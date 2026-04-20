import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Menu, Plus, X, ShoppingCart, ArrowUp, Square, Image as ImageIcon, FileUp, Camera, Star, MoreHorizontal, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import ChatMessage from "@/components/ChatMessage";
import { streamChat } from "@/lib/streamChat";
import { saveConversation } from "@/lib/conversationPersistence";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Product {
  title: string;
  price: string;
  image?: string;
  link?: string;
  seller?: string;
  rating?: string | null;
  delivery?: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  attachedImages?: string[];
}

const SHOPPING_PROMPT =
  "You are a smart shopping assistant. " +
  "CRITICAL: ALWAYS reply in the user's EXACT language and dialect. " +
  "FORMAT: Product cards appear automatically — your TEXT response must be a brief expert summary in this exact structure: " +
  "1) One sentence saying which product is the best pick and why. " +
  "2) A short comparison (2-3 bullets) of the top 2-3 options on price, quality, value. " +
  "3) One closing line with a buying tip. " +
  "Keep it under 120 words. Never write long essays. Never list every product — the cards already do that.";

const ShoppingModePage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
  const [livePreview, setLivePreview] = useState<Product[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const hasResults = messages.length > 0;

  // Live preview as user types — 300ms debounce, fires on every keystroke
  useEffect(() => {
    if (!input.trim() || input.trim().length < 2 || hasResults) {
      setLivePreview([]);
      return;
    }
    if (liveDebounce.current) clearTimeout(liveDebounce.current);
    liveDebounce.current = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("search", {
          body: { query: input, type: "shopping", limit: 8 },
        });
        if (data?.products) setLivePreview(data.products.slice(0, 8));
      } catch { /* silent */ }
    }, 300);
    return () => { if (liveDebounce.current) clearTimeout(liveDebounce.current); };
  }, [input, hasResults]);

  // Close plus menu on any outside click
  useEffect(() => {
    if (!plusOpen) return;
    const close = () => setPlusOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [plusOpen]);

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

    setLivePreview([]);
    const userMsg: Message = {
      role: "user",
      content: input.trim() || "(attached)",
      attachedImages: attachedFiles.filter(f => f.type === "image").map(f => f.data),
    };
    setMessages((m) => [...m, userMsg]);
    const sentInput = input;
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const apiMessages = [
      { role: "assistant" as const, content: SHOPPING_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: sentInput },
    ];

    let buf = "";
    let prods: Product[] = [];
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    await streamChat({
      messages: apiMessages as any,
      model: "google/gemini-2.5-flash-lite-preview-09-2025",
      chatMode: "shopping",
      user_id: userId ?? undefined,
      signal: ac.signal,
      onDelta: (d) => {
        buf += d;
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: buf, products: prods };
          return c;
        });
      },
      onProducts: (p) => {
        prods = p;
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], products: p };
          return c;
        });
      },
      onDone: async () => {
        setIsLoading(false);
        abortRef.current = null;
        if (userId) {
          const cid = await saveConversation({
            conversationId, userId, mode: "shopping",
            title: sentInput.slice(0, 60),
            messages: [
              { role: "user", content: sentInput },
              { role: "assistant", content: buf },
            ],
          });
          if (cid && !conversationId) setConversationId(cid);
        }
      },
      onError: (e) => { toast.error(e); setIsLoading(false); },
    });
  }, [input, attachedFiles, isLoading, messages, userId]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };

  const ProductCard = ({ p }: { p: Product }) => (
    <a
      href={p.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-background/40 backdrop-blur-xl transition hover:border-amber-400/40 hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white/5">
        {p.image ? (
          <img src={p.image} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center"><ShoppingCart className="h-8 w-8 text-muted-foreground" /></div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {p.seller && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.seller}</span>}
        <h3 className="line-clamp-2 text-xs font-medium text-foreground">{p.title}</h3>
        {p.rating && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400">
            <Star className="h-3 w-3 fill-current" /> {p.rating}
          </div>
        )}
        <div className="mt-auto pt-1.5 text-sm font-bold text-foreground">{p.price}</div>
      </div>
    </a>
  );

  return (
    <AppLayout>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={() => navigate("/")} currentMode="shopping" />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "file")} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files, "image")} />

      <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-background">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/20 blur-[120px] animate-pulse" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-orange-500/15 blur-[140px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-rose-400/10 blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        {/* Floating sidebar btn */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-background/40 backdrop-blur-2xl hover:bg-background/60 transition"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {!hasResults ? (
          <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-24 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-[10vw] uppercase leading-[0.95] tracking-tight md:text-[5rem]"
            >
              FIND <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">ANYTHING.</span>
              <br />SHOP SMART.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-5 max-w-md text-sm text-muted-foreground md:text-base"
            >
              Search across stores, compare prices, get the best deals — instantly.
            </motion.p>

            {/* Live preview as user types */}
            {livePreview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {livePreview.map((p, i) => <ProductCard key={i} p={p} />)}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-48 pt-20">
            {messages.map((m, i) => (
              <div key={i} className="mb-4">
                {m.attachedImages && m.attachedImages.length > 0 && (
                  <div className="mb-2 flex flex-wrap justify-end gap-2">
                    {m.attachedImages.map((img, j) => (
                      <img key={j} src={img} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                    ))}
                  </div>
                )}
                {m.content && <ChatMessage role={m.role} content={m.content} />}
                {m.products && m.products.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {m.products.map((p, j) => <ProductCard key={j} p={p} />)}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-4 pt-2 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto">
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 px-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="group relative">
                    {f.type === "image" ? (
                      <img src={f.data} alt={f.name} className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 items-center gap-2 rounded-xl bg-background/50 px-3 backdrop-blur-xl">
                        <FileUp className="h-4 w-4 text-amber-400" />
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

            <div className="relative rounded-[28px] border border-white/10 bg-background/50 p-2 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
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
                          className="absolute bottom-full mb-2 left-0 z-[46] w-72 rounded-3xl border border-white/10 bg-background/80 p-3 backdrop-blur-2xl shadow-2xl"
                        >
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { ref: cameraInputRef, icon: Camera, label: "Camera" },
                              { ref: imageInputRef, icon: ImageIcon, label: "Photos" },
                              { ref: fileInputRef, icon: FileUp, label: "Files" },
                            ].map(({ ref, icon: Icon, label }, i) => (
                              <button
                                key={label}
                                onClick={() => { ref.current?.click(); setPlusOpen(false); }}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-white/5 transition"
                              >
                                <Icon className="w-5 h-5 text-amber-400" />
                                <span className="text-[11px] text-foreground/80">{label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="What are you shopping for?"
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
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg transition hover:scale-105 disabled:opacity-40"
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

export default ShoppingModePage;
