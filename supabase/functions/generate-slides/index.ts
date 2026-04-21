import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://2slides.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, content, templateId, tier, userId, pageCount } = await req.json();
    if (!topic) throw new Error("Topic is required");

    // Clamp pageCount: 1..60. 0 means auto-detect.
    let pages = 0;
    if (typeof pageCount === "number" && Number.isFinite(pageCount)) {
      pages = Math.max(0, Math.min(60, Math.floor(pageCount)));
    }

    const apiKey = Deno.env.get("TWOSLIDES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false, fallback: true, error: "Slides service not configured.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isPro = tier === "pro";
    console.log("generate-slides:", JSON.stringify({ topic: topic.slice(0, 50), templateId, isPro, pages }));

    const authHeaders = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (isPro) {
      const body: Record<string, any> = {
        userInput: content || topic,
        responseLanguage: "Auto",
        aspectRatio: "16:9",
        resolution: "2K",
        page: pages, // 0 = auto-detect, 1..60 explicit
        contentDetail: "standard",
      };
      body.referenceImageUrl = "https://2slides.com/_next/image?url=/login_preview/st-1763716811881-gt30ikwgk_slide1.webp&w=640&q=75";

      const resp = await fetch(`${BASE_URL}/api/v1/slides/create-like-this`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error("slides pro error:", resp.status);
        return new Response(JSON.stringify({ success: false, fallback: true, error: "Pro slide generation failed." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await resp.json();
      const downloadUrl = data?.data?.downloadUrl || data?.downloadUrl;
      const slideCount = data?.data?.slidePageCount || data?.data?.successCount || pages || 10;

      if (data?.success && downloadUrl) {
        if (userId) {
          try {
            const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
            await sb.rpc("deduct_credits", { p_user_id: userId, p_amount: 2, p_action_type: "slides_pro", p_description: "Slides Pro generation" });
          } catch (e) { console.error("Credit deduction failed:", e); }
        }
        return new Response(JSON.stringify({ success: true, download_url: downloadUrl, slide_count: slideCount, title: topic }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: false, fallback: true, error: data?.data?.message || "Pro generation failed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      // Fast PPT
      const body: Record<string, any> = {
        userInput: content || topic,
        responseLanguage: "Auto",
        mode: "sync",
      };
      if (templateId) body.themeId = templateId;
      if (pages > 0) body.page = pages;

      const resp = await fetch(`${BASE_URL}/api/v1/slides/generate`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });

      if (!resp.ok) {
        console.error("slides normal error:", resp.status);
        return new Response(JSON.stringify({ success: false, fallback: true, error: "Slide generation failed." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await resp.json();
      const downloadUrl = data?.data?.downloadUrl || data?.downloadUrl;
      const slideCount = data?.data?.slidePageCount || pages || 10;
      const jobId = data?.data?.jobId;

      if (data?.success && downloadUrl) {
        return new Response(JSON.stringify({ success: true, download_url: downloadUrl, slide_count: slideCount, title: topic }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Poll if async
      if (data?.success && jobId && !downloadUrl) {
        // Longer polling window for big decks (up to ~5 minutes total)
        const maxPolls = pages > 30 ? 20 : 12;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 15000));
          try {
            const jobResp = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, { headers: authHeaders });
            if (!jobResp.ok) continue;
            const jobData = await jobResp.json();
            const jd = jobData?.data || jobData;
            if (jd.status === "success") {
              return new Response(JSON.stringify({ success: true, download_url: jd.downloadUrl, slide_count: jd.slidePageCount || slideCount, title: topic }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            if (jd.status === "failed") break;
          } catch {}
        }
      }

      return new Response(JSON.stringify({ success: false, fallback: true, error: "Slide generation did not return a download." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (e) {
    console.error("generate-slides error:", e);
    return new Response(JSON.stringify({ success: false, fallback: true, error: "Presentation generation failed." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
