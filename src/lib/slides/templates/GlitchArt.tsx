import { PageNum, type TemplateProps } from "./_shared";

export default function GlitchArt({ slide, _palette, index, total }: TemplateProps & { _palette?: unknown }) {
  const title = slide.title || "";
  const isCover = slide.type === "cover";
  const titleSize = isCover ? 140 : 92;
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
  return (
    <div className="relative w-full h-full overflow-hidden p-20" style={{ background: "#0c0c0c", color: "#fff", fontFamily: "'Space Mono', monospace" }}>
      <div className="absolute inset-0 opacity-[0.06]" style={{ background: "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 4px)" }} />
      <div className="relative z-10 h-full flex flex-col justify-center max-w-[85%]">
        {slide.kicker && <p className="text-2xl mb-6 uppercase tracking-[0.5em] text-[#ff003c] line-clamp-1">▓▓ {slide.kicker} ▓▓</p>}
        <div className="relative">
          <h1 className="absolute font-black leading-[0.9] break-words" style={{ fontSize: titleSize, color: "#ff003c", transform: "translate(-6px, -3px)", overflowWrap: "anywhere" }}>{title}</h1>
          <h1 className="absolute font-black leading-[0.9] break-words" style={{ fontSize: titleSize, color: "#00ffea", transform: "translate(6px, 3px)", overflowWrap: "anywhere" }}>{title}</h1>
          <h1 className="relative font-black leading-[0.9] break-words" style={{ fontSize: titleSize, overflowWrap: "anywhere" }}>{title}</h1>
        </div>
        {slide.subtitle && <p className="text-3xl mt-10 opacity-85 leading-snug line-clamp-3">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-3 mt-8">
            {slide.bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="text-2xl flex gap-3">
                <span className="text-[#00ffea] shrink-0">[{String(i).padStart(2, "0")}]</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && !slide.bullets?.length && (
          <p className="text-2xl mt-6 leading-relaxed opacity-85 line-clamp-6">{slide.body}</p>
        )}
        {!hasContent && !isCover && (
          <p className="text-2xl opacity-70 italic mt-4 text-[#00ffea]">▓ {slide.title}</p>
        )}
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
