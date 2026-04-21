import type { Slide, SlidePalette } from "../types";

export interface TemplateProps {
  slide: Slide;
  palette: SlidePalette;
  index: number;
  total: number;
}

export const PageNum = ({ index, total, color, opacity = 0.5 }: { index: number; total: number; color?: string; opacity?: number }) => (
  <div
    className="absolute bottom-8 right-12 text-2xl tracking-widest"
    style={{ color, opacity }}
  >
    {index + 1} / {total}
  </div>
);
