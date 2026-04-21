import { PageNum, type TemplateProps } from "./_shared";

export default function MagazineFold({ slide, palette, index, total }: TemplateProps) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
  return (
    <div className="relative w-full h-full overflow-hidden flex" style={{ background: "#f5f1e8", color: "#1a1a1a", fontFamily: "'Lora', Georgia, serif" }}>
      {slide.image && (
        <div className="w-1/2 h-full">
          <img src={slide.image} className="w-full h-full object-cover" alt="" style={{ filter: "saturate(0.85) contrast(1.05)" }} />
        </div>
      )}
      <div className={`${slide.image ? "w-1/2" : "w-full"} h-full p-20 flex flex-col justify-center overflow-hidden`}>
        {slide.kicker && (
          <p className="text-2xl uppercase tracking-[0.5em] mb-6 line-clamp-1" style={{ color: palette.accent, fontFamily: "Inter, sans-serif" }}>
            — {slide.kicker} —
          </p>
        )}
        <h1
          className="font-bold mb-8 leading-[0.95] break-words"
          style={{ fontSize: isCover ? 110 : 78, fontFamily: "'Playfair Display', Georgia, serif", overflowWrap: "anywhere" }}
        >
          {slide.title}
        </h1>
        <div className="w-32 h-1 mb-6" style={{ background: palette.accent }} />
        {slide.subtitle && <p className="text-3xl italic opacity-75 mb-6 leading-snug line-clamp-3">{slide.subtitle}</p>}
        {slide.body && <p className="text-2xl leading-relaxed opacity-90 line-clamp-8">{slide.body}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-3 mt-6">
            {slide.bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="text-2xl flex gap-4">
                <span className="font-bold shrink-0" style={{ color: palette.accent }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!hasContent && !isCover && (
          <p className="text-2xl opacity-60 italic mt-4" style={{ color: palette.accent }}>◆ {slide.title}</p>
        )}
      </div>
      <PageNum index={index} total={total} color="#1a1a1a" />
    </div>
  );
}
