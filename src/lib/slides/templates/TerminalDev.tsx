import { PageNum, type TemplateProps } from "./_shared";

export default function TerminalDev({ slide, _palette, index, total }: TemplateProps & { _palette?: unknown }) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
  return (
    <div className="relative w-full h-full overflow-hidden p-16" style={{ background: "#0a0e0a", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#33ff66" }}>
      <div className="absolute inset-0 opacity-[0.04]" style={{ background: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, #33ff66 2px, #33ff66 3px)" }} />
      <div className="relative z-10 max-w-[88%] overflow-hidden">
        <p className="text-xl mb-6 opacity-60">$ cat slide_{String(index + 1).padStart(2, "0")}.md</p>
        {slide.kicker && <p className="text-2xl mb-4 line-clamp-1" style={{ color: "#ffe066" }}># {slide.kicker}</p>}
        <h1
          className="font-bold mb-8 leading-[0.95] break-words"
          style={{ fontSize: isCover ? 110 : 76, color: "#33ff66", overflowWrap: "anywhere" }}
        >
          <span style={{ color: "#ffe066" }}>{">"}</span> {slide.title}
        </h1>
        {slide.subtitle && <p className="text-3xl mb-6 opacity-80 line-clamp-3" style={{ color: "#66ccff" }}>// {slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-3 mt-4">
            {slide.bullets.slice(0, 6).map((b, i) => (
              <li key={i} className="text-2xl flex gap-3">
                <span className="shrink-0" style={{ color: "#ff6b9d" }}>{String(i + 1).padStart(2, "0")}.</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-2xl mt-6 leading-relaxed opacity-85 line-clamp-6">{slide.body}</p>}
        {!hasContent && !isCover && (
          <p className="text-2xl opacity-70 italic mt-4" style={{ color: "#ffe066" }}>// {slide.title}</p>
        )}
      </div>
      <p className="absolute bottom-12 left-16 text-xl opacity-50">user@megsy:~$ <span className="animate-pulse">_</span></p>
      <PageNum index={index} total={total} color="#33ff66" />
    </div>
  );
}
