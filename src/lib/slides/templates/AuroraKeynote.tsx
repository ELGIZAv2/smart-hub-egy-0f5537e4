import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

const spring = { type: "spring" as const, damping: 22, stiffness: 220 };

export default function AuroraKeynote({ slide, palette, index, total }: Props) {
  const bg = `radial-gradient(ellipse at 20% 10%, ${palette.primary}55, transparent 50%), radial-gradient(ellipse at 80% 90%, ${palette.accent}44, transparent 50%), ${palette.bg}`;
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");

  // Half-bleed image layout for cover.
  if (slide.type === "cover" && slide.image) {
    return (
      <div className="relative w-full h-full flex overflow-hidden" style={{ background: bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="w-1/2 h-full relative">
          <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${palette.bg}cc 100%)` }} />
        </div>
        <div className="w-1/2 h-full flex flex-col justify-center px-24 py-20 relative z-10">
          {slide.kicker && (
            <p className="text-2xl uppercase tracking-[0.4em] mb-10 opacity-70" style={{ color: palette.accent }}>{slide.kicker}</p>
          )}
          <h1 className="text-9xl font-black mb-12 leading-[0.95]" style={{ fontSize: "180px", lineHeight: 0.95 }}>{slide.title}</h1>
          {slide.subtitle && <p className="text-5xl font-light opacity-85 max-w-2xl leading-tight">{slide.subtitle}</p>}
          {slide.author && <p className="mt-16 text-3xl opacity-70">{slide.author}</p>}
        </div>
        <div className="absolute bottom-8 right-12 text-2xl opacity-50 tracking-widest">{index + 1} / {total}</div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full flex flex-col justify-center px-24 py-20 overflow-hidden"
      style={{ background: bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <motion.div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
        style={{ background: palette.primary }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
        style={{ background: palette.accent }} animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 10, repeat: Infinity }} />

      <div className="relative z-10 flex gap-16 items-center w-full">
        <div className={showImage ? "flex-1 max-w-[55%]" : "max-w-6xl"}>
          {slide.kicker && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 0.7, y: 0 }} transition={spring}
              className="text-2xl uppercase tracking-[0.4em] mb-10" style={{ color: palette.accent }}>{slide.kicker}</motion.div>
          )}

          {slide.type === "quote" ? (
            <>
              <div className="text-[280px] font-serif leading-none mb-2 opacity-30">"</div>
              <p className="text-7xl font-light leading-tight mb-12 italic">{slide.quote}</p>
              {slide.attribution && <p className="text-3xl opacity-70" style={{ color: palette.accent }}>— {slide.attribution}</p>}
            </>
          ) : slide.type === "stats" && slide.stats?.length ? (
            <>
              <h2 className="text-8xl font-bold mb-16 leading-none">{slide.title}</h2>
              <div className="grid grid-cols-3 gap-10">
                {slide.stats.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.1 + i * 0.05 }}
                    className="backdrop-blur-xl rounded-3xl p-10 border" style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}15` }}>
                    <div className="font-black mb-4" style={{ color: palette.accent, fontSize: "120px", lineHeight: 0.9 }}>{s.value}</div>
                    <div className="text-2xl opacity-80">{s.label}</div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                className="font-black mb-10 leading-[0.95]"
                style={{ fontSize: slide.type === "cover" ? "160px" : "112px", lineHeight: 0.95 }}>
                {slide.title}
              </motion.h1>
              {slide.subtitle && <p className="text-4xl font-light opacity-80 mb-10 max-w-4xl leading-snug">{slide.subtitle}</p>}
              {slide.bullets?.length ? (
                <ul className="space-y-6 mt-8">
                  {slide.bullets.map((b, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ ...spring, delay: 0.15 + i * 0.05 }}
                      className="text-4xl flex items-start gap-6 leading-snug">
                      <span className="mt-5 w-4 h-4 rounded-full shrink-0" style={{ background: palette.accent }} />
                      <span>{b}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : null}
              {slide.body && <p className="text-3xl opacity-85 mt-8 leading-relaxed max-w-4xl">{slide.body}</p>}
              {slide.cta && (
                <div className="mt-16 inline-flex px-12 py-6 rounded-full text-3xl font-bold"
                  style={{ background: palette.accent, color: palette.bg }}>{slide.cta}</div>
              )}
            </>
          )}
        </div>

        {showImage && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.1 }}
            className="flex-1 max-w-[40%] aspect-[4/5] rounded-[40px] overflow-hidden border"
            style={{ borderColor: `${palette.fg}20`, boxShadow: `0 40px 100px ${palette.primary}40` }}>
            <img src={slide.image} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-8 right-12 text-2xl opacity-50 tracking-widest">{index + 1} / {total}</div>
    </div>
  );
}
