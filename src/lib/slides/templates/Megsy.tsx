import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

/**
 * Megsy — signature landing-page-inspired template.
 * Distinct identity: dot grid + floating particles + glass bullet cards
 * with circular number badges, gradient marquee headline, deep black bg.
 */
export default function Megsy({ slide, palette, index, total }: Props) {
  const isCover = slide.type === "cover";
  const isSection = slide.type === "section";
  const titleLen = (slide.title || "").length;

  // Dynamic title size
  const titleFs = isCover
    ? titleLen > 40 ? 140 : titleLen > 24 ? 168 : 200
    : titleLen > 40 ? 84 : 108;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: "#08070d",
        color: "#f8fafc",
        fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
      }}
    >
      {/* Landing-style ambient glows */}
      <div className="absolute" style={{ top: "15%", left: "8%", width: 760, height: 760, borderRadius: "9999px", background: `${palette.primary}26`, filter: "blur(180px)" }} />
      <div className="absolute" style={{ bottom: "8%", right: "10%", width: 680, height: 680, borderRadius: "9999px", background: "#a855f726", filter: "blur(170px)" }} />
      <div className="absolute" style={{ top: "50%", left: "55%", width: 560, height: 560, borderRadius: "9999px", background: "#ec489922", filter: "blur(150px)" }} />

      {/* Dot pattern (matches HeroSection) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]">
        <defs>
          <pattern id="megsy-dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#megsy-dots)" />
      </svg>

      {/* Floating particles */}
      {[...Array(14)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: `${(i * 37) % 100}%`,
            left: `${(i * 53) % 100}%`,
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: i % 3 === 0 ? palette.primary : i % 3 === 1 ? "#a855f7" : "#ec4899",
            boxShadow: `0 0 20px ${i % 3 === 0 ? palette.primary : "#a855f7"}`,
            opacity: 0.4,
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 4 + (i % 4), repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* COVER LAYOUT */}
      {isCover && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center px-24">
          {/* Top marquee strip */}
          <div className="absolute top-0 left-0 right-0 h-16 overflow-hidden border-b border-white/10 bg-white/[0.02] backdrop-blur-xl">
            <motion.div
              className="flex items-center gap-12 h-full whitespace-nowrap text-sm uppercase tracking-[0.5em] opacity-60"
              animate={{ x: [0, -1200] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex items-center gap-12">
                  <span>● Megsy Studio</span>
                  <span>● {slide.kicker || "Premium Deck"}</span>
                  <span>● Built with AI</span>
                </span>
              ))}
            </motion.div>
          </div>

          {slide.kicker && (
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold uppercase tracking-[0.5em] mb-8 line-clamp-1"
              style={{
                background: `linear-gradient(90deg, ${palette.primary}, #a855f7, #ec4899)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              {slide.kicker}
            </motion.p>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            className="font-black uppercase leading-[0.9] tracking-tight mb-10 break-words max-w-6xl"
            style={{ fontSize: titleFs, overflowWrap: "anywhere" }}
          >
            <span
              className="block"
              style={{
                backgroundImage: `linear-gradient(90deg, #ffffff 0%, ${palette.primary} 35%, #a855f7 65%, #ec4899 100%)`,
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "megsy-shift 6s ease-in-out infinite",
              }}
            >
              {slide.title}
            </span>
          </motion.h1>

          {slide.subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-3xl font-light opacity-80 max-w-4xl leading-snug line-clamp-3 break-words"
              style={{ overflowWrap: "anywhere" }}
            >
              {slide.subtitle}
            </motion.p>
          )}

          {/* Glass CTA pill */}
          {slide.cta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="mt-14 inline-flex w-fit items-center gap-3 px-10 py-5 rounded-full backdrop-blur-2xl border border-white/20"
              style={{
                background: `linear-gradient(90deg, ${palette.primary}30, #ec489930)`,
                boxShadow: `0 20px 80px ${palette.primary}40`,
              }}
            >
              <span className="text-xl font-bold uppercase tracking-widest">{slide.cta}</span>
              <span className="text-2xl">→</span>
            </motion.div>
          )}
        </div>
      )}

      {/* SECTION LAYOUT — huge number + title */}
      {isSection && (
        <div className="relative z-10 w-full h-full flex items-center px-24">
          <div
            className="font-black leading-none mr-12 select-none"
            style={{
              fontSize: 380,
              background: `linear-gradient(135deg, ${palette.primary}, #a855f7, #ec4899)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              opacity: 0.95,
            }}
          >
            {String(index).padStart(2, "0")}
          </div>
          <div className="flex-1 max-w-3xl">
            {slide.kicker && (
              <p className="text-xl uppercase tracking-[0.5em] opacity-60 mb-6">{slide.kicker}</p>
            )}
            <h2
              className="font-black uppercase leading-[0.95] break-words line-clamp-3"
              style={{ fontSize: titleFs, overflowWrap: "anywhere" }}
            >
              {slide.title}
            </h2>
          </div>
        </div>
      )}

      {/* QUOTE LAYOUT */}
      {slide.type === "quote" && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center px-32">
          <div
            className="font-black leading-none mb-8 select-none opacity-30"
            style={{
              fontSize: 260,
              background: `linear-gradient(135deg, ${palette.primary}, #ec4899)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}
          >
            "
          </div>
          <p
            className="font-black italic leading-[1.05] line-clamp-6 break-words max-w-6xl"
            style={{ fontSize: 80, overflowWrap: "anywhere" }}
          >
            {slide.quote || slide.title}
          </p>
          {slide.attribution && (
            <p className="mt-12 text-3xl font-light opacity-70">— {slide.attribution}</p>
          )}
        </div>
      )}

      {/* STATS LAYOUT */}
      {slide.type === "stats" && slide.stats?.length && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center px-24">
          <h2
            className="font-black uppercase leading-[0.95] mb-14 line-clamp-2 break-words max-w-6xl"
            style={{ fontSize: 92, overflowWrap: "anywhere" }}
          >
            {slide.title}
          </h2>
          <div className="grid grid-cols-3 gap-8">
            {slide.stats.slice(0, 3).map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="rounded-3xl p-10 border border-white/10 backdrop-blur-3xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div
                  className="font-black leading-none mb-4 break-words"
                  style={{
                    fontSize: 110,
                    background: `linear-gradient(135deg, ${palette.primary}, #a855f7, #ec4899)`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}
                >
                  {s.value}
                </div>
                <div className="text-2xl uppercase tracking-[0.2em] opacity-70 line-clamp-2">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT LAYOUT — floating glass bullet cards with number badges */}
      {!isCover && !isSection && slide.type !== "quote" && slide.type !== "stats" && (
        <div className="relative z-10 w-full h-full flex flex-col justify-center px-24 py-20">
          {slide.kicker && (
            <p
              className="text-xl font-bold uppercase tracking-[0.5em] mb-6 line-clamp-1"
              style={{
                background: `linear-gradient(90deg, ${palette.primary}, #ec4899)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              {slide.kicker}
            </p>
          )}

          <motion.h2
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="font-black uppercase leading-[0.95] tracking-tight mb-10 break-words max-w-5xl line-clamp-2"
            style={{ fontSize: titleFs, overflowWrap: "anywhere" }}
          >
            {slide.title}
          </motion.h2>

          {slide.subtitle && (
            <p className="text-2xl font-light opacity-80 mb-8 max-w-4xl line-clamp-2 break-words" style={{ overflowWrap: "anywhere" }}>
              {slide.subtitle}
            </p>
          )}

          {slide.bullets?.length ? (
            <div className="grid grid-cols-2 gap-5 max-w-6xl mt-2">
              {slide.bullets.slice(0, 6).map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
                  className="flex items-start gap-5 p-5 rounded-2xl backdrop-blur-3xl border border-white/[0.08]"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <div
                    className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${palette.primary}, #a855f7)`,
                      boxShadow: `0 8px 24px ${palette.primary}60`,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <span className="text-xl leading-snug opacity-95 line-clamp-2 break-words" style={{ overflowWrap: "anywhere" }}>
                    {b}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : slide.body ? (
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-3xl leading-relaxed opacity-90 max-w-5xl line-clamp-6 break-words"
              style={{ overflowWrap: "anywhere" }}
            >
              {slide.body}
            </motion.p>
          ) : null}
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-10 left-24 right-24 z-10 flex items-center justify-between">
        <span
          className="text-3xl font-black uppercase tracking-[0.3em]"
          style={{
            background: `linear-gradient(90deg, ${palette.primary}, #ec4899)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}
        >
          MEGSY
        </span>
        <span className="font-mono text-lg opacity-50 tracking-widest">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      <style>{`
        @keyframes megsy-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
