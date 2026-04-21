import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function Cinema3D({ slide, palette, index, total }: TemplateProps) {
  const bg = `radial-gradient(circle at 30% 20%, ${palette.primary}, transparent 60%), radial-gradient(circle at 70% 80%, ${palette.accent}, transparent 55%), #04060e`;
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center" style={{ background: bg, fontFamily: "Inter, sans-serif", color: "#fff" }}>
      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute -right-60 -top-60 w-[1200px] h-[1200px] rounded-full opacity-20 blur-3xl"
        style={{ background: `conic-gradient(${palette.primary}, ${palette.accent}, ${palette.primary})` }} />
      <div className="relative z-10 px-32 max-w-[80%]">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.5em] mb-10 opacity-70" style={{ color: palette.accent }}>{slide.kicker}</p>}
        <motion.h1 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="font-black mb-12 leading-[0.9]"
          style={{ fontSize: slide.type === "cover" ? 220 : 150, textShadow: `0 20px 60px ${palette.primary}80` }}>
          {slide.title}
        </motion.h1>
        {slide.subtitle && <p className="text-5xl font-light opacity-80 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-6 mt-12">
            {slide.bullets.map((b, i) => (
              <motion.li key={i} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                className="text-4xl flex items-center gap-6">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black" style={{ background: palette.accent, color: "#04060e" }}>{i + 1}</span>
                {b}
              </motion.li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
