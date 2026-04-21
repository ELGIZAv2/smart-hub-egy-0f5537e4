import { PageNum, type TemplateProps } from "./_shared";

export default function RetroArcade({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "linear-gradient(180deg, #1a0033 0%, #ff006e 50%, #ffbe0b 100%)", color: "#fff", fontFamily: "'Press Start 2P', 'VT323', monospace" }}>
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)" }} />
      <div className="relative z-10 h-full flex flex-col justify-center">
        {slide.kicker && <p className="text-2xl mb-10 tracking-widest" style={{ color: "#ffbe0b", textShadow: "3px 3px 0 #1a0033" }}>★ {slide.kicker.toUpperCase()} ★</p>}
        <h1 className="font-black mb-12 leading-[1.1] uppercase" style={{ fontSize: slide.type === "cover" ? 130 : 90, textShadow: "6px 6px 0 #1a0033, 12px 12px 0 #ff006e", letterSpacing: "0.05em" }}>
          {slide.title}
        </h1>
        {slide.subtitle && <p className="text-3xl mb-10 leading-relaxed" style={{ textShadow: "3px 3px 0 #1a0033" }}>{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-2xl flex gap-4 leading-relaxed">
                <span style={{ color: "#ffbe0b" }}>►</span>
                <span>{String(i + 1).padStart(2, "0")} {b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#ffbe0b" />
    </div>
  );
}
