import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import ScaledHtmlPreview from "@/components/files/ScaledHtmlPreview";
import TemplatePickerSheet, { type PickerTemplate } from "@/components/files/TemplatePickerSheet";
import {
  Menu, ArrowUp, ChevronLeft, ChevronRight, Loader2, Eye, Download, X,
  Plus, MoreHorizontal, Paperclip, Sparkles, LayoutTemplate,
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
  thumbnail?: string | null;
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

const KINDS: { id: Kind; label: string; hasTemplates?: boolean }[] = [
  { id: "slides",      label: "Slides",      hasTemplates: true  },
  { id: "document",    label: "Document",    hasTemplates: true  },
  { id: "resume",      label: "Resume",      hasTemplates: true  },
  { id: "report",      label: "Report",      hasTemplates: true  },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "letter",      label: "Letter",      hasTemplates: true  },
  { id: "roadmap",     label: "Roadmap"      },
  { id: "mindmap",     label: "Mindmap"      },
  { id: "timeline",    label: "Timeline"     },
];

const DEFAULT_SLIDES_TEMPLATE = "premium-megsy";

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
  return prompt.split(/\s+/).slice(0, 4).join(" ") || "New File";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [slideCount, setSlideCount] = useState(10);
  const [contentDepth, setContentDepth] = useState(3);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("Preview");
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentKindMeta = KINDS.find(k => k.id === selectedKind);
  const showTemplates = !!currentKindMeta?.hasTemplates;
  const isSlides = selectedKind === "slides";

  // Load templates
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

  // Saved files history
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

  // Set default template when kind changes
  useEffect(() => {
    const list = templatesByKind[selectedKind];
    if (!list || list.length === 0) { setSelectedTemplate(null); return; }
    if (selectedKind === "slides") {
      const megsy = list.find(t => t.id === DEFAULT_SLIDES_TEMPLATE);
      setSelectedTemplate(megsy || list[0]);
    } else {
      setSelectedTemplate(list[0]);
    }
  }, [selectedKind, templatesByKind]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText]);

  const currentTemplates = useMemo(() => templatesByKind[selectedKind] || [], [selectedKind, templatesByKind]);

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
        {
          kind: selectedKind,
          template: selectedTemplate?.id || (isSlides ? DEFAULT_SLIDES_TEMPLATE : "modern"),
          templateStyle: selectedTemplate?.style || "",
          prompt,
          useResearch: true, // always on, hidden from UI
          depth: contentDepth,
          slideCount: isSlides ? slideCount : undefined,
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

      let htmlPreview = "";
      try {
        const expRes = await fetch(`${DDS_BASE}/api/v1/generations/${result.id}/export?format=html`, { method: "POST" });
        if (expRes.ok) htmlPreview = await expRes.text();
      } catch {}

      // Capture screenshot synchronously to show in chat history
      let thumb: string | null = null;
      if (htmlPreview) {
        thumb = await captureThumb(htmlPreview, `file-${convId || result.id}`);
      }

      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          last.status = undefined;
          last.content = doc?.title || `Your ${selectedKind} is ready.`;
          last.generationId = result.id;
          last.doc = doc;
          last.htmlPreview = htmlPreview;
          last.thumbnail = thumb;
        }
        return copy;
      });

      if (convId) {
        await supabase.from("messages").insert({
          conversation_id: convId, role: "assistant", content: `Your ${selectedKind} is ready.`,
        } as any);
        await supabase.from("conversations").update({
          title: doc?.title || undefined,
          ui_state: { kind: selectedKind, thumbnail: thumb, generation_id: result.id } as any,
        }).eq("id", convId);
        loadSavedFiles();
      }

      setStatusText("");
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
  }, [input, isGenerating, selectedKind, selectedTemplate, isSlides, slideCount, contentDepth, conversationId, navigate, loadSavedFiles]);

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

  const openPreview = (html: string, title?: string) => {
    setPreviewHtml(html); setPreviewTitle(title || "Preview"); setPreviewOpen(true);
  };

  const openSavedFile = async (file: SavedFile) => {
    if (!file.generation_id) return;
    setIsGenerating(true);
    try {
      const expRes = await fetch(`${DDS_BASE}/api/v1/generations/${file.generation_id}/export?format=html`, { method: "POST" });
      if (expRes.ok) {
        const html = await expRes.text();
        openPreview(html, file.title);
      }
    } catch { toast.error("Couldn't open file"); }
    finally { setIsGenerating(false); }
  };

  const handleNewFile = () => {
    setMessages([]); setConversationId(null); setInput("");
  };

  const showHero = messages.length === 0;

  // Convert templates to picker format
  const pickerTemplates: PickerTemplate[] = currentTemplates.map(t => ({
    id: t.id, name: t.name, preview: t.preview, description: t.description,
  }));

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
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border/40">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
            {showHero ? (
              <button
                onClick={() => setSidebarOpen(true)}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleNewFile}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="text-base font-semibold tracking-tight">Files</h1>
            <button
              onClick={handleNewFile}
              className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center"
              aria-label="New"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* HERO LAYOUT */}
        {showHero ? (
          <div className="flex-1 flex flex-col">
            <section className="max-w-3xl w-full mx-auto px-5 sm:px-8 pt-10 sm:pt-16 text-center">
              <h2 className="font-bold tracking-tight leading-[1.1] text-3xl sm:text-5xl text-foreground">
                Drop in a topic, get exquisite files.
              </h2>
              <p className="mt-3 text-muted-foreground text-sm sm:text-base">
                Slides, documents, reports, resumes — designed and ready.
              </p>
            </section>

            {/* BIG centered input */}
            <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 mt-8 sm:mt-10">
              <InputBox
                value={input}
                onChange={setInput}
                onSend={handleSend}
                isGenerating={isGenerating}
                textareaRef={textareaRef}
                kindLabel={currentKindMeta?.label || "file"}
                isSlides={isSlides}
                slideCount={slideCount}
                setSlideCount={setSlideCount}
                contentDepth={contentDepth}
                setContentDepth={setContentDepth}
                showTemplates={showTemplates}
                selectedTemplate={selectedTemplate}
                onOpenPicker={() => setPickerOpen(true)}
                moreOpen={moreOpen}
                setMoreOpen={setMoreOpen}
                onAttach={() => fileInputRef.current?.click()}
              />
              <input ref={fileInputRef} type="file" hidden onChange={(e) => {
                if (e.target.files?.[0]) toast.info(`Attached ${e.target.files[0].name}`);
              }} />
            </div>

            {/* Kinds slider */}
            <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 mt-5">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 scroll-smooth">
                {KINDS.map((k) => {
                  const Active = selectedKind === k.id;
                  return (
                    <button
                      key={k.id}
                      onClick={() => setSelectedKind(k.id)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                        Active
                          ? "bg-foreground text-background border-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saved history */}
            {savedFiles.length > 0 && (
              <section className="max-w-5xl w-full mx-auto px-4 sm:px-8 pt-10 pb-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Your projects</h3>
                  <span className="text-xs text-muted-foreground">{savedFiles.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {savedFiles.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => openSavedFile(f)}
                      className="group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden text-left hover:border-foreground/30 hover:shadow-lg transition-all"
                    >
                      <div className="w-full aspect-video bg-muted overflow-hidden">
                        {f.thumbnail ? (
                          <img src={f.thumbnail} alt={f.title} loading="lazy"
                            className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase tracking-widest">
                            {f.kind}
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-sm font-semibold truncate">{f.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{f.kind}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          // CHAT LAYOUT
          <>
            <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-5 space-y-4 overflow-y-auto">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[92%] w-full">
                      {/* Megsy star avatar */}
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 mt-0.5">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {m.status ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{m.status}</span>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm whitespace-pre-wrap text-foreground">{m.content}</p>
                              {m.generationId && (
                                <div className="mt-3 rounded-2xl border border-border/60 bg-card overflow-hidden">
                                  <button
                                    onClick={() => m.htmlPreview && openPreview(m.htmlPreview, m.doc?.title)}
                                    className="block w-full aspect-video bg-muted overflow-hidden"
                                  >
                                    {m.thumbnail ? (
                                      <img src={m.thumbnail} alt={m.doc?.title || "preview"}
                                        className="w-full h-full object-cover object-top" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                        Preview unavailable
                                      </div>
                                    )}
                                  </button>
                                  <div className="flex items-center justify-between px-3 py-2 border-t border-border/60">
                                    <span className="text-xs font-medium truncate text-foreground">
                                      {m.doc?.title || "Untitled"}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => m.htmlPreview && openPreview(m.htmlPreview, m.doc?.title)}
                                        className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
                                        aria-label="Preview"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDownload(m)}
                                        className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
                                        aria-label="Download"
                                      >
                                        <Download className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </main>

            <div className="sticky bottom-0 z-10 backdrop-blur-xl bg-background/90 border-t border-border/40">
              <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3">
                <InputBox
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  isGenerating={isGenerating}
                  textareaRef={textareaRef}
                  kindLabel={currentKindMeta?.label || "file"}
                  isSlides={isSlides}
                  slideCount={slideCount}
                  setSlideCount={setSlideCount}
                  contentDepth={contentDepth}
                  setContentDepth={setContentDepth}
                  showTemplates={showTemplates}
                  selectedTemplate={selectedTemplate}
                  onOpenPicker={() => setPickerOpen(true)}
                  moreOpen={moreOpen}
                  setMoreOpen={setMoreOpen}
                  onAttach={() => fileInputRef.current?.click()}
                  compact
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Template picker */}
      <TemplatePickerSheet
        open={pickerOpen}
        templates={pickerTemplates}
        selectedId={selectedTemplate?.id}
        onSelect={(t) => {
          const full = currentTemplates.find(x => x.id === t.id);
          if (full) setSelectedTemplate(full);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {/* Preview modal */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <header className="sticky top-0 z-10 h-14 px-3 sm:px-4 flex items-center justify-between border-b border-border/40 bg-background/90 backdrop-blur-xl">
              <button onClick={() => setPreviewOpen(false)} className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold truncate flex-1 text-center px-2">{previewTitle}</p>
              <button
                onClick={() => {
                  const blob = new Blob([previewHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${previewTitle || "file"}.html`;
                  document.body.appendChild(a); a.click(); a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="h-10 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </header>
            <ScaledHtmlPreview html={previewHtml} />
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

/* ───────────────────────── Input Box (clean, centered) ───────────────────────── */

interface InputBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isGenerating: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  kindLabel: string;
  isSlides: boolean;
  slideCount: number;
  setSlideCount: (n: number) => void;
  contentDepth: number;
  setContentDepth: (n: number) => void;
  showTemplates: boolean;
  selectedTemplate: Template | null;
  onOpenPicker: () => void;
  moreOpen: boolean;
  setMoreOpen: (v: boolean) => void;
  onAttach: () => void;
  compact?: boolean;
}

const InputBox = ({
  value, onChange, onSend, isGenerating, textareaRef, kindLabel,
  isSlides, slideCount, setSlideCount, contentDepth, setContentDepth,
  showTemplates, selectedTemplate, onOpenPicker, moreOpen, setMoreOpen, onAttach, compact,
}: InputBoxProps) => {
  return (
    <div className={`rounded-3xl border border-border/70 bg-card shadow-sm focus-within:border-foreground/40 transition-colors ${compact ? "" : "shadow-xl shadow-black/[0.04]"}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
        }}
        placeholder={isSlides ? "Create slides..." : `Describe your ${kindLabel.toLowerCase()}...`}
        rows={compact ? 1 : 2}
        disabled={isGenerating}
        className={`w-full resize-none bg-transparent px-5 ${compact ? "pt-3" : "pt-5"} text-[15px] focus:outline-none disabled:opacity-60 max-h-48 placeholder:text-muted-foreground/70`}
      />

      {/* Slides controls */}
      {isSlides && !compact && (
        <div className="px-5 pb-3 grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span className="font-medium">Slides</span>
              <span className="tabular-nums font-semibold text-foreground">{slideCount}</span>
            </div>
            <input
              type="range" min={4} max={20} value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full accent-primary h-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span className="font-medium">Depth</span>
              <span className="tabular-nums font-semibold text-foreground">{contentDepth}</span>
            </div>
            <input
              type="range" min={1} max={5} value={contentDepth}
              onChange={(e) => setContentDepth(Number(e.target.value))}
              className="w-full accent-primary h-1"
            />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
        <button
          onClick={onAttach}
          className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          aria-label="Attach"
          title="Attach file"
        >
          <Plus className="h-4 w-4" />
        </button>

        {showTemplates && (
          <button
            onClick={onOpenPicker}
            className="h-9 px-3 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-medium text-foreground border border-border/60"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">{selectedTemplate?.name || "Templates"}</span>
          </button>
        )}

        <div className="relative ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-border bg-popover shadow-xl p-1.5 z-30">
              <button
                onClick={onAttach}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-sm text-left"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span>Attach file or image</span>
              </button>
            </div>
          )}

          <button
            onClick={onSend}
            disabled={!value.trim() || isGenerating}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition"
            aria-label="Send"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilesPage;
