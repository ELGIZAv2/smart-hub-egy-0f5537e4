import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Menu, Plus, X, ArrowUp, Square, Image as ImageIcon, FileUp, Camera,
  ChevronDown, MoreHorizontal, Download, Share2, FileText, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import { streamChat } from "@/lib/streamChat";
import { saveConversation } from "@/lib/conversationPersistence";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TimelineStep {
  id: string;
  label: string;
  detail: string;
  status: "active" | "done";
  ts: number;
}

interface ResearchSession {
  id: string;
  query: string;
  steps: TimelineStep[];
  images: string[];
  report: string;
  expandedStep: string | null;
}

const RESEARCH_PROMPT =
  "You are a Deep Research agent. CRITICAL: Reply in the user's EXACT language and dialect. " +
  "Produce a clean, well-structured FINAL REPORT only — no greetings, no preamble, no AI-self-references. " +
  "STRUCTURE (use proper markdown — headings, bold, bullets, tables): " +
  "# {Bold Title}\\n\\n" +
  "## نظرة عامة (Overview)\\n2-3 sentence intro.\\n\\n" +
  "## المعلومات الأساسية (Key Facts)\\nUse bullet points with **bold labels**: e.g., - **الاسم:** ...\\n\\n" +
  "## التفاصيل (Details)\\nUse ### sub-headings, numbered lists, and bullets (-, •).\\n\\n" +
  "## مقارنة / جدول (Comparison)\\nWhen comparing options, USE markdown tables with | and ---.\\n\\n" +
  "## الخلاصة (Conclusion)\\nFinal takeaway.\\n\\n" +
  "ABSOLUTELY NEVER expose internal thinking, tool calls, plans, or search queries — only the polished report.";

// Realistic, varied search status messages — show the agent is actually working
const buildStatusFromQuery = (query: string, phase: number): { label: string; detail: string } => {
  const q = query.length > 30 ? query.slice(0, 30) + "…" : query;
  const phases = [
    { label: "البحث في الويب", detail: `أبحث عن "${q}" — أفتح أهم 10 مصادر من Google و Wikipedia.` },
    { label: "تحليل المصادر", detail: `لقد وجدت معلومات قيمة. أقرأ الآن المقالات التفصيلية وأستخرج الحقائق المهمة.` },
    { label: "جمع الصور", detail: `أحضر أفضل الصور والوسائط المتعلقة بـ "${q}".` },
    { label: "مقارنة المعلومات", detail: `أقارن البيانات من المصادر المتعددة وأتحقق من الدقة.` },
    { label: "كتابة التقرير", detail: `أنظم النتائج وأكتب التقرير النهائي بصيغة احترافية.` },
  ];
  return phases[Math.min(phase, phases.length - 1)];
};

const labelFromStatus = (s: string): string => {
  const l = s.toLowerCase();
  if (/search|gathering|browsing|opening|navigat|بحث/i.test(l)) return "البحث في الويب";
  if (/analyz|reviewing|reading|تحليل/i.test(l)) return "تحليل المصادر";
  if (/image|صور/i.test(l)) return "جمع الصور";
  if (/compar|مقارنة/i.test(l)) return "مقارنة المعلومات";
  if (/writing|summar|report|composing|كتابة/i.test(l)) return "كتابة التقرير";
  return "جاري العمل";
};

