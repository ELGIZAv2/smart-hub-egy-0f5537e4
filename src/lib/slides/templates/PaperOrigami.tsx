import { PageNum, type TemplateProps } from "./_shared";

export default function PaperOrigami({ slide, palette, index, total }: TemplateProps) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
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
      <div className="relative z-10 p-20 h-full flex flex-col justify-center overflow-hidden">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.4em] mb-6 text-white line-clamp-1">{slide.kicker}</p>}
        <h1
          className="font-black mb-8 leading-[0.95] break-words"
          style={{ fontSize: isCover ? 120 : 84, color: "#fff", textShadow: "4px 4px 0 rgba(0,0,0,0.2)", overflowWrap: "anywhere" }}
        >
          {slide.title}
        </h1>
        <div className="bg-white/95 backdrop-blur rounded-3xl p-8 max-w-4xl shadow-2xl overflow-hidden">
          {slide.subtitle && <p className="text-3xl mb-4 leading-snug line-clamp-3">{slide.subtitle}</p>}
          {slide.bullets?.length ? (
            <ul className="space-y-3">
              {slide.bullets.slice(0, 6).map((b, i) => (
                <li key={i} className="text-2xl flex gap-4">
                  <span className="font-black shrink-0" style={{ color: palette.primary }}>0{i + 1}</span>
                  <span className="line-clamp-2">{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {slide.body && <p className="text-2xl leading-relaxed line-clamp-6">{slide.body}</p>}
          {!hasContent && !isCover && (
            <p className="text-2xl opacity-70 italic" style={{ color: palette.primary }}>◆ {slide.title}</p>
          )}
        </div>
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
