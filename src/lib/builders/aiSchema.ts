import { supabase } from "@/integrations/supabase/client";
import type { FileBuilderType, AnyBuilderSchema } from "./types";

const SYSTEM_BY_TYPE: Record<FileBuilderType, string> = {
  document: `Return ONLY JSON: {"title":"...","subtitle":"...","sections":[{"heading":"...","body":"..."}, ...],"language":"...","hero_image_query":"keyword"}. 4-8 sections, body 80-200 words each. No markdown.`,
  resume: `Return ONLY JSON: {"name":"...","headline":"...","contact":{"email":"...","phone":"...","location":"...","website":"..."},"summary":"...","experience":[{"role":"...","company":"...","period":"...","bullets":["...","..."]}],"education":[{"degree":"...","school":"...","period":"..."}],"skills":["..."],"languages":["..."],"language":"..."}. Use any data the user shared. Invent only neutral placeholders if missing.`,
  report: `Return ONLY JSON: {"title":"...","executive_summary":"...","kpis":[{"label":"...","value":"...","delta":"+12%"}],"sections":[{"heading":"...","body":"...","chart":{"type":"bar|line|pie","title":"...","data":[{"name":"Q1","value":120}]}}],"language":"..."}. Provide 2-4 KPIs and 3-6 sections; charts only when data is meaningful.`,
  spreadsheet: `Return ONLY JSON: {"sheet_name":"...","columns":["Col1","Col2",...],"rows":[[...],[...]],"totals_row":true|false,"language":"..."}. Make rows realistic. Numeric columns must contain numbers (not strings).`,
  letter: `Return ONLY JSON: {"sender":{"name":"...","address":"...","email":"..."},"recipient":{"name":"...","address":"..."},"date":"YYYY-MM-DD","subject":"...","body":"3-6 short paragraphs separated by \\n\\n","closing":"Sincerely,\\nName","language":"..."}.`,
  roadmap: `Return ONLY JSON: {"title":"...","horizon":"Q1 2026 → Q4 2026","phases":[{"name":"Phase 1","period":"Q1 2026","goal":"...","items":["...","..."]}],"language":"..."}. 3-6 phases, 3-6 items each.`,
  mindmap: `Return ONLY JSON: {"central_idea":"...","branches":[{"label":"...","children":["...","..."]}],"language":"..."}. 4-8 branches, 3-6 children each.`,
  timeline: `Return ONLY JSON: {"title":"...","orientation":"vertical","events":[{"date":"YYYY-MM-DD or year","title":"...","description":"..."}],"language":"..."}. 5-12 events sorted chronologically.`,
};

/**
 * Ask the chat edge function to produce a structured JSON for the given builder.
 * The chat function already enforces JSON output when system prompts request it.
 */
export async function generateBuilderSchema<T extends AnyBuilderSchema>(
  fileType: FileBuilderType,
  topic: string,
  context: { brief?: unknown; extraText?: string } = {}
): Promise<T | null> {
  const sys = SYSTEM_BY_TYPE[fileType];
  const userMsg = [
    `Topic: ${topic}`,
    context.brief ? `Brief outline (already approved by user, follow it):\n${JSON.stringify(context.brief)}` : null,
    context.extraText ? `Additional context:\n${context.extraText.slice(0, 4000)}` : null,
    `Detect the language from the topic and mirror it in all string fields.`,
  ].filter(Boolean).join("\n\n");

  try {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sys + "\nReturn raw JSON only. No markdown fences." },
          { role: "user", content: userMsg },
        ],
        model: "google/gemini-2.5-flash-lite-preview-09-2025",
        mode: "files",
        responseFormat: "json",
      }),
    });
    if (!resp.ok || !resp.body) return null;

    // Drain SSE to text.
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") break;
        try {
          const parsed = JSON.parse(j);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) raw += delta;
        } catch { /* ignore */ }
      }
    }

    // Try strict parse, then fall back to extracting first JSON block.
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(raw) as T;
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]) as T;
    }
    return null;
  } catch (e) {
    console.warn("generateBuilderSchema failed:", e);
    return null;
  }
}

/** Upload an arbitrary blob to the slide-presentations bucket and return its public URL. */
export async function uploadArtifact(
  blob: Blob,
  fileName: string,
  bucket: "slide-presentations" | "spreadsheets" | "books" = "slide-presentations"
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userPart = user?.id ?? "anon";
    const path = `${userPart}/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: blob.type || "application/octet-stream",
    });
    if (error) {
      console.warn("uploadArtifact error:", error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn("uploadArtifact failed:", e);
    return null;
  }
}
