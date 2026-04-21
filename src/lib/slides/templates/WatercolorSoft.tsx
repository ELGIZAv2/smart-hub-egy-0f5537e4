import { PageNum, type TemplateProps } from "./_shared";

export default function WatercolorSoft({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-32" style={{ background: "#fdfaf3", color: "#3a2e2e", fontFamily: "'Quicksand', 'Nunito', sans-serif" }}>
      <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-3xl opacity-50" style={{ background: `radial-gradient(circle, ${palette.primary}, transparent 70%)` }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-50" style={{ background: `radial-gradient(circle, ${palette.accent}, transparent 70%)` }} />
      <div className="relative z-10 h-full flex flex-col justify-center max-w-5xl">
        {slide.kicker && <p className="text-4xl italic mb-8" style={{ fontFamily: "'Dancing Script', cursive", color: palette.accent }}>~ {slide.kicker} ~</p>}
        <h1 className="font-bold mb-12 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 200 : 140, fontFamily: "'Dancing Script', 'Pacifico', cursive" }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-4xl font-light italic opacity-85 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-5"><span style={{ color: palette.accent }}>❀</span> {b}</li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-90 max-w-4xl">{slide.body}</p>}
      </div>
      <PageNum index={index} total={total} color="#3a2e2e" />
    </div>
  );
}
