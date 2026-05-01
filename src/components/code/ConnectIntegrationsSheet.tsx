import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Database, Loader2, X, ExternalLink, Plus, Settings, Unlink, Upload, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  projectId?: string | null;
  /** Initial view when opened from a specific button */
  initialView?: "menu" | "supabase" | "github";
  /** Callback after successful github push to refresh outer state */
  onAfterGithubPush?: (repoUrl: string) => void;
}

interface IntegStatus {
  github?: { login?: string; avatar_url?: string; connected_at?: string } | null;
  supabase?: { connected_at?: string; linked?: { project_ref: string; name: string; region: string } } | null;
}

interface SupaProject { id: string; name: string; region: string; status?: string }
interface SupaOrg { id: string; name: string }

const ConnectIntegrationsSheet = ({ open, onClose, userId, projectId, initialView = "menu", onAfterGithubPush }: Props) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<IntegStatus>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"menu" | "supabase" | "github" | "supabase-pick">("menu");

  // Supabase project picker state
  const [projects, setProjects] = useState<SupaProject[]>([]);
  const [orgs, setOrgs] = useState<SupaOrg[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");

  // Github settings state
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [pushing, setPushing] = useState(false);

  const loadStatus = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("code_integrations")
      .select("provider, config")
      .eq("user_id", userId);
    const next: IntegStatus = {};
    (data || []).forEach((row) => {
      if (row.provider === "github") next.github = row.config as any;
      if (row.provider === "supabase") next.supabase = row.config as any;
    });
    setStatus(next);

    // load repo url for current project
    if (projectId) {
      const { data: proj } = await supabase.from("projects").select("repo_url, files_snapshot").eq("id", projectId).maybeSingle();
      setRepoUrl((proj as any)?.repo_url || "");
      const link = ((proj as any)?.files_snapshot as any)?.__supabase_link;
      if (link && next.supabase) next.supabase.linked = link;
      setStatus({ ...next });
    }
  };

  useEffect(() => {
    if (open) { setView(initialView); loadStatus(); }
  }, [open, userId, initialView]);

  const startOAuth = async (provider: "github" | "supabase") => {
    if (!userId) return;
    setBusy(provider);
    try {
      const fnName = provider === "github" ? "oauth-github-connect" : "oauth-supabase-connect";
      const { data, error } = await supabase.functions.invoke(`${fnName}?action=start&user_id=${userId}`);
      if (error || !data?.url) {
        toast({ title: "Could not start connection", variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (provider: "github" | "supabase") => {
    if (!userId) return;
    await supabase.from("code_integrations").delete().eq("user_id", userId).eq("provider", provider);
    toast({ title: `${provider === "github" ? "GitHub" : "Supabase"} disconnected` });
    loadStatus();
    setView("menu");
  };

  const openSupabaseSettings = async () => {
    setView("supabase");
    if (!status.supabase?.connected_at) return;
    // Pre-load projects + orgs
    setBusy("list");
    try {
      const { data } = await supabase.functions.invoke("oauth-supabase-connect?action=list-projects", { body: { user_id: userId } });
      setProjects(data?.projects || []);
      const { data: orgsData } = await supabase.functions.invoke("oauth-supabase-connect?action=list-orgs", { body: { user_id: userId } });
      setOrgs(orgsData?.orgs || []);
      if (orgsData?.orgs?.[0]) setNewOrg(orgsData.orgs[0].id);
    } finally {
      setBusy(null);
    }
  };

  const linkProject = async (proj: SupaProject) => {
    if (!projectId) {
      toast({ title: "Open a project first", variant: "destructive" });
      return;
    }
    const { data: row } = await supabase.from("projects").select("files_snapshot").eq("id", projectId).single();
    const snap = (row?.files_snapshot as Record<string, unknown>) || {};
    await supabase.from("projects").update({
      files_snapshot: {
        ...snap,
        __supabase_link: { project_ref: proj.id, name: proj.name, region: proj.region },
      } as any,
    }).eq("id", projectId);
    toast({ title: `Linked to ${proj.name}` });
    loadStatus();
  };

  const unlinkProject = async () => {
    if (!projectId) return;
    const { data: row } = await supabase.from("projects").select("files_snapshot").eq("id", projectId).single();
    const snap = ((row?.files_snapshot as any) || {});
    delete snap.__supabase_link;
    await supabase.from("projects").update({ files_snapshot: snap as any }).eq("id", projectId);
    toast({ title: "Unlinked" });
    loadStatus();
  };

  const createProject = async () => {
    if (!userId || !newName.trim() || !newOrg) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("oauth-supabase-connect?action=create-project", {
        body: { user_id: userId, name: newName.trim(), organization_id: newOrg },
      });
      if (error || data?.error) {
        toast({ title: "Create failed", description: data?.error || error?.message, variant: "destructive" });
        return;
      }
      toast({ title: `Created ${data.project.name}` });
      if (data.project) await linkProject(data.project);
    } finally {
      setCreating(false);
    }
  };

  const pushToGithub = async () => {
    if (!projectId) { toast({ title: "Open a project first", variant: "destructive" }); return; }
    setPushing(true);
    try {
      const { data: proj } = await supabase.from("projects").select("name, files_snapshot").eq("id", projectId).maybeSingle();
      const files = ((proj as any)?.files_snapshot) || {};
      delete (files as any).__supabase_link;
      if (!files || Object.keys(files).length === 0) {
        toast({ title: "Nothing to push yet", variant: "destructive" });
        return;
      }
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/github-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ user_id: userId, project_name: (proj as any)?.name || "project", files }),
      });
      const data = await r.json();
      if (data.ok && data.repo_url) {
        await supabase.from("projects").update({ repo_url: data.repo_url }).eq("id", projectId);
        setRepoUrl(data.repo_url);
        toast({ title: "Updates pushed" });
        onAfterGithubPush?.(data.repo_url);
      } else {
        toast({ title: "Push failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Push failed", variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[80]"
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-[81] bg-card/95 backdrop-blur-2xl border-t border-border rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">
                {view === "menu" ? "Integrations"
                  : view === "supabase" ? "Supabase settings"
                  : view === "github" ? "GitHub settings"
                  : "Pick project"}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MENU */}
            {view === "menu" && (
              <div className="space-y-3">
                {/* Supabase row */}
                <button
                  onClick={() => status.supabase?.connected_at ? openSupabaseSettings() : startOAuth("supabase")}
                  disabled={busy === "supabase"}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 text-left hover:border-foreground/30 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Database className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Supabase</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {status.supabase?.connected_at ? "Tap to manage settings" : "Connect a database"}
                    </p>
                  </div>
                  {status.supabase?.connected_at
                    ? <Settings className="w-4 h-4 text-muted-foreground" />
                    : busy === "supabase"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <span className="text-[11px] px-3 py-1.5 rounded-full bg-foreground text-background font-medium">Connect</span>}
                </button>

                {/* GitHub row */}
                <button
                  onClick={() => status.github?.login ? setView("github") : startOAuth("github")}
                  disabled={busy === "github"}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 text-left hover:border-foreground/30 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                    <Github className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">GitHub</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {status.github?.login ? `Connected as @${status.github.login} — tap to manage` : "Push projects to your repos"}
                    </p>
                  </div>
                  {status.github?.login
                    ? <Settings className="w-4 h-4 text-muted-foreground" />
                    : busy === "github"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <span className="text-[11px] px-3 py-1.5 rounded-full bg-foreground text-background font-medium">Connect</span>}
                </button>
              </div>
            )}

            {/* SUPABASE SETTINGS */}
            {view === "supabase" && (
              <div className="space-y-4">
                <button onClick={() => setView("menu")} className="text-xs text-muted-foreground">← Back</button>

                {/* Linked project pill */}
                {status.supabase?.linked ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">Linked project</p>
                    <p className="text-sm font-semibold">{status.supabase.linked.name}</p>
                    <p className="text-[11px] text-muted-foreground">{status.supabase.linked.region}</p>
                    <button onClick={unlinkProject} className="mt-3 text-xs text-rose-500 hover:underline flex items-center gap-1.5">
                      <Unlink className="w-3 h-3" /> Unlink from this code project
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Select a project below to link it to this build.</p>
                )}

                {/* Projects list */}
                <div>
                  <p className="text-xs font-semibold mb-2">Your Supabase projects</p>
                  {busy === "list" ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : projects.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-3 text-center">No projects in your account</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {projects.map((p) => {
                        const isLinked = status.supabase?.linked?.project_ref === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => linkProject(p)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left ${
                              isLinked ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:bg-secondary"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-medium">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{p.region}</p>
                            </div>
                            {isLinked ? <span className="text-[10px] font-bold text-emerald-500">LINKED</span> : <LinkIcon className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Create new */}
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold mb-2">Create new project</p>
                  <div className="space-y-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Project name"
                      className="w-full bg-secondary rounded-lg px-3 py-2 text-xs border border-border outline-none focus:border-primary"
                    />
                    {orgs.length > 1 && (
                      <select
                        value={newOrg}
                        onChange={(e) => setNewOrg(e.target.value)}
                        className="w-full bg-secondary rounded-lg px-3 py-2 text-xs border border-border outline-none"
                      >
                        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                    <button
                      onClick={createProject}
                      disabled={!newName.trim() || !newOrg || creating}
                      className="w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium disabled:opacity-30 flex items-center justify-center gap-1.5"
                    >
                      {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Create new project
                    </button>
                  </div>
                </div>

                <button onClick={() => disconnect("supabase")} className="w-full text-xs text-rose-500 hover:underline pt-2 flex items-center justify-center gap-1.5">
                  <Unlink className="w-3 h-3" /> Disconnect Supabase account
                </button>
              </div>
            )}

            {/* GITHUB SETTINGS */}
            {view === "github" && (
              <div className="space-y-4">
                <button onClick={() => setView("menu")} className="text-xs text-muted-foreground">← Back</button>

                <div className="rounded-2xl border border-border p-4 bg-background/50">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Account</p>
                  <p className="text-sm font-semibold">@{status.github?.login}</p>
                </div>

                {/* Repo URL */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Repository</p>
                  {repoUrl ? (
                    <a href={repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline break-all p-3 rounded-xl border border-border bg-background/50">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{repoUrl.replace(/^https?:\/\//, "")}</span>
                    </a>
                  ) : (
                    <p className="text-[11px] text-muted-foreground p-3 rounded-xl border border-border border-dashed text-center">No repo for this project yet</p>
                  )}
                </div>

                {/* Push button */}
                <button
                  onClick={pushToGithub}
                  disabled={pushing}
                  className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {pushing ? "Pushing..." : repoUrl ? "Push updates" : "Create repo & push"}
                </button>

                <button onClick={() => disconnect("github")} className="w-full text-xs text-rose-500 hover:underline pt-2 flex items-center justify-center gap-1.5">
                  <Unlink className="w-3 h-3" /> Disconnect GitHub account
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConnectIntegrationsSheet;
