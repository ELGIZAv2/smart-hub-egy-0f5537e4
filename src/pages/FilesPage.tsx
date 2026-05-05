import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import {
  Menu, ArrowUp, ArrowLeft, ArrowRight, Loader2, Eye, Download, X, ChevronLeft,
} from "lucide-react";

const DDS_BASE = "https://docs-design-studio.lovable.app";

type Kind =
  | "slides" | "document" | "resume" | "report"
  | "spreadsheet" | "letter" | "roadmap" | "mindmap" | "timeline";

interface Template { type: Kind; id: string; name: string; description?: string; preview?: string; style?: string; }
interface DocsDoc { kind: Kind; template?: string; title?: string; [k: string]: any; }

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  status?: string;
  generationId?: string;
  doc?: DocsDoc;
  htmlPreview?: string;
}

interface SavedFile {
  id: string;
  title: string;
  kind: string;
  thumbnail: string | null;
  generation_id: string | null;
  conversation_id: string;
  updated_at: string;
}

const KINDS: { id: Kind; label: string }[] = [
  { id: "slides",      label: "Slides" },
  { id: "document",    label: "Document" },
  { id: "resume",      label: "Resume" },
  { id: "report",      label: "Report" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "letter",      label: "Letter" },
  { id: "roadmap",     label: "Roadmap" },
  { id: "mindmap",     label: "Mindmap" },
  { id: "timeline",    label: "Timeline" },
];

async function streamGenerate(body: any, onStatus: (msg: string) => void) {
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
      } catch (e: any) { if (event === "error") throw e; }
    }
  }
  throw new Error("Stream ended without completion");
}

async function generateProjectName(prompt: string): Promise<string> {
  try {
    const { data } = await supabase.functions.invoke("name-project", { body: { prompt } });
    if (data?.name) return data.name;
  } catch {}
  return prompt.split(/\s+/).slice(0, 2).join(" ") || "New File";
}

async function captureThumb(html: string, fileName: string): Promise<string | null> {
  try {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/screenshot-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ html, viewportWidth: 1280, viewportHeight: 800, fileName }),
    });
    const data = await r.json().catch(() => ({} as any));
    return data?.preview_url || null;
  } catch { return null; }
}

