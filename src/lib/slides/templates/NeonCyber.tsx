import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function NeonCyber({ slide, palette, index, total }: TemplateProps) {
  const neon = "#ff00ff";
  const cyan = "#00ffff";
  return (
    <div className="relative w-full h-full overflow-hidden p-24 flex flex-col justify-center" style={{ background: "#0a001f", fontFamily: "'Orbitron', 'Rajdhani', sans-serif", color: "#fff" }}>
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `linear-gradient(${neon}33 1px, transparent 1px), linear-gradient(90deg, ${neon}33 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        transform: "perspective(800px) rotateX(60deg) translateY(40%) scale(2)",
      }} />
      <div className="relative z-10">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.5em] mb-10" style={{ color: cyan, textShadow: `0 0 20px ${cyan}` }}>◆ {slide.kicker} ◆</p>}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="font-black mb-12 leading-[0.9] uppercase"
          style={{
            fontSize: slide.type === "cover" ? 200 : 140,
            color: "#fff",
            textShadow: `0 0 30px ${neon}, 0 0 60px ${neon}, 0 0 90px ${cyan}`,
            letterSpacing: "-0.02em"
          }}>{slide.title}</motion.h1>
        {slide.subtitle && <p className="text-5xl font-light mb-10" style={{ color: cyan, textShadow: `0 0 15px ${cyan}` }}>{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-6 mt-10">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-4xl flex gap-5 items-center">
                <span style={{ color: neon, textShadow: `0 0 10px ${neon}` }}>▶</span>
                <span style={{ textShadow: "0 0 8px rgba(255,255,255,0.6)" }}>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color={cyan} />
    </div>
  );
}
