import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPOSIO_BASE = "https://backend.composio.dev/api/v1";
const LEMONDATA_URL = "https://api.lemondata.cc/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const SHOPPY_WISE_BASE = "https://ygsoyowrumtntnlasmmh.supabase.co/functions/v1";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const COMPLEX_MODEL = "moonshotai/kimi-k2.5:nitro";
const OPENROUTER_FALLBACK_MODELS = [DEFAULT_MODEL, "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite-preview-09-2025", "google/gemini-3-flash-preview"];

function safeParseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.search(/[\{\[]/);
    const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
    if (jsonStart === -1 || jsonEnd === -1) return {};
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, ""));
    } catch {
      return {};
    }
  }
}

// ── Smart Key Cache ──
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedKey: { id: string; api_key: string } | null = null;
let cachedKeyExpiry = 0;

async function getLemonDataKey(sb: ReturnType<typeof createClient>, excludeId?: string): Promise<{ id: string; api_key: string } | null> {
  if (cachedKey && Date.now() < cachedKeyExpiry && cachedKey.id !== excludeId) return cachedKey;
  const { data } = await sb.from("lemondata_keys").select("id, api_key").eq("is_active", true).eq("is_blocked", false).limit(50);
  if (!data || data.length === 0) { cachedKey = null; return null; }
  const pool = excludeId ? data.filter((k: any) => k.id !== excludeId) : data;
  if (pool.length === 0) { cachedKey = null; return null; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  cachedKey = pick;
  cachedKeyExpiry = Date.now() + CACHE_TTL_MS;
  return pick;
}

function blockLemonKey(sb: ReturnType<typeof createClient>, keyId: string, reason: string) {
  if (cachedKey?.id === keyId) cachedKey = null;
  sb.from("lemondata_keys").update({ is_blocked: true, block_reason: reason, last_error_at: new Date().toISOString() }).eq("id", keyId).then(() => {});
}

function markKeyUsed(sb: ReturnType<typeof createClient>, keyId: string) {
  sb.from("lemondata_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId).then(() => {});
}

const serperKeyCache: { id: string; api_key: string; expiry: number } = { id: "", api_key: "", expiry: 0 };

async function getSerperKey(sb: ReturnType<typeof createClient>): Promise<string | null> {
  if (serperKeyCache.api_key && Date.now() < serperKeyCache.expiry) return serperKeyCache.api_key;
  const { data } = await sb.from("api_keys").select("id, api_key").eq("service", "serper").eq("is_active", true).limit(10);
  if (!data || data.length === 0) return Deno.env.get("SERPER_API_KEY") || null;
  const pick = data[Math.floor(Math.random() * data.length)];
  serperKeyCache.id = pick.id;
  serperKeyCache.api_key = pick.api_key;
  serperKeyCache.expiry = Date.now() + CACHE_TTL_MS;
  return pick.api_key;
}

// Hyperbrowser key cache
const hbKeyCache: { id: string; api_key: string; expiry: number } = { id: "", api_key: "", expiry: 0 };

async function getHyperbrowserKey(sb: ReturnType<typeof createClient>): Promise<string | null> {
  if (hbKeyCache.api_key && Date.now() < hbKeyCache.expiry) return hbKeyCache.api_key;
  const { data } = await sb.from("api_keys").select("id, api_key").eq("service", "hyperbrowser").eq("is_active", true).eq("is_blocked", false).limit(10);
  if (!data || data.length === 0) return null;
  const pick = data[Math.floor(Math.random() * data.length)];
  hbKeyCache.id = pick.id;
  hbKeyCache.api_key = pick.api_key;
  hbKeyCache.expiry = Date.now() + CACHE_TTL_MS;
  return pick.api_key;
}

// ── OpenRouter key ──
function getOpenRouterKey(): string | null {
  return Deno.env.get("OPENROUTER_API_KEY") || null;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type FileArtifact = { url: string; label: string; kind: string };

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>")\]]+/g) || [];
  return Array.from(new Set(matches.map((url) => url.replace(/[.,;]+$/, ""))));
}

function detectArtifactKind(url: string): string {
  if (/\.pptx?(\?|#|$)/i.test(url)) return "pptx";
  if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
  if (/\.docx?(\?|#|$)/i.test(url)) return "doc";
  if (/\.xlsx?(\?|#|$)/i.test(url)) return "sheet";
  if (/\.csv(\?|#|$)/i.test(url)) return "csv";
  if (/\.html?(\?|#|$)/i.test(url)) return "html";
  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)) return "image";
  if (/canva\.com/i.test(url)) return "canva";
  return "link";
}

function buildArtifactsFromText(text: string): FileArtifact[] {
  return extractUrls(text).map((url) => {
    const kind = detectArtifactKind(url);
    const labelMap: Record<string, string> = {
      pptx: "Download PPTX",
      pdf: "Download PDF",
      doc: "Download document",
      sheet: "Download spreadsheet",
      csv: "Download CSV",
      html: "Open preview",
      image: "Open image",
      canva: "Open Canva file",
      link: "Open link",
    };

    return { url, kind, label: labelMap[kind] || "Open file" };
  });
}

function hasSearchIntent(text: string): boolean {
  return /(latest|news|price|prices|compare|comparison|research|search|find|current|today|recent|web|website|source|sources|review|reviews|who is|what is|when did|where is|how to|what happened|statistics|stats|data|report|info|information|ابحث|بحث|اخر|آخر|سعر|اسعار|قارن|مقارنة|معلومات|مصادر|مين|ايه|ما هو|ما هي|شو|كم|متى|اين|وين|ليه|ليش)/i.test(text);
}

function hasWebsiteIntent(text: string): boolean {
  return /(website|site|url|link|domain|browser|web page|page|canva|dashboard|store|amazon|jumia|noon|login|sign in|portal|checkout|extract.*from|scrape|data from|check.*website|visit|open.*site|go to|browse|compare.*stores|compare.*prices|live.*price|real.*price|موقع|لينك|رابط|متصفح|كانفا|صفحة|سجل الدخول|ادخل|افتح|استخرج|بيانات من|تصفح|زر|اذهب|شوف الموقع|افتح الموقع)/i.test(text);
}

function hasBrowserEscalation(text: string): boolean {
  // Broader detection for tasks that genuinely need a browser
  return /(fill.*form|submit|download.*from|screenshot|log.*in|sign.*up|book.*ticket|order|purchase|buy.*from|track.*order|check.*status|monitor|watch.*price|تعبئة|نموذج|طلب|اشتري|حجز|تتبع)/i.test(text);
}

function hasShoppingIntent(text: string): boolean {
  return /(buy|shopping|shop|product|products|compare prices|best price|deal|deals|amazon|jumia|noon|store|stores|purchase|شراء|اشتري|تسوق|تسوّق|منتج|منتجات|قارن|مقارنة اسعار|سعر|اسعار|عروض|متجر|متاجر)/i.test(text);
}

function isToolMarkerChunk(content: string): boolean {
  return [
    "WEB_SEARCH",
    "BROWSE_WEBSITE",
    "SHOPPING_SEARCH",
    "CONVERT_CURRENCY",
    "GENERATE_IMAGE",
    "GENERATE_VIDEO",
    "GENERATE_VOICE",
    "CANVA_CREATE_SLIDES",
  ].includes(content.trim());
}

function normalizeRequestedModel(rawModel: string | null): string | null {
  if (!rawModel || rawModel === "auto") return null;
  return rawModel;
}

function isModelUnavailable(status: number, errorText: string): boolean {
  if (status !== 400 && status !== 404) return false;
  return /not.*available|invalid.*model|unsupported|model[_\s-]?not[_\s-]?found|not\s+found|no\s+such\s+model|deprecated/i.test(errorText);
}

function getNextFallbackModel(currentModel: string): string | null {
  return OPENROUTER_FALLBACK_MODELS.find((candidate) => candidate !== currentModel) ?? null;
}

function normalizeModelForProvider(model: string, provider: "openrouter" | "lemondata"): string {
  // LemonData expects bare model IDs (e.g. "gemini-2.5-flash-lite"), not "google/gemini-2.5-flash-lite"
  if (provider === "lemondata") {
    const slash = model.indexOf("/");
    return slash === -1 ? model : model.slice(slash + 1);
  }
  return model;
}

// Detect if the task requires a more powerful model
function detectComplexTask(text: string, hasImages: boolean, isDeepResearch: boolean, isShopping: boolean, mode?: string): boolean {
  if (hasImages) return true;
  if (isDeepResearch) return true;
  if (isShopping) return true;
  if (mode === "files") return true;
  // Complex patterns: code, analysis, comparison, long requests
  const complexPatterns = /(compare|مقارنة|analyze|تحليل|explain in detail|اشرح بالتفصيل|write code|اكتب كود|debug|programming|برمجة|research|بحث عميق|create a plan|خطة|summarize this|لخص|translate this document|ترجم|review|مراجعة|step by step|خطوة بخطوة)/i;
  if (complexPatterns.test(text)) return true;
  // Long messages likely need more reasoning
  if (text.split(/\s+/).length > 50) return true;
  return false;
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>")\]]+/i);
  return match ? match[0].replace(/[.,;]+$/, "") : null;
}

function createSyntheticToolCall(name: string, args: Record<string, unknown>) {
  return { function: { name, arguments: JSON.stringify(args) } };
}

function buildForcedToolCalls({
  latestUserText,
  explicitUrl,
  isShopping,
  needsSearch,
  isDeepResearch,
  hasSerper,
}: {
  latestUserText: string;
  explicitUrl: string | null;
  isShopping: boolean;
  needsSearch: boolean;
  isDeepResearch: boolean;
  hasSerper: boolean;
}) {
  const calls: any[] = [];

  if (isShopping) {
    // Always start with shopping product search (no key required) + web search for reviews.
    calls.push(createSyntheticToolCall("SHOPPING_SEARCH", { query: latestUserText, num: 10 }));
    if (hasSerper) {
      calls.push(createSyntheticToolCall("WEB_SEARCH", { query: `${latestUserText} reviews comparison`, include_images: false }));
    }
    return calls;
  }

  if (needsSearch) {
    calls.push(createSyntheticToolCall("BROWSE_WEBSITE", {
      goal: `Search the live web for "${latestUserText}", visit the most relevant pages, gather accurate current information, and collect trustworthy sources.${isDeepResearch ? " Also collect relevant visuals when available." : ""}`,
      url: explicitUrl || `https://www.google.com/search?q=${encodeURIComponent(latestUserText)}`,
    }));

    if (hasSerper) {
      calls.push(createSyntheticToolCall("WEB_SEARCH", {
        query: latestUserText,
        include_images: isDeepResearch,
      }));
    }
  }

  return calls;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model, mode, searchEnabled, deepResearch, chatMode, user_id, computerUseEnabled, activeAgent, selectedModel } = await req.json();
    const latestUserMessage = Array.isArray(messages)
      ? [...messages].reverse().find((message: any) => message?.role === "user")
      : null;
    const latestUserText = Array.isArray(latestUserMessage?.content)
      ? latestUserMessage.content.map((part: any) => part?.text || "").join(" ")
      : String(latestUserMessage?.content || "");
    const wantsHamzaProfile = /(hamza|hassan el-gizaery|elgiza|حمزه|حمزة|حمزة حسن)/i.test(latestUserText);
    const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve effective chat mode
    const effectiveMode = chatMode || mode || "normal";
    const isFilesMode = effectiveMode === "files";
    const isShopping = effectiveMode === "shopping" || hasShoppingIntent(latestUserText);
    const isLearning = effectiveMode === "learning";

    // Fetch shopping preferences from user_memory_entries if shopping
    let shoppingPrefs: { country?: string; currency?: string } | null = null;
    if (isShopping && user_id) {
      try {
        const { data: memData } = await sb.from("user_memory_entries")
          .select("summary")
          .eq("user_id", user_id)
          .eq("scope", "account")
          .ilike("title", "%shopping_preferences%")
          .maybeSingle();
        if (memData?.summary) {
          try { shoppingPrefs = JSON.parse(memData.summary); } catch { /* ignore */ }
        }
      } catch { /* silently skip */ }
    }

    // ── Fetch user context (optimized — skip heavy queries for casual) ──
    let userContext = "";
    // Detect casual early to skip expensive context fetching
    const isCasualEarly = /^(هلا|اهلا|هاي|مرحبا|السلام|سلام|hi|hello|hey|yo|sup|thanks|شكرا|تمام|ok|اوك|good|كويس|ازيك|عامل ايه|كيفك|صباح|مساء|bye|وداعا|ايوه|لا)\b/i.test(latestUserText.trim()) && latestUserText.trim().split(/\s+/).length <= 5;

    if (user_id && !isCasualEarly) {
      try {
        const [profileRes, personalizationRes] = await Promise.all([
          sb.from("profiles").select("display_name, plan, credits").eq("id", user_id).single(),
          sb.from("ai_personalization").select("call_name, about, profession, ai_traits, custom_instructions").eq("user_id", user_id).maybeSingle(),
        ]);

        const parts: string[] = [];
        if (profileRes.data) {
          const p = profileRes.data;
          parts.push(`User name: ${p.display_name || "Unknown"} (Plan: ${p.plan}, Credits: ${p.credits} MC — only mention if user asks)`);
        }
        if (personalizationRes.data) {
          const ai = personalizationRes.data;
          if (ai.call_name) parts.push(`Call the user: "${ai.call_name}"`);
          if (ai.about) parts.push(`About user: ${ai.about}`);
          if (ai.profession) parts.push(`Profession: ${ai.profession}`);
          if (ai.ai_traits) parts.push(`AI personality: ${ai.ai_traits}`);
          if (ai.custom_instructions) parts.push(`Custom instructions: ${ai.custom_instructions}`);
        }
        if (parts.length > 0) userContext = `\n\n--- USER CONTEXT ---\n${parts.join("\n")}`;
      } catch { /* silently skip */ }
    }

    // ── Model routing ──
    const isDeepResearch = deepResearch === true;
    const requestedModel = normalizeRequestedModel(typeof model === "string" ? model : null);
    
    // Check if messages contain images
    const hasImages = Array.isArray(messages) && messages.some((m: any) => {
      if (Array.isArray(m.content)) return m.content.some((p: any) => p.type === "image_url");
      return false;
    });

    // Auto-select powerful model for complex tasks
    const needsComplexModel = !isCasualEarly && detectComplexTask(latestUserText, hasImages, isDeepResearch, isShopping, effectiveMode);
    let modelId: string = requestedModel ?? (needsComplexModel ? COMPLEX_MODEL : DEFAULT_MODEL);
    let apiUrl = OPENROUTER_URL;
    let apiKey = "";
    let usedKeyId: string | null = null;
    let provider: "openrouter" | "lemondata" = "openrouter";

    // Try OpenRouter first (env secret)
    const orKey = getOpenRouterKey();
    if (orKey) {
      apiKey = orKey;
      provider = "openrouter";
    } else {
      // Fallback to LemonData
      const lemonKey = await getLemonDataKey(sb);
      if (lemonKey) {
        apiUrl = LEMONDATA_URL;
        apiKey = lemonKey.api_key;
        usedKeyId = lemonKey.id;
        provider = "lemondata";
      } else {
        return new Response(JSON.stringify({ error: "No API keys available" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build Composio tools
    const composioTools = COMPOSIO_API_KEY ? [
      { type: "function", function: { name: "GMAIL_SEND_EMAIL", description: "Send an email using Gmail", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } } },
      { type: "function", function: { name: "GMAIL_LIST_EMAILS", description: "List recent emails from Gmail inbox", parameters: { type: "object", properties: { max_results: { type: "number", default: 5 }, query: { type: "string" } } } } },
      { type: "function", function: { name: "GITHUB_CREATE_ISSUE", description: "Create a GitHub issue", parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["owner", "repo", "title"] } } },
      { type: "function", function: { name: "GITHUB_LIST_REPOS", description: "List user's GitHub repositories", parameters: { type: "object", properties: { per_page: { type: "number", default: 10 } } } } },
      { type: "function", function: { name: "SLACK_SEND_MESSAGE", description: "Send a message to a Slack channel", parameters: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] } } },
      { type: "function", function: { name: "GOOGLE_CALENDAR_CREATE_EVENT", description: "Create a Google Calendar event", parameters: { type: "object", properties: { title: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" }, description: { type: "string" } }, required: ["title", "start_time", "end_time"] } } },
      { type: "function", function: { name: "GOOGLE_CALENDAR_LIST_EVENTS", description: "List upcoming Google Calendar events", parameters: { type: "object", properties: { max_results: { type: "number", default: 10 } } } } },
      { type: "function", function: { name: "GOOGLE_DRIVE_LIST_FILES", description: "List files in Google Drive", parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "number", default: 10 } } } } },
      { type: "function", function: { name: "NOTION_CREATE_PAGE", description: "Create a page in Notion", parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, parent_page_id: { type: "string" } }, required: ["title", "content"] } } },
      { type: "function", function: { name: "DISCORD_SEND_MESSAGE", description: "Send a message to a Discord channel", parameters: { type: "object", properties: { channel_id: { type: "string" }, content: { type: "string" } }, required: ["channel_id", "content"] } } },
      { type: "function", function: { name: "LINKEDIN_CREATE_POST", description: "Create a LinkedIn post", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
      { type: "function", function: { name: "YOUTUBE_LIST_VIDEOS", description: "List videos from a YouTube channel", parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "number", default: 5 } } } } },
    ] : [];

    // Media generation tools (available when user uses @images, @videos, @voice in chat)
    const mediaTools = [
      {
        type: "function",
        function: {
          name: "GENERATE_IMAGE",
          description: "Generate an AI image from a text prompt. Use when the user asks to create, generate, or make an image/picture/photo. Returns the image URL.",
          parameters: { type: "object", properties: { prompt: { type: "string", description: "Detailed image description" }, model: { type: "string", description: "Model to use (nano-banana, nano-banana-pro, nano-banana-2, flux-schnell, flux-pro). Default: nano-banana" }, count: { type: "number", description: "Number of images (1-4). Default: 1" } }, required: ["prompt"] },
        },
      },
      {
        type: "function",
        function: {
          name: "GENERATE_VIDEO",
          description: "Generate an AI video from a text prompt. Use when the user asks to create a video.",
          parameters: { type: "object", properties: { prompt: { type: "string", description: "Video description" }, model: { type: "string", description: "Model: veo3, wan-x, hunyuan. Default: wan-x" } }, required: ["prompt"] },
        },
      },
      {
        type: "function",
        function: {
          name: "GENERATE_VOICE",
          description: "Convert text to speech audio. Use when the user asks to read text aloud, generate speech, or TTS.",
          parameters: { type: "object", properties: { text: { type: "string", description: "Text to speak" }, voice: { type: "string", description: "Voice ID to use. Default: alloy" } }, required: ["text"] },
        },
      },
      {
        type: "function",
        function: {
          name: "CANVA_CREATE_SLIDES",
          description: "Create a professional presentation/slides using Canva via autonomous browser. Use when the user asks to create slides, presentations, or pitch decks. The browser will open Canva, create the presentation, and return a download link.",
          parameters: { type: "object", properties: { topic: { type: "string", description: "The topic/title of the presentation" }, slide_count: { type: "number", description: "Number of slides (5-20). Default: 10" }, style: { type: "string", description: "Presentation style: professional, creative, minimal, bold. Default: professional" }, content_outline: { type: "string", description: "Detailed outline of what each slide should contain" } }, required: ["topic"] },
        },
      },
    ];

    const isCasualMessage = isCasualEarly;

    // Smart selective tool loading — only load what's actually needed
    const wantsImageTool = /@(images|صور)\b|\b(image|photo|picture|images|photos|صورة|صور)\b/i.test(latestUserText);
    const wantsVideoTool = /@(videos|فيديو)\b|\b(video|videos|clip|فيديو|فديو)\b/i.test(latestUserText);
    const wantsVoiceTool = /@(voice|صوت)\b|\b(voice|speech|audio|tts|صوت|كلام)\b/i.test(latestUserText);
    const wantsSlideTool = !isFilesMode && (activeAgent === "slides" || /@(slides|files)\b|\b(slide|slides|presentation|pitch deck|ppt|pptx|powerpoint|عرض|شرائح|سلايد|سلايدز|برزنتيشن|بوربوينت|كانفا)\b/i.test(latestUserText));
    const mentionsIntegrations = /@(integrations|تكاملات)/i.test(latestUserText) || activeAgent === "integrations";
    const mentionsBrowse = /(browse|open website|افتح موقع|go to|visit|check.*site)/i.test(latestUserText);
    const needsSearch = !isCasualMessage && (searchEnabled || isDeepResearch || isShopping) && (hasSearchIntent(latestUserText) || isDeepResearch || isShopping);
    const needsBrowserIntent = !isCasualMessage && computerUseEnabled && (
      wantsSlideTool || mentionsBrowse || hasWebsiteIntent(latestUserText) || hasBrowserEscalation(latestUserText) || isShopping || isDeepResearch || needsSearch
    );
    const shouldLoadSerperKey = !isCasualMessage && (isDeepResearch || isShopping || wantsHamzaProfile || needsSearch);
    const shouldLoadHyperbrowserKey = needsBrowserIntent;

    const [SERPER_API_KEY, HB_API_KEY] = await Promise.all([
      shouldLoadSerperKey ? getSerperKey(sb) : Promise.resolve(null),
      shouldLoadHyperbrowserKey ? getHyperbrowserKey(sb) : Promise.resolve(null),
    ]);
    const explicitUrl = extractFirstUrl(latestUserText);

    // Build search tools (AFTER key loading)
    const searchTools = (((searchEnabled || isDeepResearch) || wantsHamzaProfile) && SERPER_API_KEY) ? [
      {
        type: "function",
        function: {
          name: "WEB_SEARCH",
          description: isDeepResearch
            ? "Perform a comprehensive deep research web search. You MUST call this tool AT LEAST 3-5 TIMES with different queries."
            : "Search the web for current information. Use when the user asks about recent events, facts, product prices, news, or anything that benefits from real-time data.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Search query" }, include_images: { type: "boolean", description: "Whether to include relevant images" } }, required: ["query"] },
        },
      },
    ] : [];

    // Shopping search tool (Shoppy-Wise API — no key needed)
    const shoppingTools = isShopping ? [
      {
        type: "function",
        function: {
          name: "SHOPPING_SEARCH",
          description: "Search for products across online stores using Shoppy-Wise. Returns product images, prices, sellers, and links. ALWAYS use this when the user asks about buying, prices, products, or shopping.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Product search query" }, currency: { type: "string", description: "Currency code like EGP, SAR, USD" }, country: { type: "string", description: "Country like egypt, saudi" }, type: { type: "string", description: "Search type: google, amazon, noon" } }, required: ["query"] },
        },
      },
      {
        type: "function",
        function: {
          name: "CONVERT_CURRENCY",
          description: "Convert a price amount from one currency to another. Use when product prices are in a different currency than the user prefers.",
          parameters: { type: "object", properties: { amount: { type: "number", description: "Amount to convert" }, from: { type: "string", description: "Source currency code (e.g. USD)" }, to: { type: "string", description: "Target currency code (e.g. EGP)" } }, required: ["amount", "from", "to"] },
        },
      },
      ...(SERPER_API_KEY ? [{
        type: "function",
        function: {
          name: "WEB_SEARCH",
          description: "Search the web for product reviews, comparisons, or general information to help the user make better purchasing decisions.",
          parameters: { type: "object", properties: { query: { type: "string", description: "Search query" }, include_images: { type: "boolean" } }, required: ["query"] },
        },
      }] : []),
    ] : [];

    // Browser tool (Computer Use via Hyperbrowser)
    const browserTools = HB_API_KEY ? [
      {
        type: "function",
        function: {
          name: "BROWSE_WEBSITE",
          description: "Open a real browser and autonomously browse a website to extract data, fill forms, or perform actions. Use when: shopping comparisons need live prices, user asks to check a specific website, research needs real-time page content, or any task requiring actual web browsing. Returns extracted content and screenshots.",
          parameters: { type: "object", properties: { goal: { type: "string", description: "What to accomplish (e.g., 'Find the cheapest iPhone 16 on amazon.eg')" }, url: { type: "string", description: "Optional specific URL to start from" } }, required: ["goal"] },
        },
      },
    ] : [];

    const needsBrowser = !!HB_API_KEY && needsBrowserIntent;

    // System prompt
    let systemPrompt = buildSystemPrompt(isShopping ? "shopping" : effectiveMode, isDeepResearch, searchEnabled, wantsHamzaProfile, userContext, latestUserText, activeAgent, shoppingPrefs);

    if (computerUseEnabled && HB_API_KEY) {
      systemPrompt += `\n\nCOMPUTER USE (Megsy Computer):
- You have BROWSE_WEBSITE tool that opens a real browser to autonomously browse websites.
- Use it ONLY when the task genuinely requires visiting a real website, extracting live page data, comparing store pages, or interacting with a web page.
- Never use it for greetings, casual chat, writing, explanation, summarization, translation, or simple reasoning.
- Think first: if the task can be answered without opening a browser, do not call BROWSE_WEBSITE.`;
    }

    if (needsBrowser && !isDeepResearch) {
      systemPrompt += `\n\nIMPORTANT FOR THIS REQUEST:
- The user's request is already clear enough for live browsing.
- Do not ask unnecessary follow-up questions before browsing.
- If the request mentions a website, company page, team page, pricing page, or live store comparison, call BROWSE_WEBSITE immediately and then answer from the live result.`;
    }

    systemPrompt += `\n\nMEDIA GENERATION TOOLS:
- You have GENERATE_IMAGE, GENERATE_VIDEO, and GENERATE_VOICE tools.
- Use them when the user asks to create images, videos, or speech.
- If the user specifies @images, @videos, or @voice, use the corresponding tool.
- Always enhance the user's prompt for better results before passing to the tool.`;

    if (activeAgent === "integrations") {
      if (selectedModel?.id) {
        systemPrompt += `\n\nINTEGRATIONS AGENT:\n- The user selected @integrations with #${selectedModel.id}.\n- Use only tools relevant to ${selectedModel.id}.\n- If the integration account is not connected, do not fake execution; immediately ask the user to connect ${selectedModel.id} first.`;
      } else {
        systemPrompt += `\n\nINTEGRATIONS AGENT:\n- The user selected @integrations but no service after # yet.\n- Ask them to choose a service like Gmail, Outlook, Slack, Notion, Google Drive, or Google Calendar.`;
      }
    }

    // Build tools array selectively
    const selectedTools: any[] = [];
    if (!isCasualMessage) {
      if (isShopping) selectedTools.push(...shoppingTools);
      else if (needsSearch) selectedTools.push(...searchTools);
      if (needsBrowser) selectedTools.push(...browserTools);
      if (wantsImageTool || wantsVideoTool || wantsVoiceTool || wantsSlideTool) {
        selectedTools.push(...mediaTools.filter((tool) => {
          const name = tool.function.name;
          if (name === "GENERATE_IMAGE") return wantsImageTool;
          if (name === "GENERATE_VIDEO") return wantsVideoTool;
          if (name === "GENERATE_VOICE") return wantsVoiceTool;
          if (name === "CANVA_CREATE_SLIDES") return wantsSlideTool && !isFilesMode;
          return false;
        }));
      }
      if (mentionsIntegrations) selectedTools.push(...composioTools);
    }

    // Trim messages aggressively for speed
    const trimmedMessages = Array.isArray(messages) && messages.length > (isCasualMessage ? 4 : 6)
      ? messages.slice(isCasualMessage ? -4 : -6)
      : messages;

    const body: any = {
      model: normalizeModelForProvider(modelId, provider),
      messages: isCasualMessage 
        ? [{ role: "system", content: `You are Megsy, a fast and friendly AI assistant. Reply briefly and naturally. Match the user's language.${userContext}` }, ...trimmedMessages]
        : [{ role: "system", content: systemPrompt }, ...trimmedMessages],
      stream: true,
      max_tokens: isCasualMessage ? 150 : (isDeepResearch ? 8192 : (mode === "files" ? 4096 : 2048)),
      temperature: isCasualMessage ? 0.2 : 0.5,
    };

    if (selectedTools.length > 0) {
      body.tools = selectedTools;
      body.tool_choice = "auto";
    }

    // Shopping forces a search flow without requiring Hyperbrowser. Deep research still needs HB for browser steps.
    const shouldForceComputerFlow = !isFilesMode && !mentionsIntegrations && !wantsImageTool && !wantsVideoTool && !wantsVoiceTool && (isShopping || (!!HB_API_KEY && isDeepResearch));
    const forcedToolCalls = shouldForceComputerFlow
      ? buildForcedToolCalls({
          latestUserText,
          explicitUrl,
          isShopping,
          needsSearch,
          isDeepResearch,
          hasSerper: !!SERPER_API_KEY,
        })
      : [];

    if (forcedToolCalls.length > 0) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          await handleToolCalls(controller, encoder, forcedToolCalls, body, apiUrl, apiKey, modelId, SERPER_API_KEY, COMPOSIO_API_KEY, isDeepResearch, isShopping, searchTools, sb, 0, HB_API_KEY);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }


    // Key rotation with fast retry + provider fallback
    let response: Response;
    let retryCount = 0;
    let failureText = "";

    while (true) {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) break;

      const failStatus = response.status;
      failureText = await response.text();
      if (retryCount >= 3) break;

      if (provider === "openrouter" && isModelUnavailable(failStatus, failureText)) {
        const nextModel = getNextFallbackModel(modelId);
        if (nextModel) {
          modelId = nextModel;
          body.model = modelId;
          retryCount++;
          continue;
        }
      }

      // If OpenRouter fails with auth/rate/server errors, fallback to LemonData
      if (provider === "openrouter" && (failStatus === 401 || failStatus === 403 || failStatus === 429 || failStatus === 402 || failStatus >= 500)) {
        const lemonKey = await getLemonDataKey(sb);
        if (lemonKey) {
          apiUrl = LEMONDATA_URL;
          apiKey = lemonKey.api_key;
          usedKeyId = lemonKey.id;
          provider = "lemondata";
          retryCount++;
          continue;
        }
      }

      // LemonData key rotation
      if (provider === "lemondata" && (failStatus === 401 || failStatus === 403 || failStatus === 429 || failStatus === 402)) {
        if (failStatus !== 429 && usedKeyId) blockLemonKey(sb, usedKeyId, `HTTP ${failStatus}`);
        const newKey = await getLemonDataKey(sb, usedKeyId || undefined);
        if (newKey) {
          apiKey = newKey.api_key;
          usedKeyId = newKey.id;
          retryCount++;
          continue;
        }
      }
      break;
    }

    if (response.ok && usedKeyId) markKeyUsed(sb, usedKeyId);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits depleted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", status, failureText);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let toolCalls: any[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              if (toolCalls.length > 0) {
                await handleToolCalls(controller, encoder, toolCalls, body, apiUrl, apiKey, modelId, SERPER_API_KEY, COMPOSIO_API_KEY, isDeepResearch, isShopping, searchTools, sb, 0, HB_API_KEY);
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCalls[idx]) toolCalls[idx] = { function: { name: "", arguments: "" } };
                  if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                }
                continue;
              }

              if (delta.content && !isToolMarkerChunk(delta.content)) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: delta.content } }] })}\n\n`));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        if (toolCalls.length > 0) {
          await handleToolCalls(controller, encoder, toolCalls, body, apiUrl, apiKey, modelId, SERPER_API_KEY, COMPOSIO_API_KEY, isDeepResearch, isShopping, searchTools, sb, 0, HB_API_KEY);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Build system prompt ──
function buildSystemPrompt(mode: string | undefined, isDeepResearch: boolean, searchEnabled: boolean | undefined, wantsHamzaProfile: boolean, userContext: string, latestUserText: string, activeAgent?: string, shoppingPrefs?: { country?: string; currency?: string } | null): string {
  if (mode === "files") {
    return `You are Megsy, a smart AI File Agent made by Megsy AI. The current year is 2026. You are a decision-making agent, not a simple chatbot.

