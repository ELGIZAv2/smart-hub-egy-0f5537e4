import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import AppLayout from "@/layouts/AppLayout";
import ResearchFlow, { ResearchStep } from "@/components/files/ResearchFlow";
import FilePreviewPanel from "@/components/files/FilePreviewPanel";
import ExportDialog from "@/components/files/ExportDialog";
import { buildPreviewHtml } from "@/lib/filesHtmlBuilders";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, ArrowUp, Plus, X, Download, Eye, FileText, Undo2, Redo2, Paperclip, Image, HardDrive, Upload } from "lucide-react";

import type { SlideDeck } from "@/lib/slides/types";
import SlideDeckPreview from "@/components/files/SlideDeckPreview";
import BriefCard, { type FileBrief } from "@/components/files/BriefCard";
import SmartQuestionFlow, { type SmartQuestion } from "@/components/files/SmartQuestionFlow";
import { getBuilder, type FileBuilderType } from "@/lib/builders";
import { detectLanguage } from "@/lib/detectLanguage";


const SPECIALIZED_BUILDERS: FileBuilderType[] = [
  "document", "resume", "report", "spreadsheet",
  "letter", "roadmap", "mindmap", "timeline",
];

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  htmlContent?: string;
  downloadUrl?: string;
  mimeType?: string;
  deck?: SlideDeck;
  /** When set, this assistant message renders a BriefCard awaiting user confirmation. */
  brief?: FileBrief;
  briefForType?: FileBuilderType;
  briefTopic?: string;
  briefConsumed?: boolean;
  /** When set, this assistant message renders a SmartQuestionFlow card. */
  questions?: SmartQuestion[];
  questionsForType?: FileBuilderType;
  questionsTopic?: string;
  questionsAnswered?: boolean;
  questionsAnswer?: string;
  questionsLanguage?: string;
}

interface AttachedFile {
  name: string;
  type: string;
  data: string;
}

interface SavedFile {
  id: string;
  title: string;
  created_at: string;
  mode: string;
}

interface SlideTemplate {
  id: string;
  template_id: string;
  image_url: string | null;
  name?: string | null;
  description?: string | null;
  template_engine?: string | null;
  component_name?: string | null;
}

const FILE_SERVICES = [
  { id: "slides", label: "Slides" },
  { id: "document", label: "Document" },
  { id: "resume", label: "Resume" },
  { id: "report", label: "Report" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "letter", label: "Letter" },
  { id: "roadmap", label: "Roadmap" },
  { id: "mindmap", label: "Mindmap" },
  { id: "timeline", label: "Timeline" },
];

const SPREADSHEET_TEMPLATES = [
  { label: "Financial Report", prompt: "Create a comprehensive financial report spreadsheet with revenue, expenses, net income, assets, liabilities, and key financial ratios" },
  { label: "Employee Directory", prompt: "Create an employee directory spreadsheet with columns for name, department, position, email, phone, hire date, and status" },
  { label: "Sales Tracker", prompt: "Create a sales tracking spreadsheet with columns for date, product, quantity, unit price, total, salesperson, and region" },
  { label: "Project Budget", prompt: "Create a project budget spreadsheet with categories, planned budget, actual spending, variance, and completion status" },
  { label: "Data Analysis", prompt: "Create a data analysis spreadsheet with sample dataset, summary statistics, pivot table, and trend analysis" },
];

const spring = { type: "spring" as const, damping: 22, stiffness: 350 };

async function readSSEStreamWithStatus(
  body: ReadableStream<Uint8Array>,
  onStatus?: (status: string) => void,
  onContent?: (chunk: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return result;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          const statusMatch = delta.match(/\[STATUS:\s*(.*?)\]/);
          if (statusMatch && onStatus) onStatus(statusMatch[1]);
          const cleanDelta = delta.replace(/\[STATUS:\s*.*?\]/g, "");
          if (cleanDelta) { result += cleanDelta; onContent?.(cleanDelta); }
        }
      } catch {}
    }
  }
  return result;
}

function extractChatDisplay(content: string): string {
  const summaryMatch = content.match(/---SUMMARY---([\s\S]*?)$/);
  if (summaryMatch) return summaryMatch[1].replace(/\[STATUS:\s*.*?\]/g, "").trim();
  const hasHtml = /<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]|<section[\s>]|<table[\s>]/i.test(content);
  if (hasHtml) return "Your file is ready. Tap Preview to view it.";
  return content
    .replace(/```html[\s\S]*?```/g, "")
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[STATUS:\s*.*?\]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

type AgentMode = "plan" | "work";

