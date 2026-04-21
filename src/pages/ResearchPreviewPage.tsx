import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { detectResearchReportDirection, normalizeResearchReport } from "@/lib/normalizeResearchReport";
import { toast } from "sonner";

interface ReportData {
  query: string;
  report: string;
  images: string[];
}

const ResearchPreviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const stateReport = (location.state as { reportData?: ReportData } | null)?.reportData ?? null;

  useEffect(() => {
    if (stateReport?.report) {
      setData({
        query: stateReport.query,
        report: stateReport.report,
        images: Array.isArray(stateReport.images) ? stateReport.images : [],
      });
      setLoading(false);
      return;
    }

    if (!id) { setLoading(false); return; }

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
  }, [id, stateReport]);

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

  const cleanReport = normalizeResearchReport(data.report);
  const isRtl = detectResearchReportDirection(cleanReport) === "rtl";
  const reportEmpty = cleanReport.trim().length < 10;

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

      <div className="flex-1 overflow-y-auto overscroll-contain">
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

          {reportEmpty ? (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 text-center text-sm text-muted-foreground">
              Report is still being prepared. Please wait a moment and try again.
            </div>
          ) : (
            <article
              dir={isRtl ? "rtl" : "ltr"}
              className={`research-report ${isRtl ? "research-report--rtl" : ""}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node: _n, ...props }) => <h1 dir="auto" {...props} />,
                  h2: ({ node: _n, ...props }) => <h2 dir="auto" {...props} />,
                  h3: ({ node: _n, ...props }) => <h3 dir="auto" {...props} />,
                  h4: ({ node: _n, ...props }) => <h4 dir="auto" {...props} />,
                  p: ({ node: _n, ...props }) => <p dir="auto" {...props} />,
                  li: ({ node: _n, ...props }) => <li dir="auto" {...props} />,
                  blockquote: ({ node: _n, ...props }) => <blockquote dir="auto" {...props} />,
                  table: ({ node: _n, ...props }) => (
                    <div className="research-report__table-wrap">
                      <table {...props} />
                    </div>
                  ),
                  th: ({ node: _n, ...props }) => <th dir="auto" {...props} />,
                  td: ({ node: _n, ...props }) => <td dir="auto" {...props} />,
                  img: () => null,
                  a: ({ node: _n, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              >
                {cleanReport}
              </ReactMarkdown>
            </article>
          )}

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
