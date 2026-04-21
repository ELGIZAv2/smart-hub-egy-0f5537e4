import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

const COLORS = ["#ff6b9d", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b", "#a374db"];
const SHAPES = ["★", "●", "▲", "♥", "✿", "◆"];

export default function KidsPlayful({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "linear-gradient(135deg, #fff8e1, #ffe0ec)", color: "#2d1b4e", fontFamily: "'Comic Neue', 'Comic Sans MS', cursive" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span key={i}
          animate={{ y: [0, -20, 0], rotate: [0, 360] }}
          transition={{ duration: 6 + i, repeat: Infinity, delay: i * 0.3 }}
          className="absolute text-6xl"
          style={{ color: COLORS[i % COLORS.length], top: `${(i * 13) % 90}%`, left: `${(i * 17) % 90}%`, opacity: 0.4 }}>
          {SHAPES[i % SHAPES.length]}
        </motion.span>
      ))}
      <div className="relative z-10 h-full flex flex-col justify-center">
        {slide.kicker && (
          <p className="text-4xl mb-8 inline-block px-6 py-3 rounded-full font-bold" style={{ background: COLORS[index % COLORS.length], color: "#fff", maxWidth: "fit-content" }}>
            {slide.kicker}
          </p>
        )}
        <h1 className="font-black mb-10 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 200 : 150, color: COLORS[index % COLORS.length] }}>
          {slide.title}
        </h1>
        {slide.subtitle && <p className="text-5xl mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-6 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-4xl flex gap-5 items-center">
                <span className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: COLORS[i % COLORS.length], color: "#fff" }}>{SHAPES[i % SHAPES.length]}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#2d1b4e" />
    </div>
  );
}
