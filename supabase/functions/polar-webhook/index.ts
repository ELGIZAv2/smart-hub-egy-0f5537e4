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
        if (userId) {
          // Add credits or extend subscription on successful payment
          await supabase.from("payment_events").insert({
            user_id: userId,
            event_type: "order.paid.processed",
            payload: { amount: data.amount, currency: data.currency },
          });
        }
        break;
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
