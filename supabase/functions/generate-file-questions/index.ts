import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You generate 3-5 short clarifying questions to help create a professional file for the user.
Return ONLY JSON in this shape: {"questions":[{"title":"<short question>","options":["opt1","opt2","opt3","opt4"],"allowText":true}]}
Rules:
- Detect the user's language from the topic and write the questions and options in THAT language exactly.
- Each "title" is one short, friendly sentence (max 12 words).
- Each "options" array has 3-4 concrete choices (max 5 words each).
- Always set allowText: true so the user can type a custom answer.
- Tailor the questions to the file type (resume → role/experience/highlights; document → audience/tone/length; report → KPIs/period/audience; spreadsheet → columns/use case; letter → tone/recipient/purpose; roadmap → horizon/team size; mindmap → depth/center idea; timeline → range/granularity; slides → audience/tone/structure).
- Never wrap with markdown fences.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileType, topic, userLanguage } = await req.json();
    if (!fileType || !topic) {
      return new Response(JSON.stringify({ success: false, error: "fileType and topic required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: true, questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const langHint = userLanguage
      ? `Write everything in this language: ${userLanguage}.`
      : `Mirror the language of the topic.`;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `File type: ${fileType}\nTopic: ${topic}\n${langHint}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      console.error("questions upstream", resp.status, await resp.text());
      return new Response(JSON.stringify({ success: true, questions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { questions: [] }; }
    return new Response(JSON.stringify({ success: true, questions: parsed.questions ?? [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-file-questions error", e);
    return new Response(JSON.stringify({ success: true, questions: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
