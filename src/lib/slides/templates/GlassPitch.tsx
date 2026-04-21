import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function GlassPitch({ slide, palette, index, total }: Props) {
  const bg = `radial-gradient(circle at 30% 20%, ${palette.primary}30, transparent 50%), radial-gradient(circle at 70% 80%, ${palette.accent}25, transparent 50%), linear-gradient(135deg, ${palette.bg}, #050816)`;
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");

  return (
    <div
      className="relative w-full h-full flex items-center justify-center px-20 py-16 overflow-hidden"
      style={{ background: bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={i}
          className="absolute rounded-full opacity-50"
          style={{
            width: Math.random() * 6 + 2, height: Math.random() * 6 + 2,
            background: i % 2 ? palette.accent : palette.primary,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 2 }} />
      ))}

      {showImage && (
        <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-6xl rounded-[48px] p-20 backdrop-blur-3xl border"
        style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}20`, boxShadow: `0 50px 120px ${palette.primary}40` }}
      >
        {slide.kicker && (
          <p className="text-2xl uppercase tracking-[0.4em] mb-10 opacity-70" style={{ color: palette.accent }}>{slide.kicker}</p>
        )}

        {slide.type === "quote" ? (
          <>
            <p className="text-7xl leading-tight font-light italic">"{slide.quote}"</p>
            {slide.attribution && <p className="mt-10 text-3xl opacity-75">— {slide.attribution}</p>}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="font-bold mb-14 leading-none" style={{ fontSize: "96px" }}>{slide.title}</h2>
            <div className="grid grid-cols-3 gap-8">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.07 }}
                  className="rounded-3xl p-10 backdrop-blur-xl border"
                  style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}25` }}>
                  <div className="font-black mb-3 leading-none" style={{
                    background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "120px"
                  }}>{s.value}</div>
                  <div className="text-2xl uppercase tracking-wider opacity-80">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-black leading-[0.95] mb-10" style={{
              background: `linear-gradient(135deg, ${palette.fg}, ${palette.accent})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontSize: slide.type === "cover" ? "180px" : "112px"
            }}>{slide.title}</h1>
            {slide.subtitle && <p className="text-4xl font-light opacity-85 mb-12 max-w-4xl leading-snug">{slide.subtitle}</p>}
            {slide.bullets?.length ? (
              <ul className="space-y-5 mt-10">
                {slide.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-start gap-6 text-3xl">
                    <span className="mt-2 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})` }}>{i + 1}</span>
                    <span className="opacity-95 leading-snug">{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-3xl opacity-85 mt-10 leading-relaxed max-w-4xl">{slide.body}</p>}
          </>
        )}
      </motion.div>

      <div className="absolute bottom-8 right-12 text-2xl opacity-60 tracking-[0.3em]">{String(index + 1).padStart(2, "0")} · {String(total).padStart(2, "0")}</div>
    </div>
  );
}
