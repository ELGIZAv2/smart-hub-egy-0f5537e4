import { motion } from "framer-motion";
import { PageNum, type TemplateProps } from "./_shared";

export default function iOSGlass({ slide, palette, index, total }: TemplateProps) {
  const bg = `linear-gradient(135deg, ${palette.primary}40, ${palette.accent}40), linear-gradient(45deg, #1a1a2e, #16213e)`;
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center p-20" style={{ background: bg, fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif", color: "#fff" }}>
      <div className="absolute top-20 left-20 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: palette.primary }} />
      <div className="absolute bottom-20 right-20 w-[500px] h-[500px] rounded-full blur-3xl opacity-40" style={{ background: palette.accent }} />
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-[1500px] backdrop-blur-3xl rounded-[60px] p-24 border"
        style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 60px 120px rgba(0,0,0,0.5)" }}>
        {slide.kicker && <p className="text-2xl mb-8 tracking-widest opacity-80" style={{ color: palette.accent }}>{slide.kicker}</p>}
        <h1 className="font-bold mb-10 leading-[0.95] tracking-tight" style={{ fontSize: slide.type === "cover" ? 180 : 130 }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-4xl font-light opacity-85 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <div className="grid grid-cols-2 gap-6 mt-10">
            {slide.bullets.slice(0, 4).map((b, i) => (
              <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
                className="backdrop-blur-2xl rounded-3xl p-8 border text-3xl"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}>{b}</motion.div>
            ))}
          </div>
        ) : null}
        {slide.body && <p className="text-3xl opacity-85 leading-relaxed mt-8">{slide.body}</p>}
      </motion.div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
