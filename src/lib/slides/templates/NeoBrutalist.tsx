import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function NeoBrutalist({ slide, palette, index, total }: Props) {
  const shadow = `8px 8px 0 ${palette.fg}`;
  return (
    <div
      className="relative w-full h-full flex flex-col p-16"
      style={{ background: palette.bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <motion.div
        initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4 }}
        className="inline-flex self-start px-4 py-2 mb-8 text-sm font-black uppercase tracking-wider"
        style={{ background: palette.primary, color: "#fff", boxShadow: shadow, border: `3px solid ${palette.fg}` }}
      >
        {slide.kicker || `Slide ${index + 1}`}
      </motion.div>

      <div className="flex-1 flex flex-col justify-center max-w-5xl">
        {slide.type === "quote" ? (
          <div className="border-4 p-12" style={{ borderColor: palette.fg, background: palette.accent, boxShadow: shadow }}>
            <p className="text-5xl font-black leading-tight">"{slide.quote}"</p>
            {slide.attribution && <p className="mt-6 text-xl font-bold uppercase">— {slide.attribution}</p>}
          </div>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="text-6xl font-black mb-10 uppercase">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-6">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="p-6 border-4" style={{ borderColor: palette.fg, background: i % 2 ? palette.accent : palette.bg, boxShadow: shadow }}>
                  <div className="text-5xl font-black mb-2">{s.value}</div>
                  <div className="text-sm font-bold uppercase">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className={`font-black uppercase leading-[0.9] mb-8 ${slide.type === "cover" ? "text-9xl" : "text-7xl"}`}>
              {slide.title}
            </motion.h1>
            {slide.subtitle && (
              <p className="text-2xl font-bold mb-8 max-w-3xl uppercase opacity-80">{slide.subtitle}</p>
            )}
            {slide.bullets?.length ? (
              <ul className="space-y-3 mt-4">
                {slide.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-4 text-2xl font-bold p-3 border-2"
                    style={{ borderColor: palette.fg, background: i % 2 ? `${palette.accent}40` : "transparent" }}>
                    <span className="px-3 py-1 text-sm" style={{ background: palette.primary, color: "#fff" }}>{i + 1}</span>
                    <span className="leading-snug">{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-xl mt-6 max-w-3xl font-medium leading-relaxed">{slide.body}</p>}
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t-4 text-sm font-black uppercase" style={{ borderColor: palette.fg }}>
        <span>{index + 1} / {total}</span>
        <span style={{ color: palette.primary }}>● NEO BRUTALIST</span>
      </div>
    </div>
  );
}
