import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://2slides.com";

// All 25 React-rendered templates handled in-app.
const REACT_TEMPLATES = new Set([
  "premium-aurora-keynote", "premium-editorial-noir", "premium-neo-brutalist",
  "premium-glass-pitch", "premium-cairo-modern", "premium-sketch-hand",
  "premium-cinema-3d", "premium-ios-glass", "premium-terminal-dev",
  "premium-magazine-fold", "premium-neon-cyber", "premium-paper-origami",
  "premium-minimal-swiss", "premium-gradient-wave", "premium-dark-luxe",
  "premium-kids-playful", "premium-corporate-navy", "premium-nature-organic",
  "premium-glitch-art", "premium-isometric-tech", "premium-watercolor-soft",
  "premium-retro-arcade", "premium-scientific-paper", "premium-pitch-yc",
  "premium-arabesque-gold",
]);

const PALETTES: Record<string, { primary: string; accent: string; bg: string; fg: string }> = {
  "premium-aurora-keynote":   { primary: "#8b5cf6", accent: "#22d3ee", bg: "#070417", fg: "#f5f3ff" },
  "premium-editorial-noir":   { primary: "#0a0a0a", accent: "#c9a55c", bg: "#f5f1e8", fg: "#0a0a0a" },
  "premium-neo-brutalist":    { primary: "#ff3d00", accent: "#ffea00", bg: "#fff5e1", fg: "#0a0a0a" },
  "premium-glass-pitch":      { primary: "#3b82f6", accent: "#a855f7", bg: "#070b1f", fg: "#f8fafc" },
  "premium-cairo-modern":     { primary: "#0f3057", accent: "#d4af37", bg: "#fffdf3", fg: "#0a1929" },
  "premium-sketch-hand":      { primary: "#1f2937", accent: "#ef4444", bg: "#fdf6e3", fg: "#1f2937" },
  "premium-cinema-3d":        { primary: "#06b6d4", accent: "#f43f5e", bg: "#000814", fg: "#ffffff" },
  "premium-ios-glass":        { primary: "#0a84ff", accent: "#ff375f", bg: "#0b1020", fg: "#ffffff" },
  "premium-terminal-dev":     { primary: "#00ff9c", accent: "#00b3ff", bg: "#0a0e14", fg: "#cdd9e5" },
  "premium-magazine-fold":    { primary: "#dc2626", accent: "#0a0a0a", bg: "#fafaf7", fg: "#0a0a0a" },
  "premium-neon-cyber":       { primary: "#ff0080", accent: "#00f0ff", bg: "#05010d", fg: "#ffe9ff" },
  "premium-paper-origami":    { primary: "#fb7185", accent: "#fbbf24", bg: "#fef3ec", fg: "#1f1147" },
  "premium-minimal-swiss":    { primary: "#dc143c", accent: "#000000", bg: "#ffffff", fg: "#000000" },
  "premium-gradient-wave":    { primary: "#f97316", accent: "#a855f7", bg: "#1e0a3c", fg: "#ffffff" },
  "premium-dark-luxe":        { primary: "#d4af37", accent: "#9ca3af", bg: "#0a0a0a", fg: "#f5e9c8" },
  "premium-kids-playful":     { primary: "#fb923c", accent: "#22d3ee", bg: "#fff8e7", fg: "#1e3a8a" },
  "premium-corporate-navy":   { primary: "#1e3a8a", accent: "#0ea5e9", bg: "#f8fafc", fg: "#0a1929" },
  "premium-nature-organic":   { primary: "#15803d", accent: "#a3e635", bg: "#f7f6ee", fg: "#14532d" },
  "premium-glitch-art":       { primary: "#ff006e", accent: "#3a86ff", bg: "#0a0a0a", fg: "#fbbf24" },
  "premium-isometric-tech":   { primary: "#7c3aed", accent: "#06b6d4", bg: "#0f172a", fg: "#e0e7ff" },
  "premium-watercolor-soft":  { primary: "#fb7185", accent: "#67e8f9", bg: "#fff8f8", fg: "#4a044e" },
  "premium-retro-arcade":     { primary: "#ff006e", accent: "#ffbe0b", bg: "#1a0033", fg: "#ffffff" },
  "premium-scientific-paper": { primary: "#1e40af", accent: "#dc2626", bg: "#ffffff", fg: "#0f172a" },
  "premium-pitch-yc":         { primary: "#ff6600", accent: "#000000", bg: "#ffffff", fg: "#0a0a0a" },
  "premium-arabesque-gold":   { primary: "#b45309", accent: "#d4af37", bg: "#1a0f0a", fg: "#fef3c7" },
};

async function fetchPexelsImage(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query.slice(0, 100));
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    const r = await fetch(url.toString(), { headers: { Authorization: apiKey } });
    if (!r.ok) return null;
    const d = await r.json();
    const photo = d?.photos?.[0];
    return photo?.src?.large2x || photo?.src?.large || photo?.src?.original || null;
  } catch { return null; }
}

