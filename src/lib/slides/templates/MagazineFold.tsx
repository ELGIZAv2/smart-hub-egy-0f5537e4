import { PageNum, type TemplateProps } from "./_shared";

export default function MagazineFold({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden flex" style={{ background: "#f5f1e8", color: "#1a1a1a", fontFamily: "'Lora', Georgia, serif" }}>
      {slide.image && (
        <div className="w-1/2 h-full">
          <img src={slide.image} className="w-full h-full object-cover" alt="" style={{ filter: "saturate(0.85) contrast(1.05)" }} />
        </div>
      )}
      <div className={`${slide.image ? "w-1/2" : "w-full"} h-full p-24 flex flex-col justify-center`}>
        {slide.kicker && (
          <p className="text-2xl uppercase tracking-[0.5em] mb-8" style={{ color: palette.accent, fontFamily: "Inter, sans-serif" }}>
            — {slide.kicker} —
          </p>
        )}
        <h1 className="font-bold mb-12 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 170 : 120, fontFamily: "'Playfair Display', Georgia, serif" }}>
          {slide.title}
        </h1>
        <div className="w-32 h-1 mb-10" style={{ background: palette.accent }} />
        {slide.subtitle && <p className="text-4xl italic opacity-75 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.body && <p className="text-3xl leading-relaxed opacity-90" style={{ columnCount: slide.bullets?.length ? 1 : 2, columnGap: 40 }}>{slide.body}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-5">
                <span className="font-bold" style={{ color: palette.accent }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#1a1a1a" />
    </div>
  );
}