CRITICAL RESPONSE RULES:
- Create COMPREHENSIVE, DETAILED, WELL-STRUCTURED documents. NEVER abbreviate or shorten.
- Write FULL paragraphs, complete lists, and detailed explanations.
- If asked for a report, write AT LEAST 2000 words with full sections.
- If asked for a presentation, include AT LEAST 10 detailed slides.
- Use rich formatting: headers (##, ###), bold, bullet points, numbered lists, tables, code blocks.
- Structure your responses with clear sections and sub-sections.

DECISION ENGINE - For every request, internally decide one action:
- analyze_file: Deep analysis of uploaded file content
- answer: Answer questions about file content
- extract: Extract structured data (names, emails, dates, numbers)
- rewrite: Modify content while preserving exact structure and formatting
- generate_document: Create new documents (HTML, structured content)
- ask_user: Ask clarifying questions when request is ambiguous
- auto_review: If user uploads file without clear instructions, automatically provide: Summary, Key Insights, Issues Found, Suggestions
- multi_file_analysis: Compare multiple files, extract differences

Rules:
- When the user attaches images, analyze them carefully and incorporate observations.
- When the user attaches documents/files, read thoroughly and use content.
- If a file is uploaded WITHOUT text, perform auto_review immediately.
- When editing content, keep EXACT same structure and formatting.
- Match the user's language and dialect exactly (Egyptian Arabic → Egyptian Arabic).
- Never use emoji. Never introduce yourself unless asked.
- Vary descriptions and follow-up suggestions.
- Always end with a specific follow-up question.
- When request is ambiguous, use smart questions:
\`\`\`json
{"type":"questions","questions":[{"title":"What format do you need?","options":["Report","Presentation","Summary"],"allowText":true}]}
\`\`\`

IMPORTANT: Before ANY questions JSON block, write a natural sentence explaining what you need.
- If the request is for slides, presentations, PPT, PPTX, pitch deck, or the active file agent is slides, generate a premium single-file HTML presentation with embedded CSS and vanilla JavaScript.
- The slide output must be fully client-side and ready for iframe preview inside the app.
- Never use Canva or browser-only slide tools inside the Files workspace unless the user explicitly asks for an external website workflow.
- For document, resume, and spreadsheet requests, use browser/computer tools only when the user explicitly asks for a real web-app workflow or website action.
- Active file agent: ${activeAgent || "general"}.
${userContext}`;
  }
  
  if (isDeepResearch) {
    return `You are Megsy, a Deep Research AI Agent made by Megsy AI. The current year is 2026.

CRITICAL: Never introduce yourself. Never say "I'm Megsy" unless directly asked.

DEEP RESEARCH MODE:
- You MUST use the WEB_SEARCH tool 5-8 TIMES with different focused queries to gather exhaustive information.
- For EVERY search, set include_images=true to gather relevant visual content.
- Cover: 1) General overview 2) Latest developments 3) Key data & expert opinions 4) Visual references 5) Controversies or debates 6) Historical context
- While researching people, brands, celebrities, athletes, or public figures, ALWAYS gather photos.
- If BROWSE_WEBSITE is available, use it to get live data from important sources.

ABSOLUTE PRIVACY RULES (NEVER VIOLATE):
- NEVER show tool names like WEB_SEARCH, BROWSE_WEBSITE, SHOPPING_SEARCH, GENERATE_IMAGE, etc.
- NEVER show search queries you used (e.g., "I searched for X")
- NEVER show raw API responses, JSON data, or unprocessed results
- NEVER mention "Serper", "Hyperbrowser", "Composio", or any backend service name
- NEVER say "I used the search tool" or "I browsed the website"
- NEVER show intermediate steps, processing notes, or internal reasoning
- Write as if YOU naturally know the information — present it confidently
- The user should ONLY see the final polished research report

CRITICAL OUTPUT RULES — MASSIVE REPORT:
- You MUST write a MINIMUM of 3000-5000 words. This is NON-NEGOTIABLE.
- The report must be comprehensive, detailed, and professional-grade.
- NEVER abbreviate, shorten, or summarize. Write the FULL analysis.
- Each section must have multiple paragraphs with deep analysis.
- ALWAYS synthesize and analyze ALL gathered information into ONE cohesive report.

IMAGE PLACEMENT (CRITICAL — IMAGES FIRST):
- Place the MOST relevant images at the VERY TOP of the report using ![description](url)
- Then spread additional images throughout the report near relevant sections
- For people/celebrities: include their photo as the FIRST element
- For products: include product image at the TOP
- For places: include location photo at the TOP
- NEVER put all images at the end — they must appear THROUGHOUT the report

FORMAT:
- Use markdown extensively: ## headers, ### sub-headers, **bold**, bullet points (•), numbered lists, tables
- Format all links as clickable text: [Source Name](url)
- Use tables for structured comparisons
- Cite ALL sources: [Source Name](URL)

LANGUAGE RULE (CRITICAL):
- ALWAYS respond in the EXACT SAME language the user used in their LATEST query message
- If the user writes in Arabic (any dialect), the ENTIRE report MUST be in Arabic including ALL section headers
- If the user writes in English, respond ENTIRELY in English
- If the user writes in French, respond ENTIRELY in French
- If the user writes in any other language, respond ENTIRELY in that same language
- DETECT the language from the user's actual input text, do NOT default to Arabic
- Never mix languages within the report

REPORT STRUCTURE (adapt headers to user's language):
## [Images at the very top]
## Executive Summary (200+ words)
## Background & Context (300+ words)
## Key Findings (500+ words with sub-sections)
## Detailed Analysis (800+ words with multiple sub-sections)
## Data & Statistics (use tables for comparisons)
## Expert Opinions & Perspectives
## Future Outlook & Predictions  
## Sources & References (formatted as clickable links)

- End with 3-5 follow-up questions.
- Never use emoji.
${userContext}`;
  }

  // Learning mode
  if (mode === "learning") {
    return `You are Megsy, a smart AI Tutor made by Megsy AI. The current year is 2026.

TEACHING MODE - You are an expert educator and tutor:

TEACHING METHODOLOGY:
1. Start with a simple, relatable analogy or real-world example
2. Break complex topics into small, digestible steps
3. Use the Feynman technique: explain as if to a complete beginner
4. Progress from basic to advanced gradually
5. Check understanding with quick questions after each concept

RESPONSE FORMAT:
- Use clear headers (##) for each concept/section
- Number steps sequentially (Step 1, Step 2...)
- Include practical examples with every concept
- Use analogies and metaphors to make abstract ideas concrete
- Add "💡 Key Insight" callouts for important points
- Include "🤔 Think About It" prompts to encourage deeper thinking
- End with a summary and practice questions

SUBJECT HANDLING:
- Math/Science: Show step-by-step solutions, explain WHY each step works
- Programming: Write code with detailed comments, explain logic flow
- Languages: Use contextual examples, grammar patterns, common mistakes
- History/Social: Tell the story, connect events, explain cause and effect
- General: Use structured breakdown with clear progression

ENGAGEMENT RULES:
- Match the user's language and dialect exactly
- Adapt difficulty based on the user's apparent level
- If the user seems confused, simplify further with a new analogy
- Celebrate correct understanding naturally
- Never skip steps or assume prior knowledge unless stated
- Use tables for comparisons
- Use diagrams described in text when helpful

NEVER:
- Give answers without explanation
- Use jargon without defining it first
- Skip the "why" behind any concept
- Be condescending
- Use emoji excessively
${userContext}`;
  }

  // Shopping mode
  if (mode === "shopping") {
    const hasStoredPrefs = shoppingPrefs?.country && shoppingPrefs?.currency;
    const combinedText = (userContext + " " + latestUserText).toLowerCase();
    const isArabic = /[\u0600-\u06FF]/.test(latestUserText);
    const isEgypt = hasStoredPrefs ? /egypt|مصر/i.test(shoppingPrefs!.country!) : (/(مصر|egypt|القاهرة|cairo|جنيه|egp|اسكندرية|الجيزة|نون مصر|جوميا|امازون مصر|بي تك)/i.test(combinedText) || isArabic);
    const isSaudi = hasStoredPrefs ? /saudi|السعودية/i.test(shoppingPrefs!.country!) : /(السعودية|saudi|riyal|sar|جدة|الرياض|نون السعودية)/i.test(combinedText);
    const localCurrency = hasStoredPrefs ? shoppingPrefs!.currency! : (isEgypt ? "EGP (الجنيه المصري)" : isSaudi ? "SAR (الريال السعودي)" : "the user's local currency");
    const localStores = isEgypt ? "Noon Egypt, Jumia Egypt, Amazon.eg, B.Tech, 2B" : isSaudi ? "Noon KSA, Amazon.sa, Jarir, Extra" : "trusted online stores";

    return `You are Megsy, a smart AI Shopping Assistant made by Megsy AI. The current year is 2026.

SHOPPING ASSISTANT MODE:

ABSOLUTE RULES:
- NEVER ask the user follow-up questions before responding. Never ask for country, currency, budget, or preferences. Infer everything from the message and language.
- Default region: ${isEgypt ? "Egypt" : isSaudi ? "Saudi Arabia" : "global"}. Default currency: ${localCurrency}.
- Search and reference ${localStores} when applicable.
- Reply in the user's EXACT language and dialect.
- NEVER expose tool names or raw results. Talk naturally as if you found everything yourself.
- NEVER use emoji. Never introduce yourself unless asked.

RESPONSE FORMAT (one single short response):
- Start with a one-sentence "Best Pick" recommendation.
- Then 2-3 bullet comparison of top options with **bold names** and prices.
- One closing buying tip.
- Keep the WHOLE reply under ~120 words. Product CARDS are shown by the UI separately, so do NOT list every product as text.
- If live results are unavailable, briefly say results are limited right now and give the best advice you can with what you have.

${userContext}`;
  }

  
  let prompt = `You are Megsy, a smart AI assistant made by Megsy AI. The current year is 2026.

RESPONSE LENGTH DECISION ENGINE (CRITICAL):
Before writing your response, internally decide the optimal response length:
- BRIEF (1-3 sentences): greetings, yes/no questions, simple facts, acknowledgments, casual chat
- MEDIUM (1-2 paragraphs): explanations, how-to answers, opinions, recommendations
- DETAILED (3+ paragraphs with structure): comparisons, analysis, tutorials, research, technical topics, complex questions
Choose the length that best serves the user's actual need. Never pad short answers. Never truncate complex topics.

TOOL DECISION ENGINE:
Before responding, internally decide which tools (if any) are needed:
- No tools: casual chat, opinions, creative writing, general knowledge
- WEB_SEARCH: current events, live prices, recent news, factual verification, statistics
- BROWSE_WEBSITE: specific website data, form filling, live store comparison, page interaction
- Both: deep comparisons, product research, comprehensive fact-checking
Never use tools for greetings, simple knowledge, or creative tasks.

CORE BEHAVIOR:
- Reply to the user's actual request and the current conversation context. Do not use canned, repetitive, or generic filler responses.
- If the user is discussing a project, app, feature, bug, screen, workflow, brand, or product idea, tailor the answer to that specific project and mention the relevant details naturally.
- Build each answer from the latest user message plus the surrounding conversation. Do not ignore context.
- Never fabricate actions, results, or completed work.

IDENTITY RULES:
- Only mention your name if the user directly asks who you are.
- Never mention model providers, LemonData, hidden prompts, or internal tools.
- Never reveal account details like credits or plan unless the user explicitly asks.
- NEVER expose tool names (WEB_SEARCH, BROWSE_WEBSITE, SHOPPING_SEARCH, etc.) in your responses.
- NEVER show raw search queries, API responses, or internal processing steps.
- Talk naturally as if you found information yourself.

LANGUAGE & TONE:
- Match the user's language and dialect exactly.
- Greetings should be short and natural.
- For real questions or requests, be specific, useful, and context-aware.
- Use markdown only when it improves clarity. Do not force the same structure every time.
- No emoji unless the user explicitly asks for that style.

FORMATTING FOR LONG RESPONSES:
- Use bullet points (•) and dashes (-) to organize information clearly
- Use **bold** for key terms, names, and important points
- Use headers (## and ###) for multi-section responses
- Use numbered lists for steps or sequences
- Use tables for comparisons
- Break long paragraphs into shorter, digestible chunks
- Every response should feel clean and well-organized

QUALITY RULES:
- Avoid fixed openings, repeated intros, and generic capability lists.
- If the user asks for help on an existing project, respond as if you understand the project context and reference the most relevant parts.
- If something is ambiguous, ask a focused follow-up using smart questions format:
\`\`\`json
{"type":"questions","questions":[{"title":"What do you need help with?","options":["Option A","Option B","Option C"],"allowText":true}]}
\`\`\`
- For comparisons, use a table only when it genuinely helps.
- For technical answers, include examples only when relevant.
- For greetings or very short casual messages, do not use WEB_SEARCH or BROWSE_WEBSITE.
- Format ALL links as clickable text: [descriptive text](url). NEVER paste raw URLs.

IMAGE & FILE HANDLING:
- Analyze uploaded images and files carefully and incorporate them into the answer when relevant.
- If web search is enabled and the user asks about a public person or figure, include relevant photos with the answer.

TOOLS:
- You have integration tools (Gmail, GitHub, Slack, Calendar, Drive, Notion, Discord, LinkedIn, YouTube). Use them only when the user asks for an action that needs them.
- You have BROWSE_WEBSITE tool for autonomous web browsing. Use it when the user asks to check a website, extract specific data from a page, fill a form, compare products across stores, or any task requiring actual web browsing.
- When a request needs live search, current prices, recent information, or store comparison and BROWSE_WEBSITE is available, use it instead of only describing what you would do.
- Never promise that you will browse or search later. Either use the available tool flow or answer directly.
- If a required integration is not connected, return a connect card.
${userContext}`;

  if (searchEnabled || wantsHamzaProfile) {
    prompt += `\n- You have WEB_SEARCH. Use ONLY when the question needs current/factual information. For casual conversation, do NOT search. Synthesize results naturally and cite sources with links.`;
  }
  if (wantsHamzaProfile) {
    prompt += `\n- For Hamza Hasan / حمزة حسن, MUST call WEB_SEARCH with include_images=true. Prioritize elgiza.site.`;
  }
  
  return prompt;
}

