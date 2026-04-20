import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Plus, Camera, Image, FileUp, X, GraduationCap, ShoppingCart, ArrowDown, ChevronDown, Star, Pencil, Trash2, FolderPlus, Globe, Lock, Share2, MoreVertical, Pin, UserPlus, Copy, Mail, Link2, Users, Loader2, NotebookPen, ClipboardList, CalendarDays, Timer } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import ChatMessage from "@/components/ChatMessage";
import AnimatedInput from "@/components/AnimatedInput";
import ThinkingLoader from "@/components/ThinkingLoader";
import FancyButton from "@/components/FancyButton";
import type { AgentDef, AgentModel } from "@/lib/agentRegistry";

import { streamChat } from "@/lib/streamChat";
import ConnectorsDialog from "@/components/ConnectorsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  products?: ProductResult[];
  attachedImages?: string[];
  attachedFiles?: {name: string;type: string;}[];
  liked?: boolean | null;
  id?: string;
}

interface ProductResult {
  title: string;
  price: string;
  image?: string;
  link?: string;
  seller?: string;
  rating?: string | null;
  delivery?: string | null;
}

type ChatMode = "normal" | "learning" | "shopping" | "deep-research";

const MODE_PROMPTS: Record<ChatMode, string> = {
  normal: "",
  learning: "You are in Learning Mode. Explain everything step by step with examples, analogies, and clear breakdowns. Make complex topics easy to understand. Use bullet points, numbered steps, and structured format.",
  shopping: "You are in Shopping Mode. Help the user find the best products, compare prices, suggest alternatives, and provide purchase recommendations. Include pros/cons when comparing items.",
  "deep-research": ""
};

const PegtopIcon = ({ className }: {className?: string;}) =>
<svg className={className} width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
  </svg>;


const MEGSY_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

