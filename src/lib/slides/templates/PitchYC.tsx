import { PageNum, type TemplateProps } from "./_shared";

export default function PitchYC({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-24" style={{ background: "#fff", color: "#1a1a1a", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-2xl" style={{ background: "#ff5722" }}>Y</div>
          <span className="text-2xl font-semibold opacity-80">megsy.ai</span>
        </div>
        <span className="text-xl opacity-60">{slide.kicker || `Slide ${index + 1}`}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center max-w-6xl">
        <h1 className="font-bold mb-10 leading-[0.95] tracking-tight" style={{ fontSize: slide.type === "cover" ? 180 : 130 }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-4xl font-light opacity-85 mb-12 leading-snug max-w-5xl">{slide.subtitle}</p>}
        {slide.stats?.length ? (
          <div className="grid grid-cols-3 gap-8 mt-8">
            {slide.stats.map((s, i) => (
              <div key={i} className="border-l-4 pl-6" style={{ borderColor: "#ff5722" }}>
                <div className="font-black mb-2" style={{ fontSize: 130, color: "#ff5722", lineHeight: 0.9 }}>{s.value}</div>
                <div className="text-2xl opacity-80">{s.label}</div>
              </div>
            ))}
          </div>
        ) : slide.bullets?.length ? (
          <ul className="space-y-6 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-4xl flex gap-5">
                <span className="font-black" style={{ color: "#ff5722" }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-90 max-w-5xl">{slide.body}</p>}
      </div>
      <PageNum index={index} total={total} color="#1a1a1a" opacity={0.4} />
    </div>
  );
}