const FilesPage = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [statusText, setStatusText] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SlideTemplate | null>(null);
  const [slideTemplates, setSlideTemplates] = useState<SlideTemplate[]>([]);
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);
  const [slideCount, setSlideCount] = useState<number>(10);
  const [showExport, setShowExport] = useState(false);
  const [exportHtml, setExportHtml] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat");
  const [undoStack, setUndoStack] = useState<ChatMsg[][]>([]);
  const [redoStack, setRedoStack] = useState<ChatMsg[][]>([]);
  const [activeDeck, setActiveDeck] = useState<SlideDeck | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [pendingBuilder, setPendingBuilder] = useState<{ type: FileBuilderType; topic: string; extras: Record<string, string> } | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState<"outer" | "inner" | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("work");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isGenerating]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("slide_templates").select("*").eq("is_active", true).order("display_order");
      if (data && data.length > 0) setSlideTemplates(data);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("conversations").select("id, title, created_at, mode").eq("user_id", user.id).eq("mode", "files").order("created_at", { ascending: false }).limit(20);
      if (data) setSavedFiles(data as SavedFile[]);
    })();
  }, []);

  useEffect(() => {
    setShowTemplates(activeAgent === "slides");
    if (activeAgent !== "slides") setSelectedTemplate(null);
  }, [activeAgent]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.htmlContent) {
      setPreviewHtml(lastMsg.htmlContent);
      if (!isMobile) setActiveTab("preview");
    }
  }, [messages, conversationId, isMobile]);

  useEffect(() => {
    if (!plusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) setPlusMenuOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [plusMenuOpen]);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} too large (max 10MB)`); return; }
      const reader = new FileReader();
      if (file.type.startsWith("image/")) {
        reader.onload = () => setAttachedFiles(prev => [...prev, { name: file.name, type: "image", data: reader.result as string }]);
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, data: (reader.result as string).slice(0, 10000) }]);
        reader.readAsText(file);
      }
    });
    e.target.value = "";
  };

  const getOrCreateConversation = async (firstMsg: string) => {
    if (conversationId) return conversationId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("conversations").insert({ title: firstMsg.slice(0, 50) || "File Generation", mode: "files", user_id: user.id } as any).select("id").single();
    if (data) { setConversationId(data.id); return data.id; }
    return null;
  };

  const loadConversation = async (id: string) => {
    setConversationId(id);
    const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true });
    if (msgs) {
      const loaded = msgs.map(m => {
        const msg: ChatMsg = { role: m.role as "user" | "assistant", content: m.content };
        if (m.role === "assistant" && m.images?.[0]) {
          try { const meta = JSON.parse(m.images[0]); if (meta.htmlContent) msg.htmlContent = meta.htmlContent; if (meta.downloadUrl) msg.downloadUrl = meta.downloadUrl; } catch {}
        }
        return msg;
      });
      setMessages(loaded);
      const lastHtml = [...loaded].reverse().find(m => m.htmlContent);
      if (lastHtml?.htmlContent) {
        setPreviewHtml(lastHtml.htmlContent);
        if (!isMobile) setActiveTab("preview");
      }
    }
  };

  const saveMsg = async (convId: string, role: string, content: string, meta?: { htmlContent?: string; downloadUrl?: string }) => {
    await supabase.from("messages").insert({ conversation_id: convId, role, content, images: meta ? [JSON.stringify(meta)] : null });
  };

  const addResearchStep = (label: string) => {
    setResearchSteps(prev => {
      const updated = prev.map(s => ({ ...s, status: "done" as const }));
      return [...updated, { id: `step-${Date.now()}`, label, status: "active" as const }];
    });
  };

  const doResearchWithStreaming = async (topic: string): Promise<string> => {
    setResearchSteps([{ id: "start", label: "Starting research...", status: "active" }]);
    const systemPrompt = `You are a deep research agent. Research the following topic thoroughly and provide comprehensive, detailed information.
