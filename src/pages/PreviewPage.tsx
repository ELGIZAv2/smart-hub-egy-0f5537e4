import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, MoreHorizontal, RotateCw, Globe, ChevronRight, X, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WEBLY_BASE = "https://wxphtsgezburjqoqiqqo.supabase.co/functions/v1";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PreviewPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [search] = useSearchParams();
  const conversationId = search.get("conversation_id") || "";
  const webly = search.get("webly") || projectId || "";

  const [route, setRoute] = useState("/");
  const [iframeKey, setIframeKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewBase = `${WEBLY_BASE}/webly-site/${webly}`;
  const previewUrl = `${previewBase}${route.startsWith("/") ? route : "/" + route}`;

  const handleRefresh = () => setIframeKey(k => k + 1);

  const handleBackToChat = () => {
    if (conversationId) navigate(`/code/workspace?conversation_id=${conversationId}&project_id=${projectId}`);
    else if (projectId) navigate(`/code/workspace?project_id=${projectId}`);
    else navigate("/code");
  };

  const handlePublish = async () => {
    if (!projectId) return;
    setPublishing(true);
    setMenuOpen(false);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/webly-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ action: "deploy", project_id: webly }),
      });
      const data = await r.json();
      if (data.ok && data.cloudflare_url) {
        setPublishedUrl(data.cloudflare_url);
        toast.success("Project published");
        await supabase.from("projects").update({ status: "published" }).eq("id", projectId);
      } else {
        toast.error("Publish failed. Try again.");
      }
    } catch {
      toast.error("Publish failed. Try again.");
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Iframe — full screen */}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src={previewUrl}
        className="absolute inset-0 w-full h-full bg-white border-0"
        title="Project preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      {/* Floating bottom dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 max-w-[calc(100vw-2rem)]">
        {/* Chat button */}
        <button
          onClick={handleBackToChat}
          className="shrink-0 h-11 w-11 rounded-full bg-foreground text-background shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          title="Back to chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Route bar */}
        <div className="flex items-center gap-1.5 h-11 px-3 rounded-full bg-foreground/95 backdrop-blur-xl text-background shadow-2xl min-w-[180px]">
          <Globe className="w-4 h-4 opacity-70" />
          <span className="text-xs opacity-70">/</span>
          <input
            value={route.replace(/^\//, "")}
            onChange={e => setRoute("/" + e.target.value.replace(/^\/+/, ""))}
            onKeyDown={e => { if (e.key === "Enter") handleRefresh(); }}
            placeholder="route"
            className="bg-transparent text-xs outline-none flex-1 min-w-0 placeholder:text-background/40"
          />
        </div>

        {/* Three dots menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="shrink-0 h-11 w-11 rounded-full bg-foreground/95 text-background backdrop-blur-xl shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute bottom-full mb-2 right-0 z-40 w-52 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/60 shadow-2xl p-1.5"
                >
                  <button
                    onClick={() => { setMenuOpen(false); handleRefresh(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors"
                  >
                    <RotateCw className="w-4 h-4" /> Refresh
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-accent/40 transition-colors disabled:opacity-40"
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    {publishing ? "Publishing..." : "Publish project"}
                  </button>
                  {publishedUrl && (
                    <a
                      href={publishedUrl} target="_blank" rel="noreferrer"
                      className="block px-3 py-2 mt-1 rounded-xl text-[11px] text-primary hover:bg-accent/30 transition-colors break-all border-t border-border/40"
                    >
                      <Check className="inline w-3 h-3 mr-1" />{publishedUrl.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tiny corner exit */}
      <button
        onClick={handleBackToChat}
        className="absolute top-4 right-4 z-40 h-9 w-9 rounded-full bg-foreground/80 text-background backdrop-blur flex items-center justify-center hover:scale-105 transition-transform"
        title="Close preview"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PreviewPage;
