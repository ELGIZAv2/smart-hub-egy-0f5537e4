import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function SketchHand({ slide, palette, index, total }: TemplateProps) {
  const ink = "#1f2937";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.quote || slide.subtitle);
  const isCover = slide.type === "cover";
  const isSection = slide.type === "section";
  const titleSize = isCover ? 130 : isSection ? 140 : 92;

  return (
    <div className="relative w-full h-full overflow-hidden p-20 flex flex-col" style={{ background: "#fdf6e3", fontFamily: "Caveat, 'Patrick Hand', cursive", color: ink }}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke={ink} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-[78%]">
        {slide.kicker && (
          <p className="text-3xl mb-6 -rotate-1" style={{ color: palette.accent }}>★ {slide.kicker}</p>
        )}
        <motion.h1
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="font-black mb-8 leading-[0.95] -rotate-1 break-words"
          style={{ fontSize: titleSize, fontFamily: "Caveat, cursive", overflowWrap: "anywhere" }}
        >
          {slide.title}
        </motion.h1>

        {slide.subtitle && (
          <p className="text-4xl mb-6 opacity-80 rotate-[0.5deg] line-clamp-3">{slide.subtitle}</p>
        )}

        {slide.bullets?.length ? (
          <ul className="space-y-4 mt-2">
            {slide.bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="text-3xl flex gap-5 items-start" style={{ transform: `rotate(${(i % 2 ? -0.4 : 0.4)}deg)` }}>
                <span style={{ color: palette.accent }}>→</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {slide.body && (
          <p className="text-2xl mt-6 leading-snug max-w-4xl opacity-90 line-clamp-6">{slide.body}</p>
        )}

        {slide.quote && (
          <blockquote className="text-4xl italic mt-6 max-w-4xl line-clamp-5">
            "{slide.quote}"
            {slide.attribution && <span className="block text-2xl mt-3 opacity-70">— {slide.attribution}</span>}
          </blockquote>
        )}

        {/* Empty-slide fallback: never leave the canvas blank */}
        {!hasContent && !isCover && (
          <p className="text-3xl opacity-60 italic mt-4 -rotate-1" style={{ color: palette.accent }}>
            ✎ {slide.title}
          </p>
        )}
      </div>

      {slide.image && !slide.bullets?.length && (
        <div className="absolute bottom-24 right-20 w-[360px] h-[240px] rotate-2 shadow-2xl" style={{ border: `4px solid ${ink}` }}>
          <img src={slide.image} className="w-full h-full object-cover" alt="" />
        </div>
      )}

      <PageNum index={index} total={total} color={ink} />
    </div>
  );
}
