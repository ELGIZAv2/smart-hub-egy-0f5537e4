// Webly proxy: forwards requests to Webly API with sane error handling and CORS.
// Routes:
//   POST /webly-proxy            -> { action: "generate" | "deploy" | "screenshot", ... }
//
// Why a proxy: keeps the upstream URL out of the client, lets us inject server-side
// helpers (e.g. take screenshot via screenshotone) and unify CORS behavior.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEBLY_BASE = "https://wxphtsgezburjqoqiqqo.supabase.co/functions/v1";

const sse = (payload: Record<string, unknown>) => `data: ${JSON.stringify(payload)}\n\n`;

const extractHtml = (text: string, prompt: string) => {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const raw = fenced || text.trim();
  if (/<!doctype html/i.test(raw) || /<html[\s>]/i.test(raw)) return raw;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Generated project</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#08090d;color:#fff;min-height:100vh;display:grid;place-items:center;padding:32px}main{max-width:880px}h1{font-size:clamp(36px,7vw,72px);line-height:1;margin:0 0 18px}p{font-size:18px;line-height:1.7;color:#d7dae2}</style></head><body><main><h1>${prompt.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c)).slice(0, 90)}</h1><p>${raw.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c)).slice(0, 1200)}</p></main></body></html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate";

    if (action === "generate") {
      if (!body.project_id || !body.prompt) {
        return new Response(JSON.stringify({ error: "Missing project_id or prompt" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Streaming pass-through
      const upstream = await fetch(`${WEBLY_BASE}/webly-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: body.project_id,
          prompt: body.prompt,
          messages: body.messages ?? [],
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text().catch(() => "");
        if (upstream.status === 404) {
          const fallback = await fetch(`${WEBLY_BASE}/webly-api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stream: false,
              messages: [
                { role: "system", content: "Generate a polished production-ready single-file website. Return only complete HTML with embedded CSS and JavaScript. No markdown." },
                { role: "user", content: body.prompt },
              ],
            }),
          });
          if (fallback.ok) {
            const data = await fallback.json().catch(() => ({}));
            const content = data?.choices?.[0]?.message?.content || data?.content || "";
            const html = extractHtml(String(content), body.prompt);
            const stream = new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                controller.enqueue(enc.encode(sse({ type: "text", delta: "Generating local preview" })));
                controller.enqueue(enc.encode(sse({ type: "file_start", path: "/index.html" })));
                controller.enqueue(enc.encode(sse({ type: "file_done", path: "/index.html", content: html })));
                controller.enqueue(enc.encode(sse({ type: "done", mode: "local", files: { "/index.html": html } })));
                controller.enqueue(enc.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
            });
          }
        }
        const status = upstream.status === 404 ? 404 : 502;
        const msg = upstream.status === 404
          ? "Project not found. Start a new build first."
          : "Build service is busy. Please retry.";
        return new Response(JSON.stringify({ error: msg, detail: t.slice(0, 200) }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (action === "deploy") {
      const r = await fetch(`${WEBLY_BASE}/webly-deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: body.project_id }),
      });
      const data = await r.json().catch(() => ({}));
      return new Response(JSON.stringify(data), {
        status: r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "screenshot") {
      // Capture preview thumbnail using ScreenshotOne and save to storage.
      const projectId = body.project_id;
      const userId = body.user_id;
      const targetUrl = body.url || `${WEBLY_BASE}/webly-site/${projectId}`;
      if (!projectId || !userId) {
        return new Response(JSON.stringify({ error: "Missing project_id or user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessKey = Deno.env.get("ScreenshotOne_Access Key");
      if (!accessKey) {
        return new Response(JSON.stringify({ error: "Screenshot service not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({
        access_key: accessKey,
        url: targetUrl,
        viewport_width: "1280",
        viewport_height: "800",
        device_scale_factor: "1",
        format: "jpg",
        image_quality: "75",
        block_ads: "true",
        block_cookie_banners: "true",
        cache: "false",
        delay: "2",
      });

      const shotResp = await fetch(`https://api.screenshotone.com/take?${params}`);
      if (!shotResp.ok) {
        return new Response(JSON.stringify({ error: "Screenshot capture failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const blob = await shotResp.arrayBuffer();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const path = `${userId}/projects/${projectId}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("user-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploadErr) {
        return new Response(JSON.stringify({ error: "Storage upload failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pub } = supabase.storage.from("user-images").getPublicUrl(path);
      const previewUrl = `${pub.publicUrl}?t=${Date.now()}`;

      await supabase.from("projects").update({ preview_url: previewUrl }).eq("id", projectId);

      return new Response(JSON.stringify({ ok: true, preview_url: previewUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Service error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
