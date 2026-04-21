import { PageNum, type TemplateProps } from "./_shared";

export default function DarkLuxe({ slide, palette, index, total }: TemplateProps) {
  const gold = "#d4af37";
  return (
    <div className="relative w-full h-full overflow-hidden p-32" style={{ background: "radial-gradient(ellipse at center, #1a1410 0%, #050302 100%)", color: "#fff", fontFamily: "'Bodoni 72', 'Didot', Georgia, serif" }}>
      <div className="absolute top-32 left-32 right-32 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
      <div className="absolute bottom-32 left-32 right-32 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
      <div className="h-full flex flex-col justify-center">
        {slide.kicker && (
          <p className="text-3xl uppercase tracking-[0.6em] mb-12 text-center" style={{ color: gold, fontFamily: "Inter, sans-serif" }}>
            ❦ {slide.kicker} ❦
          </p>
        )}
        <h1 className="font-bold mb-14 leading-[0.95] text-center italic" style={{ fontSize: slide.type === "cover" ? 200 : 140, color: gold }}>
          {slide.title}
        </h1>
        {slide.subtitle && <p className="text-5xl font-light opacity-80 text-center max-w-5xl mx-auto leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-6 mt-12 max-w-4xl mx-auto">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-4xl flex gap-5 justify-center"><span style={{ color: gold }}>※</span> {b}</li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-85 text-center max-w-5xl mx-auto mt-8">{slide.body}</p>}
      </div>
      <PageNum index={index} total={total} color={gold} />
    </div>
  );
}
