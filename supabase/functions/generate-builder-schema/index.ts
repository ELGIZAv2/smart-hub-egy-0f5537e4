import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_BY_TYPE: Record<string, string> = {
  document: `Return ONLY JSON: {"title":"...","subtitle":"...","sections":[{"heading":"...","body":"..."}, ...],"language":"...","hero_image_query":"keyword"}. 4-8 sections, body 80-200 words each.`,
  resume: `Return ONLY JSON: {"name":"...","headline":"...","contact":{"email":"...","phone":"...","location":"...","website":"..."},"summary":"...","experience":[{"role":"...","company":"...","period":"...","bullets":["...","..."]}],"education":[{"degree":"...","school":"...","period":"..."}],"skills":["..."],"languages":["..."],"language":"..."}. Use any data the user shared. Invent only neutral placeholders if missing.`,
  report: `Return ONLY JSON: {"title":"...","executive_summary":"...","kpis":[{"label":"...","value":"...","delta":"+12%"}],"sections":[{"heading":"...","body":"...","chart":{"type":"bar|line|pie","title":"...","data":[{"name":"Q1","value":120}]}}],"language":"..."}. 2-4 KPIs and 3-6 sections.`,
  spreadsheet: `Return ONLY JSON: {"sheet_name":"...","columns":["Col1","Col2",...],"rows":[[...],[...]],"totals_row":true,"language":"..."}. 8-30 rows, realistic data, numeric columns must contain numbers.`,
  letter: `Return ONLY JSON: {"sender":{"name":"...","address":"...","email":"..."},"recipient":{"name":"...","address":"..."},"date":"YYYY-MM-DD","subject":"...","body":"3-6 short paragraphs separated by \\n\\n","closing":"Sincerely,\\nName","language":"..."}.`,
  roadmap: `Return ONLY JSON: {"title":"...","horizon":"Q1 2026 → Q4 2026","phases":[{"name":"Phase 1","period":"Q1 2026","goal":"...","items":["...","..."]}],"language":"..."}. 3-6 phases, 3-6 items each.`,
  mindmap: `Return ONLY JSON: {"central_idea":"...","branches":[{"label":"...","children":["...","..."]}],"language":"..."}. 4-8 branches, 3-6 children each.`,
  timeline: `Return ONLY JSON: {"title":"...","orientation":"vertical","events":[{"date":"YYYY-MM-DD or year","title":"...","description":"..."}],"language":"..."}. 5-12 events sorted chronologically.`,
};

/* ============================================================
 * Multi-provider AI helper (Lovable → OpenRouter → LemonData)
 * ========================================================== */
type AIProvider = { name: string; key: string | undefined; url: string; modelPrefix: string; supportsJsonMode: boolean };

function providers(): AIProvider[] {
  return [
    { name: "lovable",    key: Deno.env.get("LOVABLE_API_KEY"),    url: "https://ai.gateway.lovable.dev/v1/chat/completions", modelPrefix: "google/", supportsJsonMode: true },
    { name: "openrouter", key: Deno.env.get("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/chat/completions",       modelPrefix: "google/", supportsJsonMode: true },
    { name: "lemondata",  key: Deno.env.get("DEAPI_API_KEY"),      url: "https://api.lemondata.ai/v1/chat/completions",        modelPrefix: "",        supportsJsonMode: false },
  ];
}

async function callAIWithFallback(
  messages: Array<{ role: string; content: string }>,
  opts: { model?: string; jsonMode?: boolean } = {},
): Promise<string> {
  const model = opts.model ?? "gemini-2.5-flash-lite";
  const wantJson = !!opts.jsonMode;
  let lastErr = "no provider configured";

  for (const p of providers()) {
    if (!p.key) continue;
    try {
      const finalMessages = wantJson && !p.supportsJsonMode
        ? [...messages.slice(0, 1), { role: "system", content: "Return raw JSON only. No markdown fences." }, ...messages.slice(1)]
        : messages;
      const body: Record<string, unknown> = { model: `${p.modelPrefix}${model}`, messages: finalMessages };
      if (wantJson && p.supportsJsonMode) body.response_format = { type: "json_object" };

      const r = await fetch(p.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d?.choices?.[0]?.message?.content;
        if (c) { console.log(`[ai] ✓ ${p.name}`); return c; }
        lastErr = `${p.name}: empty`;
        continue;
      }
      const txt = await r.text().catch(() => "");
      console.warn(`[ai] ✗ ${p.name} ${r.status}: ${txt.slice(0, 200)}`);
      lastErr = `${p.name}: ${r.status}`;
    } catch (e) {
      console.warn(`[ai] ✗ ${p.name} threw:`, e);
      lastErr = `${p.name}: ${String(e).slice(0, 80)}`;
    }
  }
  throw new Error(`All AI providers failed: ${lastErr}`);
}

function safeParseJson<T = unknown>(raw: string): T | null {
  try { return JSON.parse(raw) as T; } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { /* */ } }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileType, topic, brief, userLanguage, extra } = await req.json();
    if (!fileType || !topic) {
      return new Response(JSON.stringify({ success: false, error: "fileType and topic required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sys = SYSTEM_BY_TYPE[fileType] ?? SYSTEM_BY_TYPE.document;
    const langHint = userLanguage
      ? `Write all string fields in this language: ${userLanguage}.`
      : `Detect the language from the topic and mirror it.`;
    const userMsg = [
      `Topic: ${topic}`,
      brief ? `Approved brief (follow it):\n${JSON.stringify(brief).slice(0, 2500)}` : null,
      extra ? `Extra context:\n${JSON.stringify(extra).slice(0, 1500)}` : null,
      langHint,
    ].filter(Boolean).join("\n\n");

    let raw = "";
    try {
      raw = await callAIWithFallback(
        [{ role: "system", content: sys + "\nReturn raw JSON only. No markdown fences." }, { role: "user", content: userMsg }],
        { model: "gemini-2.5-flash-lite", jsonMode: true },
      );
    } catch (e) {
      console.error("[builder-schema] all providers failed:", e);
      return new Response(JSON.stringify({ success: false, error: "Schema generation failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const schema = safeParseJson(raw);
    return new Response(JSON.stringify({ success: !!schema, schema }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-builder-schema error", e);
    return new Response(JSON.stringify({ success: false, error: "Schema generation failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
