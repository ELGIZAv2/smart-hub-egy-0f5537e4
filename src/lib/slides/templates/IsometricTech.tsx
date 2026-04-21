import { PageNum, type TemplateProps } from "./_shared";

export default function IsometricTech({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-24 flex" style={{ background: `linear-gradient(135deg, #1a1d3a, #2d1d4f)`, color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div className="flex-1 flex flex-col justify-center max-w-[60%]">
        {slide.kicker && <p className="text-3xl mb-8 uppercase tracking-[0.4em]" style={{ color: palette.accent }}>◢ {slide.kicker}</p>}
        <h1 className="font-black mb-10 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 180 : 130 }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-4xl font-light opacity-85 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-6">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-5">
                <span className="text-2xl px-3 py-1 rounded" style={{ background: palette.accent, color: "#0a0a1f" }}>{String(i + 1).padStart(2, "0")}</span>
                {b}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="w-[40%] flex items-center justify-center">
        <svg viewBox="0 0 400 400" className="w-full h-auto">
          <g transform="translate(200,200)" style={{ transform: "translate(200px,200px)" }}>
            {[0, 1, 2, 3].map(i => (
              <g key={i} transform={`translate(0,${-i * 40})`}>
                <polygon points="-100,-50 0,-100 100,-50 0,0" fill={palette.primary} opacity={0.4 + i * 0.2} stroke={palette.accent} strokeWidth="2" />
                <polygon points="-100,-50 0,0 0,80 -100,30" fill={palette.accent} opacity={0.5 + i * 0.15} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <polygon points="100,-50 0,0 0,80 100,30" fill={palette.primary} opacity={0.6 + i * 0.1} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              </g>
            ))}
          </g>
        </svg>
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
