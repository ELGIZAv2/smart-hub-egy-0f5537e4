import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://2slides.com";

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

/* --------------- Pexels integration with smart fallback --------------- */
async function fetchPexelsImage(query: string, apiKey: string): Promise<string | null> {
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query.slice(0, 100));
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    const r = await fetch(url.toString(), { headers: { Authorization: apiKey } });
    if (!r.ok) {
      console.warn("[pexels] http", r.status, "for", query);
      return null;
    }
    const d = await r.json();
    const photo = d?.photos?.[0];
    return photo?.src?.large2x || photo?.src?.large || photo?.src?.original || null;
  } catch (e) {
    console.warn("[pexels] error", e);
    return null;
  }
}

async function resolveImage(query: string | undefined, apiKey: string | undefined): Promise<string | null> {
  if (!apiKey || !query) return null;
  const cleaned = sanitizeQueryForPexels(query);
  // Try full query
  let url = await fetchPexelsImage(cleaned, apiKey);
  if (url) return url;
  // Fallback: first 2 words
  const short = cleaned.split(/\s+/).slice(0, 2).join(" ");
  if (short && short !== cleaned) {
    url = await fetchPexelsImage(short, apiKey);
    if (url) return url;
  }
  // Final fallback: very generic word
  const first = cleaned.split(/\s+/)[0];
  if (first) {
    url = await fetchPexelsImage(first, apiKey);
    if (url) return url;
  }
  console.warn("[pexels] no result for", query);
  return null;
}

function sanitizeQueryForPexels(q: string): string {
  // Strip non-latin chars; collapse whitespace.
  return q.replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
          .replace(/[\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g, " ")
          .replace(/\s+/g, " ").trim();
}

function isMostlyEnglish(s: string): boolean {
  if (!s) return false;
  const latinChars = (s.match(/[A-Za-z]/g) || []).length;
  return latinChars >= Math.max(3, s.replace(/\s/g, "").length * 0.6);
}

/* --------------- Stage A: Outline --------------- */
async function generateOutline(opts: {
  topic: string;
  content: string;
  templateId: string;
  pageCount: number;
  apiKey: string;
}) {
  const { topic, content, templateId, pageCount, apiKey } = opts;
  const isCairo = templateId === "premium-cairo-modern" || templateId === "premium-arabesque-gold";

  const lengthRule = pageCount > 0
    ? `Produce EXACTLY ${pageCount} slide entries.`
    : `Decide the optimal slide count: 8 for simple topics, 12-15 for standard, 18-25 for deep/complex. Min 8, max 25.`;

  const sys = `You are a presentation strategist. Output ONLY a JSON object — no markdown.

Schema:
{
  "title": "deck title (in user language)",
  "subtitle": "short subtitle",
  "language": "ar|en|fr|...",
  "slides": [
    {"type":"cover","title":"...","subtitle":"...","image_query":"3-5 ENGLISH visual keywords"},
    {"type":"section","title":"section name","kicker":"01","image_query":"english keywords"},
    {"type":"content","title":"slide title","image_query":"english keywords","focus":"1 sentence describing what this slide will explore in depth"},
    {"type":"quote","focus":"who and on which sub-topic"},
    {"type":"stats","title":"...","focus":"what kind of stats: percentages / growth / costs"},
    {"type":"closing","title":"Thank You","subtitle":"...","cta":"..."}
  ]
}

Rules:
- ${lengthRule}
- First slide MUST be "cover", last MUST be "closing".
- Mix types: insert a "section" every 4-6 slides; include >=1 "stats" and >=1 "quote" slide if length >= 10.
- "image_query" MUST be 3-5 visual ENGLISH keywords (e.g. "modern glass office skyline aerial"). NO arabic, NO chinese, NO punctuation other than spaces.
- "focus" is a brief instruction for the next stage — what the deep-content writer should expand. Be specific about the angle.
- Detect language from topic and put title/subtitle in THAT language. ${isCairo ? "Strongly prefer Arabic for title/subtitle." : ""}`;

  const userMsg = `Topic: ${topic}\n${content ? `Reference material:\n${content.slice(0, 6000)}` : ""}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`Outline failed: ${resp.status}`);
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  let outline: any = {};
  try { outline = JSON.parse(raw); } catch { outline = { title: topic, slides: [] }; }
  if (!Array.isArray(outline.slides) || outline.slides.length === 0) {
    outline.slides = [{ type: "cover", title: topic }, { type: "closing", title: "Thank You" }];
  }
  return outline;
}

/* --------------- Stage B: Deep Content --------------- */
async function expandWithDeepContent(opts: {
  outline: any;
  topic: string;
  content: string;
  templateId: string;
  apiKey: string;
}) {
  const { outline, topic, content, templateId, apiKey } = opts;
  const isCairo = templateId === "premium-cairo-modern" || templateId === "premium-arabesque-gold";
  const language = outline.language || "auto";

  const sys = `You are a senior research writer creating a presentation. Output ONLY a JSON object — no markdown.

You are given an OUTLINE and you must EXPAND every slide with rich, factual content.

For each slide, return the same fields PLUS:
- "title": polished slide title (keep or improve outline title) in the same language as outline
- "body": REQUIRED for content/section slides — a substantive paragraph of 50-110 words explaining the point with specific facts, context, and insight. Never empty, never a single sentence.
- "bullets": REQUIRED for content slides — 4-6 bullets, each 6-15 words, concrete and informative (NOT 2-word fragments, NOT generic "Improves efficiency").
- "stats": REQUIRED for stats slides — array of 3-5 {label, value} where value is bold and short ("87%", "$2.4M", "12x growth").
- "quote": REQUIRED for quote slides — 15-30 word memorable quote tied to the topic.
- "attribution": REQUIRED for quote slides — plausible person + role.
- Keep "image_query" exactly as outline gives it (English).
- Keep "type", "kicker", "subtitle", "cta" as outline gives them.

Hard rules:
- Output language = ${language}. ${isCairo ? "Strongly prefer Arabic." : ""}
- Use the reference material as ground truth; if material is sparse, expand with widely-known facts about the topic.
- NEVER produce empty body or empty bullets.
- NEVER write filler like "More info coming" or "TBD" or "Lorem ipsum".
- Be specific: name people, products, dates, numbers, places when possible.

Return JSON: { "slides": [ {full slide object}, ... ] } in the SAME ORDER as outline.`;

  const userMsg = `Topic: ${topic}
Outline (expand each slide deeply):
${JSON.stringify({ slides: outline.slides }, null, 2)}

${content ? `Reference material:\n${content.slice(0, 8000)}` : ""}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    console.warn("[deep-content] failed", resp.status, await resp.text().catch(() => ""));
    return outline.slides;
  }
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      // Merge: take outline slide and override with deep version (preserve image_query if missing)
      return outline.slides.map((o: any, i: number) => {
        const deep = parsed.slides[i] || {};
        return { ...o, ...deep, image_query: deep.image_query || o.image_query };
      });
    }
  } catch (e) {
    console.warn("[deep-content] parse error", e);
  }
  return outline.slides;
}

