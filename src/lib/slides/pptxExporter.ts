import type { SlideDeck, Slide } from "./types";

/**
 * Export a SlideDeck to a PowerPoint .pptx file using PptxGenJS.
 * Native vector-based slides — fully editable in PowerPoint/Keynote.
 */
export async function exportDeckToPptx(deck: SlideDeck, filename = "presentation.pptx") {
  const PptxGenJSModule = await import("pptxgenjs");
  const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title || "Presentation";

  const { palette } = deck;
  const isCairo = deck.templateId === "premium-cairo-modern";
  const isLight = ["premium-editorial-noir", "premium-neo-brutalist", "premium-cairo-modern"].includes(deck.templateId);

  for (let i = 0; i < deck.slides.length; i++) {
    const s = deck.slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: palette.bg.replace("#", "") };

    addSlideContent(slide, s, palette, i, deck.slides.length, isLight, isCairo);
  }

  await pptx.writeFile({ fileName: filename });
}

function addSlideContent(slide: any, s: Slide, palette: any, index: number, total: number, isLight: boolean, isCairo: boolean) {
  const fg = palette.fg.replace("#", "");
  const accent = palette.accent.replace("#", "");
  const primary = palette.primary.replace("#", "");
  const align = isCairo ? "right" : "left";
  const fontFace = isCairo ? "Cairo" : "Inter";

  // Page number
  slide.addText(`${index + 1} / ${total}`, {
    x: 12, y: 7.0, w: 1, h: 0.3,
    fontSize: 9, color: fg, fontFace, align: "right", transparency: 60,
  });

  if (s.kicker) {
    slide.addText(s.kicker.toUpperCase(), {
      x: 0.8, y: 0.6, w: 11, h: 0.4,
      fontSize: 11, bold: true, color: accent, fontFace, charSpacing: 4, align,
    });
  }

  if (s.type === "quote") {
    slide.addText(`"${s.quote || ""}"`, {
      x: 0.8, y: 2, w: 11.5, h: 3.5,
      fontSize: 36, italic: true, color: fg, fontFace, align,
      valign: "middle",
    });
    if (s.attribution) {
      slide.addText(`— ${s.attribution}`, {
        x: 0.8, y: 5.5, w: 11.5, h: 0.5,
        fontSize: 16, color: accent, fontFace, align,
      });
    }
    return;
  }

  if (s.type === "stats" && s.stats?.length) {
    slide.addText(s.title || "", {
      x: 0.8, y: 1.2, w: 11.5, h: 0.9,
      fontSize: 36, bold: true, color: fg, fontFace, align,
    });
    const cols = Math.min(3, s.stats.length);
    const cellW = 11.5 / cols;
    s.stats.slice(0, 6).forEach((stat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.8 + col * cellW;
      const y = 2.8 + row * 1.8;
      slide.addText(stat.value, {
        x, y, w: cellW - 0.2, h: 0.9,
        fontSize: 44, bold: true, color: accent, fontFace, align: "left",
      });
      slide.addText(stat.label, {
        x, y: y + 0.9, w: cellW - 0.2, h: 0.4,
        fontSize: 12, color: fg, fontFace, align: "left", transparency: 30,
      });
    });
    return;
  }

  // Cover, section, content, closing
  const titleSize = s.type === "cover" ? 60 : 44;
  const titleY = s.type === "cover" ? 2.5 : 1.4;
  slide.addText(s.title || "", {
    x: 0.8, y: titleY, w: 11.5, h: 1.6,
    fontSize: titleSize, bold: true, color: fg, fontFace, align,
  });

  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 0.8, y: titleY + 1.5, w: 11.5, h: 0.8,
      fontSize: 20, color: fg, fontFace, align, transparency: 25,
    });
  }

  if (s.bullets?.length) {
    const items = s.bullets.map(b => ({
      text: b,
      options: { bullet: { type: "bullet" as const, color: accent }, color: fg, fontSize: 20, fontFace, align },
    }));
    slide.addText(items, {
      x: 0.8, y: titleY + 1.8, w: 11.5, h: 4,
      paraSpaceAfter: 8,
    });
  }

  if (s.body && !s.bullets?.length) {
    slide.addText(s.body, {
      x: 0.8, y: titleY + 1.8, w: 11.5, h: 4,
      fontSize: 18, color: fg, fontFace, align, transparency: 15,
    });
  }

  if (s.cta) {
    slide.addShape("roundRect", {
      x: 0.8, y: 6.2, w: 3.5, h: 0.7,
      fill: { color: accent },
      line: { color: accent, width: 0 },
      rectRadius: 0.35,
    });
    slide.addText(s.cta, {
      x: 0.8, y: 6.2, w: 3.5, h: 0.7,
      fontSize: 14, bold: true, color: palette.bg.replace("#", ""), fontFace, align: "center",
    });
  }
}
