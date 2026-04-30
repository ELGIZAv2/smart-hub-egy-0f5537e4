import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowUp, Code2, FolderOpen, Sparkles, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  preview_url: string | null;
  status: string;
  updated_at: string;
  conversation_id: string | null;
  description: string | null;
}

const TEMPLATES = [
  "Personal portfolio website",
  "E-commerce store with cart",
  "SaaS landing page",
  "Restaurant menu site",
  "Photography gallery",
  "Online resume / CV",
];

const HERO_LINES = [
  { top: "BUILD", bottom: "ANY APP" },
  { top: "CODE", bottom: "ANY IDEA" },
  { top: "SHIP", bottom: "IN MINUTES" },
];

const ProgrammingPage = () => {
  const [input, setInput] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    const t = setInterval(() => setHeroIdx(p => (p + 1) % HERO_LINES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("projects")
      .select("id, name, preview_url, status, updated_at, conversation_id, description")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(24);
    if (data) setProjects(data as Project[]);
    setLoading(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    navigate(`/code/workspace?prompt=${encodeURIComponent(input)}`);
  };

  const openProject = (project: Project) => {
    const params = new URLSearchParams();
    params.set("project_id", project.id);
    if (project.conversation_id) params.set("conversation_id", project.conversation_id);
    navigate(`/code/workspace?${params.toString()}`);
  };

  const hero = HERO_LINES[heroIdx];

  return (
    <AppLayout
      onSelectConversation={(id) => { setConversationId(id); navigate(`/code/workspace?conversation_id=${id}`); }}
      onNewChat={() => setConversationId(null)}
      activeConversationId={conversationId}
    >
      <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
        {/* Top bar — Pricing-page style */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 max-w-7xl mx-auto">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight">Build</h1>
        </div>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-6 sm:pt-12 pb-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <h2
                className="font-black tracking-tight leading-[0.95] text-foreground"
                style={{ fontSize: "clamp(2.25rem, 8vw, 5.5rem)", letterSpacing: "-0.04em" }}
              >
                {hero.top}
                <br />
                <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                  {hero.bottom}
                </span>
              </h2>
            </motion.div>
          </AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mx-auto mt-5 max-w-xl font-medium text-muted-foreground"
            style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.125rem)" }}
          >
            Describe your idea. Watch it become a live website in seconds.
          </motion.p>
        </section>

        {/* Input */}
        <section className="max-w-2xl mx-auto px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl shadow-primary/5 p-2 pl-4"
          >
            <div className="flex items-end gap-2">
              <Sparkles className="w-5 h-5 text-primary mt-3 shrink-0" />
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="A modern portfolio for a photographer..."
                rows={2}
                className="flex-1 bg-transparent resize-none text-base text-foreground placeholder:text-muted-foreground/60 outline-none py-3 px-1 max-h-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 w-11 h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-25 flex items-center justify-center"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Templates */}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {TEMPLATES.map((t, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                onClick={() => setInput(t)}
                className="px-3.5 py-1.5 rounded-full border border-border/60 bg-card/40 backdrop-blur text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                {t}
              </motion.button>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 mt-14 pb-16">
          {loading ? null : projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/60 text-sm">
              No projects yet — start by describing your idea above.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Projects
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground/60">{projects.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((project, i) => (
                  <motion.button
                    key={project.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    onClick={() => openProject(project)}
                    className="group relative flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden text-left hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all"
                  >
                    <div className="w-full aspect-video bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-amber-500/10 flex items-center justify-center overflow-hidden relative">
                      {project.preview_url ? (
                        <img
                          src={project.preview_url}
                          alt={project.name}
                          loading="lazy"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Code2 className="w-12 h-12 text-foreground/15" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-card-foreground truncate">{project.name}</p>
                      {project.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{project.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">{new Date(project.updated_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default ProgrammingPage;
