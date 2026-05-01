import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowUp, Plus, Image as ImageIcon, Paperclip, Camera,
  Loader2, Database, Github, Play, Settings, Pencil, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import AppLayout from "@/layouts/AppLayout";
import CodeChatContainer from "@/components/code/CodeChatContainer";
import { CodeStep, StepType } from "@/components/code/CodeStepMessage";
import ConnectIntegrationsSheet from "@/components/code/ConnectIntegrationsSheet";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BUILD_CREDIT_COST = 5;

interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "plan" | "build" | "log" | "status" | "steps" | "timeline" | "api_key_request";
  meta?: { durationMs?: number; credits?: number };
  apiKeyName?: string;
  apiKeyDescription?: string;
  apiKeyResolved?: boolean;
}

interface Attachment { name: string; type: "image" | "file"; data: string; }

let stepCounter = 0;
const makeStep = (type: StepType, text: string, file?: string): CodeStep => ({
  id: `step-${++stepCounter}`, type, text, file, status: "active",
});

const CodeWorkspace = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";
  const paramConversationId = searchParams.get("conversation_id") || "";
  const paramProjectId = searchParams.get("project_id") || "";

  // --- State ---
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState<CodeStep[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(paramConversationId || null);
  const [projectId, setProjectId] = useState<string | null>(paramProjectId || null);
  const [weblyProjectId, setWeblyProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("New Project");
  const [hasBuilt, setHasBuilt] = useState(false);

  // UI state
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [integrationsInitialView, setIntegrationsInitialView] = useState<"menu" | "supabase" | "github">("menu");

  // Resizable bottom sheet
  const [projectMenuHeight, setProjectMenuHeight] = useState(440);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(440);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const { userId, credits, hasEnoughCredits, refreshCredits, loading: creditsLoading } = useCredits();

  // --- Load existing project ---
  useEffect(() => {
    if (!paramProjectId) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, webly_project_id, conversation_id")
        .eq("id", paramProjectId)
        .maybeSingle();
      if (data) {
        setProjectName(data.name || "Project");
        setWeblyProjectId((data as any).webly_project_id || null);
        if (data.conversation_id) setConversationId(data.conversation_id);
        setHasBuilt(true);
      }
    })();
  }, [paramProjectId]);

  // --- Load conversation messages — never wipe local; merge if needed ---
  useEffect(() => {
    if (!paramConversationId) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("conversation_id", paramConversationId)
        .order("created_at", { ascending: true });
      if (data?.length) setMessages(data.map(m => ({ role: m.role as any, content: m.content })));
    })();
  }, [paramConversationId]);

  // --- Auto-fire initial prompt ---
  useEffect(() => {
    if (initRef.current || !initialPrompt || messages.length > 0 || creditsLoading) return;
    initRef.current = true;
    handleSend(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, creditsLoading]);

  // --- Step helpers ---
  const addStep = async (type: StepType, text: string, file?: string): Promise<CodeStep> => {
    const step = makeStep(type, text, file);
    setSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "done" as const } : s).concat(step));
    setActiveStepId(step.id);
    await new Promise(r => setTimeout(r, 250));
    return step;
  };
  const completeAllSteps = () => {
    setSteps(prev => prev.map(s => ({ ...s, status: "done" as const })));
    setActiveStepId(null);
  };

  // --- Conversation helper ---
  const ensureConversation = async (firstMessage: string) => {
    if (conversationId) return conversationId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const title = firstMessage.slice(0, 50) || "Code Project";
    const { data } = await supabase
      .from("conversations")
      .insert({ title, mode: "code", user_id: user.id } as any)
      .select("id").single();
    if (data) { setConversationId(data.id); return data.id; }
    return null;
  };

  // --- AI two-word project name ---
  const generateProjectName = async (prompt: string): Promise<string> => {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/name-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json().catch(() => ({} as any));
      const name = (data?.name || "").trim();
      if (name) return name;
    } catch {}
    return prompt.split(/\s+/).slice(0, 2).join(" ").slice(0, 30) || "New Project";
  };

  // --- Project helper ---
  const ensureProject = async (firstMessage: string, weblyId: string, convId: string | null) => {
    if (projectId) {
      await supabase.from("projects").update({
        webly_project_id: weblyId, status: "ready", updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      return projectId;
    }
    if (!userId) return null;
    const name = await generateProjectName(firstMessage);
    const { data } = await supabase.from("projects").insert({
      user_id: userId,
      name,
      description: firstMessage.slice(0, 200),
      status: "ready",
      webly_project_id: weblyId,
      conversation_id: convId,
    } as any).select("id").single();
    if (data) {
      setProjectId(data.id);
      setProjectName(name);
      // Capture screenshot in background once a preview exists
      captureScreenshot(data.id, weblyId);
      return data.id;
    }
    return null;
  };

  // --- Screenshot via Webly preview URL → store on project.preview_url is the published URL.
  // For card thumbnails we use a separate column `thumbnail_url`. We try to fetch a screenshot
  // via the screenshot edge function (uses ScreenshotOne).
  const captureScreenshot = async (pid: string, weblyId: string) => {
    try {
      const url = `https://wxphtsgezburjqoqiqqo.supabase.co/functions/v1/webly-site/${weblyId}/`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/capture-screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ url, project_id: pid }),
      });
      // Edge function (best-effort) writes to projects.thumbnail_url itself; ignore errors
      if (!r.ok) return;
    } catch {}
  };

  // --- Persist a single message to DB ---
  const persistMessage = async (convId: string | null, msg: ChatMsg) => {
    if (!convId) return;
    try {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: msg.role,
        content: msg.content,
      } as any);
    } catch {}
  };

  // --- Handle API key submission ---
  const handleApiKeySubmit = async (keyName: string, keyValue: string) => {
    if (!userId || !keyName) return;
    try {
      await supabase.from("code_integrations").upsert({
        user_id: userId,
        project_id: projectId,
        provider: keyName,
        config: { api_key: keyValue },
      } as any, { onConflict: "user_id,project_id,provider" });
      setMessages(prev => prev.map(m =>
        m.type === "api_key_request" && m.apiKeyName === keyName ? { ...m, apiKeyResolved: true } : m
      ));
      toast.success(`${keyName} saved`);
    } catch {
      toast.error("Failed to save key");
    }
  };

  // --- Send / build ---
  const handleSend = async (textOverride?: string) => {
    const msgText = textOverride ?? input;
    if (!msgText.trim() || isLoading) return;
    if (creditsLoading) return;
    if (credits !== null && !hasEnoughCredits(BUILD_CREDIT_COST)) {
      toast.error("Not enough MC. You need 5 MC to build.");
      return;
    }

    if (!textOverride) setInput("");
    const userMsg: ChatMsg = { role: "user", content: msgText };
    setMessages(prev => [...prev, userMsg]);
    setAttachments([]);
    setIsLoading(true);
    setSteps([]);

    const startedAt = Date.now();
    const convId = await ensureConversation(msgText);
    persistMessage(convId, userMsg);

    if (userId) {
      const dedResp = await fetch(`${SUPABASE_URL}/functions/v1/deduct-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ user_id: userId, amount: BUILD_CREDIT_COST, action_type: "code_build", description: "Webly build" }),
      });
      const ded = await dedResp.json().catch(() => ({}));
      if (!ded.success) {
        toast.error(ded.error || "Not enough credits");
        setIsLoading(false);
        return;
      }
      refreshCredits();
    }

    await addStep("thinking", "Thinking");

    const wpid = weblyProjectId || `megsy-${userId?.slice(0, 8) || "u"}-${Date.now().toString(36)}`;
    if (!weblyProjectId) setWeblyProjectId(wpid);

    let buildError: string | null = null;
    let assistantBuffer = "";
    const flushAssistant = () => {
      if (!assistantBuffer.trim()) return;
      const finalText = assistantBuffer.trim();
      assistantBuffer = "";
      const m: ChatMsg = { role: "assistant", content: finalText, type: "build" };
      setMessages(prev => [...prev, m]);
      persistMessage(convId, m);
    };

    try {
      // Pure pass-through to the Webly backend (per user instruction)
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/webly-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "generate",
          project_id: wpid,
          prompt: msgText,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({} as any));
        buildError = errBody?.error || "Build service is busy. Try again shortly.";
        throw new Error(buildError);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const seenFiles = new Set<string>();
      let generatedFiles: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === "text" && typeof ev.delta === "string") {
              assistantBuffer += ev.delta;
            } else if (ev.type === "status" && typeof ev.message === "string") {
              await addStep("thinking", ev.message);
            } else if (ev.type === "file_start" && ev.path && !seenFiles.has(ev.path)) {
              seenFiles.add(ev.path);
              await addStep("creating", "Creating", ev.path);
            } else if (ev.type === "file_done" && ev.path) {
              if (typeof ev.content === "string") generatedFiles[ev.path] = ev.content;
              setSteps(prev => prev.map(s => s.file === ev.path ? { ...s, status: "done" as const } : s));
            } else if (ev.type === "done" && ev.files && typeof ev.files === "object") {
              generatedFiles = { ...generatedFiles, ...(ev.files as Record<string, string>) };
            } else if (ev.type === "verify_start") {
              await addStep("searching", "Verifying");
            } else if (ev.type === "verify_done") {
              await addStep("done", ev.ok ? "Verified" : "Fixing");
            } else if (ev.type === "request_api_key" && ev.name) {
              flushAssistant();
              const keyMsg: ChatMsg = {
                role: "assistant",
                type: "api_key_request",
                content: `Need API key: ${ev.name}`,
                apiKeyName: ev.name,
                apiKeyDescription: ev.description || ev.message || "Required to continue.",
              };
              setMessages(prev => [...prev, keyMsg]);
              persistMessage(convId, keyMsg);
            }
          } catch {}
        }
      }

      completeAllSteps();
      setHasBuilt(true);
      flushAssistant();

      const pid = await ensureProject(msgText, wpid, convId);
      if (pid && Object.keys(generatedFiles).length > 0) {
        await supabase.from("projects").update({ files_snapshot: generatedFiles as any }).eq("id", pid);
        // Now snapshot exists — try a screenshot
        captureScreenshot(pid, wpid);
      }
    } catch (e) {
      completeAllSteps();
      flushAssistant();
      const durationMs = Date.now() - startedAt;
      const errMsg: ChatMsg = {
        role: "assistant",
        content: buildError || (e instanceof Error ? e.message : "Build failed."),
        meta: { durationMs, credits: 0 },
      };
      setMessages(prev => [...prev, errMsg]);
      persistMessage(convId, errMsg);
      if (userId) {
        fetch(`${SUPABASE_URL}/functions/v1/deduct-credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ user_id: userId, amount: -BUILD_CREDIT_COST, action_type: "code_build_refund", description: "Refund: build failed" }),
        }).then(() => refreshCredits()).catch(() => {});
      }
    }

    setIsLoading(false);
  };

  // --- Attachment handlers ---
  const handleFilePick = (kind: "file" | "image" | "camera") => {
    setPlusMenuOpen(false);
    if (kind === "camera") cameraInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        setAttachments(prev => [...prev, {
          name: f.name,
          type: f.type.startsWith("image") ? "image" : "file",
          data: String(ev.target?.result || ""),
        }]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  // --- Rename ---
  const handleRename = async () => {
    if (!projectId || !renameValue.trim()) { setRenameOpen(false); return; }
    const newName = renameValue.trim().slice(0, 80);
    await supabase.from("projects").update({ name: newName }).eq("id", projectId);
    setProjectName(newName);
    setRenameOpen(false);
    setProjectMenuOpen(false);
    toast.success("Project renamed");
  };

  const openIntegrations = (initial: "menu" | "supabase" | "github" = "menu") => {
    setProjectMenuOpen(false);
    setPlusMenuOpen(false);
    setIntegrationsInitialView(initial);
    setIntegrationsOpen(true);
  };

  const handleOpenPreview = useCallback(() => {
    if (!weblyProjectId || !projectId) {
      toast.info("Build something first to preview.");
      return;
    }
    navigate(`/code/preview/${projectId}?webly=${weblyProjectId}${conversationId ? `&conversation_id=${conversationId}` : ""}`);
  }, [weblyProjectId, projectId, conversationId, navigate]);

  // --- Swipe-left → preview ---
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current, sy = touchStartY.current;
    if (sx == null || sy == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 60 && dx < 0 && hasBuilt) {
      handleOpenPreview();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // --- Resizable sheet handlers ---
  const onResizeStart = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartH.current = projectMenuHeight;
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.clientY - dragStartY.current;
    const h = Math.max(220, Math.min(window.innerHeight * 0.9, dragStartH.current - dy));
    setProjectMenuHeight(h);
  };
  const onResizeEnd = () => { dragStartY.current = null; };

  return (
    <AppLayout
      onSelectConversation={(id) => navigate(`/code/workspace?conversation_id=${id}`)}
      onNewChat={() => navigate("/code")}
      activeConversationId={conversationId}
    >
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative h-[100dvh] w-full bg-background overflow-hidden flex flex-col"
      >
        {/* Floating header */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
          <button
            onClick={() => navigate("/code")}
            className="pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-card/60 backdrop-blur-md transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setProjectMenuOpen(true)}
            className="pointer-events-auto px-4 py-2 rounded-full liquid-glass-button text-sm font-semibold text-foreground hover:scale-[1.02] transition-all max-w-[55vw] truncate flex items-center gap-1.5"
          >
            {projectName}
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Preview pill — Play icon + label */}
          <button
            onClick={handleOpenPreview}
            disabled={!hasBuilt}
            className="pointer-events-auto h-10 px-3.5 rounded-full liquid-glass-button flex items-center gap-1.5 text-foreground/90 hover:text-foreground hover:scale-[1.02] transition-all disabled:opacity-40"
            aria-label="Preview"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            <span className="text-xs font-semibold">Preview</span>
          </button>
        </div>

        {/* Project bottom sheet — resizable */}
        <AnimatePresence>
          {projectMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setProjectMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ height: projectMenuHeight }}
                className="fixed bottom-0 inset-x-0 z-50 rounded-t-[28px] liquid-glass-milk px-5 pt-3 pb-8 overflow-y-auto"
              >
                {/* drag handle (resize) */}
                <div
                  onPointerDown={onResizeStart}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeEnd}
                  onPointerCancel={onResizeEnd}
                  className="w-full h-6 flex items-center justify-center cursor-ns-resize touch-none mb-1"
                >
                  <div className="w-12 h-1.5 rounded-full bg-foreground/25" />
                </div>

                {/* Credits */}
                <div className="rounded-2xl liquid-glass-button px-4 py-3.5 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">Credits</span>
                    <span className="text-sm font-semibold text-foreground/80">{credits ?? "—"} left</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 transition-all"
                      style={{ width: `${Math.min(100, ((credits ?? 0) / 100) * 100)}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => { setProjectMenuOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-[15px] text-foreground liquid-glass-hover transition-colors"
                >
                  <Settings className="w-5 h-5" /> Settings
                </button>
                <button
                  onClick={() => { setProjectMenuOpen(false); setRenameValue(projectName); setRenameOpen(true); }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-[15px] text-foreground liquid-glass-hover transition-colors"
                >
                  <Pencil className="w-5 h-5" /> Rename project
                </button>
                <button
                  onClick={() => { setProjectMenuOpen(false); handleOpenPreview(); }}
                  disabled={!hasBuilt}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-[15px] text-foreground liquid-glass-hover transition-colors disabled:opacity-40"
                >
                  <Play className="w-5 h-5" fill="currentColor" /> Open preview
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* + plus menu — grid (Supabase, Image, File) */}
        <AnimatePresence>
          {plusMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setPlusMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed bottom-0 inset-x-0 z-50 rounded-t-[28px] liquid-glass-milk px-5 pt-3 pb-8"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full bg-foreground/20 mx-auto mb-4" />
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-3">Add to project</p>

                {/* Top row: 2 squares */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => openIntegrations("supabase")}
                    className="aspect-[4/3] rounded-2xl liquid-glass-button flex flex-col items-center justify-center gap-2 text-foreground hover:scale-[1.02] transition-transform"
                  >
                    <Database className="w-7 h-7 text-emerald-500" />
                    <span className="text-sm font-semibold">Supabase</span>
                    <span className="text-[10px] text-muted-foreground">Connect database</span>
                  </button>
                  <button
                    onClick={() => handleFilePick("image")}
                    className="aspect-[4/3] rounded-2xl liquid-glass-button flex flex-col items-center justify-center gap-2 text-foreground hover:scale-[1.02] transition-transform"
                  >
                    <ImageIcon className="w-7 h-7 text-fuchsia-500" />
                    <span className="text-sm font-semibold">Image</span>
                    <span className="text-[10px] text-muted-foreground">Attach a photo</span>
                  </button>
                </div>

                {/* Bottom: full-width */}
                <button
                  onClick={() => handleFilePick("file")}
                  className="w-full rounded-2xl liquid-glass-button flex items-center gap-3 px-5 py-4 text-foreground hover:scale-[1.01] transition-transform"
                >
                  <Paperclip className="w-6 h-6 text-amber-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold">File</p>
                    <p className="text-[11px] text-muted-foreground">Attach any document</p>
                  </div>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Chat */}
        <div className="flex-1 overflow-hidden pt-14 pb-44 min-h-0">
          <CodeChatContainer messages={messages} steps={steps} activeStepId={activeStepId} isThinking={isLoading && steps.length === 0} onSubmitApiKey={handleApiKeySubmit} />
        </div>

        {/* Bottom input */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-3 pt-6 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card border border-border/60 text-xs">
                    {a.type === "image" ? <ImageIcon className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
                    <span className="truncate max-w-[100px]">{a.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[28px] bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl shadow-primary/5 p-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isLoading ? "Building..." : hasBuilt ? "Describe your changes..." : "Describe your project..."}
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 px-2 py-1.5 max-h-32 disabled:opacity-60"
              />

              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => setPlusMenuOpen(true)}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                  aria-label="Add"
                >
                  <Plus className="w-5 h-5" />
                </button>

                <div className="flex-1" />

                {/* Send — fully hidden while building (per user request) */}
                {!isLoading && (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-25 flex items-center justify-center"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                )}
                {isLoading && (
                  <div className="h-9 w-9 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {/* Rename dialog */}
        <AnimatePresence>
          {renameOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRenameOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl liquid-glass-milk p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Rename project</h3>
                <input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(); }}
                  placeholder="Project name"
                  autoFocus
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground border border-border outline-none focus:border-primary transition-colors"
                />
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setRenameOpen(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-accent/60 transition-colors">Cancel</button>
                  <button onClick={handleRename} disabled={!renameValue.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-colors">Save</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <ConnectIntegrationsSheet
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        userId={userId}
        projectId={projectId}
        initialView={integrationsInitialView}
      />
    </AppLayout>
  );
};

export default CodeWorkspace;