IMPORTANT: As you research, output [STATUS: description] markers to show your progress.
After all status updates, provide your full research findings in detail. Include facts, statistics, dates, names, and verified information.
Write at least 2000 words of research content. Be thorough and accurate.
Do NOT invent information. Only provide verified facts.`;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Research this topic deeply and provide comprehensive information: ${topic}` }
          ],
          model: "moonshotai/kimi-k2.5:nitro",
          mode: "files",
          searchEnabled: true,
        }),
      });
      if (!resp.ok || !resp.body) return "";
      return await readSSEStreamWithStatus(resp.body, (status) => { addResearchStep(status); });
    } catch { return ""; }
  };

  const generateSlides = async (userInput: string, researchContent: string, convId: string | null) => {
    addResearchStep("Creating your presentation...");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.functions.invoke("generate-slides", {
      body: {
        topic: userInput,
        content: researchContent || userInput,
        templateId: selectedTemplate?.template_id || undefined,
        tier: "normal",
        userId: user?.id,
        pageCount: slideCount,
      },
    });
    if (error || !data?.success) return null;

    // Premium React deck path
    if (data?.engine === "react-native" && data?.deck) {
      const deck = data.deck as SlideDeck;
      const summary = `Your ${deck.slides.length}-slide presentation "${deck.title || userInput}" is ready. Tap Preview to view it or download as PPTX.`;
      pushMessage({ role: "assistant", content: summary, deck });
      if (convId) await saveMsg(convId, "assistant", summary, { htmlContent: JSON.stringify({ __deck: deck }) });
      setActiveDeck(deck);
      return true;
    }

    if (data?.download_url) {
      const summary = `Your presentation "${userInput}" is ready with ${data.slide_count || slideCount || 10} professional slides.`;
      pushMessage({ role: "assistant", content: summary, downloadUrl: data.download_url });
      if (convId) await saveMsg(convId, "assistant", summary, { downloadUrl: data.download_url });
      return true;
    }
    return null;
  };

  const generateHtmlFile = async (userInput: string, files: AttachedFile[], researchContent: string, convId: string | null) => {
    addResearchStep("Generating your file...");

    const agentType = activeAgent || "document";
    const imageFiles = files.filter(f => f.type === "image");
    const textFiles = files.filter(f => f.type !== "image");

    const systemPrompt = `You are an intelligent file generation agent called Megsy.
Current mode: ${agentMode === "plan" ? "PLAN — Only discuss, plan, and ask clarifying questions. Do NOT generate any HTML or files." : "WORK — Generate files. You MUST output HTML content."}
${agentMode === "work" ? `
You MUST generate a complete HTML file. Do NOT respond with just text.
Current file type: ${agentType}

CRITICAL RULES FOR FILE GENERATION:
- This is a FILE, NOT a website. Do NOT include navigation bars, fixed headers, buttons, or interactive UI elements.
- Generate LARGE, comprehensive content. Minimum 2000 words for reports/documents.
- Do NOT invent information. Use ONLY the research data provided and the user's explicit instructions.
- Do NOT add placeholder images, random tables, or filler content unless specifically requested.
- Do NOT abbreviate, summarize, or truncate the user's request.
- If the user attached images, analyze them carefully and incorporate the visual content into your response.
- Output ONLY complete, valid HTML for file content. Do NOT wrap it in code fences.
- Respond in the SAME LANGUAGE as the user's message.
- Choose a unique design style that fits the topic.

${agentType === "spreadsheet" ? `SPREADSHEET RULES: Generate interactive tables with contenteditable cells, sort buttons, sum/total rows, responsive with horizontal scroll, professional styling.` : ""}
${agentType === "resume" ? `RESUME RULES: Use ONLY user data. Include Contact Info, Summary, Experience, Education, Skills, Projects, Languages, Certifications.` : ""}
${agentType === "roadmap" ? "Generate a visual project roadmap as HTML with timeline-based layout, milestones, and phases." : ""}
${agentType === "mindmap" ? "Generate a visual mind map as HTML with hierarchical nodes, connecting lines, and proper spacing." : ""}
${agentType === "timeline" ? "Generate a visual chronological timeline as HTML with events, dates, and descriptions." : ""}

After the HTML content, write a personalized summary starting with ---SUMMARY--- on a new line.
As you work, output [STATUS: description] markers to show progress.` : `
Current file type context: ${agentType}
Help the user plan their ${agentType}. Ask clarifying questions about content, structure, style, and audience.
Be conversational and helpful. Do NOT generate any HTML.
Respond in the SAME LANGUAGE as the user's message.`}`;

    let prompt = `User request: ${userInput}`;
    if (researchContent) prompt += `\n\nResearch data to use (verified information):\n${researchContent.slice(0, 6000)}`;

    if (agentMode === "work" && ["slides", "document", "report", "roadmap", "timeline"].includes(agentType) && !userInput.toLowerCase().includes("no image")) {
      addResearchStep("Finding relevant images...");
      try {
        const { data: imgData } = await supabase.functions.invoke("search", { body: { query: `${userInput} high quality photos` } });
        const urls = Array.isArray(imgData?.images) ? imgData.images.slice(0, 6) : [];
        if (urls.length) prompt += `\n\nRelevant images you may use (only if contextually appropriate):\n${urls.map((u: string, i: number) => `${i + 1}. ${u}`).join("\n")}`;
      } catch {}
    }

    textFiles.forEach(f => { prompt += `\n\n--- Attached: ${f.name} ---\n${f.data}`; });

    const userMessage: any = imageFiles.length > 0
      ? { role: "user", content: [
          { type: "text", text: prompt },
          ...imageFiles.map(img => ({ type: "image_url", image_url: { url: img.data } }))
        ]}
      : { role: "user", content: prompt };

    addResearchStep(agentMode === "plan" ? "Thinking..." : "Writing content...");
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt }, userMessage],
        model: "moonshotai/kimi-k2.5:nitro",
        mode: "files",
      }),
    });

    if (!resp.ok || !resp.body) {
      pushMessage({ role: "assistant", content: "Generation failed. Please try again." });
      return;
    }

    let content = await readSSEStreamWithStatus(resp.body, (status) => { addResearchStep(status); });

    // In PLAN mode, always accept text response
    if (agentMode === "plan") {
      const cleanContent = content.replace(/\[STATUS:\s*.*?\]/g, "").replace(/---SUMMARY---[\s\S]*$/, "").replace(/<[^>]+>/g, "").trim();
      pushMessage({ role: "assistant", content: cleanContent });
      if (convId) await saveMsg(convId, "assistant", cleanContent);
      return;
    }

    // In WORK mode, check if AI generated HTML
    const hasHtml = /<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]|<section[\s>]|<table[\s>]/i.test(content);
    if (!hasHtml && !content.includes("---SUMMARY---")) {
      // AI didn't generate a file in work mode — retry with stronger instruction
      addResearchStep("Retrying file generation...");
      const retryResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You MUST generate a complete HTML file. Output ONLY HTML. Do not chat. Generate a ${agentType} about the user's topic. Respond in the user's language. After HTML, add ---SUMMARY--- with a brief description.` },
            userMessage
          ],
          model: "moonshotai/kimi-k2.5:nitro",
          mode: "files",
        }),
      });
      if (retryResp.ok && retryResp.body) {
        content = await readSSEStreamWithStatus(retryResp.body, (status) => { addResearchStep(status); });
      }
      const retryHasHtml = /<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]|<section[\s>]|<table[\s>]/i.test(content);
      if (!retryHasHtml) {
        const cleanContent = content.replace(/\[STATUS:\s*.*?\]/g, "").replace(/<[^>]+>/g, "").trim();
        pushMessage({ role: "assistant", content: cleanContent || "Could not generate the file. Please try with more details." });
        if (convId) await saveMsg(convId, "assistant", cleanContent);
        return;
      }
    }

    let summary = "";
    const summaryMatch = content.match(/---SUMMARY---([\s\S]*?)$/);
    if (summaryMatch) {
      summary = summaryMatch[1].replace(/\[STATUS:\s*.*?\]/g, "").trim();
      content = content.replace(/---SUMMARY---[\s\S]*$/, "").trim();
    }
    content = content.replace(/\[STATUS:\s*.*?\]/g, "").trim();

    const html = buildPreviewHtml({ content, agent: activeAgent, request: userInput });
    const desc = summary || "Your file is ready. Tap Preview to view it.";

    pushMessage({ role: "assistant", content: desc, htmlContent: html });
    if (convId) await saveMsg(convId, "assistant", desc, { htmlContent: html });
    setPreviewHtml(html);
    if (!isMobile) setActiveTab("preview");
  };

  const pushMessage = (msg: ChatMsg) => {
    setUndoStack(prev => [...prev, messages]);
    setRedoStack([]);
    setMessages(prev => [...prev, msg]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, messages]);
    setMessages(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, messages]);
    setMessages(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handleGenerate = useCallback(async (overrideInput?: string) => {
    const userInput = overrideInput || input;
    if (!userInput.trim() && attachedFiles.length === 0) return;

    // Specialized builders: open Intake → Brief → Build flow.
    if (
      agentMode === "work" &&
      activeAgent &&
      SPECIALIZED_BUILDERS.includes(activeAgent as FileBuilderType) &&
      !pendingBuilder
    ) {
      setPendingBuilder({ type: activeAgent as FileBuilderType, topic: userInput, extras: {} });
      setIntakeOpen(true);
      return;
    }

    const userContent = userInput || `[Attached ${attachedFiles.length} file(s)]`;
    pushMessage({ role: "user", content: userContent });
    setInput("");
    const files = [...attachedFiles];
    setAttachedFiles([]);
    setIsGenerating(true);
    setStatusText("Starting...");
    setResearchSteps([]);
    if (isMobile) setActiveTab("chat");

    const convId = await getOrCreateConversation(userContent);
    if (convId) await saveMsg(convId, "user", userContent);

    try {
      // In plan mode, skip research and slides — just chat
      if (agentMode === "plan") {
        await generateHtmlFile(userInput, files, "", convId);
      } else {
        const isSlides = activeAgent === "slides";
        const needsResearch = ["slides", "report", "document", "roadmap", "mindmap", "timeline", "spreadsheet"].includes(activeAgent || "");

        let research = "";
        if (needsResearch && activeAgent !== "resume" && activeAgent !== "letter") {
          research = await doResearchWithStreaming(userInput);
        }

        if (isSlides) {
          const result = await generateSlides(userInput, research, convId);
          if (!result) await generateHtmlFile(userInput, files, research, convId);
        } else {
          await generateHtmlFile(userInput, files, research, convId);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("conversations").select("id, title, created_at, mode").eq("user_id", user.id).eq("mode", "files").order("created_at", { ascending: false }).limit(20);
        if (data) setSavedFiles(data as SavedFile[]);
      }
    } catch (e) {
      console.error("Generation error:", e);
      pushMessage({ role: "assistant", content: "Something went wrong. Please try again." });
    }

    setIsGenerating(false);
    setStatusText("");
    setResearchSteps([]);
  }, [input, attachedFiles, activeAgent, conversationId, selectedTemplate, isMobile, agentMode, pendingBuilder]);

  // ---- Specialized builder flow: Intake -> Brief -> Build ----
  const handleIntakeSubmit = async (topic: string, extras: Record<string, string>) => {
    if (!pendingBuilder) return;
    setIntakeOpen(false);
    setInput("");
    pushMessage({ role: "user", content: topic });
    const convId = await getOrCreateConversation(topic);
    if (convId) await saveMsg(convId, "user", topic);

    setIsGenerating(true);
    setStatusText("Drafting brief...");
    try {
      const { data } = await supabase.functions.invoke("generate-file-brief", {
        body: { fileType: pendingBuilder.type, topic, extra: extras },
      });
      const brief: FileBrief = data?.brief ?? { summary: topic };
      setPendingBuilder({ ...pendingBuilder, topic, extras });
      pushMessage({
        role: "assistant",
        content: brief.summary || `Here's the plan for your ${pendingBuilder.type}.`,
        brief,
        briefForType: pendingBuilder.type,
        briefTopic: topic,
      });
    } catch {
      // On brief failure, build directly.
      await runBuilder(pendingBuilder.type, topic, undefined, convId);
    }
    setIsGenerating(false);
    setStatusText("");
  };

  const handleIntakeSkip = async () => {
    if (!pendingBuilder) return;
    setIntakeOpen(false);
    const topic = pendingBuilder.topic || input || "Untitled";
    setInput("");
    pushMessage({ role: "user", content: topic });
    const convId = await getOrCreateConversation(topic);
    if (convId) await saveMsg(convId, "user", topic);
    await runBuilder(pendingBuilder.type, topic, undefined, convId);
    setPendingBuilder(null);
  };

  const runBuilder = async (
    type: FileBuilderType,
    topic: string,
    brief: FileBrief | undefined,
    convId: string | null
  ) => {
    const builder = getBuilder(type);
    if (!builder) return;
    setIsGenerating(true);
    setResearchSteps([{ id: "build", label: `Building your ${type}...`, status: "active" }]);
    try {
      const result = await builder(topic, brief);
      pushMessage({
        role: "assistant",
        content: result.summary,
        htmlContent: result.previewHtml,
        downloadUrl: result.downloadUrl,
        mimeType: result.mimeType,
      });
      if (convId) {
        await saveMsg(convId, "assistant", result.summary, {
          htmlContent: result.previewHtml,
          downloadUrl: result.downloadUrl,
        });
      }
      if (result.previewHtml) {
        setPreviewHtml(result.previewHtml);
        if (!isMobile) setActiveTab("preview");
      }
    } catch (e) {
      console.error("builder failed:", e);
      pushMessage({ role: "assistant", content: "Generation failed. Please try again." });
    }
    setIsGenerating(false);
    setResearchSteps([]);
  };

  const handleBriefConfirm = async (msgIdx: number, editedBrief: FileBrief) => {
    const msg = messages[msgIdx];
    if (!msg?.briefForType || !msg.briefTopic) return;
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, briefConsumed: true } : m));
    await runBuilder(msg.briefForType, msg.briefTopic, editedBrief, conversationId);
    setPendingBuilder(null);
  };

  const newChat = () => {
    setMessages([]); setInput(""); setPreviewHtml(null); setAttachedFiles([]);
    setConversationId(null); setActiveAgent(null); setStatusText("");
    setShowTemplates(false); setSelectedTemplate(null); setResearchSteps([]);
    setActiveTab("chat"); setUndoStack([]); setRedoStack([]);
  };

  const hasMessages = messages.length > 0;
  const showPreviewPanel = !isMobile && previewHtml && hasMessages;

  // Segmented Plan/Work control
  const ModeToggle = () => (
    <div className="ios-segment-control">
      {(["plan", "work"] as const).map(mode => (
        <motion.button
          key={mode}
          onClick={() => setAgentMode(mode)}
          className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
            agentMode === mode ? "text-foreground" : "text-muted-foreground"
          }`}
          whileTap={{ scale: 0.95 }}
          transition={spring}
        >
          {agentMode === mode && (
            <motion.div
              layoutId="mode-indicator"
              className="absolute inset-0 rounded-full liquid-glass-button"
              transition={spring}
            />
          )}
          <span className="relative z-10">{mode === "plan" ? "Plan" : "Work"}</span>
        </motion.button>
      ))}
    </div>
  );

  // Plus menu component
  const PlusMenu = ({ context }: { context: "outer" | "inner" }) => (
    <AnimatePresence>
      {plusMenuOpen === context && (
        <motion.div
          ref={plusMenuRef}
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={spring}
          className="absolute bottom-full mb-2 left-0 z-50 w-56 rounded-3xl p-2 shadow-2xl liquid-glass-milk"
        >
          {[
            { icon: Paperclip, label: "Attach File", action: () => fileInputRef.current?.click() },
            { icon: Image, label: "Attach Image", action: () => imageInputRef.current?.click() },
            { icon: Upload, label: "Upload from Device", action: () => fileInputRef.current?.click() },
          ].map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: i * 0.03 }}
              onClick={() => { setPlusMenuOpen(null); item.action(); }}
              className="ios-menu-item w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm text-foreground/90 hover:bg-accent/30"
              whileTap={{ scale: 0.96 }}
            >
              <item.icon className="w-4 h-4 text-muted-foreground" /> {item.label}
            </motion.button>
          ))}
          <div className="border-t border-border/15 my-1.5" />
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.09 }}
            disabled
            className="ios-menu-item w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-sm text-muted-foreground/40 cursor-not-allowed"
          >
            <HardDrive className="w-4 h-4" /> Google Drive
            <span className="ml-auto text-[10px] uppercase tracking-wider opacity-50">Soon</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const chatPanel = (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={spring}
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </motion.button>
          <div className="flex items-center gap-1">
            {undoStack.length > 0 && (
              <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={handleUndo} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><Undo2 className="w-4 h-4" /></motion.button>
            )}
            {redoStack.length > 0 && (
              <motion.button whileTap={{ scale: 0.9 }} transition={spring} onClick={handleRedo} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><Redo2 className="w-4 h-4" /></motion.button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center min-h-full px-4">
            <div className="flex-1" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-2xl w-full">
              <h1 className="font-display text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-3">
                <span className="text-foreground">CREATE</span><br />
                <span className="bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">ANYTHING</span>
              </h1>
              <p className="text-muted-foreground/50 text-sm mb-10 max-w-xs mx-auto">
                Slides, documents, resumes, reports — powered by AI
              </p>

              {/* Input area */}
              <div className="max-w-xl mx-auto mb-5">
                {(activeAgent || selectedTemplate) && (
                  <motion.div layout className="flex items-center gap-2 mb-2 px-1 flex-wrap">
                    {activeAgent && (
                      <motion.span
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={spring}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-pill text-xs font-medium text-primary"
                      >
                        {FILE_SERVICES.find(s => s.id === activeAgent)?.label}
                        <button onClick={() => setActiveAgent(null)} className="ml-0.5 hover:text-foreground"><X className="w-3 h-3" /></button>
                      </motion.span>
                    )}
                    {selectedTemplate && (
                      <motion.span
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={spring}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-pill text-xs font-medium text-violet-400"
                      >
                        Template
                        <button onClick={() => setSelectedTemplate(null)} className="ml-0.5 hover:text-foreground"><X className="w-3 h-3" /></button>
                      </motion.span>
                    )}
                  </motion.div>
                )}

                {attachedFiles.length > 0 && (
                  <div className="flex gap-2 mb-2 px-1 flex-wrap">
                    {attachedFiles.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={spring}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-button text-xs text-foreground"
                      >
                        <span className="truncate max-w-[100px]">{f.name}</span>
                        <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="liquid-glass rounded-3xl overflow-visible">
                  <div className="flex items-end gap-2 px-4 py-3 min-h-[100px] relative">
                    <div className="relative self-end">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        transition={spring}
                        onClick={() => setPlusMenuOpen(plusMenuOpen === "outer" ? null : "outer")}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </motion.button>
                      <PlusMenu context="outer" />
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); handleGenerate(); }
                      }}
                      placeholder={agentMode === "plan" ? "Describe your file idea..." : "Describe what you want to create..."}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none min-h-[60px] max-h-[160px] py-1 select-text"
                      rows={3}
                      enterKeyHint="enter"
                    />
                    <div className="flex flex-col items-center gap-2 self-end">
                      <ModeToggle />
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        transition={spring}
                        onClick={() => handleGenerate()}
                        disabled={isGenerating || (!input.trim() && attachedFiles.length === 0)}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-foreground hover:bg-muted-foreground/10 transition-colors disabled:opacity-20"
                      >
                        {isGenerating ? <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="max-w-xl mx-auto mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none px-1">
                  {FILE_SERVICES.map(svc => (
                    <motion.button
                      key={svc.id}
                      whileTap={{ scale: 0.93 }}
                      transition={spring}
                      onClick={() => setActiveAgent(activeAgent === svc.id ? null : svc.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-all ${
                        activeAgent === svc.id
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "liquid-glass-button text-foreground/70 hover:text-foreground"
                      }`}
                    >
                      <span className="font-medium">{svc.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Spreadsheet templates */}
              {activeAgent === "spreadsheet" && (
                <div className="max-w-xl mx-auto mb-6">
                  <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider mb-3 text-left px-1">Quick Templates</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none px-1">
                    {SPREADSHEET_TEMPLATES.map(tmpl => (
                      <motion.button key={tmpl.label} whileTap={{ scale: 0.95 }} transition={spring} onClick={() => { setInput(tmpl.prompt); }} className="px-4 py-2 rounded-full liquid-glass-button text-xs text-foreground/70 hover:text-foreground whitespace-nowrap shrink-0">
                        {tmpl.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Slide templates */}
              <AnimatePresence>
                {showTemplates && slideTemplates.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="max-w-xl mx-auto mb-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider">Choose a template</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">{slideCount} slides</span>
                      </div>
                    </div>
                    <div className="px-1 mb-4">
                      <input
                        type="range"
                        min={3}
                        max={60}
                        step={1}
                        value={slideCount}
                        onChange={(e) => setSlideCount(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none bg-foreground/10 accent-primary cursor-pointer"
                        aria-label="Number of slides"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                        <span>3</span><span>15</span><span>30</span><span>45</span><span>60</span>
                      </div>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none px-1">
                      {slideTemplates.map(tmpl => {
                        const selected = selectedTemplate?.id === tmpl.id;
                        return (
                          <motion.button
                            key={tmpl.id}
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.02 }}
                            transition={spring}
                            onClick={() => setSelectedTemplate(selected ? null : tmpl)}
                            className={`shrink-0 w-40 rounded-2xl overflow-hidden transition-all text-left ${
                              selected ? "ring-2 ring-primary shadow-lg shadow-primary/20 scale-105" : "liquid-glass-subtle"
                            }`}
                          >
                            <div className="aspect-[16/10] bg-secondary/50 flex items-center justify-center relative">
                              {tmpl.image_url ? (
                                <img src={tmpl.image_url} alt={tmpl.name || "Template"} className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 font-mono px-2 text-center">{tmpl.name || tmpl.template_id.slice(-8)}</span>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                            </div>
                            {tmpl.name && (
                              <div className="px-2.5 py-1.5">
                                <p className="text-[11px] font-semibold text-foreground truncate">{tmpl.name}</p>
                              </div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Recent files */}
            <div className="flex-1 flex flex-col justify-start pt-6 max-w-xl w-full px-4">
              {savedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40 font-medium">Recent</p>
                  {savedFiles.slice(0, 6).map((f, i) => (
                    <motion.button
                      key={f.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring, delay: i * 0.04 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => loadConversation(f.id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl liquid-glass-button text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                      </div>
                      <span className="text-muted-foreground/30 shrink-0 text-xs">→</span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto py-4 px-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className="flex justify-end mb-4"
                  >
                    <div className="max-w-[85%] liquid-glass-subtle text-foreground px-4 py-2.5 rounded-[1.6rem] rounded-br-md text-sm leading-relaxed select-text">{msg.content}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className="mb-4 space-y-3"
                  >
                    <div className="text-foreground text-sm select-text leading-relaxed whitespace-pre-wrap">
                      {extractChatDisplay(msg.content)}
                    </div>

                    {msg.brief && msg.briefForType && !msg.briefConsumed && (
                      <BriefCard
                        brief={msg.brief}
                        fileType={msg.briefForType}
                        onConfirm={(edited) => handleBriefConfirm(i, edited)}
                      />
                    )}
                    
                    {/* File thumbnail card */}
                    {msg.htmlContent && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={spring}
                        className="rounded-3xl overflow-hidden liquid-glass-subtle max-w-sm"
                      >
                        <div className="relative h-[120px] overflow-hidden bg-white rounded-t-3xl">
                          <iframe
                            srcDoc={msg.htmlContent}
                            className="w-full h-full pointer-events-none"
                            sandbox=""
                            title="File thumbnail"
                            style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
                          />
                        </div>
                        <div className="px-4 py-3 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">
                            {messages.find(m => m.role === "user")?.content?.slice(0, 40) || "Document"}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              transition={spring}
                              onClick={() => { if (isMobile) setActiveTab("chat"); textareaRef.current?.focus(); }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg"
                            >
                              Edit
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              transition={spring}
                              onClick={() => { setPreviewHtml(msg.htmlContent!); if (isMobile) setActiveTab("preview"); }}
                              className="text-xs text-primary font-medium hover:text-primary/80 transition-colors px-2 py-1 rounded-lg"
                            >
                              Preview
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {msg.deck && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        transition={spring}
                        onClick={() => setActiveDeck(msg.deck!)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                      >
                        <Eye className="w-4 h-4" /> Preview Slides ({msg.deck.slides.length})
                      </motion.button>
                    )}

                    {msg.downloadUrl && (
                      <motion.a
                        whileTap={{ scale: 0.95 }}
                        transition={spring}
                        href={msg.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                      >
                        <Download className="w-4 h-4" />
                        {msg.mimeType === "image/svg+xml" ? "Download SVG"
                          : msg.mimeType === "application/pdf" ? "Download PDF"
                          : msg.mimeType?.includes("spreadsheet") ? "Download XLSX"
                          : "Download"}
                      </motion.a>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
            {isGenerating && researchSteps.length > 0 && <ResearchFlow steps={researchSteps} />}
            {isGenerating && researchSteps.length === 0 && (
              <div className="flex items-center gap-2.5 py-2">
                <motion.svg width="18" height="18" viewBox="0 0 100 100" className="shrink-0 text-primary" animate={{ rotate: [0, 180, 360], scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                  <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="currentColor" />
                </motion.svg>
                <span className="text-sm text-foreground">{statusText || "Working..."}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Preview button removed */}

      {/* Bottom input */}
      {hasMessages && (
        <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-2xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {attachedFiles.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-button text-xs text-foreground"
                  >
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                  </motion.div>
                ))}
              </div>
            )}
            <div className="liquid-glass rounded-3xl overflow-visible">
              <div className="flex items-end gap-2 px-3 py-2 relative">
                <div className="relative self-end">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={spring}
                    onClick={() => setPlusMenuOpen(plusMenuOpen === "inner" ? null : "inner")}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                  <PlusMenu context="inner" />
                </div>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); handleGenerate(); }
                  }}
                  placeholder={agentMode === "plan" ? "Discuss your plan..." : "Ask for changes..."}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none min-h-[24px] max-h-[120px] py-2 select-text"
                  rows={1}
                  enterKeyHint="enter"
                />
                <div className="flex items-center gap-2 self-end">
                  <ModeToggle />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={spring}
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || (!input.trim() && attachedFiles.length === 0)}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-foreground hover:bg-muted-foreground/10 transition-colors disabled:opacity-20"
                  >
                    {isGenerating ? <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx,.csv,.json,.md,.xlsx,.pptx,image/*" multiple className="hidden" onChange={handleFileAttach} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileAttach} />
    </div>
  );

  const previewPanel = previewHtml ? (
    <FilePreviewPanel
      html={previewHtml}
      title={messages.find(m => m.role === "user")?.content?.slice(0, 50) || "Preview"}
      onClose={() => { if (isMobile) setActiveTab("chat"); else setPreviewHtml(null); }}
      onEdit={() => { if (isMobile) setActiveTab("chat"); }}
      onDownload={() => { setExportHtml(previewHtml); setShowExport(true); }}
    />
  ) : null;

  return (
    <AppLayout onSelectConversation={loadConversation} onNewChat={newChat} activeConversationId={conversationId}>
      <div className="h-full flex flex-col bg-background overflow-x-hidden">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={newChat} onSelectConversation={loadConversation} activeConversationId={conversationId} currentMode="files" />

        <ExportDialog open={showExport} onClose={() => setShowExport(false)} html={exportHtml} fileName={activeAgent || "document"} isSpreadsheet={activeAgent === "spreadsheet"} />

        {isMobile ? (
          <div className="flex-1 min-h-0 relative">
            {activeTab === "chat" ? chatPanel : (previewPanel || chatPanel)}
          </div>
        ) : (
          <div className={`flex-1 min-h-0 ${showPreviewPanel ? "grid grid-cols-[minmax(350px,2fr)_3fr]" : "flex flex-col"}`}>
            {showPreviewPanel ? (
              <>
                <div className="border-r border-border/20 overflow-hidden">{chatPanel}</div>
                <div className="overflow-hidden relative">{previewPanel}</div>
              </>
            ) : (
              chatPanel
            )}
          </div>
        )}

        {/* Specialized builder Intake overlay */}
        <AnimatePresence>
          {intakeOpen && pendingBuilder && (
            <IntakeForm
              fileType={pendingBuilder.type}
              onSubmit={handleIntakeSubmit}
              onSkip={handleIntakeSkip}
              onClose={() => { setIntakeOpen(false); setPendingBuilder(null); }}
            />
          )}
        </AnimatePresence>

        {/* Premium slide deck preview overlay */}
        <AnimatePresence>
          {activeDeck && (
            <SlideDeckPreview deck={activeDeck} onClose={() => setActiveDeck(null)} />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

export default FilesPage;