const normalizeStatusLabel = (status: string) => {
  if (!status.trim()) return "";
  const lower = status.toLowerCase();
  const blocklist = ["web_search", "browse_website", "shopping_search", "convert_currency", "generate_image", "generate_video", "generate_voice", "canva_create_slides", "running ", "tool_call", "function_call"];
  if (blocklist.some(b => lower.includes(b))) return "Working on your request...";
  if (/https?:\/\//i.test(status)) return "Searching the web...";
  if (/writing the report/i.test(lower)) return "Writing the final report...";
  if (/analyzing products/i.test(lower)) return "Comparing the best options...";
  if (/searching for products|searching stores/i.test(lower)) return "Searching stores...";
  if (/searching:|gathering/i.test(lower)) return "Searching the web...";
  if (/found\s+\d+\s+(results|products)/i.test(lower)) return "Reviewing the results...";
  if (/search completed/i.test(lower)) return "Search completed.";
  if (/browsing completed/i.test(lower)) return "Browsing completed.";
  if (/reviewing/i.test(lower)) return "Reviewing the sources...";
  if (/opening|starting|browser|megsy computer|navigat|clicking|scrolling|extracting|smart browser/i.test(lower)) return "Searching the web...";
  return "Working on your request...";
};

const ChatPage = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [computerUseEnabled, setComputerUseEnabled] = useState(true);
  const [chatMode, setChatMode] = useState<ChatMode>("normal");
  const [attachedFiles, setAttachedFiles] = useState<{name: string;type: string;data: string;}[]>([]);
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"private" | "public">("public");
  const [isShared, setIsShared] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<{title: string;options: string[];allowText?: boolean;}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; email: string; role: string }[]>([]);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AgentModel | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);

  // Fetch user ID once for memory context
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setChatUserId(user.id);
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Only auto-scroll on user's own new message, not during streaming
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const prevCount = lastMsgCountRef.current;
    lastMsgCountRef.current = messages.length;
    // Scroll only when user sends a new message (count increased and last is user)
    if (messages.length > prevCount && messages.length > 0 && messages[messages.length - 1].role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const createOrUpdateConversation = async (firstMessage: string) => {
    if (conversationId) return conversationId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const title = firstMessage.slice(0, 50) || "New Chat";
    const { data } = await supabase.from("conversations").insert({ title, mode: "chat", model: MEGSY_MODEL, user_id: user.id } as any).select("id").single();
    if (data) {setConversationId(data.id);setConversationTitle(title);return data.id;}
    return null;
  };

  const saveMessage = async (convId: string, role: string, content: string, images?: string[]) => {
    await supabase.from("messages").insert({ conversation_id: convId, role, content, images: images || null });
  };

  const handleLikeMessage = useCallback((index: number, liked: boolean | null) => {
    setMessages((prev) => prev.map((m, i) => i === index ? { ...m, liked } : m));
  }, []);

  const loadConversation = async (id: string) => {
    setConversationId(id);
    setSearchStatus("");
    setPendingQuestions([]);
    const { data: conv } = await supabase.from("conversations").select("title, is_shared, share_id, is_pinned").eq("id", id).single();
    if (conv) {
      setConversationTitle(conv.title || "Untitled");
      setIsShared(conv.is_shared || false);
      setShareId(conv.share_id || null);
      setShareMode(conv.is_shared ? "public" : "private");
      setIsPinned(!!conv.is_pinned);
    }
    const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    if (msgs) {
      setMessages(msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content, images: m.images || undefined, liked: m.liked, id: m.id })));
      setTimeout(() => scrollToBottom(), 150);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {abortControllerRef.current.abort();abortControllerRef.current = null;}
    setIsLoading(false);setIsThinking(false);setSearchStatus("");
    setMessages((prev) => prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content ? prev.slice(0, -1) : prev);
  };

  const handleModeChange = (mode: ChatMode) => {
    setChatMode((prev) => prev === mode ? "normal" : mode);
    if (mode === "deep-research") {
      setSearchEnabled(true);
    } else if (mode !== "normal") {
      setSearchEnabled(false);
    }
    setPlusMenuOpen(false);
  };

  const handleSearchToggle = () => {
    setSearchEnabled(!searchEnabled);
    if (!searchEnabled) setChatMode("normal");
    setPlusMenuOpen(false);
  };

  const handleStructuredAction = useCallback((text: string) => {
    if (text.startsWith("Connect:")) {
      setConnectorsOpen(true);
      return;
    }
    setInput(text);
    setTimeout(() => {
      setInput(text);
      void sendWithTextRef.current?.(text);
    }, 50);
  }, []);

  // Fix: detect smart questions from the LATEST assistant message when streaming completes
  useEffect(() => {
    if (isLoading) return; // Wait until streaming is done
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;
    
    const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?```/g;
    let match;
    const questions: {title: string;options: string[];allowText?: boolean;}[] = [];
    while ((match = jsonBlockRegex.exec(lastMsg.content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === "questions" && parsed.questions) {
          questions.push(...parsed.questions);
        }
      } catch {}
    }
    if (questions.length > 0) setPendingQuestions(questions);
  }, [messages, isLoading]);

  const handleQuestionAnswer = (answer: string) => {
    setPendingQuestions([]);
    handleSendWithText(answer);
  };

  const handleQuestionSkip = () => {
    setPendingQuestions([]);
  };

  const isSubmittingRef = useRef(false);
  const sendWithTextRef = useRef<(overrideText?: string) => Promise<void>>();

  const handleSendWithText = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() && attachedFiles.length === 0) return;
    if (isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const imageAttachments = attachedFiles.filter((f) => f.type === "image");
    const fileAttachments = attachedFiles.filter((f) => f.type === "file");

    const userMsg: Message = {
      role: "user",
      content: text || (attachedFiles.length > 0 ? `[${attachedFiles.length} file(s) attached]` : ""),
      attachedImages: imageAttachments.map((f) => f.data),
      attachedFiles: fileAttachments.map((f) => ({ name: f.name, type: f.type }))
    };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    const userInput = text;
    setInput("");
    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);setIsThinking(true);
    setPendingQuestions([]);

    const conversationPromise = createOrUpdateConversation(userInput || "File analysis").catch(() => null);
    void conversationPromise.then(async (resolvedConversationId) => {
      if (!resolvedConversationId) return;
      await saveMessage(resolvedConversationId, "user", userInput || `[${currentFiles.length} file(s) attached]`);
    });

    let assistantContent = "";
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let searchImages: string[] = [];
    let streamedProducts: ProductResult[] = [];

    const isToolMarkerChunk = (chunk: string) => {
      const trimmed = chunk.trim();
      return [
        "BROWSE_WEBSITE",
        "WEB_SEARCH",
        "SHOPPING_SEARCH",
        "CONVERT_CURRENCY",
        "GENERATE_IMAGE",
        "GENERATE_VIDEO",
        "GENERATE_VOICE",
        "CANVA_CREATE_SLIDES",
      ].includes(trimmed);
    };

    const updateAssistant = (chunk: string) => {
      if (isToolMarkerChunk(chunk)) return;
      setIsThinking(false);setSearchStatus("");
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent, products: m.products ?? streamedProducts } : m);
        return [...prev, { role: "assistant", content: assistantContent, products: streamedProducts }];
      });
    };

    const allMessages = [...messages, userMsg].map((m) => {
      const imgs = m.attachedImages || [];
      if (imgs.length > 0) {
        // IMPORTANT: Put text FIRST so the model sees the user's question, then images
        const content: any[] = [];
        if (m.content && m.content.trim()) {
          content.push({ type: "text" as const, text: m.content });
        }
        imgs.forEach((imgData) => {
          content.push({ type: "image_url" as const, image_url: { url: imgData } });
        });
        // Ensure there's always at least text content
        if (content.length === 0) {
          content.push({ type: "text" as const, text: "Please analyze this image." });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

    if (currentFiles.some((f) => f.type === "file")) {
      const fileTexts = currentFiles.filter((f) => f.type === "file").map((f) => `--- File: ${f.name} ---\n${f.data}`).join("\n\n");
      const lastMsg = allMessages[allMessages.length - 1];
      if (typeof lastMsg.content === "string") {
        lastMsg.content = `${lastMsg.content}\n\n${fileTexts}`;
      }
    }

    // Mode prompts are now handled server-side via chatMode parameter
    const isDeepResearch = chatMode === "deep-research";

    await streamChat({
      messages: allMessages, model: MEGSY_MODEL, searchEnabled: searchEnabled || isDeepResearch,
      deepResearch: isDeepResearch,
      chatMode: chatMode,
      user_id: chatUserId || undefined,
      computerUseEnabled,
      activeAgent: chatMode !== "normal" ? chatMode : (selectedAgent?.id || undefined),
      selectedModel: selectedModel ? { id: selectedModel.id, cost: selectedModel.cost } : undefined,
      onDelta: updateAssistant,
      onImages: (imgs) => {searchImages = imgs;},
      onProducts: (products) => {
        streamedProducts = products;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role !== "assistant") return prev;
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, products } : m);
        });
      },
      onStatus: (status) => {
        const normalizedStatus = normalizeStatusLabel(status);
        if (normalizedStatus) {
          setSearchStatus(normalizedStatus);
          setIsThinking(true);
        }
      },
      onBrowser: () => {
        // Browser state no longer tracked in UI
      },
      onDone: async () => {
        setIsLoading(false);setIsThinking(false);setSearchStatus("");
        isSubmittingRef.current = false;
        if (!assistantContent && searchImages.length === 0 && streamedProducts.length === 0) {
          setMessages((prev) => prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content ? prev.slice(0, -1) : prev);
        }
        const resolvedConversationId = await conversationPromise;
        if (resolvedConversationId && assistantContent) {
          await saveMessage(resolvedConversationId, "assistant", assistantContent, searchImages.length > 0 ? searchImages : undefined);
          if (searchImages.length > 0 || streamedProducts.length > 0) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, images: searchImages.length > 0 ? searchImages : m.images, products: streamedProducts.length > 0 ? streamedProducts : m.products } : m);
              return prev;
            });
          }
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", resolvedConversationId);
        }
      },
      onError: (err) => {toast.error(err);setIsThinking(false);setIsLoading(false);setSearchStatus("");setMessages((prev) => prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content ? prev.slice(0, -1) : prev);isSubmittingRef.current = false;},
      signal: controller.signal
    });
  };

  useEffect(() => {
    sendWithTextRef.current = handleSendWithText;
  });

  const handleSend = () => handleSendWithText();

  const handleNewChat = () => {
    setMessages([]);setConversationId(null);setConversationTitle("");setIsLoading(false);setIsThinking(false);setAttachedFiles([]);setSearchStatus("");setChatMode("normal");setSearchEnabled(true);setComputerUseEnabled(true);setIsShared(false);setShareId(null);setShareMode("private");setIsPinned(false);setPendingQuestions([]);setSelectedModel(null);setSelectedAgent(null);isSubmittingRef.current = false;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const fileList = Array.from(files);
    if (attachedFiles.length + fileList.length > 5) {
      toast.error("Maximum 5 files allowed");
      e.target.value = "";
      return;
    }
    fileList.forEach(async (file) => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        return;
      }
      if (file.size === 0) {
        toast.error(`${file.name} is empty`);
        return;
      }
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        setAttachedFiles((prev) => [...prev, { name: file.name, type: "file", data: text.slice(0, 8000) }]);
      }
    });
    e.target.value = "";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedFiles((prev) => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleShare = async () => {
    setShareDialogOpen(true);
  };

  const handleCreateShareLink = async () => {
    if (!conversationId) return;
    if (shareMode === "public") {
      const newShareId = shareId || Math.random().toString(36).substring(2, 10);
      const { error } = await supabase.from("conversations").update({ is_shared: true, share_id: newShareId } as any).eq("id", conversationId);
      if (error) {toast.error("Failed to share");return;}
      setIsShared(true);
      setShareId(newShareId);
      const url = `${window.location.origin}/share/${newShareId}`;
      setGeneratedShareUrl(url);
    } else {
      await supabase.from("conversations").update({ is_shared: false } as any).eq("id", conversationId);
      setIsShared(false);
      setGeneratedShareUrl(null);
      toast.success("Chat set to private");
      setShareDialogOpen(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (generatedShareUrl) {
      await navigator.clipboard.writeText(generatedShareUrl);
      toast.success("Link copied!");
    }
  };

  const handleRename = async () => {
    if (!conversationId || !renameValue.trim()) return;
    await supabase.from("conversations").update({ title: renameValue.trim() }).eq("id", conversationId);
    setConversationTitle(renameValue.trim());
    setIsRenaming(false);
    toast.success("Renamed");
  };

  const handleTogglePin = async () => {
    if (!conversationId) return;
    const nextPinned = !isPinned;
    const payload = nextPinned
      ? { is_pinned: true, pinned_at: new Date().toISOString() }
      : { is_pinned: false, pinned_at: null };
    const { error } = await supabase.from("conversations").update(payload as any).eq("id", conversationId);
    if (error) { toast.error("Failed to update pin"); return; }
    setIsPinned(nextPinned);
    toast.success(nextPinned ? "Pinned" : "Unpinned");
  };

  const handleInvite = async () => {
    if (!conversationId) { toast.error("Start a conversation first"); return; }
    setInviteDialogOpen(true);
    setInviteLink(null);
    setInviteEmail("");
    const { data: memberRows } = await supabase.from("conversation_members").select("user_id, role").eq("conversation_id", conversationId);
    if (memberRows) {
      setMembers(memberRows.map((m: any) => ({ id: m.user_id, email: "", role: m.role })));
    }
  };

  const handleSendInviteEmail = async () => {
    if (!conversationId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInviteLoading(false); return; }
    const { data, error } = await supabase.from("conversation_invites").insert({ conversation_id: conversationId, invited_by: user.id, invite_email: inviteEmail.trim().toLowerCase() } as any).select("invite_token").single();
    if (error) { toast.error("Failed to create invite"); setInviteLoading(false); return; }
    const link = `${window.location.origin}/chat?invite=${(data as any).invite_token}`;
    setInviteLink(link);

    // Send actual invite email
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          to: inviteEmail.trim().toLowerCase(),
          template: "invite",
          user_id: user.id,
          type: "system",
          variables: {
            name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone",
            invite_link: link,
            app_url: window.location.origin,
          },
        },
      });
    } catch {}

    setInviteLoading(false);
    toast.success("Invite sent!");
  };

  const handleGenerateInviteLink = async () => {
    if (!conversationId) return;
    setInviteLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInviteLoading(false); return; }
    const { data, error } = await supabase.from("conversation_invites").insert({ conversation_id: conversationId, invited_by: user.id } as any).select("invite_token").single();
    if (error) { toast.error("Failed to create invite link"); setInviteLoading(false); return; }
    const link = `${window.location.origin}/chat?invite=${(data as any).invite_token}`;
    setInviteLink(link);
    setInviteLoading(false);
  };

  const handleCopyInviteLink = async () => {
    if (inviteLink) { await navigator.clipboard.writeText(inviteLink); toast.success("Invite link copied!"); }
  };

  // Accept invite / deep link / demo conversation on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Deep link: /chat?conv=xxx
    const convParam = params.get("conv");
    if (convParam && !conversationId) {
      loadConversation(convParam);
      window.history.replaceState({}, "", "/chat");
      return;
    }

    const inviteToken = params.get("invite");
    if (inviteToken) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Please sign in to accept invite"); return; }
        const { data: invite } = await supabase.from("conversation_invites").select("*").eq("invite_token", inviteToken).eq("status", "pending").single();
        if (!invite) { toast.error("Invalid or expired invite"); return; }
        await supabase.from("conversation_members").insert({ conversation_id: (invite as any).conversation_id, user_id: user.id, role: "member" } as any);
        await supabase.from("conversation_invites").update({ status: "accepted", accepted_by: user.id } as any).eq("id", (invite as any).id);
        loadConversation((invite as any).conversation_id);
        window.history.replaceState({}, "", "/chat");
        toast.success("You joined the conversation!");
      })();
      return;
    }

    // Demo conversation on first visit
    const demoKey = "megsy_demo_shown";
    if (localStorage.getItem(demoKey)) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Check if user has any conversations already
      const { count } = await supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (count && count > 0) { localStorage.setItem(demoKey, "1"); return; }
      localStorage.setItem(demoKey, "1");

      const demoUserMsg = "What is Megsy AI? Tell me everything about what you can do.";
      const demoAssistantMsg = `# Welcome to Megsy AI

Megsy is your all-in-one AI platform. Here's everything I can help you with:

## Chat
- **Smart conversations** powered by Google Gemini, with web search, deep research, learning mode, and shopping mode
- **Smart Questions** — I ask you clarifying questions to give better answers
- **File analysis** — upload images, PDFs, documents and I'll analyze them
- **Integrations** — connect Telegram, Discord, Slack, Notion, Zoom, TikTok, Twitter, Shopify, Meta, and more

## Images
- **AI Image Generation** — create stunning images using multiple models (Flux, DALL-E, Midjourney-style, and more)
- **15+ Image Tools** — Face Swap, Background Remover, Clothes Changer, Hair Changer, Inpainting, Retouch, Colorize, Sketch to Image, and more
- **Studio** — your personal gallery of all generated images

## Videos
- **AI Video Generation** — create videos from text or images
- **Video Tools** — Swap Characters, Upscale, Talking Photo, Video Extender, Auto Caption, Lip Sync, Video to Text
- **Community** — browse and reuse prompts from other creators

## Voice
- **Text-to-Speech** — generate natural voices with multiple AI models
- **Voice Cloning** — clone your own voice

## Programming
- **Megsy Workspace** — describe an app and I build it with live preview
- **Full-stack generation** — React, HTML, CSS, JavaScript projects
- **Download** your generated code

## Files
- **Document creation** — generate PDFs, spreadsheets, presentations
- **Smart file analysis** — upload any document for AI analysis

## Settings
- **AI Personalization** — tell me your name, profession, and how you want me to behave
- **Theme customization** — multiple themes and accent colors
- **Language** — auto-translate the entire UI

---

**MC Credits** power everything. You start with free credits and can earn more through referrals (20% commission).

Ask me anything to get started!`;

      // Create conversation
      const { data: conv } = await supabase.from("conversations").insert({ title: "Welcome to Megsy AI", mode: "chat", model: MEGSY_MODEL, user_id: user.id } as any).select("id").single();
      if (!conv) return;
      await supabase.from("messages").insert([
        { conversation_id: conv.id, role: "user", content: demoUserMsg },
        { conversation_id: conv.id, role: "assistant", content: demoAssistantMsg },
      ]);
      setConversationId(conv.id);
      setConversationTitle("Welcome to Megsy AI");
      setMessages([
        { role: "user", content: demoUserMsg },
        { role: "assistant", content: demoAssistantMsg },
      ]);
    })();
  }, []);

  // Realtime for new members
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`members-${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      const newMember = payload.new as any;
      setMembers((prev) => {
        if (prev.some((m) => m.id === newMember.user_id)) return prev;
        return [...prev, { id: newMember.user_id, email: "", role: newMember.role }];
      });
      toast.success("A new member joined!");
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const handleDelete = async () => {
    if (!conversationId) return;
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("conversations").delete().eq("id", conversationId);
    toast.success("Deleted");
    handleNewChat();
  };

  const handleEditUserMessageAt = useCallback((index: number, messageText: string) => {
    setInput(messageText);
    setMessages((prev) => {
      const next = [...prev];
      if (!next[index] || next[index].role !== "user") return prev;
      next.splice(index, next[index + 1]?.role === "assistant" ? 2 : 1);
      return next;
    });
  }, []);

  const hasConversation = messages.length > 0;

  const iosSpring = { type: "spring" as const, damping: 22, stiffness: 350 };

  const renderPlusMenu = () =>
  <>
      <div className="fixed inset-0 z-[45]" onClick={() => setPlusMenuOpen(false)} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.92 }}
        transition={iosSpring}
        className="absolute bottom-full mb-2 left-0 z-[46] rounded-3xl liquid-glass-milk p-3 w-72"
      >
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { ref: cameraInputRef, icon: Camera, label: "Camera" },
            { ref: imageInputRef, icon: Image, label: "Photos" },
            { ref: fileInputRef, icon: FileUp, label: "Files" },
          ].map(({ ref, icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => { ref.current?.click(); setPlusMenuOpen(false); }}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl liquid-glass-hover transition-colors ios-menu-item active:scale-95"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-[11px] text-foreground/80">{label}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border/15 pt-2 space-y-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={iosSpring}
            onClick={handleSearchToggle}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl liquid-glass-hover transition-colors ios-menu-item"
          >
            <span className="text-sm text-foreground/80">Web search</span>
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center ${searchEnabled ? "bg-primary justify-end" : "bg-muted justify-start"}`}>
              <motion.div layout transition={iosSpring} className="w-4 h-4 rounded-full bg-foreground mx-0.5" />
            </div>
          </motion.button>
          <div className="border-t border-border/15 mt-1 pt-1">
            <p className="text-[10px] text-muted-foreground/50 uppercase px-3 py-1.5">Modes</p>
            {[
              { mode: "learning" as ChatMode, label: "Learning Mode" },
              { mode: "shopping" as ChatMode, label: "Shopping Mode" },
              { mode: "deep-research" as ChatMode, label: "Deep Research" },
            ].map(({ mode, label }) => (
              <motion.button
                key={mode}
                whileTap={{ scale: 0.97 }}
                transition={iosSpring}
                onClick={() => {
                  if (mode === "learning") { navigate("/learning"); setPlusMenuOpen(false); return; }
                  if (mode === "shopping") { navigate("/shopping"); setPlusMenuOpen(false); return; }
                  if (mode === "deep-research") { navigate("/research"); setPlusMenuOpen(false); return; }
                  handleModeChange(mode);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ios-menu-item ${chatMode === mode ? "bg-primary/15 text-primary" : "liquid-glass-hover text-foreground/70"}`}
              >
                <span className="text-sm">{label}</span>
                {chatMode === mode && <span className="ml-auto text-xs text-primary">On</span>}
              </motion.button>
            ))}
          </div>
          {chatMode === "learning" && (
            <div className="border-t border-border/15 mt-1 pt-1">
              <p className="text-[10px] text-muted-foreground/50 uppercase px-3 py-1.5">Study tools</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { path: "/tools/smart-notes", icon: NotebookPen, label: "Smart Notes" },
                  { path: "/tools/exam-simulator", icon: ClipboardList, label: "Exam Simulator" },
                  { path: "/tools/study-planner", icon: CalendarDays, label: "Study Planner" },
                  { path: "/tools/focus-room", icon: Timer, label: "Focus Room" },
                ].map(({ path, icon: Icon, label }) => (
                  <button
                    key={path}
                    onClick={() => { navigate(path); setPlusMenuOpen(false); }}
                    className="flex items-center gap-2 px-2.5 py-2.5 rounded-xl liquid-glass-hover transition-colors ios-menu-item active:scale-95"
                  >
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-foreground/85 leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-border/15 mt-1 pt-1">
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={iosSpring}
              onClick={() => {navigate("/settings/integrations");setPlusMenuOpen(false);}}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left liquid-glass-hover transition-colors ios-menu-item"
            >
              <span className="text-sm text-foreground/70">Integrations</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">PRO</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>;


  const renderAttachments = () => {
    if (attachedFiles.length === 0) return null;
    return (
      <div className="flex gap-2 px-2 overflow-x-auto pb-1 mb-1">
        {attachedFiles.map((f, i) =>
        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg liquid-glass-button text-xs text-foreground shrink-0">
            {f.type === "image" ? <img src={f.data} alt="" className="w-8 h-8 rounded object-cover" /> : <FileUp className="w-3 h-3" />}
            <span className="truncate max-w-[100px]">{f.name}</span>
            <button onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>);
  };

  // Glass dialog class
  const glassDialogClass = "max-w-[calc(100vw-2rem)] sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl liquid-glass";

  return (
    <AppLayout
      onSelectConversation={loadConversation}
      onNewChat={handleNewChat}
      activeConversationId={conversationId}>
      
      <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectConversation={loadConversation}
          activeConversationId={conversationId}
          currentMode="chat" />

        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 min-h-[48px] bg-transparent">
          <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center bg-transparent border-0 text-muted-foreground hover:text-foreground transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          {!hasConversation && (
            <div className="flex-1 flex justify-center">
              <FancyButton onClick={() => navigate("/pricing")}>
                Unlock Pro
              </FancyButton>
            </div>
          )}

          <div className="flex items-center gap-1">

            {hasConversation && conversationId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 flex items-center justify-center bg-transparent border-0 text-muted-foreground hover:text-foreground transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl liquid-glass p-1.5">
                  <DropdownMenuItem onClick={handleShare} className="rounded-lg px-3 py-2.5 text-sm gap-3 cursor-pointer text-foreground/80">
                    <Share2 className="w-4 h-4 text-muted-foreground" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleInvite} className="rounded-lg px-3 py-2.5 text-sm gap-3 cursor-pointer text-foreground/80">
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
                    Invite
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {setRenameValue(conversationTitle);setIsRenaming(true);}} className="rounded-lg px-3 py-2.5 text-sm gap-3 cursor-pointer text-foreground/80">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleTogglePin} className="rounded-lg px-3 py-2.5 text-sm gap-3 cursor-pointer text-foreground/80">
                    <Pin className="w-4 h-4 text-muted-foreground" />
                    {isPinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-border/30" />
                  <DropdownMenuItem onClick={handleDelete} className="rounded-lg px-3 py-2.5 text-sm gap-3 cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="w-9" /> 
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-0 relative" ref={messagesContainerRef} onScroll={handleScroll}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="text-center max-w-xl w-full">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <PegtopIcon className="text-primary" />
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">Ask Megsy ?</h2>
                </div>

                <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                  <button onClick={() => navigate("/images")} className="px-3 py-1.5 rounded-full liquid-glass-button text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Photos
                  </button>
                  <button onClick={() => navigate("/files")} className="px-3 py-1.5 rounded-full liquid-glass-button text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Files
                  </button>
                  <button onClick={() => navigate("/videos")} className="px-3 py-1.5 rounded-full liquid-glass-button text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Videos
                  </button>
                  <button onClick={() => navigate("/code")} className="px-3 py-1.5 rounded-full liquid-glass-button text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Code
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4 px-4 md:px-6 space-y-2 pb-44 md:pb-52">
              {messages.map((msg, i) =>
                <ChatMessage
                  key={i}
                  messageIndex={i}
                  role={msg.role}
                  content={msg.content}
                  images={msg.images}
                  products={msg.products}
                  attachedImages={msg.attachedImages}
                  attachedFiles={msg.attachedFiles}
                  isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                  isThinking={isThinking && i === messages.length - 1 && msg.role === "assistant" && !msg.content}
                  searchStatus={i === messages.length - 1 && msg.role === "assistant" ? searchStatus : undefined}
                  liked={msg.liked}
                  onLikeMessage={handleLikeMessage}
                  onShare={undefined}
                  onStructuredAction={handleStructuredAction}
                  onEditUserMessageAt={msg.role === "user" ? handleEditUserMessageAt : undefined}
                  isDeepResearch={chatMode === "deep-research"} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          <AnimatePresence>
            {showScrollBtn && messages.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className="fixed bottom-36 right-4 z-20 w-9 h-9 rounded-full liquid-glass-subtle flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowDown className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom input - floating with blur */}
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 md:px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 pointer-events-none">
            <div className="max-w-3xl mx-auto space-y-2 pointer-events-auto">
              {/* Mode badge above input */}
              <AnimatePresence>
                {chatMode !== "normal" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex items-center"
                  >
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium liquid-glass-subtle ${
                      chatMode === "learning" ? "text-emerald-400" :
                      chatMode === "shopping" ? "text-amber-400" :
                      chatMode === "deep-research" ? "text-violet-400" : "text-foreground"
                    }`}>
                      {chatMode === "learning" && <GraduationCap className="w-3.5 h-3.5" />}
                      {chatMode === "shopping" && <ShoppingCart className="w-3.5 h-3.5" />}
                      {chatMode === "deep-research" && <Globe className="w-3.5 h-3.5" />}
                      <span>{chatMode === "learning" ? "Learning" : chatMode === "shopping" ? "Shopping" : "Deep Research"}</span>
                      <button
                        onClick={() => { setChatMode("normal"); setSelectedAgent(null); setSelectedModel(null); }}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-accent/50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </motion.div>
                )}
                {selectedAgent && chatMode === "normal" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex items-center"
                  >
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm border border-border/30 ${selectedAgent.bg} ${selectedAgent.color}`}>
                      {(() => { const Icon = selectedAgent.icon; return <Icon className="w-3.5 h-3.5" />; })()}
                      <span>{selectedAgent.label}</span>
                      <button
                        onClick={() => { setSelectedAgent(null); setSelectedModel(null); }}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-accent/50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {renderAttachments()}

              <div className="relative mx-auto w-full max-w-3xl">
                <AnimatePresence>
                  {plusMenuOpen && renderPlusMenu()}
                </AnimatePresence>
                <AnimatedInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  onCancel={handleCancel}
                  onPlusClick={() => setPlusMenuOpen(!plusMenuOpen)}
                  disabled={isLoading}
                  isLoading={isLoading}
                  pendingQuestions={pendingQuestions}
                  onQuestionAnswer={handleQuestionAnswer}
                  onQuestionSkip={handleQuestionSkip}
                  activeAgent={chatMode !== "normal" ? chatMode : (selectedAgent?.id || null)}
                  onAgentSelect={(agent: AgentDef) => {
                    const modeMap: Record<string, ChatMode> = { learning: "learning", shopping: "shopping", "deep-research": "deep-research" };
                    if (modeMap[agent.id]) {
                      setSelectedAgent(null);
                      setSelectedModel(null);
                      handleModeChange(modeMap[agent.id]);
                      return;
                    }
                    setChatMode("normal");
                    setSelectedAgent(agent);
                    setSelectedModel(null);
                  }}
                  onAgentRemove={() => { setChatMode("normal"); setSelectedAgent(null); setSelectedModel(null); if (chatMode === "deep-research") setSearchEnabled(false); }}
                  selectedModel={selectedModel}
                  onModelSelect={(model: AgentModel) => setSelectedModel(model)}
                  onModelRemove={() => setSelectedModel(null)}
                />
              </div>
            </div>
          </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.doc,.docx" multiple />
        <input ref={cameraInputRef} type="file" className="hidden" onChange={handleCameraCapture} accept="image/*" capture="environment" />
        <input ref={imageInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" multiple />

        <ConnectorsDialog open={connectorsOpen} onOpenChange={setConnectorsOpen} onNavigateIntegrations={() => navigate("/settings/integrations")} />

        {/* Share Dialog - Glass */}
        <Dialog open={shareDialogOpen} onOpenChange={(open) => {setShareDialogOpen(open);if (!open) setGeneratedShareUrl(null);}}>
          <DialogContent className={glassDialogClass}>
            <div className="px-5 pt-5 pb-3">
              <DialogHeader className="mb-0">
                <DialogTitle className="text-base font-semibold text-left text-foreground">Share chat</DialogTitle>
                <DialogDescription className="text-xs text-left text-muted-foreground">Future messages aren't included</DialogDescription>
              </DialogHeader>
            </div>
            <div className="border-t border-border/30">
              <button
                onClick={() => {setShareMode("private");setGeneratedShareUrl(null);}}
                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${shareMode === "private" ? "bg-accent/50" : "hover:bg-accent/30"}`}>
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/90">Keep private</p>
                  <p className="text-[11px] text-muted-foreground">Only you have access</p>
                </div>
              </button>
              <div className="h-px bg-border/30 mx-5" />
              <button
                onClick={() => setShareMode("public")}
                className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors ${shareMode === "public" ? "bg-accent/50" : "hover:bg-accent/30"}`}>
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/90">Create public link</p>
                  <p className="text-[11px] text-muted-foreground">Anyone with the link can view</p>
                </div>
              </button>
            </div>
            <div className="px-5 py-4 border-t border-border/30">
              {shareMode === "public" && generatedShareUrl ? (
                <div className="flex items-center gap-2 rounded-xl liquid-glass-button px-3 py-2.5 max-w-full overflow-hidden">
                  <span className="flex-1 text-[11px] text-muted-foreground truncate min-w-0 select-all">{generatedShareUrl}</span>
                  <button onClick={handleCopyShareLink} className="shrink-0 p-2 rounded-lg liquid-glass-hover transition-colors" aria-label="Copy">
                    <Copy className="w-4 h-4 text-foreground/70" />
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button onClick={handleCreateShareLink} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity">
                    {shareMode === "public" ? "Create link" : "Save"}
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog - Glass */}
        <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
          <DialogContent className={`${glassDialogClass} sm:max-w-sm`}>
            <div className="p-5 space-y-3">
              <DialogHeader>
                <DialogTitle className="text-lg text-foreground">Rename chat</DialogTitle>
              </DialogHeader>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-12 rounded-2xl border-border/30 bg-accent/30 text-sm text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsRenaming(false)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">Cancel</button>
                <button onClick={handleRename} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity">Save</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite Dialog - Glass */}
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) { setInviteLink(null); setInviteEmail(""); } }}>
          <DialogContent className={`${glassDialogClass} sm:max-w-[420px]`}>
            <div className="px-5 pt-5 pb-3">
              <DialogHeader className="mb-0">
                <DialogTitle className="text-base font-semibold text-left flex items-center gap-2 text-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  Invite to conversation
                </DialogTitle>
                <DialogDescription className="text-xs text-left text-muted-foreground">Invite someone to join and chat together with AI</DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Invite by email</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="h-11 pl-9 rounded-xl border-border/30 bg-accent/30 text-sm text-foreground placeholder:text-muted-foreground"
                      onKeyDown={(e) => e.key === "Enter" && handleSendInviteEmail()}
                    />
                  </div>
                  <button
                    onClick={handleSendInviteEmail}
                    disabled={inviteLoading || !inviteEmail.trim()}
                    className="px-4 h-11 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-opacity disabled:opacity-50"
                  >
                    {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] text-muted-foreground uppercase">or</span>
                <div className="flex-1 h-px bg-border/30" />
              </div>

              {inviteLink ? (
                <div className="flex items-center gap-2 rounded-xl liquid-glass-button px-3 py-2.5 max-w-full overflow-hidden">
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-[11px] text-muted-foreground truncate min-w-0 select-all">{inviteLink}</span>
                  <button onClick={handleCopyInviteLink} className="shrink-0 p-2 rounded-lg liquid-glass-hover transition-colors">
                    <Copy className="w-4 h-4 text-foreground/70" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInviteLink}
                  disabled={inviteLoading}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl liquid-glass-button text-sm text-foreground/70"
                >
                  <Link2 className="w-4 h-4" />
                  Generate invite link
                </button>
              )}

              {members.length > 0 && (
                <div className="pt-3 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase mb-2">Members ({members.length + 1})</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">You</div>
                      <span className="text-xs text-foreground/70">Owner</span>
                    </div>
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {m.email ? m.email[0].toUpperCase() : "?"}
                        </div>
                        <span className="text-xs text-muted-foreground">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>);
};

export default ChatPage;
