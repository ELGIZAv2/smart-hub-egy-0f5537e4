import { useEffect, useState } from "react";
import AuroraKeynote from "./templates/AuroraKeynote";
import EditorialNoir from "./templates/EditorialNoir";
import NeoBrutalist from "./templates/NeoBrutalist";
import GlassPitch from "./templates/GlassPitch";
import CairoModern from "./templates/CairoModern";
import SketchHand from "./templates/SketchHand";
import Cinema3D from "./templates/Cinema3D";
import iOSGlass from "./templates/iOSGlass";
import TerminalDev from "./templates/TerminalDev";
import MagazineFold from "./templates/MagazineFold";
import NeonCyber from "./templates/NeonCyber";
import PaperOrigami from "./templates/PaperOrigami";
import MinimalSwiss from "./templates/MinimalSwiss";
import GradientWave from "./templates/GradientWave";
import DarkLuxe from "./templates/DarkLuxe";
import KidsPlayful from "./templates/KidsPlayful";
import CorporateNavy from "./templates/CorporateNavy";
import NatureOrganic from "./templates/NatureOrganic";
import GlitchArt from "./templates/GlitchArt";
import IsometricTech from "./templates/IsometricTech";
import WatercolorSoft from "./templates/WatercolorSoft";
import RetroArcade from "./templates/RetroArcade";
import ScientificPaper from "./templates/ScientificPaper";
import PitchYC from "./templates/PitchYC";
import ArabesqueGold from "./templates/ArabesqueGold";
import type { SlideDeck, Slide, SlidePalette } from "./types";

const TEMPLATE_MAP: Record<string, React.ComponentType<{ slide: Slide; palette: SlidePalette; index: number; total: number }>> = {
  AuroraKeynote, EditorialNoir, NeoBrutalist, GlassPitch, CairoModern,
  SketchHand, Cinema3D, iOSGlass, TerminalDev, MagazineFold, NeonCyber,
  PaperOrigami, MinimalSwiss, GradientWave, DarkLuxe, KidsPlayful,
  CorporateNavy, NatureOrganic, GlitchArt, IsometricTech, WatercolorSoft,
  RetroArcade, ScientificPaper, PitchYC, ArabesqueGold,
};

const TEMPLATE_BY_ID: Record<string, string> = {
  "premium-aurora-keynote": "AuroraKeynote",
  "premium-editorial-noir": "EditorialNoir",
  "premium-neo-brutalist": "NeoBrutalist",
  "premium-glass-pitch": "GlassPitch",
  "premium-cairo-modern": "CairoModern",
  "premium-sketch-hand": "SketchHand",
  "premium-cinema-3d": "Cinema3D",
  "premium-ios-glass": "iOSGlass",
  "premium-terminal-dev": "TerminalDev",
  "premium-magazine-fold": "MagazineFold",
  "premium-neon-cyber": "NeonCyber",
  "premium-paper-origami": "PaperOrigami",
  "premium-minimal-swiss": "MinimalSwiss",
  "premium-gradient-wave": "GradientWave",
  "premium-dark-luxe": "DarkLuxe",
  "premium-kids-playful": "KidsPlayful",
  "premium-corporate-navy": "CorporateNavy",
  "premium-nature-organic": "NatureOrganic",
  "premium-glitch-art": "GlitchArt",
  "premium-isometric-tech": "IsometricTech",
  "premium-watercolor-soft": "WatercolorSoft",
  "premium-retro-arcade": "RetroArcade",
  "premium-scientific-paper": "ScientificPaper",
  "premium-pitch-yc": "PitchYC",
  "premium-arabesque-gold": "ArabesqueGold",
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

  const componentName = TEMPLATE_BY_ID[deck.templateId] || "AuroraKeynote";
  const Template = TEMPLATE_MAP[componentName];
  const slide = deck.slides[index];
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
        <Template slide={slide} palette={deck.palette} index={index} total={deck.slides.length} />
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
