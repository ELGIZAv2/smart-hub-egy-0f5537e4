import { PageNum, type TemplateProps } from "./_shared";

export default function PaperOrigami({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#ece9e2", color: "#1a1a1a", fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute top-0 left-0 w-2/3 h-2/3" style={{
        background: palette.primary, clipPath: "polygon(0 0, 100% 0, 70% 100%, 0 80%)",
        boxShadow: "20px 20px 60px rgba(0,0,0,0.15)"
      }} />
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2" style={{
        background: palette.accent, clipPath: "polygon(40% 0, 100% 30%, 100% 100%, 0 100%)",
        boxShadow: "-20px -20px 60px rgba(0,0,0,0.15)", opacity: 0.85
      }} />
      <div className="relative z-10 p-24 h-full flex flex-col justify-center">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.4em] mb-8 text-white">{slide.kicker}</p>}
        <h1 className="font-black mb-12 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 180 : 130, color: "#fff", textShadow: "4px 4px 0 rgba(0,0,0,0.2)" }}>
          {slide.title}
        </h1>
        <div className="bg-white/95 backdrop-blur rounded-3xl p-10 max-w-4xl shadow-2xl">
          {slide.subtitle && <p className="text-4xl mb-6 leading-snug">{slide.subtitle}</p>}
          {slide.bullets?.length ? (
            <ul className="space-y-5">
              {slide.bullets.map((b, i) => (
                <li key={i} className="text-3xl flex gap-4">
                  <span className="font-black" style={{ color: palette.primary }}>0{i + 1}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {slide.body && <p className="text-3xl leading-relaxed">{slide.body}</p>}
        </div>
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
