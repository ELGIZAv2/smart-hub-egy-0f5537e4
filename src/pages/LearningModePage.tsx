import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Menu, Plus, X, Wrench, ArrowUp, Square,
  NotebookPen, ClipboardList, CalendarDays, Timer, Image as ImageIcon, FileUp, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import ChatMessage from "@/components/ChatMessage";
import ThinkingLoader from "@/components/ThinkingLoader";
import { streamChat } from "@/lib/streamChat";
import { saveConversation } from "@/lib/conversationPersistence";

interface Message {
  role: "user" | "assistant";
  content: string;
  attachedImages?: string[];
  attachedFiles?: { name: string; type: string }[];
}

const LEARNING_PROMPT =
  "You are a smart, adaptive learning tutor using the Feynman technique. " +
  "CRITICAL: ALWAYS reply in the EXACT same language AND dialect the user wrote in. " +
  "ABSOLUTE RULES — VIOLATING THESE BREAKS THE PRODUCT: " +
  "1) NEVER introduce yourself. NEVER say 'I am Megsy', 'I am an AI', 'I'm here to help', 'مرحبا أنا ميغسي', or any greeting/intro. Just answer directly. " +
  "2) NEVER end messages with offers like 'let me know if', 'feel free to ask', 'do you want me to'. " +
  "3) ONLY mention who you are if the user EXPLICITLY asks 'who are you' or 'what's your name'. " +
  "RESPONSE LENGTH — match length to question complexity: " +
  "• Greetings / yes-no → 1 short sentence. " +
  "• Simple factual → 1-2 sentences. " +
  "• 'Explain' → 1 paragraph + 3-4 bullets max. " +
  "• 'Teach me' / complex → structured breakdown with headings, bullets, examples. " +
  "When the user attaches images or files, READ THEM CAREFULLY and answer based on the actual content — never say 'I can't see the image'.";

const STUDY_TOOLS = [
  { id: "smart-notes", label: "Smart Notes", icon: NotebookPen, route: "/tools/smart-notes", color: "from-emerald-400 to-teal-500" },
  { id: "exam", label: "Exam Simulator", icon: ClipboardList, route: "/tools/exam-simulator", color: "from-violet-400 to-purple-500" },
  { id: "planner", label: "Study Planner", icon: CalendarDays, route: "/tools/study-planner", color: "from-amber-400 to-orange-500" },
  { id: "focus", label: "Focus Room", icon: Timer, route: "/tools/focus-room", color: "from-rose-400 to-pink-500" },
];

