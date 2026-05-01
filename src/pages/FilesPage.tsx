import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Menu, ArrowUp, FileText, Presentation, FileSpreadsheet,
  ScrollText, Map, GitBranch, Calendar, Mail, User, Loader2, Eye, Download, X,
} from "lucide-react";

// ---------- Backend (Docs Design Studio) ----------
const DDS_BASE = "https://docs-design-studio.lovable.app";

type Kind =
  | "slides" | "document" | "resume" | "report"
  | "spreadsheet" | "letter" | "roadmap" | "mindmap" | "timeline";

interface Template {
  type: Kind;
  id: string;
  name: string;
  description?: string;
  preview?: string;
  style?: string;
}

interface DocsDoc {
  kind: Kind;
  template?: string;
  accentColor?: string;
  background?: "dark" | "light" | "gradient";
  slides?: Array<{ html: string; title?: string; notes?: string }>;
  blocks?: Array<any>;
  title?: string;
  subtitle?: string;
  // resume
  name?: string;
  contact?: any;
  summary?: string;
  experience?: any[];
  education?: any[];
  skills?: string[];
  // spreadsheet
  sheet?: { name?: string; headers: string[]; rows: string[][]; totals?: string[] };
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  status?: string;          // streaming status
  generationId?: string;
  doc?: DocsDoc;
  htmlPreview?: string;     // pre-rendered HTML page from /export?format=html
}

const KINDS: { id: Kind; label: string; icon: any; gradient: string }[] = [
  { id: "slides",      label: "Slides",      icon: Presentation,    gradient: "from-purple-500 to-fuchsia-500" },
  { id: "document",    label: "Document",    icon: FileText,        gradient: "from-blue-500 to-cyan-500" },
  { id: "resume",      label: "Resume",      icon: User,            gradient: "from-emerald-500 to-teal-500" },
  { id: "report",      label: "Report",      icon: ScrollText,      gradient: "from-amber-500 to-orange-500" },
  { id: "spreadsheet", label: "Spreadsheet", icon: FileSpreadsheet, gradient: "from-green-500 to-emerald-500" },
  { id: "letter",      label: "Letter",      icon: Mail,            gradient: "from-rose-500 to-pink-500" },
  { id: "roadmap",     label: "Roadmap",     icon: Map,             gradient: "from-indigo-500 to-blue-500" },
  { id: "mindmap",     label: "Mindmap",     icon: GitBranch,       gradient: "from-violet-500 to-purple-500" },
  { id: "timeline",    label: "Timeline",    icon: Calendar,        gradient: "from-yellow-500 to-amber-500" },
];

// ---------- SSE reader ----------
async function streamGenerate(
  body: any,
  onStatus: (msg: string) => void,
): Promise<{ docJson: string; id: string; url: string | null }> {
  const res = await fetch(`${DDS_BASE}/api/v1/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`Generation failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message", data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const payload = JSON.parse(data);
        if (event === "status" && payload.message) onStatus(payload.message);
        if (event === "done") return payload;
        if (event === "error") throw new Error(payload.message || "Generation failed");
      } catch (e: any) {
        if (event === "error") throw e;
      }
    }
  }
  throw new Error("Stream ended without completion");
}

// ---------- AI naming (2 words) ----------
async function generateProjectName(prompt: string): Promise<string> {
  try {
    const { data } = await supabase.functions.invoke("name-project", { body: { prompt } });
    if (data?.name) return data.name;
  } catch {}
  return prompt.split(/\s+/).slice(0, 2).join(" ") || "New File";
}