// ── Handle tool calls ──
async function handleToolCalls(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  toolCalls: any[],
  originalBody: any,
  apiUrl: string,
  apiKey: string,
  modelId: string,
  SERPER_API_KEY: string | null,
  COMPOSIO_API_KEY: string | undefined,
  isDeepResearch: boolean,
  isShopping: boolean,
  searchTools: any[],
  sb: ReturnType<typeof createClient>,
  depth: number = 0,
  HB_API_KEY: string | null = null,
) {
  const MAX_DEPTH = 2;
  const validToolCalls = toolCalls.filter((tc) => tc?.function?.name);
  const allSearchResults: string[] = [];
  const allImages = new Set<string>();
  const allProducts: any[] = [];
  
  const pushStatus = (status: string) => {
    // Sanitize: never expose tool names, URLs, or internal steps
    let clean = status.replace(/https?:\/\/[^\s]+/g, "").replace(/—/g, "").trim();
    const lower = clean.toLowerCase();
    const blocklist = ["web_search", "browse_website", "shopping_search", "convert_currency", "generate_image", "generate_video", "generate_voice", "canva_create_slides", "running ", "tool_call", "function_call", "hyper-agent", "hyperbrowser", "serper", "composio", "shoppy", "currency-convert", "shopping-search", "step ", "action:", "next_goal"];
    if (blocklist.some(b => lower.includes(b))) clean = "Working on your request...";
    if (!clean || clean.length < 3) clean = "Searching...";
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: clean })}\n\n`));
  };
  const pushBrowser = (_browser: Record<string, unknown>) => {
    // No longer sending browser state to frontend
  };
  const shouldIncludeImages = (query: string, explicit: boolean) => {
    if (isDeepResearch || explicit) return true;
    return /(who is|biography|profile|photos|images|picture|person|celebrity|founder|actor|singer|player|president|ممثل|مطرب|لاعب|شخص|شخصية|صور|صورة|مؤسس)/i.test(query);
  };

  for (const tc of validToolCalls) {
    try {
      const toolName = tc.function?.name;
      const toolArgs = safeParseToolArgs(tc.function?.arguments || "{}");

      // Shopping search via Shoppy-Wise API
      if (toolName === "SHOPPING_SEARCH") {
        const searchQuery = String(toolArgs.query || "").trim();
        if (!searchQuery) continue;

        pushStatus("Searching stores...");

        const params = new URLSearchParams({ q: searchQuery, limit: "20" });
        if (toolArgs.currency) params.set("currency", String(toolArgs.currency));
        if (toolArgs.country) params.set("country", String(toolArgs.country));
        if (toolArgs.type) params.set("type", String(toolArgs.type));

        try {
          const shopResp = await fetchWithTimeout(`${SHOPPY_WISE_BASE}/shopping-search?${params}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }, 15000);

          if (shopResp.ok) {
            const shopData = await shopResp.json();
            const rawProducts = shopData.data?.products || shopData.products || [];
            if (rawProducts.length > 0) {
              const products = rawProducts.map((p: any) => {
                // Fix product links: ensure they are valid absolute URLs
                let productLink = p.url || p.link || p.product_url || p.productUrl || "";
                if (productLink && !productLink.startsWith("http")) {
                  // Try to construct a valid URL from the source/store
                  const source = (p.source || p.store || "").toLowerCase();
                  if (source.includes("amazon")) productLink = `https://www.amazon.com/dp/${productLink}`;
                  else if (source.includes("noon")) productLink = `https://www.noon.com/product/${productLink}`;
                  else if (source.includes("jumia")) productLink = `https://www.jumia.com/product/${productLink}`;
                  else productLink = `https://${productLink}`;
                }
                return {
                  title: p.title || p.name || "",
                  price: p.converted_price || p.price || "N/A",
                  image: p.image || p.thumbnail || p.imageUrl || "",
                  link: productLink,
                  seller: p.source || p.store || p.merchant || "",
                  rating: p.rating ? `${p.rating}${String(p.rating).includes('/') ? '' : '/5'}` : null,
                  delivery: p.delivery || p.shipping || null,
                };
              });
              allProducts.push(...products);

              const context = `Shopping results for "${searchQuery}":\n` + 
                products.map((p: any, i: number) => 
                  `[${i+1}] ${p.title} - ${p.price} from ${p.seller}${p.rating ? ` (${p.rating})` : ""}${p.link ? `\nBuy: ${p.link}` : ""}`
                ).join("\n\n");
              allSearchResults.push(context);
              
              pushStatus("Comparing the best product options...");

              const productImages = products.filter((p: any) => p.image).map((p: any) => p.image);
              if (productImages.length > 0) {
                productImages.forEach((img: string) => allImages.add(img));
              }
            }
          }
        } catch (shopErr) {
          console.error("Shoppy-Wise error:", shopErr);
          pushStatus("Shopping search failed, continuing...");
        }
        continue;
      }

      // Currency conversion via Shoppy-Wise API
      if (toolName === "CONVERT_CURRENCY") {
        const amount = Number(toolArgs.amount) || 0;
        const from = String(toolArgs.from || "USD").toUpperCase();
        const to = String(toolArgs.to || "EGP").toUpperCase();
        if (!amount) continue;

        try {
          const convResp = await fetchWithTimeout(`${SHOPPY_WISE_BASE}/currency-convert?amount=${amount}&from=${from}&to=${to}`, {
            method: "GET",
          }, 8000);
          if (convResp.ok) {
            const convData = await convResp.json();
            const converted = convData.converted || convData.result || convData;
            allSearchResults.push(`Currency conversion: ${amount} ${from} = ${typeof converted === "object" ? JSON.stringify(converted) : converted} ${to}`);
          }
        } catch { /* skip */ }
        continue;
      }

      if (toolName === "WEB_SEARCH" && SERPER_API_KEY) {
        const searchQuery = String(toolArgs.query || "").trim();
        if (!searchQuery) continue;

        const includeImages = shouldIncludeImages(searchQuery, Boolean(toolArgs.include_images));
        pushStatus(isDeepResearch ? "Gathering trusted sources..." : "Searching the web...");

        const searchRequest = fetchWithTimeout("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: searchQuery, num: isDeepResearch ? 8 : 6 }),
        }, 8000);

        const imageRequest = includeImages
          ? fetchWithTimeout("https://google.serper.dev/images", {
              method: "POST",
              headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ q: searchQuery, num: isDeepResearch ? 4 : 3 }),
            }, 8000)
          : null;

        const [searchResult, imageResult] = await Promise.allSettled([
          searchRequest,
          ...(imageRequest ? [imageRequest] : []),
        ]);

        if (searchResult.status !== "fulfilled" || !searchResult.value.ok) {
          pushStatus("Search failed, continuing with available info");
          continue;
        }

        const searchData = await searchResult.value.json();
        const imageData = imageRequest && imageResult?.status === "fulfilled" && imageResult.value.ok
          ? await imageResult.value.json()
          : null;

        let context = `Search: "${searchQuery}"\n`;
        if (searchData.organic?.length) {
          context += searchData.organic.map((r: any, i: number) =>
            `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.link}`
          ).join("\n\n");
        }

        if (searchData.knowledgeGraph) {
          const kg = searchData.knowledgeGraph;
          context = `${kg.title || ""}\n${kg.description || ""}\n\n${context}`;
          if (kg.imageUrl) allImages.add(kg.imageUrl);
        }

        if (imageData?.images) {
          imageData.images.slice(0, isDeepResearch ? 4 : 3).forEach((img: any) => {
            if (img.imageUrl) allImages.add(img.imageUrl);
          });
        }

        const organicCount = searchData.organic?.length || 0;
        pushStatus(organicCount > 0 ? (isDeepResearch ? "Reviewing the sources..." : "Reviewing the results...") : "Search completed");
        allSearchResults.push(context);
        continue;
      }

      // Browser agent (Computer Use) via HyperAgent async API
      if (toolName === "BROWSE_WEBSITE" && HB_API_KEY) {
        const browseGoal = String(toolArgs.goal || "").trim();
        const browseUrl = String(toolArgs.url || "").trim();
        if (!browseGoal) continue;

        const HB_BASE = "https://api.hyperbrowser.ai";
        const fullTask = browseUrl ? `Go to ${browseUrl} and ${browseGoal}` : browseGoal;

        pushStatus("Navigating...");
        pushBrowser({ currentStep: "Starting browser", currentUrl: browseUrl || undefined });
        if (browseUrl) pushStatus("Loading page...");

        try {
          const startResp = await fetchWithTimeout(`${HB_BASE}/api/task/hyper-agent`, {
            method: "POST",
            headers: { "x-api-key": HB_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ task: fullTask, maxSteps: 15, keepBrowserOpen: false }),
          }, 15000);

          if (!startResp.ok) {
            pushStatus("Failed to open browser");
            continue;
          }

          const startData = await startResp.json();
          const jobId = startData.jobId;
          if (!jobId) { pushStatus("No task ID returned"); continue; }

          pushStatus("Working on it...");
          pushBrowser({
            currentStep: "Browsing the web",
            liveUrl: startData.liveUrl || startData.sessionUrl || startData.previewUrl || undefined,
            screenshotUrl: startData.screenshotUrl || undefined,
          });

          let lastStepCount = 0;
          let pollCount = 0;
          const MAX_POLLS = 45;
          let finalResult: any = null;

          const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

          while (pollCount < MAX_POLLS) {
            await sleep(2000);
            pollCount++;

            try {
              const statusResp = await fetchWithTimeout(`${HB_BASE}/api/task/hyper-agent/${jobId}/status`, {
                headers: { "x-api-key": HB_API_KEY },
              }, 8000);

              if (!statusResp.ok) continue;

              const statusData = await statusResp.json();
              pushBrowser({
                liveUrl: statusData.liveUrl || statusData.sessionUrl || statusData.previewUrl || startData.liveUrl || undefined,
                screenshotUrl: statusData.screenshotUrl || statusData.latestScreenshot || undefined,
                currentStep: statusData.currentStep || undefined,
              });

              if (statusData.steps && Array.isArray(statusData.steps)) {
                const newSteps = statusData.steps.slice(lastStepCount);
                for (const step of newSteps) {
                  const desc = step.description || step.next_goal || step.action || "";
                  if (desc) {
                    pushStatus(desc);
                    pushBrowser({
                      currentStep: desc,
                      liveUrl: statusData.liveUrl || statusData.sessionUrl || statusData.previewUrl || undefined,
                      screenshotUrl: step.screenshotUrl || statusData.screenshotUrl || statusData.latestScreenshot || undefined,
                    });
                  }
                }
                lastStepCount = statusData.steps.length;
              }

              if (statusData.status === "completed" || statusData.status === "finished" || statusData.status === "done") {
                finalResult = statusData;
                break;
              }
              if (statusData.status === "failed" || statusData.status === "error") {
                pushStatus("Browser task failed");
                break;
              }
            } catch { continue; }
          }

          if (finalResult) {
            const output = finalResult.output || finalResult.result || JSON.stringify(finalResult);
            pushStatus("Browsing completed");
            pushBrowser({
              currentStep: "Data collection completed",
              liveUrl: finalResult.liveUrl || finalResult.sessionUrl || finalResult.previewUrl || undefined,
              screenshotUrl: finalResult.screenshotUrl || finalResult.latestScreenshot || undefined,
            });
            allSearchResults.push(`Browser Agent Result for "${browseGoal}":\n${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}`);
          } else {
            pushStatus("Browser task timed out");
          }
        } catch (browserErr) {
          console.error("Browser agent error:", browserErr);
          pushStatus("Browser error occurred");
        }
        continue;
      }

      // Media generation tools
      if (toolName === "GENERATE_IMAGE") {
        const prompt = String(toolArgs.prompt || "").trim();
        if (!prompt) continue;
        const imgModel = String(toolArgs.model || "nano-banana");
        const count = Math.min(Number(toolArgs.count) || 1, 4);
        pushStatus(`Generating ${count} image${count > 1 ? "s" : ""} with ${imgModel}...`);
        try {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
          const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
          const imgResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/generate-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
            body: JSON.stringify({ prompt, model: imgModel, num_images: count }),
          }, 60000);
          if (imgResp.ok) {
            const imgData = await imgResp.json();
            const urls = imgData.images || imgData.url ? [imgData.url] : [];
            if (urls.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ images: urls })}\n\n`));
              pushStatus(`Image${urls.length > 1 ? "s" : ""} generated successfully`);
              allSearchResults.push(`Generated ${urls.length} image(s) for: "${prompt}"`);
            }
          } else {
            pushStatus("Image generation failed");
          }
        } catch { pushStatus("Image generation error"); }
        continue;
      }

      if (toolName === "GENERATE_VIDEO") {
        const prompt = String(toolArgs.prompt || "").trim();
        if (!prompt) continue;
        pushStatus(`Generating video...`);
        try {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
          const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
          const vidResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/generate-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
            body: JSON.stringify({ prompt, model: String(toolArgs.model || "wan-x") }),
          }, 120000);
          if (vidResp.ok) {
            const vidData = await vidResp.json();
            pushStatus("Video generation started");
            allSearchResults.push(`Video generation initiated for: "${prompt}". ${vidData.taskId ? `Task ID: ${vidData.taskId}` : JSON.stringify(vidData)}`);
          } else {
            pushStatus("Video generation failed");
          }
        } catch { pushStatus("Video generation error"); }
        continue;
      }

      if (toolName === "GENERATE_VOICE") {
        const text = String(toolArgs.text || "").trim();
        if (!text) continue;
        pushStatus(`Generating speech...`);
        try {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
          const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
          const voiceResp = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/generate-voice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
            body: JSON.stringify({ text, voice: String(toolArgs.voice || "alloy") }),
          }, 30000);
          if (voiceResp.ok) {
            const voiceData = await voiceResp.json();
            pushStatus("Speech generated");
            allSearchResults.push(`Voice generated: ${voiceData.url || JSON.stringify(voiceData)}`);
          } else {
            pushStatus("Voice generation failed");
          }
        } catch { pushStatus("Voice generation error"); }
        continue;
      }

      // Canva slide creation via Hyperbrowser
      if (toolName === "CANVA_CREATE_SLIDES" && HB_API_KEY) {
        const topic = String(toolArgs.topic || "").trim();
        if (!topic) continue;
        const slideCount = Math.min(Math.max(Number(toolArgs.slide_count) || 10, 5), 20);
        const style = String(toolArgs.style || "professional");
        const outline = String(toolArgs.content_outline || "");

        const HB_BASE = "https://api.hyperbrowser.ai";
        const canvaTask = `Go to https://www.canva.com and create a ${style} presentation about "${topic}" with ${slideCount} slides. ${outline ? `Content outline: ${outline}` : `Create a well-structured presentation covering the key aspects of ${topic}.`} Use Canva's templates if available. After creating all slides, download the presentation as PPTX format and provide the download link.`;

        pushStatus(`Opening Canva to create presentation...`);
        pushStatus(`Topic: ${topic} — ${slideCount} slides`);

        try {
          const startResp = await fetchWithTimeout(`${HB_BASE}/api/task/hyper-agent`, {
            method: "POST",
            headers: { "x-api-key": HB_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ task: canvaTask, maxSteps: 30, keepBrowserOpen: false }),
          }, 15000);

          if (!startResp.ok) {
            pushStatus("Failed to open Canva browser");
            allSearchResults.push(`Failed to create Canva presentation for "${topic}". Browser could not be opened.`);
            continue;
          }

          const startData = await startResp.json();
          const jobId = startData.jobId;
          if (!jobId) { pushStatus("No task ID"); continue; }

          pushStatus("Canva opened — creating slides...");

          let lastStepCount = 0;
          let pollCount = 0;
          const MAX_POLLS = 90; // ~3 min for Canva
          let finalResult: any = null;
          const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

          while (pollCount < MAX_POLLS) {
            await sleep(2000);
            pollCount++;
            try {
              const statusResp = await fetchWithTimeout(`${HB_BASE}/api/task/hyper-agent/${jobId}/status`, {
                headers: { "x-api-key": HB_API_KEY },
              }, 8000);
              if (!statusResp.ok) continue;
              const statusData = await statusResp.json();

              if (statusData.steps && Array.isArray(statusData.steps)) {
                const newSteps = statusData.steps.slice(lastStepCount);
                for (const s of newSteps) {
                  const desc = s.description || s.next_goal || s.action || "";
                  if (desc) pushStatus(desc);
                }
                lastStepCount = statusData.steps.length;
              }

              if (statusData.status === "completed" || statusData.status === "finished" || statusData.status === "done") {
                finalResult = statusData;
                break;
              }
              if (statusData.status === "failed" || statusData.status === "error") {
                pushStatus("Canva task failed");
                break;
              }
            } catch { continue; }
          }

          if (finalResult) {
            const output = finalResult.output || finalResult.result || JSON.stringify(finalResult);
            pushStatus("Presentation created successfully");
            allSearchResults.push(`Canva presentation created for "${topic}":\n${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}`);
          } else {
            pushStatus("Canva task timed out");
            allSearchResults.push(`Canva presentation creation timed out for "${topic}". The browser took too long.`);
          }
        } catch (err) {
          console.error("Canva error:", err);
          pushStatus("Canva creation error");
        }
        continue;
      }

      if (!COMPOSIO_API_KEY || !toolName) continue;

      pushStatus(`Executing ${toolName.split("_")[0]} action...`);

      let connData: any;
      try {
        const connResp = await fetchWithTimeout(`${COMPOSIO_BASE}/connectedAccounts?user_uuid=default`, {
          headers: { "x-api-key": COMPOSIO_API_KEY, "Content-Type": "application/json" },
        }, 8000);
        connData = await connResp.json();
      } catch {
        pushStatus("Integration service unavailable");
        continue;
      }

      const accounts = connData.items || connData || [];
      const appName = toolName.split("_")[0].toLowerCase();
      const account = accounts.find((a: any) =>
        (a.appName || "").toLowerCase().includes(appName) ||
        (a.appUniqueId || "").toLowerCase().includes(appName)
      );

      if (!account) {
        const serviceName = toolName.split("_")[0];
        const friendlyNames: Record<string, string> = {
          GMAIL: "Gmail", GITHUB: "GitHub", SLACK: "Slack", GOOGLE: "Google",
          NOTION: "Notion", DISCORD: "Discord", LINKEDIN: "LinkedIn", YOUTUBE: "YouTube",
        };
        const displayName = friendlyNames[serviceName] || serviceName;
        const connectCard = `\n\n\`\`\`json\n{"type":"cards","items":[{"title":"Connect ${displayName}","description":"You need to connect your ${displayName} account to use this feature. Go to Integrations to set it up.","action":"Connect"}]}\n\`\`\`\n\nPlease connect your **${displayName}** account first from the Integrations page, then try again.`;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: connectCard } }] })}\n\n`));
        continue;
      }

      try {
        pushStatus(`Running ${toolName}...`);
        const execResp = await fetchWithTimeout(`${COMPOSIO_BASE}/actions/${encodeURIComponent(toolName)}/execute`, {
          method: "POST",
          headers: { "x-api-key": COMPOSIO_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ connectedAccountId: account.id, input: toolArgs }),
        }, 15000);
        const execData = await execResp.json();

        if (execResp.ok) {
          pushStatus(`${toolName} completed successfully`);
          const resultText = `\n\n---\n✅ **${toolName}** executed successfully.\n\`\`\`json\n${JSON.stringify(execData.data || execData, null, 2).slice(0, 1500)}\n\`\`\``;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: resultText } }] })}\n\n`));
        } else {
          pushStatus(`${toolName} failed`);
          const resultText = `\n\n---\n❌ **${toolName}** failed: ${JSON.stringify(execData).slice(0, 500)}`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: resultText } }] })}\n\n`));
        }
      } catch (execErr) {
        pushStatus(`${toolName} timed out`);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n---\n⚠️ **${toolName}** timed out. Please try again.` } }] })}\n\n`));
      }
    } catch (toolErr) {
      console.error("Tool execution error:", toolErr);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\nAn error occurred while executing the tool. Continuing with available information." } }] })}\n\n`));
    }
  }

  if (allSearchResults.length > 0) {
    // CRITICAL: Send images FIRST before synthesis starts so user sees them immediately
    const images = Array.from(allImages);
    if (images.length > 0) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ images })}\n\n`));
    }

    // Send products data early
    if (allProducts.length > 0) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ products: allProducts })}\n\n`));
    }

    pushStatus(isDeepResearch ? "Writing the report now..." : (isShopping ? "Preparing recommendations..." : "Writing response..."));
    const combinedContext = allSearchResults.join("\n\n=== Next Source ===\n\n");

    // Build image context for inline placement
    const imageUrlsList = images.map((url, i) => `[Image ${i+1}]: ${url}`).join("\n");

    const searchMessages = [
      ...originalBody.messages,
      { role: "assistant", content: "I have gathered comprehensive information from multiple sources. Now writing the full report." },
      { role: "user", content: `Here are the search results:\n\n${combinedContext}\n\n${images.length > 0 ? `Available images to include inline:\n${imageUrlsList}\n\n` : ""}${isShopping 
        ? `CRITICAL INSTRUCTIONS FOR SHOPPING RESPONSE:
- Write ONE single, clean, organized response. Do NOT send multiple separate messages.
- Format each product clearly with: name, price, store, rating, and a purchase link.
- Use a comparison table for 3+ products.
- Give a clear "Best Pick" recommendation at the top.
- Use bullet points (•) and dashes (-) for organized lists.
- Use bold (**text**) for product names and prices.
- ALWAYS use the same language the user used. If Arabic → write EVERYTHING in Arabic.
- NEVER mention tool names, search queries, or internal steps.` 
        : isDeepResearch 
          ? `CRITICAL INSTRUCTIONS FOR DEEP RESEARCH REPORT:
- Write an EXTREMELY detailed, comprehensive research report of AT LEAST 3000-5000 words.
- The report must be a MASSIVE, professional-grade document — not a brief summary.
- CRITICAL: Start by placing the most relevant images at the VERY TOP using ![description](url) BEFORE the text.
- Then write the full report below the images.
- LANGUAGE (MOST CRITICAL): DETECT the language of the user's ORIGINAL query and write the ENTIRE report in that EXACT language.
  * If the user wrote in English → write EVERYTHING in English
  * If the user wrote in Arabic → write EVERYTHING in Arabic  
  * If the user wrote in French → write EVERYTHING in French
  * If the user wrote in ANY other language → write EVERYTHING in that language
  * Do NOT default to Arabic. DETECT from the actual user text.
- Structure with MANY sections and sub-sections:
  ## Executive Summary (200+ words)
  ## Background & Context (300+ words)
  ## Key Findings (500+ words with sub-sections)
  ## Detailed Analysis (800+ words with multiple sub-sections)
  ## Data & Statistics (use tables for comparisons)
  ## Expert Opinions & Perspectives
  ## Future Outlook & Predictions
- Do NOT include a "Sources", "References", or "Sources & References" section at the end. Cite sources INLINE only using [Source Name](URL) within the text.
- Include images inline throughout using ![description](url) — spread them across sections.
- Use bullet points (•), numbered lists, bold text, and tables extensively.
- Do NOT show any raw search data, internal steps, or tool outputs.
- Do NOT abbreviate or shorten. Write the FULL detailed report.`
          : `Synthesize the information naturally and cite sources with [Source Name](URL). Match the user's language. Use bullet points (•) and dashes (-) for organized responses. Use bold for key points.`}` },
    ];

    const secondBody: any = {
      model: modelId,
      messages: searchMessages,
      stream: true,
      max_tokens: isDeepResearch ? 8192 : (isShopping ? 2048 : 2048),
    };

    try {
      const secondResp = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(secondBody),
      });

      if (secondResp.ok && secondResp.body) {
        const secondReader = secondResp.body.getReader();
        const decoder = new TextDecoder();
        let buf2 = "";

        while (true) {
          const { done: d2, value: v2 } = await secondReader.read();
          if (d2) break;
          buf2 += decoder.decode(v2, { stream: true });
          const lines2 = buf2.split("\n");
          buf2 = lines2.pop() || "";

          for (const l2 of lines2) {
            if (!l2.startsWith("data: ")) continue;
            const d = l2.slice(6).trim();
            if (d === "[DONE]") continue;

            try {
              const p = JSON.parse(d);
              const delta2 = p.choices?.[0]?.delta;
              if (!delta2) continue;

              // Ignore nested tool calls in synthesis - prevents infinite loops
              if (delta2.tool_calls) continue;

              const c = delta2.content;
              if (c) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`));
            } catch {
              continue;
            }
          }
        }
      } else {
        console.error("Synthesis call failed:", secondResp.status);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\n" + combinedContext.slice(0, 3000) } }] })}\n\n`));
      }
    } catch (e) {
      console.error("Synthesis error:", e);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\nFailed to synthesize results:\n\n" + combinedContext.slice(0, 2000) } }] })}\n\n`));
    }
  }
}
