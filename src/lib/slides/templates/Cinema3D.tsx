import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function Cinema3D({ slide, palette, index, total }: TemplateProps) {
  const bg = `radial-gradient(circle at 30% 20%, ${palette.primary}, transparent 60%), radial-gradient(circle at 70% 80%, ${palette.accent}, transparent 55%), #04060e`;
  const hasContent = !!(slide.bullets?.length || slide.body || slide.quote || slide.subtitle);
  const isCover = slide.type === "cover";
  const titleSize = isCover ? 150 : 92;

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center"
      style={{ background: bg, fontFamily: "Inter, sans-serif", color: "#fff" }}
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute -right-60 -top-60 w-[1200px] h-[1200px] rounded-full opacity-20 blur-3xl"
        style={{ background: `conic-gradient(${palette.primary}, ${palette.accent}, ${palette.primary})` }}
      />

      <div className="relative z-10 px-28 max-w-[78%] flex flex-col justify-center">
        {slide.kicker && (
          <p className="text-3xl uppercase tracking-[0.5em] mb-8 opacity-70 line-clamp-1" style={{ color: palette.accent }}>
            {slide.kicker}
          </p>
        )}

        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="font-black mb-8 leading-[0.95] break-words"
          style={{ fontSize: titleSize, textShadow: `0 20px 60px ${palette.primary}80`, overflowWrap: "anywhere" }}
        >
          {slide.title}
        </motion.h1>

        {slide.subtitle && (
          <p className="text-4xl font-light opacity-80 leading-snug line-clamp-3 max-w-3xl">{slide.subtitle}</p>
        )}

        {slide.bullets?.length ? (
          <ul className="space-y-4 mt-8">
            {slide.bullets.slice(0, 5).map((b, i) => (
              <motion.li
                key={i}
                initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                className="text-3xl flex items-center gap-5"
              >
                <span
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-xl font-black"
                  style={{ background: palette.accent, color: "#04060e" }}
                >
                  {i + 1}
                </span>
                <span className="line-clamp-2">{b}</span>
              </motion.li>
            ))}
          </ul>
        ) : null}

        {slide.body && !slide.bullets?.length && (
          <p className="text-3xl mt-6 leading-relaxed opacity-85 line-clamp-6 max-w-3xl">{slide.body}</p>
        )}

        {slide.quote && (
          <blockquote className="text-4xl italic mt-6 max-w-3xl line-clamp-5">
            "{slide.quote}"
            {slide.attribution && <span className="block text-2xl mt-3 opacity-70">— {slide.attribution}</span>}
          </blockquote>
        )}

        {/* Empty-slide fallback */}
        {!hasContent && !isCover && (
          <p className="text-3xl opacity-60 italic mt-4" style={{ color: palette.accent }}>
            ✦ {slide.title}
          </p>
        )}
      </div>

      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
