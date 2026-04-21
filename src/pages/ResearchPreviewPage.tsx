import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReportData {
  query: string;
  report: string;
  images: string[];
}

const ResearchPreviewPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) { setLoading(false); return; }
      const { data: row } = await supabase
        .from("research_reports")
        .select("query, report, images")
        .eq("user_id", uid)
        .eq("session_key", id)
        .maybeSingle();
      if (row) {
        setData({
          query: row.query,
          report: row.report,
          images: (row.images as any) || [],
        });
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const cleanReport = data.report
    .replace(/^\s*>\s*(thinking|reasoning|internal)[\s\S]*?(?=\n##|\n#|$)/gim, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();

  const handleDownload = () => {
    const blob = new Blob([`# ${data.query}\n\n${cleanReport}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.query.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  // Distribute images: first 3 at top, rest in middle gallery
  const topImages = data.images.slice(0, 3);
  const restImages = data.images.slice(3);

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-foreground/5 bg-background/80 px-4 py-3 backdrop-blur-2xl">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5 transition"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="flex-1 truncate text-sm font-semibold text-foreground">{data.query}</h1>
        <button
          onClick={handleDownload}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5 transition"
          title="Download"
        >
          <Download className="h-4 w-4 text-foreground" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8">
          {topImages.length > 0 && (
            <div className="-mx-5 mb-8 overflow-x-auto px-5 pb-2 scrollbar-thin">
              <div className="flex gap-3" style={{ width: "max-content" }}>
                {topImages.map((img, i) => (
                  <div key={i} className="h-44 w-64 shrink-0 overflow-hidden rounded-2xl border border-foreground/5 bg-foreground/5">
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-p:leading-relaxed prose-p:text-foreground/85 prose-li:text-foreground/85 prose-strong:text-foreground prose-table:text-sm prose-th:bg-foreground/5 prose-td:border-foreground/10 prose-th:border-foreground/10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanReport}</ReactMarkdown>
          </article>

          {restImages.length > 0 && (
            <div className="-mx-5 mt-10 overflow-x-auto px-5 pb-2 scrollbar-thin">
              <h3 className="mb-3 text-sm font-bold text-foreground">More images</h3>
              <div className="flex gap-3" style={{ width: "max-content" }}>
                {restImages.map((img, i) => (
                  <div key={i} className="h-44 w-64 shrink-0 overflow-hidden rounded-2xl border border-foreground/5 bg-foreground/5">
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchPreviewPage;