async function generateReactSlideDeck(opts: {
  topic: string;
  content: string;
  templateId: string;
  pageCount: number; // 0 means "let AI decide"
  apiKey: string;
}) {
  const { topic, content, templateId, pageCount, apiKey } = opts;
  const palette = PALETTES[templateId] ?? PALETTES["premium-aurora-keynote"];
  const isCairo = templateId === "premium-cairo-modern" || templateId === "premium-arabesque-gold";

  const lengthRule = pageCount > 0
    ? `Produce EXACTLY ${pageCount} slides.`
    : `YOU decide the optimal slide count based on topic depth: 8 slides for simple topics, 12-15 for standard, 18-25 for deep/complex. Never fewer than 6 nor more than 30.`;

  const sys = `You are a world-class presentation designer. Output ONLY a JSON object — no markdown, no fences.

Schema:
{
  "title": "deck title",
  "subtitle": "short subtitle",
  "language": "ar|en|...",
  "slides": [
    {"type":"cover","title":"...","subtitle":"...","author":"...","image_query":"2-4 english keywords"},
    {"type":"section","title":"section name","kicker":"01","image_query":"keywords"},
    {"type":"content","title":"slide title","bullets":["...","..."],"body":"optional paragraph","image_query":"english keywords"},
    {"type":"quote","quote":"...","attribution":"..."},
    {"type":"stats","title":"...","stats":[{"label":"...","value":"42%"}]},
    {"type":"closing","title":"Thank You","subtitle":"...","cta":"..."}
  ]
}

Rules:
- ${lengthRule}
- First slide MUST be type "cover". Last slide MUST be type "closing".
- Mix types richly. Use "section" every 4-6 slides for chapter breaks. Include at least 1 "stats" slide and 1 "quote" slide if length >= 10.
- Each "content" slide: 3-6 concise bullets (max 12 words each) AND a body paragraph of 1-2 sentences for richer context.
- ALWAYS include "image_query" (2-4 ENGLISH keywords) for cover, section, and EVERY content slide. Skip only for quote/stats/closing.
- "image_query" must always be in English (Pexels indexes English best). Be specific and visual ("modern office workspace", not "office").
- Detect language from topic and mirror it in title/subtitle/bullets/body. ${isCairo ? "Strongly prefer Arabic." : ""}
- Be specific, factual, and concise. No filler, no generic platitudes.
- Stats values are bold and short ("87%", "$2.4M", "12x").`;

  const userMsg = `Topic: ${topic}\n${content ? `Reference material:\n${content.slice(0, 4000)}` : ""}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`AI deck failed: ${resp.status}`);
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  let deck: any = {};
  try { deck = JSON.parse(raw); } catch { deck = { title: topic, slides: [] }; }
  deck.templateId = templateId;
  deck.palette = palette;
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    deck.slides = [{ type: "cover", title: topic }, { type: "closing", title: "Thank You" }];
  }

  // Inject Pexels images in parallel.
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (pexelsKey) {
    const tasks = deck.slides.map(async (slide: any) => {
      if (slide?.image_query && !slide.image) {
        const url = await fetchPexelsImage(slide.image_query, pexelsKey);
        if (url) slide.image = url;
      }
    });
    await Promise.all(tasks);
  }

  return deck;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, content, templateId, tier, userId, pageCount } = await req.json();
    if (!topic) throw new Error("Topic is required");

    // 0 / null / undefined => let AI decide. Cap to a sane window otherwise.
    let pages = 0;
    if (typeof pageCount === "number" && Number.isFinite(pageCount) && pageCount > 0) {
      pages = Math.max(0, Math.min(60, Math.floor(pageCount)));
    }

    if (templateId && REACT_TEMPLATES.has(templateId)) {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ success: false, fallback: true, error: "AI not configured." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const deck = await generateReactSlideDeck({
          topic, content: content || "", templateId,
          pageCount: pages, apiKey,
        });

        if (userId) {
          try {
            const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
            await sb.rpc("deduct_credits", { p_user_id: userId, p_amount: 2, p_action_type: "slides_premium", p_description: "Premium React slides" });
          } catch (e) { console.error("Credit deduction failed:", e); }
        }

        return new Response(JSON.stringify({
          success: true,
          engine: "react-native",
          deck,
          slide_count: deck.slides?.length ?? 0,
          title: deck.title || topic,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("react-native deck error:", e);
        return new Response(JSON.stringify({ success: false, fallback: true, error: "Premium deck generation failed." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // -------- Legacy 2Slides path --------
    const apiKey = Deno.env.get("TWOSLIDES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false, fallback: true, error: "Slides service not configured.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isPro = tier === "pro";
    const authHeaders = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };

    if (isPro) {
      const body: Record<string, any> = {
        userInput: content || topic,
        responseLanguage: "Auto",
        aspectRatio: "16:9",
        resolution: "2K",
        page: pages,
        contentDetail: "standard",
        referenceImageUrl: "https://2slides.com/_next/image?url=/login_preview/st-1763716811881-gt30ikwgk_slide1.webp&w=640&q=75",
      };

      const resp = await fetch(`${BASE_URL}/api/v1/slides/create-like-this`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });
      if (!resp.ok) {
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
          } catch {}
        }
        return new Response(JSON.stringify({ success: true, download_url: downloadUrl, slide_count: slideCount, title: topic }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, fallback: true, error: "Pro generation failed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const body: Record<string, any> = { userInput: content || topic, responseLanguage: "Auto", mode: "sync" };
      if (templateId) body.themeId = templateId;
      if (pages > 0) body.page = pages;

      const resp = await fetch(`${BASE_URL}/api/v1/slides/generate`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });
      if (!resp.ok) {
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

      if (data?.success && jobId && !downloadUrl) {
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
