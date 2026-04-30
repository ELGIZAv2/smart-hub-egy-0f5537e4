import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, ArrowUp, Plus, MoreHorizontal, Image as ImageIcon, Paperclip, Camera,
  Loader2, Database, Github, Eye, Settings, Pencil, Coins, X, Check, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import AppLayout from "@/layouts/AppLayout";
import AppSidebar from "@/components/AppSidebar";
import CodeChatContainer from "@/components/code/CodeChatContainer";
import { CodeStep, StepType } from "@/components/code/CodeStepMessage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const WEBLY_BASE = "https://wxphtsgezburjqoqiqqo.supabase.co/functions/v1";
const BUILD_CREDIT_COST = 5;

interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
  type?: "plan" | "build" | "log" | "status" | "steps" | "timeline";
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
  const [planMode, setPlanMode] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(paramConversationId || null);
  const [projectId, setProjectId] = useState<string | null>(paramProjectId || null);
  const [weblyProjectId, setWeblyProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("New Project");
  const [hasBuilt, setHasBuilt] = useState(false);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

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

  // --- Load conversation messages ---
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

  // --- Project helper ---
  const ensureProject = async (firstMessage: string, weblyId: string, convId: string | null) => {
    if (projectId) {
      await supabase.from("projects").update({
        webly_project_id: weblyId, status: "ready", updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      return projectId;
    }
    if (!userId) return null;
    const name = firstMessage.slice(0, 60) || "Untitled Project";
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
      return data.id;
    }
    return null;
  };

  // --- Capture screenshot in background ---
  const captureScreenshot = async (pid: string, weblyId: string) => {
    if (!userId) return;
    // Wait a few seconds for site to be ready
    await new Promise(r => setTimeout(r, 4000));
    fetch(`${SUPABASE_URL}/functions/v1/webly-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ action: "screenshot", project_id: pid, user_id: userId, url: `${WEBLY_BASE}/webly-site/${weblyId}` }),
    }).catch(() => {});
  };

  // --- Send message / build ---
  const handleSend = async (textOverride?: string) => {
    const msgText = textOverride ?? input;
    if (!msgText.trim() || isLoading) return;
    if (creditsLoading) return;
    if (credits !== null && !hasEnoughCredits(BUILD_CREDIT_COST)) {
      toast.error("Not enough MC. You need 5 MC to build.");
      return;
    }

    if (!textOverride) setInput("");
    setMessages(prev => [...prev, { role: "user", content: msgText }]);
    setAttachments([]);
    setIsLoading(true);
    setSteps([]);

    const convId = await ensureConversation(msgText);

    // Deduct
    if (userId) {
      const dedResp = await fetch(`${SUPABASE_URL}/functions/v1/deduct-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ user_id: userId, amount: BUILD_CREDIT_COST, action_type: "code_build", description: "Webly build" }),
      });
      const ded = await dedResp.json().catch(() => ({}));
      if (!ded.success) {
        toast.error(ded.error || "MC deduction failed");
        setIsLoading(false);
        return;
      }
      refreshCredits();
    }

    await addStep("pre_message", planMode ? "Planning your build..." : "Got it. Building now...");
    await addStep("thinking", "Analyzing request");

    // Use existing webly project id if available, else generate
    const wpid = weblyProjectId || `megsy-${userId?.slice(0, 8) || "u"}-${Date.now().toString(36)}`;
    if (!weblyProjectId) setWeblyProjectId(wpid);

    let buildError: string | null = null;
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/webly-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "generate",
          project_id: wpid,
          prompt: msgText,
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([{ role: "user", content: msgText }]),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({} as any));
        buildError = errBody?.error || "Build service is busy right now. Please try again shortly.";
        throw new Error(buildError);
      }

      await addStep("writing", "Generating code");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const seenFiles = new Set<string>();

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
            if (ev.type === "file_start" && ev.path && !seenFiles.has(ev.path)) {
              seenFiles.add(ev.path);
              await addStep("creating", "Creating", ev.path);
            } else if (ev.type === "file_done" && ev.path) {
              setSteps(prev => prev.map(s =>
                s.file === ev.path ? { ...s, status: "done" as const } : s
              ));
            } else if (ev.type === "verify_start") {
              await addStep("searching", "Verifying in browser");
            } else if (ev.type === "verify_done") {
              await addStep("done", ev.ok ? "Verification passed" : "Fixing issues");
            }
          } catch {}
        }
      }

      completeAllSteps();
      setHasBuilt(true);

      const fileCount = seenFiles.size || 1;
      const isAr = /[\u0600-\u06FF]/.test(msgText);
      const reply = isAr
        ? `تمام، خلصت! بنيت ${fileCount} ملف. اضغط Preview علشان تشوف الموقع.`
        : `Done! Built ${fileCount} files. Tap Preview to see your site live.`;
      setMessages(prev => [...prev, { role: "assistant", content: reply, type: "build" }]);

      const pid = await ensureProject(msgText, wpid, convId);

      if (convId) {
        supabase.from("messages").insert([
          { conversation_id: convId, role: "user", content: msgText },
          { conversation_id: convId, role: "assistant", content: reply },
        ]);
      }

      // Background screenshot
      if (pid) captureScreenshot(pid, wpid);
    } catch (e) {
      completeAllSteps();
      const isAr = /[\u0600-\u06FF]/.test(msgText);
      const fallback = isAr
        ? (buildError ? "خدمة البناء مشغولة حالياً. تم استرداد رصيدك، حاول مرة أخرى." : "حصل خطأ أثناء البناء. تم استرداد رصيدك.")
        : (buildError || "Build failed. Your credits were refunded.");
      setMessages(prev => [...prev, { role: "assistant", content: fallback }]);
      // Refund the deducted credits since the build never started
      if (userId) {
        fetch(`${SUPABASE_URL}/functions/v1/deduct-credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ user_id: userId, amount: -BUILD_CREDIT_COST, action_type: "code_build_refund", description: "Refund: build service unavailable" }),
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

  // --- Supabase connect (fixed-text UX) ---
  const [supaUrl, setSupaUrl] = useState("");
  const [supaKey, setSupaKey] = useState("");
  const handleSupabaseConnect = async () => {
    if (!supaUrl.trim() || !supaKey.trim() || !userId) return;
    // Save to integrations (server-only readable from edge functions)
    await supabase.from("code_integrations").upsert({
      user_id: userId,
      project_id: projectId,
      provider: "supabase",
      config: { url: supaUrl.trim(), anon_key: supaKey.trim() },
    } as any, { onConflict: "user_id,project_id,provider" });

    setSupabaseModalOpen(false);
    setSupaUrl(""); setSupaKey("");

    // Fixed messages
    setMessages(prev => [
      ...prev,
      { role: "user", content: "I have connected the backend." },
      {
        role: "assistant",
        content:
          "Backend connected. We can now build:\n\n• User authentication (sign-up, sign-in, password reset)\n• User profiles & settings\n• Database tables with row-level security\n• File uploads & storage\n• Real-time data sync\n• Subscription & payment flows\n\nJust tell me what you want to add.",
      },
    ]);
  };

  // --- GitHub push ---
  const handleGithubPush = async () => {
    setMoreMenuOpen(false);
    if (!hasBuilt || !weblyProjectId) {
      toast.error("Build something first.");
      return;
    }
    setGithubBusy(true);
    try {
      // Fetch generated files snapshot from webly
      const filesResp = await fetch(`${WEBLY_BASE}/webly-site/${weblyProjectId}/__files`);
      const filesData = await filesResp.json().catch(() => ({}));
      const files = filesData?.files || filesData || {};

      const r = await fetch(`${SUPABASE_URL}/functions/v1/github-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          user_id: userId,
          project_name: projectName,
          description: `Built with Megsy AI — ${projectName}`,
          files: typeof files === "object" ? files : {},
        }),
      });
      const data = await r.json();
      if (data.ok && data.repo_url) {
        await supabase.from("projects").update({ repo_url: data.repo_url }).eq("id", projectId!);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Repository created on your GitHub: [${data.repo_url}](${data.repo_url})`,
        }]);
        toast.success("Pushed to GitHub");
      } else if (data.needs_oauth) {
        toast.error("Connect your GitHub account first (coming soon).");
      } else {
        toast.error("GitHub push failed.");
      }
    } catch {
      toast.error("GitHub push failed.");
    }
    setGithubBusy(false);
  };

  const handleOpenPreview = () => {
    if (!weblyProjectId || !projectId) {
      toast.info("Build something first to preview.");
      return;
    }
    navigate(`/code/preview/${projectId}?webly=${weblyProjectId}${conversationId ? `&conversation_id=${conversationId}` : ""}`);
  };

  return (
    <AppLayout
      onSelectConversation={(id) => navigate(`/code/workspace?conversation_id=${id}`)}
      onNewChat={() => navigate("/code")}
      activeConversationId={conversationId}
    >
      <div className="relative h-[100dvh] w-full bg-background overflow-hidden flex flex-col">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={() => navigate("/code")}
          onSelectConversation={(id) => navigate(`/code/workspace?conversation_id=${id}`)}
          activeConversationId={conversationId}
          currentMode="code"
        />

        {/* Floating header — no background, no border */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
          <button
            onClick={() => setSidebarOpen(true)}
            className="pointer-events-auto h-10 w-10 rounded-full flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-card/60 backdrop-blur-md transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="relative pointer-events-auto">
            <button
              onClick={() => setProjectMenuOpen(o => !o)}
              className="px-4 py-2 rounded-full bg-card/60 backdrop-blur-xl border border-border/40 text-sm font-semibold text-foreground hover:bg-card/80 transition-all max-w-[60vw] truncate"
            >
              {projectName}
            </button>
            <AnimatePresence>
              {projectMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProjectMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-40 w-64 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl p-2"
                  >
                    {/* Credits row with bar */}
                    <div className="px-3 py-2.5 rounded-xl bg-accent/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Coins className="w-3.5 h-3.5" /> Credits
                        </span>
                        <span className="text-xs font-bold text-foreground">{credits ?? "—"} MC</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 transition-all"
                          style={{ width: `${Math.min(100, ((credits ?? 0) / 100) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => { setRenameValue(projectName); setRenameOpen(true); }}
                      className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors"
                    >
                      <Pencil className="w-4 h-4" /> Rename project
                    </button>
                    <button
                      onClick={() => { setProjectMenuOpen(false); navigate("/settings"); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="w-10" />
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-hidden pt-14 pb-44 min-h-0">
          <CodeChatContainer messages={messages} steps={steps} activeStepId={activeStepId} isThinking={isLoading && steps.length === 0} />
        </div>

        {/* Floating Preview button — vertical right side */}
        {hasBuilt && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleOpenPreview}
            className="absolute right-3 bottom-44 z-30 px-3 py-3 rounded-2xl bg-foreground text-background shadow-xl hover:scale-105 transition-transform flex flex-col items-center gap-1"
            title="Open preview"
          >
            <Eye className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-wide">PREVIEW</span>
          </motion.button>
        )}

        {/* Bottom sticky input */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-3 pt-6 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-2xl mx-auto">
            {/* Attachments */}
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
                placeholder={hasBuilt ? "Describe your changes..." : "Describe your project..."}
                rows={1}
                className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 px-2 py-1.5 max-h-32"
              />

              {/* Bottom toolbar */}
              <div className="flex items-center gap-1.5 mt-1">
                {/* Plus menu */}
                <div className="relative">
                  <button
                    onClick={() => { setPlusMenuOpen(o => !o); setMoreMenuOpen(false); }}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {plusMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setPlusMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          className="absolute bottom-full mb-2 left-0 z-40 w-48 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl p-1.5"
                        >
                          <button onClick={() => handleFilePick("image")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors">
                            <ImageIcon className="w-4 h-4" /> Attach image
                          </button>
                          <button onClick={() => handleFilePick("file")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors">
                            <Paperclip className="w-4 h-4" /> Attach file
                          </button>
                          <button onClick={() => handleFilePick("camera")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors">
                            <Camera className="w-4 h-4" /> Take photo
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Plan mode */}
                <button
                  onClick={() => setPlanMode(p => !p)}
                  className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-all ${
                    planMode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Plan
                </button>

                {/* Three dots — integrations */}
                <div className="relative">
                  <button
                    onClick={() => { setMoreMenuOpen(o => !o); setPlusMenuOpen(false); }}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          className="absolute bottom-full mb-2 left-0 z-40 w-56 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl p-1.5"
                        >
                          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 py-1.5">Integrations</p>
                          <button
                            onClick={() => { setMoreMenuOpen(false); setSupabaseModalOpen(true); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors"
                          >
                            <Database className="w-4 h-4 text-emerald-500" /> Connect Supabase
                          </button>
                          <button
                            onClick={handleGithubPush}
                            disabled={githubBusy}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors disabled:opacity-40"
                          >
                            {githubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                            {githubBusy ? "Pushing..." : "Push to GitHub"}
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1" />

                {/* Send */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-25 flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {/* Rename dialog */}
        <AnimatePresence>
          {renameOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRenameOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl bg-card border border-border/60 shadow-2xl p-5"
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

        {/* Supabase connect dialog */}
        <AnimatePresence>
          {supabaseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSupabaseModalOpen(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-3xl bg-card border border-border/60 shadow-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-base font-semibold text-foreground">Connect Backend</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Paste your Supabase project URL and anon key. They are stored securely and used only by the AI when building your backend.
                </p>
                <div className="space-y-2.5">
                  <input
                    type="url" value={supaUrl} onChange={e => setSupaUrl(e.target.value)}
                    placeholder="https://xxxx.supabase.co"
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground border border-border outline-none focus:border-primary transition-colors"
                  />
                  <input
                    type="password" value={supaKey} onChange={e => setSupaKey(e.target.value)}
                    placeholder="Anon key (eyJhbGc...)"
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground border border-border outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setSupabaseModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium">Cancel</button>
                  <button
                    onClick={handleSupabaseConnect}
                    disabled={!supaUrl.trim() || !supaKey.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Connect
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default CodeWorkspace;
