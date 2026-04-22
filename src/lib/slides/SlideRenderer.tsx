import { useEffect, useState } from "react";
import GlassPitch from "./templates/GlassPitch";
import SketchHand from "./templates/SketchHand";
import Cinema3D from "./templates/Cinema3D";
import TerminalDev from "./templates/TerminalDev";
import MagazineFold from "./templates/MagazineFold";
import PaperOrigami from "./templates/PaperOrigami";
import MinimalSwiss from "./templates/MinimalSwiss";
import GradientWave from "./templates/GradientWave";
import GlitchArt from "./templates/GlitchArt";
import Megsy from "./templates/Megsy";
import type { SlideDeck, Slide, SlidePalette } from "./types";
import { paletteForTemplate } from "./templatePalettes";

const TEMPLATE_MAP: Record<string, React.ComponentType<{ slide: Slide; palette: SlidePalette; index: number; total: number }>> = {
  GlassPitch, SketchHand, Cinema3D, TerminalDev, MagazineFold,
  PaperOrigami, MinimalSwiss, GradientWave, GlitchArt, Megsy,
};

const TEMPLATE_BY_ID: Record<string, string> = {
  "premium-megsy": "Megsy",
  "premium-glass-pitch": "GlassPitch",
  "premium-sketch-hand": "SketchHand",
  "premium-cinema-3d": "Cinema3D",
  "premium-terminal-dev": "TerminalDev",
  "premium-magazine-fold": "MagazineFold",
  "premium-paper-origami": "PaperOrigami",
  "premium-minimal-swiss": "MinimalSwiss",
  "premium-gradient-wave": "GradientWave",
  "premium-glitch-art": "GlitchArt",
};

interface Props { deck: SlideDeck; }

/** Fixed-resolution 1920x1080 slide that scales to fit its container. */
export function SlideCanvas({ deck, index }: { deck: SlideDeck; index: number }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const wrap = document.getElementById("slide-scale-wrap");
      if (!wrap) return;
      const sx = wrap.clientWidth / 1920;
      const sy = wrap.clientHeight / 1080;
      setScale(Math.min(sx, sy));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const componentName = TEMPLATE_BY_ID[deck.templateId] || "GlassPitch";
  const Template = TEMPLATE_MAP[componentName];
  const slide = deck.slides[index];
  const palette = paletteForTemplate(deck.templateId, deck.palette);
  if (!slide || !Template) return null;

  return (
    <div id="slide-scale-wrap" className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
      <div
        className="absolute slide-content"
        style={{
          width: 1920, height: 1080,
          left: "50%", top: "50%",
          marginLeft: -960, marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <Template slide={slide} palette={palette} index={index} total={deck.slides.length} />
      </div>
    </div>
  );
}

export function SlideRenderer({ deck }: Props) {
  const [active, setActive] = useState(0);
  const total = deck.slides.length;

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="flex-1 min-h-0">
        <SlideCanvas deck={deck} index={active} />
      </div>
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/50 backdrop-blur border-t border-border/20">
        <button
          onClick={() => setActive(i => Math.max(0, i - 1))}
          disabled={active === 0}
          className="px-4 py-2 rounded-full text-sm font-medium liquid-glass-button disabled:opacity-30"
        >← Prev</button>
        <div className="flex items-center gap-2 overflow-x-auto max-w-[60%] scrollbar-none">
          {deck.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 w-2 h-2 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "bg-foreground/20"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => setActive(i => Math.min(total - 1, i + 1))}
          disabled={active === total - 1}
          className="px-4 py-2 rounded-full text-sm font-medium liquid-glass-button disabled:opacity-30"
        >Next →</button>
      </div>
    </div>
  );
}