// ---------- Main ----------
const FilesPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedKind, setSelectedKind] = useState<Kind>("slides");
  const [templatesByKind, setTemplatesByKind] = useState<Record<string, Template[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [useResearch, setUseResearch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load templates from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${DDS_BASE}/api/v1/templates`);
        const json = await res.json();
        const grouped: Record<string, Template[]> = {};
        for (const t of (json.templates || [])) {
          if (!grouped[t.type]) grouped[t.type] = [];
          grouped[t.type].push(t);
        }
        setTemplatesByKind(grouped);
      } catch {
        // silently degrade — templates optional
      }
    })();
  }, []);

  // Auto-pick first template per kind
  useEffect(() => {
    const list = templatesByKind[selectedKind];
    if (list && list.length > 0) setSelectedTemplate(list[0]);
    else setSelectedTemplate(null);
  }, [selectedKind, templatesByKind]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText]);

  const currentTemplates = useMemo(() => templatesByKind[selectedKind] || [], [selectedKind, templatesByKind]);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to generate files");
      navigate("/auth");
      return;
    }

    setInput("");
    const userMsg: ChatMsg = { role: "user", content: prompt };
    const assistantMsg: ChatMsg = { role: "assistant", content: "", status: "Starting..." };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsGenerating(true);
    setStatusText("Starting...");

    // Persist conversation
    let convId = conversationId;
    if (!convId) {
      const name = await generateProjectName(prompt);
      const { data: conv } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: name, mode: "files" })
        .select("id")
        .single();
      convId = conv?.id || null;
      if (convId) setConversationId(convId);
    }

    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId, user_id: user.id, role: "user", content: prompt,
      });
    }

    try {
      const result = await streamGenerate(
        {
          kind: selectedKind,
          template: selectedTemplate?.id || "modern",
          templateStyle: selectedTemplate?.style || "",
          prompt,
          useResearch,
          depth: 3,
        },
        (msg) => {
          setStatusText(msg);
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") last.status = msg;
            return copy;
          });
        },
      );

      const doc: DocsDoc = JSON.parse(result.docJson);

      // Fetch standalone HTML for preview
      let htmlPreview = "";
      try {
        const expRes = await fetch(`${DDS_BASE}/api/v1/generations/${result.id}/export?format=html`, {
          method: "POST",
        });
        if (expRes.ok) htmlPreview = await expRes.text();
      } catch {}

      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          last.status = undefined;
          last.content = `Your ${selectedKind} is ready.`;
          last.generationId = result.id;
          last.doc = doc;
          last.htmlPreview = htmlPreview;
        }
        return copy;
      });

      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId, user_id: user.id, role: "assistant",
          content: `Your ${selectedKind} is ready.`,
          images: [JSON.stringify({ generationId: result.id, kind: selectedKind })],
        });
      }

      setStatusText("");

      // Open preview if HTML available
      if (htmlPreview) {
        setPreviewHtml(htmlPreview);
        setPreviewOpen(true);
      }
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          last.status = undefined;
          last.content = "Sorry — generation didn't complete. Please try again.";
        }
        return copy;
      });
      toast.error(e?.message || "Generation failed");
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  }, [input, isGenerating, selectedKind, selectedTemplate, useResearch, conversationId, navigate]);

  const handleDownload = useCallback(async (msg: ChatMsg) => {
    if (!msg.generationId) return;
    try {
      const res = await fetch(`${DDS_BASE}/api/v1/generations/${msg.generationId}/export?format=html`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Export failed");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${msg.doc?.title || msg.doc?.kind || "document"}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    }
  }, []);

  const handlePreview = useCallback((msg: ChatMsg) => {
    if (msg.htmlPreview) {
      setPreviewHtml(msg.htmlPreview);
      setPreviewOpen(true);
    }
  }, []);

  const showHero = messages.length === 0;

  return (
    <AppLayout disablePadding>
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold tracking-tight">Files</h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Hero */}
        <AnimatePresence>
          {showHero && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl w-full mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-6 text-center"
            >
              <h2 className="font-black tracking-tight leading-[1.05] text-4xl sm:text-6xl">
                Create anything.{" "}
                <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                  Beautifully.
                </span>
              </h2>
              <p className="mt-5 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
                Slides, resumes, reports, spreadsheets — generated, designed, and ready to share.
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Kind picker */}
        {showHero && (
          <div className="max-w-5xl w-full mx-auto px-5 sm:px-8 mt-2">
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-1 px-1 scrollbar-hide">
              {KINDS.map((k) => {
                const Active = selectedKind === k.id;
                const Icon = k.icon;
                return (
                  <button
                    key={k.id}
                    onClick={() => setSelectedKind(k.id)}
                    className={`snap-start shrink-0 group relative rounded-2xl border transition-all px-4 py-3 flex items-center gap-2.5 ${
                      Active
                        ? "border-foreground/80 bg-foreground text-background shadow-md"
                        : "border-border/60 bg-card hover:border-foreground/40"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${k.gradient} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm">{k.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Template strip */}
            {currentTemplates.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3 font-semibold">Style</p>
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {currentTemplates.map((t) => {
                    const Active = selectedTemplate?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all border ${
                          Active
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-foreground/40"
                        }`}
                      >
                        {t.preview ? <span className="mr-1.5">{t.preview}</span> : null}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 overflow-y-auto">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-card border border-border/60"
                }`}
              >
                {m.status ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{m.status}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" && m.generationId && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handlePreview(m)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 bg-foreground text-background hover:opacity-90 transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </button>
                        <button
                          onClick={() => handleDownload(m)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border border-border hover:bg-muted transition"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Input bar */}
        <div className="sticky bottom-0 z-10 backdrop-blur-xl bg-background/85 border-t border-border/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
            <div className="rounded-2xl border border-border/70 bg-card shadow-sm focus-within:border-foreground/60 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Describe your ${selectedKind}...`}
                rows={1}
                disabled={isGenerating}
                className="w-full resize-none bg-transparent px-4 py-3 text-sm focus:outline-none disabled:opacity-60 max-h-40"
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <button
                  onClick={() => setUseResearch(v => !v)}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1 transition-all ${
                    useResearch
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Live web research"
                >
                  {useResearch ? "● Research on" : "○ Research"}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating}
                  className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition"
                  aria-label="Send"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {statusText && !messages.some(m => m.status) && (
              <p className="text-xs text-muted-foreground mt-2 text-center">{statusText}</p>
            )}
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-stretch justify-center p-0 sm:p-6"
            onClick={() => setPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl bg-background rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-card/80 backdrop-blur-xl">
                <span className="text-sm font-semibold">Preview</span>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="h-9 w-9 rounded-xl hover:bg-muted flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe
                srcDoc={previewHtml}
                title="Document preview"
                className="flex-1 w-full bg-white"
                sandbox="allow-same-origin allow-scripts"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default FilesPage;
