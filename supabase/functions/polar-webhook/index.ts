// Polar webhook handler — receives subscription/checkout/order events
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("POLAR_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook secret not configured", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  let payload: any;
  try {
    // Polar provides plain secret; Standard Webhooks expects base64
    const base64Secret = btoa(secret);
    const wh = new Webhook(base64Secret);
    payload = wh.verify(rawBody, headers);
  } catch (e: any) {
    console.error("Webhook signature verification failed:", e.message);
    return new Response("Invalid signature", { status: 401 });
  }

  const eventType = payload.type as string;
  const data = payload.data ?? {};
  const userId =
    data.metadata?.user_id ||
    data.customer?.external_id ||
    data.subscription?.customer?.external_id ||
    data.subscription?.metadata?.user_id ||
    null;

  // Map product_id -> { plan, credits, interval }
  const PRODUCT_MAP: Record<string, { plan: string; credits: number }> = {
    "57ebadf5-ae24-4814-a80c-d39c288b68aa": { plan: "starter", credits: 1000 },     // Starter monthly
    "eea9ef87-f733-448a-9554-d37d88dec986": { plan: "starter", credits: 12000 },    // Starter yearly
    "6776d8ca-2027-4893-b419-07ed28796f45": { plan: "pro", credits: 3500 },         // Pro monthly
    "bd50728b-1c57-40c3-ad6a-4962cbf38849": { plan: "pro", credits: 42000 },        // Pro yearly
    "af5a7adb-2713-4fb2-bd07-aad91ec0dd9f": { plan: "elite", credits: 6500 },       // Elite monthly
    "f2889c5d-b180-4041-a908-5f3ef568b56d": { plan: "elite", credits: 78000 },      // Elite yearly
  };

  const extractProductId = (d: any): string | null =>
    d.product_id ||
    d.product?.id ||
    d.products?.[0]?.id ||
    d.subscription?.product_id ||
    d.subscription?.product?.id ||
    d.items?.[0]?.product_id ||
    d.items?.[0]?.product?.id ||
    null;

  // Log event
  await supabase.from("payment_events").insert({
    user_id: userId,
    event_type: eventType,
    polar_event_id: data.id || null,
    payload: payload,
  });

  try {
    switch (eventType) {
      case "checkout.updated":
      case "checkout.created":
        if (data.status === "succeeded" && userId) {
          await activateSubscription(supabase, userId, data, "starter");
        }
        break;

      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
        if (userId) {
          await upsertSubscription(supabase, userId, data, "active");
        }
        break;

      case "subscription.canceled":
      case "subscription.revoked":
        if (userId) {
          await upsertSubscription(supabase, userId, data, "canceled");
          // Downgrade plan
          await supabase
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", userId);
        }
        break;

      case "order.paid":
      case "order.created": {
        if (!userId) break;

        const productId = extractProductId(data);
        const mapping = productId ? PRODUCT_MAP[productId] : null;

        // Idempotency: skip if this order already credited
        const orderId = data.id || data.order_id;
        if (orderId) {
          const { data: existing } = await supabase
            .from("payment_events")
            .select("id")
            .eq("event_type", "order.credits.added")
            .eq("polar_event_id", orderId)
            .maybeSingle();
          if (existing) break;
        }

        if (mapping) {
          // Add credits via RPC
          const { error: credErr } = await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: mapping.credits,
            p_description: `Subscription: ${mapping.plan} (Polar order ${orderId || "n/a"})`,
          });
          if (credErr) console.error("add_credits failed:", credErr);

          // Update plan
          await supabase.from("profiles").update({ plan: mapping.plan }).eq("id", userId);

          // Log idempotency marker
          await supabase.from("payment_events").insert({
            user_id: userId,
            event_type: "order.credits.added",
            polar_event_id: orderId || null,
            payload: { product_id: productId, plan: mapping.plan, credits: mapping.credits },
          });
        } else {
          console.warn("order.paid: no PRODUCT_MAP entry for product_id:", productId);
          await supabase.from("payment_events").insert({
            user_id: userId,
            event_type: "order.paid.processed",
            payload: { amount: data.amount, currency: data.currency, product_id: productId, unmapped: true },
          });
        }
        break;
      }
    }
  } catch (e: any) {
    console.error("Webhook processing error:", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function activateSubscription(supabase: any, userId: string, data: any, plan: string) {
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_customer_id: data.customer_id || data.customer?.id || null,
      polar_subscription_id: data.subscription_id || data.id,
      polar_product_id: data.product_id || data.products?.[0]?.id || null,
      plan,
      status: "active",
      amount_cents: data.amount || null,
      currency: data.currency || "usd",
    },
    { onConflict: "polar_subscription_id" }
  );
  await supabase.from("profiles").update({ plan }).eq("id", userId);
}

async function upsertSubscription(supabase: any, userId: string, data: any, status: string) {
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      polar_customer_id: data.customer_id || data.customer?.id || null,
      polar_subscription_id: data.id,
      polar_product_id: data.product_id || data.product?.id || null,
      plan: data.metadata?.plan || "starter",
      status,
      current_period_end: data.current_period_end || null,
      amount_cents: data.amount || data.recurring_interval_amount || null,
      currency: data.currency || "usd",
    },
    { onConflict: "polar_subscription_id" }
  );
  if (status === "active") {
    await supabase
      .from("profiles")
      .update({ plan: data.metadata?.plan || "starter" })
      .eq("id", userId);
  }
}
