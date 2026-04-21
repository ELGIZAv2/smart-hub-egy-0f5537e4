import type { SlidePalette } from "./types";

/**
 * Per-template palette overrides. Each premium template gets its own
 * distinctive colour story so two decks never look alike — even when the
 * AI returns the same default palette.
 */
export const TEMPLATE_PALETTES: Record<string, SlidePalette> = {
  "premium-aurora-keynote":   { primary: "#8b5cf6", accent: "#22d3ee", bg: "#070417", fg: "#f5f3ff" },
  "premium-editorial-noir":   { primary: "#0a0a0a", accent: "#c9a55c", bg: "#f5f1e8", fg: "#0a0a0a" },
  "premium-neo-brutalist":    { primary: "#ff3d00", accent: "#ffea00", bg: "#fff5e1", fg: "#0a0a0a" },
  "premium-glass-pitch":      { primary: "#3b82f6", accent: "#a855f7", bg: "#070b1f", fg: "#f8fafc" },
  "premium-cairo-modern":     { primary: "#0f3057", accent: "#d4af37", bg: "#fffdf3", fg: "#0a1929" },
  "premium-sketch-hand":      { primary: "#1f2937", accent: "#ef4444", bg: "#fdf6e3", fg: "#1f2937" },
  "premium-cinema-3d":        { primary: "#06b6d4", accent: "#f43f5e", bg: "#000814", fg: "#ffffff" },
  "premium-ios-glass":        { primary: "#0a84ff", accent: "#ff375f", bg: "#0b1020", fg: "#ffffff" },
  "premium-terminal-dev":     { primary: "#00ff9c", accent: "#00b3ff", bg: "#0a0e14", fg: "#cdd9e5" },
  "premium-magazine-fold":    { primary: "#dc2626", accent: "#0a0a0a", bg: "#fafaf7", fg: "#0a0a0a" },
  "premium-neon-cyber":       { primary: "#ff0080", accent: "#00f0ff", bg: "#05010d", fg: "#ffe9ff" },
  "premium-paper-origami":    { primary: "#fb7185", accent: "#fbbf24", bg: "#fef3ec", fg: "#1f1147" },
  "premium-minimal-swiss":    { primary: "#dc143c", accent: "#000000", bg: "#ffffff", fg: "#000000" },
  "premium-gradient-wave":    { primary: "#f97316", accent: "#a855f7", bg: "#1e0a3c", fg: "#ffffff" },
  "premium-dark-luxe":        { primary: "#d4af37", accent: "#9ca3af", bg: "#0a0a0a", fg: "#f5e9c8" },
  "premium-kids-playful":     { primary: "#fb923c", accent: "#22d3ee", bg: "#fff8e7", fg: "#1e3a8a" },
  "premium-corporate-navy":   { primary: "#1e3a8a", accent: "#0ea5e9", bg: "#f8fafc", fg: "#0a1929" },
  "premium-nature-organic":   { primary: "#15803d", accent: "#a3e635", bg: "#f7f6ee", fg: "#14532d" },
  "premium-glitch-art":       { primary: "#ff006e", accent: "#3a86ff", bg: "#0a0a0a", fg: "#fbbf24" },
  "premium-isometric-tech":   { primary: "#7c3aed", accent: "#06b6d4", bg: "#0f172a", fg: "#e0e7ff" },
  "premium-watercolor-soft":  { primary: "#fb7185", accent: "#67e8f9", bg: "#fff8f8", fg: "#4a044e" },
  "premium-retro-arcade":     { primary: "#ff006e", accent: "#ffbe0b", bg: "#1a0033", fg: "#ffffff" },
  "premium-scientific-paper": { primary: "#1e40af", accent: "#dc2626", bg: "#ffffff", fg: "#0f172a" },
  "premium-pitch-yc":         { primary: "#ff6600", accent: "#000000", bg: "#ffffff", fg: "#0a0a0a" },
  "premium-arabesque-gold":   { primary: "#b45309", accent: "#d4af37", bg: "#1a0f0a", fg: "#fef3c7" },
};

export function paletteForTemplate(templateId: string, fallback?: SlidePalette): SlidePalette {
  return TEMPLATE_PALETTES[templateId] ?? fallback ?? {
    primary: "#7c3aed", accent: "#06b6d4", bg: "#0b0b1a", fg: "#f5f5ff",
  };
}
