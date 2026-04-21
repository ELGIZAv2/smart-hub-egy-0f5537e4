import { useEffect, useMemo, useState } from "react";
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

/**
 * Heavy-duty markdown normalizer for the AI research report.
 * Fixes the formatting issues we keep seeing in the preview:
 *   - dropped blank lines before/after headings, lists, tables, blockquotes
 *   - bullets/numbers stuck to the previous line ("text- item" or "text 1.")
 *   - mid-sentence line breaks inside Arabic paragraphs
 *   - stray "thinking/reasoning" preamble blocks
 *   - Latin punctuation hugging Arabic text without spaces
 *   - normalized list markers and stripped excessive blank lines
 */
const normalizeReport = (raw: string): string => {
  if (!raw) return "";
  let s = raw;

  // 1. Strip internal/thinking blocks
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  s = s.replace(/^\s*>\s*(thinking|reasoning|internal)[\s\S]*?(?=\n##|\n#|$)/gim, "");

  // 2. Normalize line endings & non-breaking spaces
  s = s.replace(/\r\n?/g, "\n").replace(/\u00A0/g, " ").replace(/\t/g, "    ");

  // 3. Force a blank line BEFORE block elements that are jammed onto a previous line
  s = s.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");           // headings
  s = s.replace(/([^\n])\n(\|.+\|)/g, "$1\n\n$2");             // tables
  s = s.replace(/([^\n])\n(>\s)/g, "$1\n\n$2");                // blockquotes
  s = s.replace(/([^\n])\n([-*+]\s)/g, "$1\n\n$2");            // bullets
  s = s.replace(/([^\n])\n(\d+\.\s)/g, "$1\n\n$2");            // numbered

  // 4. When the model glued a bullet onto the SAME line: "intro: - item" -> "intro:\n\n- item"
  s = s.replace(/([^\s])\s+([-*+])\s+(?=\S)/g, (m, pre, bullet) =>
    /[(\[]/.test(pre) ? m : `${pre}\n\n${bullet} `
  );

  // 5. Normalize bullet markers to "-" for consistent rendering
  s = s.replace(/^[\s]*[•●◦∙·]\s+/gm, "- ");

  // 6. Fix headings without a space after the # (e.g. "##Title" -> "## Title")
  s = s.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

  // 7. Re-flow accidental mid-sentence breaks INSIDE paragraphs only.
  //    A break is an "accident" when the next line starts with a lowercase/Arabic letter
    //    AND the previous line did not end with terminal punctuation.
  s = s.replace(
    /([^\n.!?؟:。！？\-•\|>])\n(?!\n)([^\s#\->\d\|])/g,
    "$1 $2"
  );

  // 8. Add a space between Arabic and Latin/numeric runs that are jammed together
  s = s.replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, "$1 $2");
  s = s.replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1 $2");

  // 9. Collapse 3+ blank lines down to 2
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
};

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

  const cleanReport = normalizeReport(data.report);
  const isRtl = /[\u0600-\u06FF]/.test(cleanReport);

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

          <article
            dir={isRtl ? "rtl" : "ltr"}
            className={`prose prose-neutral dark:prose-invert max-w-none
              prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground
              prose-h1:text-3xl prose-h1:mb-5 prose-h1:mt-2
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-h2:border-b prose-h2:border-foreground/10 prose-h2:pb-2
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:my-3 prose-p:leading-[1.85] prose-p:text-foreground/85
              prose-li:my-1.5 prose-li:leading-[1.8] prose-li:text-foreground/85
              prose-ul:my-3 prose-ol:my-3 prose-ul:pl-6 prose-ol:pl-6
              prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-2 prose-blockquote:border-foreground/30 prose-blockquote:text-foreground/75 prose-blockquote:not-italic
              prose-hr:my-8 prose-hr:border-foreground/10
              prose-code:rounded prose-code:bg-foreground/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-[''] prose-code:after:content-['']
              prose-pre:rounded-2xl prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-foreground/10
              prose-table:my-5 prose-table:text-sm prose-table:w-full
              prose-th:bg-foreground/[0.06] prose-th:px-3 prose-th:py-2 prose-th:text-foreground prose-th:font-semibold prose-th:border prose-th:border-foreground/10
              prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-foreground/10 prose-td:align-top
              ${isRtl ? "text-right [&_ul]:pr-6 [&_ul]:pl-0 [&_ol]:pr-6 [&_ol]:pl-0 [&_blockquote]:border-r-2 [&_blockquote]:border-l-0 [&_blockquote]:pr-4 [&_blockquote]:pl-0" : ""}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node: _n, ...props }) => (
                  <div className="my-5 overflow-x-auto rounded-2xl border border-foreground/10">
                    <table {...props} className="w-full border-collapse text-sm" />
                  </div>
                ),
                img: ({ node: _n, ...props }) => (
                  <img {...props} loading="lazy" className="my-4 rounded-2xl border border-foreground/10" />
                ),
              }}
            >
              {cleanReport}
            </ReactMarkdown>
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
