import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function NeoBrutalist({ slide, palette, index, total }: Props) {
  const shadow = `14px 14px 0 ${palette.fg}`;
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");

  return (
    <div className="relative w-full h-full flex flex-col p-20" style={{ background: palette.bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}>
      <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="inline-flex self-start px-8 py-4 mb-12 text-3xl font-black uppercase tracking-wider"
        style={{ background: palette.primary, color: "#fff", boxShadow: shadow, border: `5px solid ${palette.fg}` }}>
        {slide.kicker || `Slide ${index + 1}`}
      </motion.div>

      <div className="flex-1 flex gap-12 items-center">
        <div className={showImage ? "flex-1 max-w-[55%]" : "flex-1 max-w-6xl"}>
          {slide.type === "quote" ? (
            <div className="border-[6px] p-16" style={{ borderColor: palette.fg, background: palette.accent, boxShadow: shadow }}>
              <p className="text-7xl font-black leading-tight">"{slide.quote}"</p>
              {slide.attribution && <p className="mt-10 text-3xl font-bold uppercase">— {slide.attribution}</p>}
            </div>
          ) : slide.type === "stats" && slide.stats?.length ? (
            <>
              <h2 className="font-black mb-12 uppercase leading-[0.9]" style={{ fontSize: "112px" }}>{slide.title}</h2>
              <div className="grid grid-cols-3 gap-8">
                {slide.stats.map((s, i) => (
                  <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="p-10 border-[6px]" style={{ borderColor: palette.fg, background: i % 2 ? palette.accent : palette.bg, boxShadow: shadow }}>
                    <div className="font-black mb-4 leading-none" style={{ fontSize: "110px" }}>{s.value}</div>
                    <div className="text-2xl font-black uppercase">{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="font-black uppercase leading-[0.85] mb-10"
                style={{ fontSize: slide.type === "cover" ? "200px" : "128px" }}>
                {slide.title}
              </motion.h1>
              {slide.subtitle && <p className="text-4xl font-bold mb-10 max-w-4xl uppercase opacity-85">{slide.subtitle}</p>}
              {slide.bullets?.length ? (
                <ul className="space-y-5 mt-6">
                  {slide.bullets.map((b, i) => (
                    <motion.li key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-6 text-3xl font-bold p-5 border-4"
                      style={{ borderColor: palette.fg, background: i % 2 ? `${palette.accent}40` : "transparent" }}>
                      <span className="px-5 py-2 text-2xl shrink-0" style={{ background: palette.primary, color: "#fff" }}>{i + 1}</span>
                      <span className="leading-snug">{b}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : null}
              {slide.body && <p className="text-3xl mt-8 max-w-4xl font-medium leading-relaxed">{slide.body}</p>}
            </>
          )}
        </div>

        {showImage && (
          <div className="flex-1 max-w-[40%] h-[700px] border-[6px]" style={{ borderColor: palette.fg, boxShadow: shadow }}>
            <img src={slide.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-10 pt-6 border-t-[6px] text-2xl font-black uppercase" style={{ borderColor: palette.fg }}>
        <span>{index + 1} / {total}</span>
        <span style={{ color: palette.primary }}>● NEO BRUTALIST</span>
      </div>
    </div>
  );
}
