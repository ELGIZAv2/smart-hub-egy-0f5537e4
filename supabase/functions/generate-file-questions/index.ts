import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You generate 3-5 short clarifying questions to help create a professional file for the user.
Return ONLY JSON: {"questions":[{"title":"<short question>","options":["opt1","opt2","opt3","opt4"],"allowText":true}]}
Rules:
- Detect the user's language from the topic and write the questions and options in THAT language exactly.
- Each "title" is one short, friendly sentence (max 12 words).
- Each "options" array has 3-4 concrete choices (max 5 words each).
- Always set allowText: true so the user can type a custom answer.
- Tailor questions to file type (resume → role/experience/highlights; document → audience/tone/length; report → KPIs/period/audience; spreadsheet → columns/use case; letter → tone/recipient/purpose; roadmap → horizon/team size; mindmap → depth/center idea; timeline → range/granularity; slides → audience/tone/structure).
- IMPORTANT: vary your angle every call. Do NOT ask the same questions twice for the same topic.
- Never wrap with markdown fences.`;

/* Multi-provider helper */
type AIProvider = { name: string; key: string | undefined; url: string; modelPrefix: string; supportsJsonMode: boolean };
function providers(): AIProvider[] {
  return [
    { name: "lovable",    key: Deno.env.get("LOVABLE_API_KEY"),    url: "https://ai.gateway.lovable.dev/v1/chat/completions", modelPrefix: "google/", supportsJsonMode: true },
    { name: "openrouter", key: Deno.env.get("OPENROUTER_API_KEY"), url: "https://openrouter.ai/api/v1/chat/completions",       modelPrefix: "google/", supportsJsonMode: true },
    { name: "lemondata",  key: Deno.env.get("DEAPI_API_KEY"),      url: "https://api.lemondata.ai/v1/chat/completions",        modelPrefix: "",        supportsJsonMode: false },
  ];
}
async function callAIWithFallback(messages: Array<{ role: string; content: string }>, opts: { model?: string; jsonMode?: boolean; temperature?: number } = {}): Promise<string> {
  const model = opts.model ?? "gemini-2.5-flash-lite";
  let lastErr = "no provider";
  for (const p of providers()) {
    if (!p.key) continue;
    try {
      const finalMessages = opts.jsonMode && !p.supportsJsonMode
        ? [...messages.slice(0, 1), { role: "system", content: "Return raw JSON only." }, ...messages.slice(1)]
        : messages;
      const body: Record<string, unknown> = { model: `${p.modelPrefix}${model}`, messages: finalMessages };
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      if (opts.jsonMode && p.supportsJsonMode) body.response_format = { type: "json_object" };
      const r = await fetch(p.url, { method: "POST", headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        const d = await r.json();
        const c = d?.choices?.[0]?.message?.content;
        if (c) { console.log(`[ai] ✓ ${p.name}`); return c; }
      }
      const txt = await r.text().catch(() => "");
      console.warn(`[ai] ✗ ${p.name} ${r.status}: ${txt.slice(0, 160)}`);
      lastErr = `${p.name}:${r.status}`;
    } catch (e) {
      console.warn(`[ai] ✗ ${p.name} threw:`, e);
      lastErr = `${p.name}:exc`;
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
    const { fileType, topic, userLanguage, seed, avoidQuestions } = await req.json();
    if (!fileType || !topic) {
      return new Response(JSON.stringify({ success: false, error: "fileType and topic required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const langHint = userLanguage ? `Write everything in this language: ${userLanguage}.` : `Mirror the language of the topic.`;
    const variationSeed = typeof seed === "number" ? seed : Date.now();
    const avoidList = Array.isArray(avoidQuestions) && avoidQuestions.length
      ? `\n\nDo NOT repeat or paraphrase any of these previous questions:\n${avoidQuestions.slice(0, 8).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}\nAsk about completely different angles instead.`
      : "";

    let raw = "";
    try {
      raw = await callAIWithFallback(
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: `File type: ${fileType}\nTopic: ${topic}\n${langHint}\nVariation seed: ${variationSeed} — produce a fresh angle different from previous runs.${avoidList}` },
        ],
        { model: "gemini-2.5-flash-lite", jsonMode: true, temperature: 0.95 },
      );
    } catch (e) {
      console.error("[file-questions] all providers failed:", e);
      return new Response(JSON.stringify({ success: true, questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = safeParseJson<{ questions?: unknown[] }>(raw) ?? { questions: [] };
    return new Response(JSON.stringify({ success: true, questions: parsed.questions ?? [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-file-questions error", e);
    return new Response(JSON.stringify({ success: true, questions: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
