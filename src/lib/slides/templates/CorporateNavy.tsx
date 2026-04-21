import { PageNum, type TemplateProps } from "./_shared";

export default function CorporateNavy({ slide, palette, index, total }: TemplateProps) {
  const navy = "#0a2540";
  return (
    <div className="relative w-full h-full overflow-hidden flex" style={{ background: "#fff", fontFamily: "Inter, sans-serif", color: navy }}>
      <div className="w-3 h-full" style={{ background: navy }} />
      <div className="flex-1 p-24 flex flex-col justify-center">
        {slide.kicker && (
          <p className="text-2xl uppercase tracking-[0.3em] font-semibold mb-8" style={{ color: palette.accent }}>{slide.kicker}</p>
        )}
        <h1 className="font-bold mb-10 leading-[0.95] tracking-tight" style={{ fontSize: slide.type === "cover" ? 180 : 130 }}>{slide.title}</h1>
        <div className="w-32 h-1.5 mb-10" style={{ background: palette.accent }} />
        {slide.subtitle && <p className="text-4xl font-light opacity-80 mb-10 leading-snug max-w-5xl">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 mt-8 max-w-5xl">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex gap-5">
                <span className="text-3xl font-black" style={{ color: palette.accent }}>0{i + 1}</span>
                <p className="text-3xl leading-snug">{b}</p>
              </div>
            ))}
          </div>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-85 max-w-5xl">{slide.body}</p>}
      </div>
      {slide.image && (
        <div className="w-1/3 h-full">
          <img src={slide.image} className="w-full h-full object-cover" alt="" />
        </div>
      )}
      <PageNum index={index} total={total} color={navy} opacity={0.4} />
    </div>
  );
}