const LearningModePage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

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

  const send = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isLoading) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim() || "(attached files)",
      attachedImages: attachedFiles.filter(f => f.type === "image").map(f => f.data),
      attachedFiles: attachedFiles.filter(f => f.type !== "image").map(f => ({ name: f.name, type: f.type })),
    };
    setMessages((m) => [...m, userMsg]);
    const sentInput = input;
    setInput("");
    const sentFiles = [...attachedFiles];
    setAttachedFiles([]);
    setIsThinking(true);
    setIsLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const apiMessages = [
      { role: "assistant" as const, content: LEARNING_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: sentFiles.filter(f => f.type === "image").length > 0
          ? [
              { type: "text", text: sentInput || "Analyze the image" },
              ...sentFiles.filter(f => f.type === "image").map(f => ({ type: "image_url", image_url: { url: f.data } })),
            ]
          : sentInput,
      },
    ];

    let assistantBuf = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    await streamChat({
      messages: apiMessages as any,
      model: "google/gemini-2.5-flash-lite-preview-09-2025",
      chatMode: "learning",
      user_id: userId ?? undefined,
      signal: ac.signal,
      onDelta: (d) => {
        setIsThinking(false);
        assistantBuf += d;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: assistantBuf };
          return copy;
        });
      },
      onDone: async () => {
        setIsLoading(false);
        setIsThinking(false);
        abortRef.current = null;
        // Save the user/assistant pair to the sidebar history
        if (userId && assistantBuf) {
          const newId = await saveConversation({
            conversationId,
            userId,
            mode: "learning",
            title: sentInput || "Learning chat",
            messages: [
              { role: "user", content: sentInput || "(attached files)", images: userMsg.attachedImages },
              { role: "assistant", content: assistantBuf },
            ],
          });
          if (newId && !conversationId) setConversationId(newId);
        }
      },
      onError: (e) => { toast.error(e); setIsLoading(false); setIsThinking(false); },
    });
  }, [input, attachedFiles, isLoading, messages, userId, conversationId]);

  const stop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setIsThinking(false);
  };

  // Memoize tools list so it doesn't remount/reload on toggle
  const toolsList = useMemo(() => STUDY_TOOLS.map((t, idx) => {
    const sizes = ["w-56 py-3.5 text-sm", "w-48 py-3 text-sm", "w-40 py-2.5 text-xs", "w-32 py-2 text-xs"];
    return { ...t, sizeClass: sizes[idx], idx };
  }), []);

  return (
    <AppLayout>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={() => navigate("/")} currentMode="learning" />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "file")} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />

      <div ref={scrollAreaRef} className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">
        {/* Animated background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-violet-500/15 blur-[140px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-amber-400/10 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        {/* Floating sidebar button (no header) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/40 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/60 transition"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {/* Empty state hero */}
        {messages.length === 0 ? (
          <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-[10vw] uppercase leading-[0.95] tracking-tight text-foreground md:text-[5rem]"
            >
              LEARN <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">ANYTHING.</span>
              <br />FAST.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-5 max-w-md text-sm text-muted-foreground md:text-base"
            >
              Your personal tutor that breaks down the hardest concepts — ask, upload a book, or start a study plan.
            </motion.p>
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-3xl px-4 pb-48 pt-20">
            {messages.map((m, i) => (
              <div key={i}>
                {m.attachedImages && m.attachedImages.length > 0 && (
                  <div className="mb-2 flex flex-wrap justify-end gap-2">
                    {m.attachedImages.map((img, j) => (
                      <img key={j} src={img} alt="" className="h-24 w-24 rounded-2xl border border-white/10 object-cover" />
                    ))}
                  </div>
                )}
                <ChatMessage role={m.role} content={m.content} />
              </div>
            ))}
            {isThinking && <ThinkingLoader />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Floating Tools button — pyramid menu (memoized, no remount) */}
        <div className="fixed bottom-32 right-4 z-50 md:right-8">
          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div
                key="tools-menu"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-16 right-0 flex flex-col items-end gap-2"
              >
                {toolsList.map((t) => (
                  <motion.button
                    key={t.id}
                    layout="position"
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    transition={{ delay: t.idx * 0.04, type: "spring", damping: 20, stiffness: 300 }}
                    onClick={() => { navigate(t.route); setToolsOpen(false); }}
                    className={`${t.sizeClass} flex items-center justify-end gap-2.5 rounded-full border border-white/15 bg-background/60 px-4 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-[1.02] transition-transform`}
                  >
                    <span className="font-medium text-foreground">{t.label}</span>
                    <div className={`rounded-full bg-gradient-to-br ${t.color} p-1.5`}>
                      <t.icon className="h-3.5 w-3.5 text-white" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setToolsOpen((v) => !v)}
            className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_10px_40px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl transition hover:scale-105 ${toolsOpen ? "rotate-45" : ""}`}
          >
            <Wrench className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Input bar — same style as ChatPage */}
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-4 pt-2 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto">
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 px-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="group relative">
                    {f.type === "image" ? (
                      <img src={f.data} alt={f.name} className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
                    ) : (
                      <div className="flex h-16 items-center gap-2 rounded-xl border border-white/10 bg-background/50 px-3 backdrop-blur-xl">
                        <FileUp className="h-4 w-4 text-emerald-400" />
                        <span className="max-w-[120px] truncate text-xs">{f.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative rounded-[28px] border border-white/10 bg-background/50 p-2 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
              <div className="flex items-end gap-2">
                <div className="relative">
                  <button
                    onClick={() => setPlusOpen((v) => !v)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 ${plusOpen ? "rotate-45" : ""}`}
                  >
                    <Plus className="h-5 w-5 text-foreground" />
                  </button>

                  <AnimatePresence>
                    {plusOpen && (
                      <>
                        <div className="fixed inset-0 z-[45]" onClick={() => setPlusOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.92 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 12, scale: 0.92 }}
                          transition={{ type: "spring", damping: 22, stiffness: 350 }}
                          className="absolute bottom-full mb-2 left-0 z-[46] w-72 rounded-3xl border border-white/10 bg-background/80 p-3 backdrop-blur-2xl shadow-2xl"
                        >
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { ref: cameraInputRef, icon: Camera, label: "Camera" },
                              { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                              { ref: fileInputRef, icon: FileUp, label: "Files" },
                            ].map(({ ref, icon: Icon, label }, i) => (
                              <motion.button
                                key={label}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/5 transition"
                              >
                                <Icon className="w-5 h-5 text-emerald-400" />
                                <span className="text-[11px] text-foreground/80">{label}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask anything you want to learn..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
                  style={{ maxHeight: "140px" }}
                />

                {isLoading ? (
                  <button
                    onClick={stop}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:scale-105"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
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

export default LearningModePage;
