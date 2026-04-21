import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import { SlideRenderer } from "@/lib/slides/SlideRenderer";
import { exportDeckToPptx } from "@/lib/slides/pptxExporter";
import type { SlideDeck } from "@/lib/slides/types";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  deck: SlideDeck;
  onClose: () => void;
}

const spring = { type: "spring" as const, damping: 22, stiffness: 320 };

const SlideDeckPreview = ({ deck, onClose }: Props) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const safe = (deck.title || "presentation").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60);
      await exportDeckToPptx(deck, `${safe}.pptx`);
      toast.success("PowerPoint downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border/20">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full liquid-glass-button flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <p className="text-sm font-medium text-foreground truncate flex-1 text-center px-3">{deck.title}</p>
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={spring}
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {downloading
            ? <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Download className="w-4 h-4" />}
          PPTX
        </motion.button>
      </div>
      <div className="flex-1 min-h-0">
        <SlideRenderer deck={deck} />
      </div>
    </motion.div>
  );
};

export default SlideDeckPreview;
