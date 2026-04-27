// Polar checkout session creator
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POLAR_API = "https://api.polar.sh/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const POLAR_TOKEN = Deno.env.get("POLAR_ACCESS_TOKEN");
    if (!POLAR_TOKEN) throw new Error("POLAR_ACCESS_TOKEN not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const { product_id, plan = "starter", success_url } = body;
    if (!product_id) return json({ error: "product_id required" }, 400);

    const origin = req.headers.get("origin") || "https://megsyai.com";
    const successUrl = success_url || `${origin}/billing/success?checkout_id={CHECKOUT_ID}`;

    const polarRes = await fetch(`${POLAR_API}/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POLAR_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [product_id],
        success_url: successUrl,
        external_customer_id: user.id,
        customer_email: user.email,
        metadata: { user_id: user.id, plan },
      }),
    });

    if (!polarRes.ok) {
      const errText = await polarRes.text();
      console.error("Polar checkout error:", polarRes.status, errText);
      return json({ error: "Failed to create checkout", details: errText }, 502);
    }

    const checkout = await polarRes.json();
    return json({ url: checkout.url, id: checkout.id });
  } catch (e: any) {
    console.error("polar-checkout error:", e);
    return json({ error: e.message || "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
