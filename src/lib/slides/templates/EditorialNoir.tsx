import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function EditorialNoir({ slide, palette, index, total }: Props) {
  return (
    <div
      className="relative w-full h-full flex flex-col px-24 py-20"
      style={{ background: palette.bg, color: palette.fg, fontFamily: '"Playfair Display", Georgia, serif' }}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] opacity-50 pb-6 border-b" style={{ borderColor: `${palette.fg}20` }}>
        <span style={{ fontFamily: "Inter, sans-serif" }}>Editorial · Vol. {index + 1}</span>
        <span style={{ fontFamily: "Inter, sans-serif", color: palette.accent }}>{slide.type === "cover" ? "Issue" : "Feature"}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-5xl">
        {slide.kicker && (
          <p className="text-sm uppercase tracking-[0.3em] mb-8" style={{ color: palette.accent, fontFamily: "Inter, sans-serif" }}>
            — {slide.kicker} —
          </p>
        )}

        {slide.type === "quote" ? (
          <>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
              className="text-6xl leading-tight italic font-light">"{slide.quote}"</motion.p>
            {slide.attribution && (
              <p className="mt-10 text-lg tracking-widest uppercase opacity-60" style={{ fontFamily: "Inter, sans-serif" }}>
                {slide.attribution}
              </p>
            )}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="text-6xl font-bold mb-16 leading-[1.05]">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-12">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="border-t pt-4" style={{ borderColor: palette.fg }}>
                  <div className="text-5xl font-bold mb-2">{s.value}</div>
                  <div className="text-xs uppercase tracking-widest opacity-60" style={{ fontFamily: "Inter, sans-serif" }}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className={`font-black leading-[0.95] mb-8 ${slide.type === "cover" ? "text-9xl" : "text-7xl"}`}>
              {slide.title}
            </motion.h1>
            {slide.subtitle && (
              <p className="text-2xl italic font-light mb-10 max-w-3xl opacity-80 leading-snug">{slide.subtitle}</p>
            )}
            {slide.bullets?.length ? (
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mt-8 max-w-4xl" style={{ fontFamily: "Inter, sans-serif" }}>
                {slide.bullets.map((b, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex gap-4">
                    <span className="text-lg font-bold" style={{ color: palette.accent }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-lg leading-snug">{b}</span>
                  </motion.div>
                ))}
              </div>
            ) : null}
            {slide.body && <p className="text-xl mt-8 leading-relaxed max-w-3xl opacity-90" style={{ fontFamily: "Inter, sans-serif" }}>{slide.body}</p>}
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] opacity-50 pt-6 border-t" style={{ borderColor: `${palette.fg}20`, fontFamily: "Inter, sans-serif" }}>
        <span>{index + 1} / {total}</span>
        <span>Editorial Noir</span>
      </div>
    </div>
  );
}
