import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

export default function GlassPitch({ slide, palette, index, total }: Props) {
  const bg = `radial-gradient(circle at 30% 20%, ${palette.primary}30, transparent 50%), radial-gradient(circle at 70% 80%, ${palette.accent}25, transparent 50%), linear-gradient(135deg, ${palette.bg}, #050816)`;
  const showImage = !!slide.image && (slide.type === "cover" || slide.type === "section" || slide.type === "content");
  const hasContent = !!(slide.bullets?.length || slide.body || slide.quote || slide.subtitle || slide.stats?.length);
  const isCover = slide.type === "cover";

  return (
    <div
      className="relative w-full h-full flex items-center justify-center px-16 py-12 overflow-hidden"
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
        className="relative z-10 w-full max-w-5xl rounded-[40px] p-14 backdrop-blur-3xl border overflow-hidden"
        style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}20`, boxShadow: `0 50px 120px ${palette.primary}40` }}
      >
        {slide.kicker && (
          <p className="text-2xl uppercase tracking-[0.4em] mb-6 opacity-70 line-clamp-1" style={{ color: palette.accent }}>{slide.kicker}</p>
        )}

        {slide.type === "quote" ? (
          <>
            <p className="text-5xl leading-tight font-light italic line-clamp-6">"{slide.quote || slide.title}"</p>
            {slide.attribution && <p className="mt-6 text-2xl opacity-75">— {slide.attribution}</p>}
          </>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <h2 className="font-bold mb-10 leading-tight line-clamp-2 break-words" style={{ fontSize: "72px", overflowWrap: "anywhere" }}>{slide.title}</h2>
            <div className="grid grid-cols-3 gap-6">
              {slide.stats.slice(0, 3).map((s, i) => (
                <motion.div key={i} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.07 }}
                  className="rounded-2xl p-8 backdrop-blur-xl border"
                  style={{ background: `${palette.fg}08`, borderColor: `${palette.fg}25` }}>
                  <div className="font-black mb-2 leading-none break-words" style={{
                    background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "84px"
                  }}>{s.value}</div>
                  <div className="text-xl uppercase tracking-wider opacity-80 line-clamp-2">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-black leading-[0.95] mb-6 break-words" style={{
              background: `linear-gradient(135deg, ${palette.fg}, ${palette.accent})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontSize: isCover ? "120px" : "76px",
              overflowWrap: "anywhere",
            }}>{slide.title}</h1>
            {slide.subtitle && <p className="text-3xl font-light opacity-85 mb-6 max-w-4xl leading-snug line-clamp-3">{slide.subtitle}</p>}
            {slide.bullets?.length ? (
              <ul className="space-y-4 mt-6">
                {slide.bullets.slice(0, 6).map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-start gap-5 text-2xl">
                    <span className="mt-1 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})` }}>{i + 1}</span>
                    <span className="opacity-95 leading-snug line-clamp-2">{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}
            {slide.body && <p className="text-2xl opacity-85 mt-6 leading-relaxed max-w-4xl line-clamp-6">{slide.body}</p>}
            {!hasContent && !isCover && (
              <p className="text-2xl opacity-60 italic mt-4" style={{ color: palette.accent }}>◆ {slide.title}</p>
            )}
          </>
        )}
      </motion.div>

      <div className="absolute bottom-8 right-12 text-2xl opacity-60 tracking-[0.3em]">{String(index + 1).padStart(2, "0")} · {String(total).padStart(2, "0")}</div>
    </div>
  );
}
