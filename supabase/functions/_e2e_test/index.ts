import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function invoke(name: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let data: unknown = null;
  try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: r.status, ok: r.ok, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const results: Array<{ test: string; passed: boolean; detail?: string }> = [];

  // 1) Schema generation for every file type
  const fileTypes = ["document", "resume", "report", "spreadsheet", "letter", "roadmap", "mindmap", "timeline"];
  for (const ft of fileTypes) {
    const r = await invoke("generate-builder-schema", { fileType: ft, topic: `Test ${ft} about renewable energy`, userLanguage: "en" });
    const ok = r.ok && (r.data as { success?: boolean; schema?: unknown })?.success === true && !!(r.data as { schema?: unknown }).schema;
    results.push({ test: `schema:${ft}`, passed: ok, detail: ok ? undefined : `status=${r.status} body=${JSON.stringify(r.data).slice(0, 200)}` });
  }

  // 2) Smart questions
  {
    const r = await invoke("generate-file-questions", { fileType: "document", topic: "AI in healthcare", userLanguage: "en" });
    const qs = (r.data as { questions?: unknown[] })?.questions ?? [];
    results.push({ test: "questions:document", passed: Array.isArray(qs) && qs.length >= 3, detail: `count=${Array.isArray(qs) ? qs.length : "n/a"}` });
  }

  // 3) Brief
  {
    const r = await invoke("generate-file-brief", { fileType: "slides", topic: "Quantum computing basics", pageCount: 8, userLanguage: "en" });
    const ok = r.ok && (r.data as { success?: boolean })?.success === true;
    results.push({ test: "brief:slides", passed: ok, detail: ok ? undefined : `status=${r.status}` });
  }

  // 4) Slides for one template
  {
    const r = await invoke("generate-slides", {
      topic: "The future of solar energy",
      content: "",
      templateId: "premium-glass-pitch",
      pageCount: 6,
    });
    const data = r.data as { success?: boolean; deck?: { slides?: unknown[] }; slide_count?: number };
    const slides = data?.deck?.slides ?? [];
    const filled = (slides as Array<{ body?: string; bullets?: unknown[] }>).filter(s =>
      (typeof s.body === "string" && s.body.length > 30) || (Array.isArray(s.bullets) && s.bullets.length >= 2)
    ).length;
    const ok = r.ok && data?.success === true && slides.length >= 5 && filled / Math.max(1, slides.length) >= 0.5;
    results.push({ test: "slides:glass-pitch", passed: ok, detail: `count=${slides.length} filled=${filled}` });
  }

  const passed = results.filter(r => r.passed).length;
  return new Response(JSON.stringify({
    summary: `${passed}/${results.length} passed`,
    passed,
    total: results.length,
    results,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
