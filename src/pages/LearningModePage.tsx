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
import LiquidWorkspaceInput from "@/components/LiquidWorkspaceInput";
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

      <div ref={scrollAreaRef} className="ios26-page-shell relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">

        {/* Floating sidebar button (no header) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/40 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-background/60 transition"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {/* Empty state hero */}
        {messages.length === 0 ? (
          <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            >
              Learn with clarity.
            </motion.h1>
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

        <LiquidWorkspaceInput
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={stop}
          isLoading={isLoading}
          placeholder="Ask anything you want to understand"
          canSend={Boolean(input.trim() || attachedFiles.length > 0)}
          plusOpen={plusOpen}
          onPlusToggle={() => setPlusOpen((v) => !v)}
          attachments={attachedFiles}
          onRemoveAttachment={(index) => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}
          textareaRef={textareaRef}
          plusMenu={plusOpen ? (
            <div className="ios26-plus-sheet w-full p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { ref: cameraInputRef, icon: Camera, label: "Camera" },
                  { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                  { ref: fileInputRef, icon: FileUp, label: "Files" },
                ].map(({ ref, icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                    className="ios26-plus-tile"
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.6} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        />
      </div>
    </AppLayout>
  );
};

export default LearningModePage;
