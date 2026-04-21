import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

const spring = { type: "spring" as const, damping: 22, stiffness: 220 };

export default function AuroraKeynote({ slide, palette, index, total }: Props) {
  const bg = `radial-gradient(ellipse at 20% 10%, ${palette.primary}55, transparent 50%), radial-gradient(ellipse at 80% 90%, ${palette.accent}44, transparent 50%), ${palette.bg}`;

  return (
    <div
      className="relative w-full h-full flex flex-col justify-center px-20 py-16 overflow-hidden"
      style={{ background: bg, color: palette.fg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <motion.div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
        style={{ background: palette.primary }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl"
        style={{ background: palette.accent }}
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="relative z-10 max-w-5xl">
        {slide.kicker && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 0.6, y: 0 }} transition={spring}
            className="text-xs uppercase tracking-[0.4em] mb-6" style={{ color: palette.accent }}>
            {slide.kicker}
          </motion.div>
        )}
        {slide.type === "quote" ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} transition={spring} className="text-9xl font-serif leading-none mb-4">"</motion.div>
            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }}
              className="text-5xl font-light leading-tight mb-8 italic">{slide.quote}</motion.p>
            {slide.attribution && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ ...spring, delay: 0.2 }}
                className="text-lg" style={{ color: palette.accent }}>— {slide.attribution}</motion.p>
            )}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className="text-5xl font-bold mb-12">{slide.title}</motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {slide.stats.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.1 + i * 0.05 }}
                  className="backdrop-blur-xl rounded-3xl p-6 border" style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}15` }}>
                  <div className="text-5xl font-bold mb-2" style={{ color: palette.accent }}>{s.value}</div>
                  <div className="text-sm opacity-70">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className={`font-bold mb-6 leading-[1.05] ${slide.type === "cover" ? "text-7xl" : "text-5xl"}`}>
              {slide.title}
            </motion.h1>
            {slide.subtitle && (
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 0.75, y: 0 }} transition={{ ...spring, delay: 0.1 }}
                className="text-2xl font-light mb-8 max-w-3xl">{slide.subtitle}</motion.p>
            )}
            {slide.bullets?.length ? (
              <ul className="space-y-4 mt-6">
                {slide.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ ...spring, delay: 0.15 + i * 0.05 }}
                    className="text-2xl flex items-start gap-4 leading-snug">
                    <span className="mt-3 w-2 h-2 rounded-full shrink-0" style={{ background: palette.accent }} />
                    <span>{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-xl opacity-80 mt-6 leading-relaxed max-w-3xl">{slide.body}</p>}
            {slide.cta && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: 0.3 }}
                className="mt-12 inline-flex px-8 py-4 rounded-full text-lg font-medium"
                style={{ background: palette.accent, color: palette.bg }}>
                {slide.cta}
              </motion.div>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-6 right-8 text-xs opacity-40 tracking-wider">{index + 1} / {total}</div>
    </div>
  );
}
