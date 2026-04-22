import type { SlidePalette } from "./types";

/**
 * Per-template signature palettes. Keeps decks visually distinct even when
 * the AI returns the same default colours.
 */
export const TEMPLATE_PALETTES: Record<string, SlidePalette> = {
  "premium-megsy":         { primary: "#3b82f6", accent: "#ec4899", bg: "#08070d", fg: "#f8fafc" },
  "premium-glass-pitch":   { primary: "#3b82f6", accent: "#a855f7", bg: "#070b1f", fg: "#f8fafc" },
  "premium-sketch-hand":   { primary: "#1f2937", accent: "#ef4444", bg: "#fdf6e3", fg: "#1f2937" },
  "premium-cinema-3d":     { primary: "#06b6d4", accent: "#f43f5e", bg: "#000814", fg: "#ffffff" },
  "premium-terminal-dev":  { primary: "#00ff9c", accent: "#00b3ff", bg: "#0a0e14", fg: "#cdd9e5" },
  "premium-magazine-fold": { primary: "#dc2626", accent: "#0a0a0a", bg: "#fafaf7", fg: "#0a0a0a" },
  "premium-paper-origami": { primary: "#fb7185", accent: "#fbbf24", bg: "#fef3ec", fg: "#1f1147" },
  "premium-minimal-swiss": { primary: "#dc143c", accent: "#000000", bg: "#ffffff", fg: "#000000" },
  "premium-gradient-wave": { primary: "#f97316", accent: "#a855f7", bg: "#1e0a3c", fg: "#ffffff" },
  "premium-glitch-art":    { primary: "#ff006e", accent: "#3a86ff", bg: "#0a0a0a", fg: "#fbbf24" },
};

export function paletteForTemplate(templateId: string, fallback?: SlidePalette): SlidePalette {
  return TEMPLATE_PALETTES[templateId] ?? fallback ?? {
    primary: "#7c3aed", accent: "#06b6d4", bg: "#0b0b1a", fg: "#f5f5ff",
  };
}
