import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function GlassPitch({ slide, palette, index, total }: Props) {
  const bg = `radial-gradient(circle at 30% 20%, ${palette.primary}30, transparent 50%), radial-gradient(circle at 70% 80%, ${palette.accent}25, transparent 50%), linear-gradient(135deg, ${palette.bg}, #050816)`;

  return (
    <div
      className="relative w-full h-full flex items-center justify-center px-16 py-12 overflow-hidden"
      style={{ background: bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={i}
          className="absolute rounded-full opacity-40"
          style={{
            width: Math.random() * 4 + 1, height: Math.random() * 4 + 1,
            background: i % 2 ? palette.accent : palette.primary,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-5xl rounded-3xl p-12 backdrop-blur-2xl border"
        style={{ background: `${palette.fg}06`, borderColor: `${palette.fg}15`, boxShadow: `0 30px 80px ${palette.primary}30` }}
      >
        {slide.kicker && (
          <p className="text-xs uppercase tracking-[0.4em] mb-6 opacity-60" style={{ color: palette.accent }}>{slide.kicker}</p>
        )}

        {slide.type === "quote" ? (
          <>
            <p className="text-4xl leading-tight font-light italic">"{slide.quote}"</p>
            {slide.attribution && <p className="mt-6 text-lg opacity-70">— {slide.attribution}</p>}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="text-4xl font-bold mb-10">{slide.title}</h2>
            <div className="grid grid-cols-3 gap-6">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.07 }}
                  className="rounded-2xl p-6 backdrop-blur-xl border"
                  style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}20` }}>
                  <div className="text-5xl font-black mb-1" style={{
                    background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
                  }}>{s.value}</div>
                  <div className="text-xs uppercase tracking-wider opacity-70">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className={`font-bold leading-[1.05] mb-6 ${slide.type === "cover" ? "text-7xl" : "text-5xl"}`} style={{
              background: `linear-gradient(135deg, ${palette.fg}, ${palette.accent})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>{slide.title}</h1>
            {slide.subtitle && <p className="text-2xl font-light opacity-80 mb-8 max-w-3xl">{slide.subtitle}</p>}
            {slide.bullets?.length ? (
              <ul className="space-y-3 mt-6">
                {slide.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-start gap-4 text-xl">
                    <span className="mt-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})` }}>{i + 1}</span>
                    <span className="opacity-90">{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-lg opacity-80 mt-6 leading-relaxed max-w-3xl">{slide.body}</p>}
          </>
        )}
      </motion.div>

      <div className="absolute bottom-6 right-8 text-xs opacity-50 tracking-[0.3em]">{String(index + 1).padStart(2, "0")} · {String(total).padStart(2, "0")}</div>
    </div>
  );
}
