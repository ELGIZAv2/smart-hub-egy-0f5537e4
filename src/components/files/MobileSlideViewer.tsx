import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { SlideCanvas } from "@/lib/slides/SlideRenderer";
import { exportDeckToPptx } from "@/lib/slides/pptxExporter";
import type { SlideDeck } from "@/lib/slides/types";
import { toast } from "sonner";

interface Props {
  deck: SlideDeck;
  onClose: () => void;
}

/**
 * Mobile-first slide viewer:
 * - Sticky header with back + title + download
 * - Vertically scrollable list of all slides (each rendered at proper aspect ratio)
 * - Floating prev/next pills that scroll smoothly to the next slide
 */
const MobileSlideViewer = ({ deck, onClose }: Props) => {
  const [downloading, setDownloading] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const safe = (deck.title || "presentation").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60);
      await exportDeckToPptx(deck, `${safe}.pptx`);
      toast.success("Downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  };

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(deck.slides.length - 1, i));
    setActive(next);
    slideRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Track active slide via IntersectionObserver
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.idx);
          if (!Number.isNaN(idx)) setActive(idx);
        }
      },
      { root, threshold: [0.4, 0.6, 0.8] },
    );
    slideRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [deck.slides.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 h-14 px-3 sm:px-4 flex items-center justify-between border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold truncate flex-1 text-center px-2">{deck.title}</p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="h-10 px-3 sm:px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
        >
          {downloading
            ? <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">Export</span>
        </button>
      </header>

      {/* Slides scroller */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain bg-muted/20 snap-y snap-mandatory"
      >
        <div className="flex flex-col items-center gap-4 sm:gap-6 px-3 sm:px-6 py-5">
          {deck.slides.map((_, i) => (
            <div
              key={i}
              ref={(el) => (slideRefs.current[i] = el)}
              data-idx={i}
              className="w-full max-w-3xl snap-center"
            >
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
                <SlideCanvas deck={deck} index={i} />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground tabular-nums">
                {i + 1} / {deck.slides.length}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating nav pills */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-2 py-1.5 rounded-full bg-foreground/90 text-background shadow-2xl backdrop-blur-xl">
        <button
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          className="h-9 w-9 rounded-full hover:bg-background/10 flex items-center justify-center disabled:opacity-30"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold tabular-nums px-2 min-w-[3rem] text-center">
          {active + 1} / {deck.slides.length}
        </span>
        <button
          onClick={() => goTo(active + 1)}
          disabled={active === deck.slides.length - 1}
          className="h-9 w-9 rounded-full hover:bg-background/10 flex items-center justify-center disabled:opacity-30"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default MobileSlideViewer;