const DeepResearchPage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sessions, isLoading]);

  // Persist completed reports in sessionStorage so the preview route can read them
  useEffect(() => {
    if (sessions.length > 0) {
      sessionStorage.setItem("dr_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  const handleFile = useCallback((files: FileList | null, kind: "image" | "file") => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name} > 20MB`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles((prev) => [...prev, { name: f.name, type: kind === "image" ? "image" : "file", data: reader.result as string }]);
      };
      reader.readAsDataURL(f);
    });
    setPlusOpen(false);
  }, []);

  const updateLastSession = (fn: (s: ResearchSession) => ResearchSession) => {
    setSessions((arr) => {
      const copy = [...arr];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  };

  const send = useCallback(async () => {
    if (!input.trim()) return;
    if (isLoading) return;

    const sid = `dr-${Date.now()}`;
    const newSession: ResearchSession = {
      id: sid, query: input.trim(), steps: [], images: [], report: "", expandedStep: null,
    };
    setSessions((s) => [...s, newSession]);
    const sentInput = input;
    setInput("");
    setIsLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const apiMessages = [
      { role: "assistant" as const, content: RESEARCH_PROMPT },
      { role: "user" as const, content: sentInput },
    ];

    let reportBuf = "";
    let phase = 0;
    let phaseTimer: ReturnType<typeof setInterval> | null = null;

    // Inject realistic, time-delayed status updates so user feels real progress
    const pushPhase = () => {
      const { label, detail } = buildStatusFromQuery(sentInput, phase);
      updateLastSession((s) => {
        const updated: TimelineStep[] = s.steps.map((x) => ({ ...x, status: "done" }));
        updated.push({
          id: `${Date.now()}-${updated.length}`,
          label, detail,
          status: "active",
          ts: Date.now(),
        });
        return { ...s, steps: updated, expandedStep: updated[updated.length - 1].id };
      });
      phase++;
    };

    pushPhase(); // Phase 0 immediately
    phaseTimer = setInterval(() => {
      if (phase < 4) pushPhase();
    }, 2200);

    await streamChat({
      messages: apiMessages as any,
      model: "moonshotai/kimi-k2.5:nitro",
      chatMode: "deep-research",
      deepResearch: true,
      searchEnabled: true,
      user_id: userId ?? undefined,
      signal: ac.signal,
      onStatus: (st) => {
        const label = labelFromStatus(st);
        updateLastSession((s) => {
          const last = s.steps[s.steps.length - 1];
          if (last && last.label === label) {
            const copy = [...s.steps];
            copy[copy.length - 1] = { ...last, detail: (last.detail ? last.detail + "\n" : "") + st };
            return { ...s, steps: copy };
          }
          return s;
        });
      },
      onImages: (imgs) => {
        updateLastSession((s) => ({ ...s, images: imgs.slice(0, 20) }));
      },
      onDelta: (d) => {
        // First content delta = stop the simulated phase loop and mark "writing"
        if (phaseTimer) { clearInterval(phaseTimer); phaseTimer = null; }
        if (!reportBuf) {
          updateLastSession((s) => {
            const updated: TimelineStep[] = s.steps.map((x) => ({ ...x, status: "done" }));
            updated.push({
              id: `${Date.now()}-writing`,
              label: "كتابة التقرير",
              detail: "أنظم النتائج وأكتب التقرير النهائي…",
              status: "active",
              ts: Date.now(),
            });
            return { ...s, steps: updated, expandedStep: updated[updated.length - 1].id };
          });
        }
        reportBuf += d;
        updateLastSession((s) => ({ ...s, report: reportBuf }));
      },
      onDone: async () => {
        if (phaseTimer) { clearInterval(phaseTimer); phaseTimer = null; }
        updateLastSession((s) => ({
          ...s,
          steps: s.steps.map((x) => ({ ...x, status: "done" as const })),
          expandedStep: null,
        }));
        setIsLoading(false);
        abortRef.current = null;
        if (userId && reportBuf) {
          const cid = await saveConversation({
            conversationId, userId, mode: "research",
            title: sentInput.slice(0, 60),
            messages: [
              { role: "user", content: sentInput },
              { role: "assistant", content: reportBuf },
            ],
          });
          if (cid && !conversationId) setConversationId(cid);
        }
      },
      onError: (e) => {
        if (phaseTimer) { clearInterval(phaseTimer); phaseTimer = null; }
        toast.error(e); setIsLoading(false);
      },
    });
  }, [input, isLoading, userId, conversationId]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };

  const downloadReport = (s: ResearchSession) => {
    const blob = new Blob([`# ${s.query}\n\n${s.report}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.query.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const share = async (s: ResearchSession) => {
    if (navigator.share) {
      try { await navigator.share({ title: s.query, text: s.report.slice(0, 200) }); }
      catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(s.report);
      toast.success("Copied to clipboard");
    }
  };

  const openPreview = (s: ResearchSession) => {
    sessionStorage.setItem(`dr_report_${s.id}`, JSON.stringify({ query: s.query, report: s.report, images: s.images }));
    navigate(`/research/preview/${s.id}`);
  };

  const toggleStep = (sIdx: number, stepId: string) => {
    setSessions((arr) => {
      const copy = [...arr];
      copy[sIdx] = { ...copy[sIdx], expandedStep: copy[sIdx].expandedStep === stepId ? null : stepId };
      return copy;
    });
  };

  const hasResults = sessions.length > 0;

  // Click-anywhere closes plus menu
  useEffect(() => {
    if (!plusOpen) return;
    const close = () => setPlusOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [plusOpen]);

  return (
    <AppLayout>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={() => navigate("/")} currentMode="research" />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "file")} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />

      <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-500/20 blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-500/15 blur-[140px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-blue-400/10 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/40 backdrop-blur-2xl hover:bg-background/60 transition"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {!hasResults ? (
          <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-[10vw] uppercase leading-[0.95] tracking-tight md:text-[5rem]"
            >
              RESEARCH <span className="bg-gradient-to-r from-violet-400 to-indigo-500 bg-clip-text text-transparent">DEEP.</span>
              <br />KNOW MORE.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-5 max-w-md text-sm text-muted-foreground md:text-base"
            >
              Watch your AI agent search, analyze, compare, and write — live in front of you.
            </motion.p>
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-2xl px-4 pb-48 pt-20 space-y-8">
            {sessions.map((s, idx) => {
              const isLast = idx === sessions.length - 1;
              const isActive = isLast && isLoading;
              return (
                <div key={s.id} className="space-y-4">
                  {/* User query as plain text right-aligned */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-3xl bg-foreground/5 px-4 py-2.5 text-sm text-foreground">
                      {s.query}
                    </div>
                  </div>

                  {/* Live timeline — bold labels, no bg, no border, just star icons */}
                  <div className="space-y-0.5">
                    {s.steps.map((step) => {
                      const isStepActive = step.status === "active";
                      const isExpanded = s.expandedStep === step.id;
                      return (
                        <div key={step.id}>
                          <button
                            onClick={() => toggleStep(idx, step.id)}
                            className="w-full flex items-center gap-2.5 py-1.5 text-left hover:opacity-80 transition"
                          >
                            <div className={`shrink-0 ${isStepActive ? "text-violet-400" : "text-emerald-400/80"}`}>
                              <Sparkles className={`h-4 w-4 ${isStepActive ? "animate-pulse" : ""}`} />
                            </div>
                            <span className={`flex-1 text-sm font-bold truncate ${isStepActive ? "text-foreground" : "text-foreground/85"}`}>
                              {step.label}
                            </span>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {isExpanded && step.detail && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-7 my-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                  {step.detail}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                    {isActive && s.steps.length === 0 && (
                      <div className="flex items-center gap-2.5 py-1.5">
                        <Sparkles className="h-4 w-4 text-violet-400 animate-pulse" />
                        <span className="text-sm font-bold text-foreground">جاري بدء البحث…</span>
                      </div>
                    )}
                  </div>

                  {/* Inline images — horizontal scroll if any found */}
                  {s.images.length > 0 && (
                    <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-thin">
                      <div className="flex gap-2.5" style={{ width: "max-content" }}>
                        {s.images.slice(0, 12).map((img, i) => (
                          <div key={i} className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl border border-foreground/5 bg-foreground/5">
                            <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Report card — clean, no icons except subtle FileText, three-dot menu */}
                  {s.report && (
                    <div className="relative rounded-3xl border border-foreground/10 bg-background/60 backdrop-blur-xl overflow-hidden">
                      <button
                        onClick={() => openPreview(s)}
                        className="block w-full p-4 text-left transition hover:bg-foreground/[0.03]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                            <FileText className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0 pr-8">
                            <h3 className="text-sm font-semibold text-foreground truncate">{s.query}</h3>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Markdown · {(s.report.length / 1024).toFixed(1)} KB
                            </p>
                            <p className="mt-2.5 line-clamp-3 text-xs text-foreground/60 leading-relaxed">
                              {s.report.slice(0, 260).replace(/[#*`>]/g, "").trim()}
                            </p>
                          </div>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full hover:bg-foreground/10 transition"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-2xl border-foreground/10 rounded-2xl">
                          <DropdownMenuItem onClick={() => downloadReport(s)} className="rounded-xl">
                            <Download className="mr-2 h-4 w-4" /> Download as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => share(s)} className="rounded-xl">
                            <Share2 className="mr-2 h-4 w-4" /> Share
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-4 pt-2 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto">
            <div className="relative rounded-[28px] border border-white/10 bg-background/50 p-2 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <div className="flex items-end gap-2">
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPlusOpen((v) => !v); }}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 ${plusOpen ? "rotate-45" : ""}`}
                  >
                    <Plus className="h-5 w-5 text-foreground" />
                  </button>
                  <AnimatePresence>
                    {plusOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.92 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-2 left-0 z-[46] w-72 rounded-3xl border border-white/10 bg-background/80 p-3 backdrop-blur-2xl shadow-2xl"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { ref: cameraInputRef, icon: Camera, label: "Camera" },
                            { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                            { ref: fileInputRef, icon: FileUp, label: "Files" },
                          ].map(({ ref, icon: Icon, label }) => (
                            <button
                              key={label}
                              onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/5 transition"
                            >
                              <Icon className="w-5 h-5 text-violet-400" />
                              <span className="text-[11px] text-foreground/80">{label}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="What do you want to research?"
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ maxHeight: "140px" }}
                />

                {isLoading ? (
                  <button onClick={stop} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg transition hover:scale-105 disabled:opacity-40"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DeepResearchPage;
