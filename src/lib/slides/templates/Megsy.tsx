import { motion } from "framer-motion";
import type { Slide, SlidePalette } from "../types";

interface Props { slide: Slide; palette: SlidePalette; index: number; total: number; }

/**
 * Megsy — signature template inspired by the Megsy landing page.
 * Bold uppercase display headlines, gradient text, dark backdrop with
 * primary / purple / pink radial glows.
 */
export default function Megsy({ slide, palette, index, total }: Props) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.quote || slide.subtitle || slide.stats?.length);
  const showImage = !!slide.image && (isCover || slide.type === "section" || slide.type === "content");

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
      <div
        className="absolute"
        style={{
          top: "20%", left: "12%", width: 720, height: 720, borderRadius: "9999px",
          background: `${palette.primary}1f`, filter: "blur(180px)",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "10%", right: "15%", width: 640, height: 640, borderRadius: "9999px",
          background: "#a855f71f", filter: "blur(160px)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "55%", left: "55%", width: 520, height: 520, borderRadius: "9999px",
          background: "#ec48991a", filter: "blur(140px)",
        }}
      />

      {/* Subtle grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
        <defs>
          <pattern id="megsy-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#megsy-grid)" />
      </svg>

      {/* Image as faint accent (never the focus) */}
      {showImage && (
        <img
          src={slide.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-15"
          style={{ mixBlendMode: "screen" }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center px-24 py-20">
        {slide.kicker && (
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold uppercase tracking-[0.4em] mb-8 line-clamp-1"
            style={{
              background: `linear-gradient(90deg, ${palette.primary}, #a855f7, #ec4899)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}
          >
            {slide.kicker}
          </motion.p>
        )}

        {slide.type === "quote" ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="max-w-5xl"
          >
            <p className="text-7xl leading-[1.05] font-black italic line-clamp-6 break-words" style={{ overflowWrap: "anywhere" }}>
              "{slide.quote || slide.title}"
            </p>
            {slide.attribution && (
              <p className="mt-10 text-3xl font-light opacity-70">— {slide.attribution}</p>
            )}
          </motion.div>
        ) : slide.type === "stats" && slide.stats?.length ? (
          <>
            <motion.h2
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="font-black uppercase leading-[0.95] mb-14 line-clamp-2 break-words"
              style={{ fontSize: 96, overflowWrap: "anywhere" }}
            >
              {slide.title}
            </motion.h2>
            <div className="grid grid-cols-3 gap-8 max-w-6xl">
              {slide.stats.slice(0, 3).map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-3xl p-10 border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl"
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
          </>
        ) : (
          <>
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="font-black uppercase leading-[0.92] tracking-tight mb-8 break-words max-w-6xl"
              style={{
                fontSize: isCover ? 184 : 124,
                overflowWrap: "anywhere",
              }}
            >
              <span className="block">{slide.title?.split(" ").slice(0, 2).join(" ")}</span>
              {slide.title && slide.title.split(" ").length > 2 && (
                <span
                  className="block"
                  style={{
                    background: `linear-gradient(90deg, ${palette.primary}, #a855f7, #ec4899)`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}
                >
                  {slide.title.split(" ").slice(2).join(" ")}
                </span>
              )}
            </motion.h1>

            {slide.subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="text-3xl font-light opacity-80 mb-10 max-w-4xl leading-snug line-clamp-3"
              >
                {slide.subtitle}
              </motion.p>
            )}

            {slide.bullets?.length ? (
              <ul className="space-y-5 mt-4 max-w-5xl">
                {slide.bullets.slice(0, 6).map((b, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="flex items-start gap-6 text-3xl"
                  >
                    <span
                      className="mt-2 shrink-0 w-3 h-3 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${palette.primary}, #ec4899)`,
                        boxShadow: `0 0 20px ${palette.primary}80`,
                      }}
                    />
                    <span className="opacity-95 leading-snug line-clamp-2 break-words" style={{ overflowWrap: "anywhere" }}>{b}</span>
                  </motion.li>
                ))}
              </ul>
            ) : null}

            {slide.body && (
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="text-3xl leading-relaxed opacity-85 mt-6 max-w-5xl line-clamp-6 break-words"
                style={{ overflowWrap: "anywhere" }}
              >
                {slide.body}
              </motion.p>
            )}

            {!hasContent && !isCover && (
              <p className="text-3xl opacity-60 italic mt-6" style={{ color: palette.accent }}>
                ◆ {slide.title}
              </p>
            )}

            {slide.cta && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-12 inline-flex"
              >
                <span
                  className="px-10 py-5 rounded-full text-2xl font-bold uppercase tracking-wider"
                  style={{
                    background: `linear-gradient(90deg, ${palette.primary}, #ec4899)`,
                    color: "#fff",
                    boxShadow: `0 20px 60px ${palette.primary}60`,
                  }}
                >
                  {slide.cta}
                </span>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Footer brand + page number */}
      <div className="absolute bottom-10 left-24 right-24 z-10 flex items-center justify-between text-xl opacity-60">
        <span className="font-bold uppercase tracking-[0.4em]">Megsy</span>
        <span className="tracking-widest">{String(index + 1).padStart(2, "0")} · {String(total).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
