import { PageNum, type TemplateProps } from "./_shared";

export default function ArabesqueGold({ slide, palette, index, total }: TemplateProps) {
  const gold = "#c9a55c";
  const navy = "#0e1a3a";
  return (
    <div className="relative w-full h-full overflow-hidden p-24" dir="rtl" style={{ background: `linear-gradient(135deg, ${navy}, #1a2851)`, color: "#fff", fontFamily: "'Amiri', 'Cairo', 'Tajawal', serif" }}>
      <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
        <defs>
          <pattern id="arab" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M60,0 L120,60 L60,120 L0,60 Z M60,30 L90,60 L60,90 L30,60 Z" fill="none" stroke={gold} strokeWidth="1.5" />
            <circle cx="60" cy="60" r="12" fill="none" stroke={gold} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#arab)" />
      </svg>
      <div className="relative z-10 h-full flex flex-col justify-center text-right max-w-6xl mr-auto">
        {slide.kicker && (
          <p className="text-3xl mb-8 tracking-wider" style={{ color: gold }}>۞ {slide.kicker} ۞</p>
        )}
        <h1 className="font-bold mb-12 leading-[1.15]" style={{ fontSize: slide.type === "cover" ? 180 : 130, color: gold, textShadow: `0 0 30px ${gold}40` }}>
          {slide.title}
        </h1>
        <div className="w-40 h-1 mb-10 ms-auto" style={{ background: `linear-gradient(90deg, transparent, ${gold})` }} />
        {slide.subtitle && <p className="text-4xl font-light opacity-90 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-5 justify-end leading-relaxed">
                <span>{b}</span>
                <span style={{ color: gold }}>◈</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-90 max-w-5xl">{slide.body}</p>}
      </div>
      <PageNum index={index} total={total} color={gold} />
    </div>
  );
}