const FilesPage = () => {
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
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const kindScrollRef = useRef<HTMLDivElement>(null);

  // Templates
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${DDS_BASE}/api/v1/templates`);
        const json = await res.json();
        const grouped: Record<string, Template[]> = {};
        for (const t of (json.templates || [])) {
          (grouped[t.type] = grouped[t.type] || []).push(t);
        }
        setTemplatesByKind(grouped);
      } catch {}
    })();
  }, []);

  // Saved files (history under the input)
  const loadSavedFiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, title, updated_at, ui_state")
      .eq("user_id", user.id)
      .eq("mode", "files")
      .order("updated_at", { ascending: false })
      .limit(24);
    if (!data) return;
    const list: SavedFile[] = data.map((c: any) => ({
      id: c.id,
      title: c.title || "Untitled",
      kind: c.ui_state?.kind || "document",
      thumbnail: c.ui_state?.thumbnail || null,
      generation_id: c.ui_state?.generation_id || null,
      conversation_id: c.id,
      updated_at: c.updated_at,
    }));
    setSavedFiles(list);
  }, []);

  useEffect(() => { loadSavedFiles(); }, [loadSavedFiles]);

  useEffect(() => {
    const list = templatesByKind[selectedKind];
    if (list && list.length > 0) setSelectedTemplate(list[0]);
    else setSelectedTemplate(null);
  }, [selectedKind, templatesByKind]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText]);

  const currentTemplates = useMemo(() => templatesByKind[selectedKind] || [], [selectedKind, templatesByKind]);

  const scrollKinds = (dir: "left" | "right") => {
    const el = kindScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); navigate("/auth"); return; }

    setInput("");
    const userMsg: ChatMsg = { role: "user", content: prompt };
    const assistantMsg: ChatMsg = { role: "assistant", content: "", status: "Starting..." };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsGenerating(true);
    setStatusText("Starting...");

    let convId = conversationId;
    if (!convId) {
      const name = await generateProjectName(prompt);
      const { data: conv } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: name, mode: "files", ui_state: { kind: selectedKind } as any })
        .select("id").single();
      convId = conv?.id || null;
      if (convId) setConversationId(convId);
    }

    if (convId) {
      await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: prompt } as any);
    }

    try {
      const result = await streamGenerate(
        { kind: selectedKind, template: selectedTemplate?.id || "modern", templateStyle: selectedTemplate?.style || "", prompt, useResearch, depth: 3 },
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

      let htmlPreview = "";
      try {
        const expRes = await fetch(`${DDS_BASE}/api/v1/generations/${result.id}/export?format=html`, { method: "POST" });
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
          conversation_id: convId, role: "assistant", content: `Your ${selectedKind} is ready.`,
        } as any);
      }

      setStatusText("");

      if (htmlPreview) {
        setPreviewHtml(htmlPreview);
        setPreviewOpen(true);
        // Capture thumb in background
        if (convId) {
          captureThumb(htmlPreview, `file-${convId}`).then(async (thumb) => {
            await supabase.from("conversations").update({
              ui_state: { kind: selectedKind, thumbnail: thumb, generation_id: result.id } as any,
            }).eq("id", convId!);
            loadSavedFiles();
          });
        }
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
  }, [input, isGenerating, selectedKind, selectedTemplate, useResearch, conversationId, navigate, loadSavedFiles]);

  const handleDownload = useCallback(async (msg: ChatMsg) => {
    if (!msg.generationId) return;
    try {
      const res = await fetch(`${DDS_BASE}/api/v1/generations/${msg.generationId}/export?format=html`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${msg.doc?.title || msg.doc?.kind || "document"}.html`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (e: any) { toast.error(e?.message || "Download failed"); }
  }, []);

  const handlePreview = useCallback((msg: ChatMsg) => {
    if (msg.htmlPreview) { setPreviewHtml(msg.htmlPreview); setPreviewOpen(true); }
  }, []);

  const openSavedFile = async (file: SavedFile) => {
    if (!file.generation_id) return;
    setIsGenerating(true);
    try {
      const expRes = await fetch(`${DDS_BASE}/api/v1/generations/${file.generation_id}/export?format=html`, { method: "POST" });
      if (expRes.ok) {
        const html = await expRes.text();
        setPreviewHtml(html);
        setPreviewOpen(true);
      }
    } catch { toast.error("Couldn't open file"); }
    finally { setIsGenerating(false); }
  };

  const handleNewFile = () => {
    setMessages([]); setConversationId(null); setInput("");
  };

  const showHero = messages.length === 0;

  return (
    <AppLayout>
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewFile}
        currentMode="files"
      />

      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {showHero ? (
              <button
                onClick={() => setSidebarOpen(true)}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleNewFile}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
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
              className="max-w-3xl w-full mx-auto px-5 sm:px-8 pt-8 sm:pt-14 pb-4 text-center"
            >
              <h2 className="font-black tracking-tight leading-[1.05] text-4xl sm:text-6xl">
                Create anything.{" "}
                <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                  Beautifully.
                </span>
              </h2>
              <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
                Slides, resumes, reports, spreadsheets — generated, designed, ready to share.
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Kind picker — horizontal slider with arrows */}
        {showHero && (
          <div className="max-w-5xl w-full mx-auto px-2 sm:px-8 mt-2">
            <div className="relative">
              <button
                onClick={() => scrollKinds("left")}
                className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card/95 backdrop-blur-xl border border-border/60 shadow items-center justify-center hover:bg-card"
                aria-label="Scroll left"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div ref={kindScrollRef} className="flex gap-2.5 overflow-x-auto pb-3 snap-x snap-mandatory px-3 sm:px-12 scrollbar-hide scroll-smooth">
                {KINDS.map((k) => {
                  const Active = selectedKind === k.id;
                  return (
                    <button
                      key={k.id}
                      onClick={() => setSelectedKind(k.id)}
                      className={`snap-start shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold border transition-all ${
                        Active
                          ? "bg-foreground text-background border-foreground shadow-md"
                          : "border-border/60 bg-card text-foreground/80 hover:border-foreground/40"
                      }`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => scrollKinds("right")}
                className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card/95 backdrop-blur-xl border border-border/60 shadow items-center justify-center hover:bg-card"
                aria-label="Scroll right"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {currentTemplates.length > 0 && (
              <div className="mt-2 px-3 sm:px-12">
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {currentTemplates.map((t) => {
                    const Active = selectedTemplate?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          Active
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-foreground/40"
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages (during conversation) */}
        {!showHero && (
          <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4 overflow-y-auto">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-foreground text-background" : "bg-card border border-border/60"}`}>
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
                          <button onClick={() => handlePreview(m)} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 bg-foreground text-background hover:opacity-90 transition">
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </button>
                          <button onClick={() => handleDownload(m)} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border border-border hover:bg-muted transition">
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
        )}

        {/* Spacer to push input down on hero */}
        {showHero && <div className="flex-1" />}

        {/* Input bar */}
        <div className={`${showHero ? "" : "sticky bottom-0"} z-10 backdrop-blur-xl bg-background/85 border-t border-border/40`}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
            <div className="rounded-2xl border border-border/70 bg-card shadow-sm focus-within:border-foreground/60 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
                    useResearch ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
                  }`}
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

        {/* Saved files grid (under input, when on hero) */}
        {showHero && savedFiles.length > 0 && (
          <section className="max-w-5xl w-full mx-auto px-5 sm:px-8 pb-20 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Files</h3>
              <span className="text-xs text-muted-foreground/60">{savedFiles.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => openSavedFile(f)}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden text-left hover:border-foreground/40 hover:shadow-lg transition-all"
                >
                  <div className="w-full aspect-video bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-amber-500/10 overflow-hidden">
                    {f.thumbnail ? (
                      <img src={f.thumbnail} alt={f.title} loading="lazy"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground/60 uppercase tracking-wider">
                        {f.kind}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold truncate">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{f.kind}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-stretch justify-center p-0 sm:p-6"
            onClick={() => setPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl bg-background rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-3 sm:px-4 h-12 border-b border-border/60 bg-card/80 backdrop-blur-xl shrink-0">
                <button onClick={() => setPreviewOpen(false)} className="h-9 w-9 rounded-xl hover:bg-muted flex items-center justify-center">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold">Preview</span>
                <button onClick={() => setPreviewOpen(false)} className="h-9 w-9 rounded-xl hover:bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ScaledHtmlPreview html={previewHtml} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default FilesPage;