/* --------------- English image-query enforcement --------------- */
async function ensureEnglishQueries(slides: any[], apiKey: string): Promise<void> {
  const offenders: { idx: number; q: string }[] = [];
  slides.forEach((s, idx) => {
    if (s?.image_query && !isMostlyEnglish(s.image_query)) {
      offenders.push({ idx, q: s.image_query });
    }
  });
  if (offenders.length === 0) return;

  console.log("[image-query] translating", offenders.length, "non-english queries");

  const sys = `You translate short phrases into 3-5 visual ENGLISH keywords for stock-photo search. Output ONLY JSON: {"translations":[{"i":0,"q":"english keywords"}]}. No fluff, just visual nouns and adjectives.`;
  const userMsg = `Translate each:\n${offenders.map((o, i) => `${i}. ${o.q}`).join("\n")}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.translations)) {
      parsed.translations.forEach((t: any) => {
        const slot = offenders[t.i];
        if (slot && t.q) slides[slot.idx].image_query = t.q;
      });
    }
  } catch (e) {
    console.warn("[image-query] translation failed", e);
  }
}

/* --------------- Main two-stage builder --------------- */
async function generateReactSlideDeck(opts: {
  topic: string;
  content: string;
  templateId: string;
  pageCount: number;
  apiKey: string;
}) {
  const { topic, content, templateId, pageCount, apiKey } = opts;
  const palette = PALETTES[templateId] ?? PALETTES["premium-aurora-keynote"];

  const outline = await generateOutline({ topic, content, templateId, pageCount, apiKey });
  const deepSlides = await expandWithDeepContent({ outline, topic, content, templateId, apiKey });
  await ensureEnglishQueries(deepSlides, apiKey);

  const deck: any = {
    title: outline.title || topic,
    subtitle: outline.subtitle,
    language: outline.language,
    templateId,
    palette,
    slides: deepSlides,
  };

  // Inject Pexels images with fallback in parallel.
  const pexelsKey = Deno.env.get("PEXELS_API_KEY");
  if (pexelsKey) {
    await Promise.all(deck.slides.map(async (slide: any) => {
      if (slide?.image_query && !slide.image) {
        const url = await resolveImage(slide.image_query, pexelsKey);
        if (url) slide.image = url;
      }
    }));
  }

  return deck;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, content, templateId, tier, userId, pageCount } = await req.json();
    if (!topic) throw new Error("Topic is required");

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
