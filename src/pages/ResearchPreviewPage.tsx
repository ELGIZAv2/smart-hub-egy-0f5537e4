import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
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
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
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

  const handleDownload = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    const loadingToast = toast.loading(isRtl ? "جارٍ إنشاء ملف PDF…" : "Generating PDF…");
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Capture the entire report as a high-res canvas
      const node = reportRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: node.scrollWidth,
      });

      // A4 portrait in mm
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // Compute the pixel slice height that fits one PDF page
      const pxPerMm = canvas.width / usableW;
      const sliceH = Math.floor(usableH * pxPerMm);

      let rendered = 0;
      let pageIndex = 0;
      while (rendered < canvas.height) {
        const currentSliceH = Math.min(sliceH, canvas.height - rendered);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceH;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, currentSliceH, 0, 0, canvas.width, currentSliceH);
        const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        const imgHmm = currentSliceH / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin, usableW, imgHmm, undefined, "FAST");
        rendered += currentSliceH;
        pageIndex++;
      }

      const safeName = data!.query.slice(0, 60).replace(/[\\/:*?"<>|]/g, "-").trim() || "research-report";
      pdf.save(`${safeName}.pdf`);
      toast.success(isRtl ? "تم التحميل" : "Downloaded", { id: loadingToast });
    } catch (err) {
      console.error("[PDF export]", err);
      toast.error(isRtl ? "فشل إنشاء الملف" : "Failed to generate PDF", { id: loadingToast });
    } finally {
      setExporting(false);
    }
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
          disabled={exporting}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5 transition disabled:opacity-50"
          title="Download PDF"
        >
          {exporting ? <Loader2 className="h-4 w-4 text-foreground animate-spin" /> : <Download className="h-4 w-4 text-foreground" />}
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
          {/* Editorial header */}
          <div className="mb-10">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {isRtl ? "تقرير بحث معمّق" : "Deep Research Report"}
            </p>
            <h1
              dir="auto"
              className="text-[clamp(2rem,6vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-foreground"
              style={{ fontFamily: isRtl ? '"Noto Naskh Arabic", "Cairo", system-ui, sans-serif' : 'Inter, system-ui, sans-serif' }}
            >
              {data.query}
            </h1>
            <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px w-10 bg-foreground/40" />
              <span>{new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
          </div>

          {topImages.length > 0 && (
            <figure className="-mx-5 mb-10 sm:mx-0">
              <div className="overflow-x-auto px-5 pb-2 sm:px-0 scrollbar-thin" style={{ scrollSnapType: "x mandatory" }}>
                <div className="flex gap-3" style={{ width: "max-content" }}>
                  {topImages.map((img, i) => (
                    <div
                      key={i}
                      className="h-56 w-72 shrink-0 overflow-hidden rounded-xl bg-foreground/5 sm:h-64 sm:w-96"
                      style={{ scrollSnapAlign: "start" }}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </figure>
          )}

          {reportEmpty ? (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-sm text-muted-foreground">
              {isRtl ? "التقرير قيد التحضير. حاول مرة أخرى بعد قليل." : "Report is still being prepared. Please wait a moment and try again."}
            </div>
          ) : (
            <article
              dir={isRtl ? "rtl" : "ltr"}
              lang={isRtl ? "ar" : "en"}
              className={`research-report ${isRtl ? "research-report--rtl" : ""}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node: _n, ...props }) => <h2 dir="auto" {...props} />,
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
            <div className="mt-14 border-t border-foreground/10 pt-8">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {isRtl ? "صور إضافية" : "More Images"}
              </p>
              <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 scrollbar-thin">
                <div className="flex gap-3" style={{ width: "max-content" }}>
                  {restImages.map((img, i) => (
                    <div key={i} className="h-44 w-64 shrink-0 overflow-hidden rounded-xl bg-foreground/5">
                      <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!reportEmpty && (
            <div className="mt-16 flex justify-center">
              <div className="h-2 w-2 rotate-45 bg-foreground/40" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchPreviewPage;
