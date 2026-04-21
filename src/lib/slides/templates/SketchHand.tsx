import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function SketchHand({ slide, palette, index, total }: TemplateProps) {
  const ink = "#1f2937";
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "#fdf6e3", fontFamily: "Caveat, 'Patrick Hand', cursive", color: ink }}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke={ink} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {slide.kicker && <p className="text-4xl mb-8 -rotate-1" style={{ color: palette.accent }}>★ {slide.kicker}</p>}
      <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="font-black mb-12 leading-[0.95] -rotate-1"
        style={{ fontSize: slide.type === "cover" ? 200 : 140, fontFamily: "Caveat, cursive" }}>
        {slide.title}
      </motion.h1>
      {slide.subtitle && <p className="text-6xl mb-10 opacity-80 rotate-[0.5deg]">{slide.subtitle}</p>}
      {slide.bullets?.length ? (
        <ul className="space-y-6 mt-8">
          {slide.bullets.map((b, i) => (
            <li key={i} className="text-5xl flex gap-6 items-start" style={{ transform: `rotate(${(i % 2 ? -0.4 : 0.4)}deg)` }}>
              <span style={{ color: palette.accent }}>→</span><span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {slide.body && <p className="text-4xl mt-8 leading-snug max-w-5xl opacity-90">{slide.body}</p>}
      {slide.image && (
        <div className="absolute bottom-32 right-24 w-[480px] h-[320px] rotate-2 shadow-2xl" style={{ border: `4px solid ${ink}` }}>
          <img src={slide.image} className="w-full h-full object-cover" alt="" />
        </div>
      )}
      <PageNum index={index} total={total} color={ink} />
    </div>
  );
}
