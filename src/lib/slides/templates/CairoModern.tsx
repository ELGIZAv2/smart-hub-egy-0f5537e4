import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function CairoModern({ slide, palette, index, total }: Props) {
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");

  return (
    <div dir="rtl" className="relative w-full h-full flex flex-col px-24 py-16"
      style={{ background: palette.bg, color: palette.fg, fontFamily: '"Cairo", "Tajawal", system-ui, sans-serif' }}>
      <div className="absolute top-0 right-0 w-3 h-full" style={{ background: palette.accent }} />
      <div className="absolute top-0 left-0 w-2 h-full opacity-40" style={{ background: palette.primary }} />

      <div className="flex items-center justify-between pb-8 mb-10 border-b-2" style={{ borderColor: `${palette.fg}15` }}>
        <span className="text-2xl font-bold tracking-wider" style={{ color: palette.primary }}>القاهرة الحديثة</span>
        <span className="text-xl opacity-60">{index + 1} / {total}</span>
      </div>

      <div className="flex-1 flex gap-12 items-center">
        <div className={showImage ? "flex-1 max-w-[55%]" : "flex-1 max-w-6xl"}>
          {slide.kicker && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="inline-flex self-start px-6 py-3 mb-8 rounded-full text-2xl font-bold"
              style={{ background: `${palette.accent}25`, color: palette.accent }}>
              {slide.kicker}
            </motion.div>
          )}

          {slide.type === "quote" ? (
            <>
              <div className="leading-none mb-2 opacity-25" style={{ color: palette.accent, fontSize: "240px" }}>"</div>
              <p className="text-7xl font-light leading-snug">{slide.quote}</p>
              {slide.attribution && (
                <p className="mt-12 text-3xl font-bold" style={{ color: palette.primary }}>— {slide.attribution}</p>
              )}
            </>
          ) : slide.type === "stats" && slide.stats?.length ? (
            <>
              <h2 className="font-black mb-14 leading-[0.95]" style={{ fontSize: "100px" }}>{slide.title}</h2>
              <div className="grid grid-cols-3 gap-10">
                {slide.stats.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="p-10 rounded-3xl text-center" style={{ background: `${palette.primary}08`, border: `2px solid ${palette.accent}30` }}>
                    <div className="font-black mb-4 leading-none" style={{ color: palette.accent, fontSize: "120px" }}>{s.value}</div>
                    <div className="text-2xl font-bold opacity-85">{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="font-black leading-[1.05] mb-8"
                style={{ fontSize: slide.type === "cover" ? "180px" : "120px" }}>
                {slide.title}
              </motion.h1>
              {slide.subtitle && (
                <p className="text-4xl font-medium mb-12 max-w-3xl opacity-85 leading-relaxed">{slide.subtitle}</p>
              )}
              {slide.bullets?.length ? (
                <ul className="space-y-6 mt-8">
                  {slide.bullets.map((b, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-6 text-3xl leading-snug">
                      <span className="mt-3 shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-black"
                        style={{ background: palette.accent, color: palette.bg }}>{i + 1}</span>
                      <span>{b}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : null}
              {slide.body && <p className="text-3xl mt-10 leading-relaxed max-w-4xl opacity-90">{slide.body}</p>}
              {slide.cta && (
                <div className="mt-14 inline-flex self-start px-12 py-6 rounded-full text-3xl font-bold"
                  style={{ background: palette.primary, color: palette.bg }}>{slide.cta}</div>
              )}
            </>
          )}
        </div>

        {showImage && (
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
            className="flex-1 max-w-[40%] aspect-[4/5] rounded-[40px] overflow-hidden"
            style={{ border: `4px solid ${palette.accent}`, boxShadow: `0 30px 80px ${palette.primary}30` }}>
            <img src={slide.image} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
      </div>
    </div>
  );
}
