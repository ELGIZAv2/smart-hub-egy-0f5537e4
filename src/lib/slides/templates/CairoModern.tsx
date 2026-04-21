import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function CairoModern({ slide, palette, index, total }: Props) {
  return (
    <div
      dir="rtl"
      className="relative w-full h-full flex flex-col px-20 py-16"
      style={{ background: palette.bg, color: palette.fg, fontFamily: '"Cairo", "Tajawal", system-ui, sans-serif' }}
    >
      <div className="absolute top-0 right-0 w-2 h-full" style={{ background: palette.accent }} />
      <div className="absolute top-0 left-0 w-1 h-full opacity-40" style={{ background: palette.primary }} />

      <div className="flex items-center justify-between pb-6 mb-8 border-b-2" style={{ borderColor: `${palette.fg}15` }}>
        <span className="text-sm font-bold tracking-wider" style={{ color: palette.primary }}>القاهرة الحديثة</span>
        <span className="text-xs opacity-50">{index + 1} / {total}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-5xl">
        {slide.kicker && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="inline-flex self-start px-4 py-1.5 mb-6 rounded-full text-sm font-bold"
            style={{ background: `${palette.accent}25`, color: palette.accent }}>
            {slide.kicker}
          </motion.div>
        )}

        {slide.type === "quote" ? (
          <>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.2 }}
              className="text-9xl leading-none mb-2" style={{ color: palette.accent }}>"</motion.div>
            <p className="text-5xl font-light leading-snug">{slide.quote}</p>
            {slide.attribution && (
              <p className="mt-8 text-xl font-bold" style={{ color: palette.primary }}>— {slide.attribution}</p>
            )}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="text-5xl font-black mb-12">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-8">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="p-6 rounded-2xl text-center" style={{ background: `${palette.primary}08`, border: `1px solid ${palette.accent}30` }}>
                  <div className="text-5xl font-black mb-2" style={{ color: palette.accent }}>{s.value}</div>
                  <div className="text-sm font-bold opacity-80">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={`font-black leading-[1.1] mb-6 ${slide.type === "cover" ? "text-8xl" : "text-6xl"}`}>
              {slide.title}
            </motion.h1>
            {slide.subtitle && (
              <p className="text-2xl font-medium mb-8 max-w-3xl opacity-80 leading-relaxed">{slide.subtitle}</p>
            )}
            {slide.bullets?.length ? (
              <ul className="space-y-4 mt-6">
                {slide.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-4 text-2xl leading-snug">
                    <span className="mt-2 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: palette.accent, color: palette.bg }}>{i + 1}</span>
                    <span>{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-xl mt-6 leading-relaxed max-w-3xl opacity-90">{slide.body}</p>}
            {slide.cta && (
              <div className="mt-10 inline-flex self-start px-8 py-4 rounded-full text-lg font-bold"
                style={{ background: palette.primary, color: palette.bg }}>{slide.cta}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
