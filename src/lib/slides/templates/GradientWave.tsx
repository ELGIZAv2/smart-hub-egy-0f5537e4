import { PageNum, type TemplateProps } from "./_shared";

export default function GradientWave({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`, color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <svg className="absolute bottom-0 left-0 w-full h-1/3" viewBox="0 0 1920 360" preserveAspectRatio="none">
        <path d="M0,180 C480,60 960,300 1920,120 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.18)" />
        <path d="M0,240 C480,160 1440,360 1920,200 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.28)" />
        <path d="M0,280 C640,200 1280,340 1920,260 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.45)" />
      </svg>
      <div className="relative z-10 p-32 h-full flex flex-col justify-center max-w-[80%]">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.4em] mb-10 opacity-90">✦ {slide.kicker}</p>}
        <h1 className="font-black mb-12 leading-[0.92]" style={{ fontSize: slide.type === "cover" ? 200 : 140 }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-5xl font-light opacity-90 max-w-4xl leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-10">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-4xl flex gap-5"><span className="opacity-70">●</span> {b}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
