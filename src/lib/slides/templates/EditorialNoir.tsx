import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function EditorialNoir({ slide, palette, index, total }: Props) {
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");

  if (slide.type === "cover" && slide.image) {
    return (
      <div className="relative w-full h-full flex flex-col" style={{ background: palette.bg, color: palette.fg, fontFamily: '"Playfair Display", Georgia, serif' }}>
        <div className="h-1/2 relative overflow-hidden">
          <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 60%, ${palette.bg} 100%)` }} />
        </div>
        <div className="flex-1 flex flex-col justify-center px-24 py-12">
          {slide.kicker && (
            <p className="text-2xl uppercase tracking-[0.4em] mb-8" style={{ color: palette.accent, fontFamily: "Inter, sans-serif" }}>— {slide.kicker} —</p>
          )}
          <h1 className="font-black leading-[0.9]" style={{ fontSize: "180px" }}>{slide.title}</h1>
          {slide.subtitle && <p className="text-4xl italic font-light mt-8 opacity-80">{slide.subtitle}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col px-24 py-16" style={{ background: palette.bg, color: palette.fg, fontFamily: '"Playfair Display", Georgia, serif' }}>
      <div className="flex items-center justify-between text-2xl uppercase tracking-[0.35em] opacity-60 pb-8 border-b-2" style={{ borderColor: `${palette.fg}20` }}>
        <span style={{ fontFamily: "Inter, sans-serif" }}>Editorial · Vol. {index + 1}</span>
        <span style={{ fontFamily: "Inter, sans-serif", color: palette.accent }}>{slide.type === "cover" ? "Issue" : "Feature"}</span>
      </div>

      <div className="flex-1 flex gap-16 items-center pt-8">
        <div className={showImage ? "flex-1 max-w-[55%]" : "flex-1 max-w-6xl"}>
          {slide.kicker && (
            <p className="text-2xl uppercase tracking-[0.3em] mb-10" style={{ color: palette.accent, fontFamily: "Inter, sans-serif" }}>— {slide.kicker} —</p>
          )}

          {slide.type === "quote" ? (
            <>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-8xl leading-tight italic font-light">"{slide.quote}"</motion.p>
              {slide.attribution && (
                <p className="mt-12 text-3xl tracking-widest uppercase opacity-70" style={{ fontFamily: "Inter, sans-serif" }}>{slide.attribution}</p>
              )}
            </>
          ) : slide.type === "stats" && slide.stats?.length ? (
            <>
              <h2 className="font-bold mb-16 leading-[0.95]" style={{ fontSize: "100px" }}>{slide.title}</h2>
              <div className="grid grid-cols-3 gap-12">
                {slide.stats.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="border-t-4 pt-6" style={{ borderColor: palette.fg }}>
                    <div className="font-black mb-4 leading-none" style={{ fontSize: "110px" }}>{s.value}</div>
                    <div className="text-2xl uppercase tracking-widest opacity-70" style={{ fontFamily: "Inter, sans-serif" }}>{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="font-black leading-[0.9] mb-10"
                style={{ fontSize: slide.type === "cover" ? "180px" : "120px" }}>
                {slide.title}
              </motion.h1>
              {slide.subtitle && <p className="text-4xl italic font-light mb-12 max-w-3xl opacity-85 leading-snug">{slide.subtitle}</p>}
              {slide.bullets?.length ? (
                <div className="grid grid-cols-1 gap-y-8 mt-10 max-w-4xl" style={{ fontFamily: "Inter, sans-serif" }}>
                  {slide.bullets.map((b, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex gap-8 items-start">
                      <span className="text-5xl font-bold leading-none shrink-0" style={{ color: palette.accent }}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-3xl leading-snug">{b}</span>
                    </motion.div>
                  ))}
                </div>
              ) : null}
              {slide.body && <p className="text-3xl mt-10 leading-relaxed max-w-4xl opacity-90" style={{ fontFamily: "Inter, sans-serif" }}>{slide.body}</p>}
            </>
          )}
        </div>

        {showImage && (
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            className="flex-1 max-w-[40%] h-[700px] overflow-hidden">
            <img src={slide.image} alt="" className="w-full h-full object-cover grayscale-[15%]" style={{ filter: "contrast(1.05)" }} />
          </motion.div>
        )}
      </div>

      <div className="flex items-center justify-between text-2xl uppercase tracking-[0.35em] opacity-60 pt-8 border-t-2" style={{ borderColor: `${palette.fg}20`, fontFamily: "Inter, sans-serif" }}>
        <span>{index + 1} / {total}</span>
        <span>Editorial Noir</span>
      </div>
    </div>
  );
}
