import { PageNum, type TemplateProps } from "./_shared";

export default function GradientWave({ slide, palette, index, total }: TemplateProps) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})`, color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <svg className="absolute bottom-0 left-0 w-full h-1/3" viewBox="0 0 1920 360" preserveAspectRatio="none">
        <path d="M0,180 C480,60 960,300 1920,120 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.18)" />
        <path d="M0,240 C480,160 1440,360 1920,200 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.28)" />
        <path d="M0,280 C640,200 1280,340 1920,260 L1920,360 L0,360 Z" fill="rgba(255,255,255,0.45)" />
      </svg>
      <div className="relative z-10 p-24 h-full flex flex-col justify-center max-w-[80%] overflow-hidden">
        {slide.kicker && <p className="text-3xl uppercase tracking-[0.4em] mb-8 opacity-90 line-clamp-1">✦ {slide.kicker}</p>}
        <h1
          className="font-black mb-8 leading-[0.95] break-words"
          style={{ fontSize: isCover ? 130 : 90, overflowWrap: "anywhere" }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && <p className="text-4xl font-light opacity-90 max-w-4xl leading-snug line-clamp-3">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-4 mt-8">
            {slide.bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="text-3xl flex gap-4">
                <span className="opacity-70 shrink-0">●</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && !slide.bullets?.length && (
          <p className="text-2xl mt-6 leading-relaxed opacity-90 max-w-3xl line-clamp-6">{slide.body}</p>
        )}
        {!hasContent && !isCover && (
          <p className="text-2xl opacity-70 italic mt-4">◆ {slide.title}</p>
        )}
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
