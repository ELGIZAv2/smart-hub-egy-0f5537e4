import { PageNum, type TemplateProps } from "./_shared";

export default function TerminalDev({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-20" style={{ background: "#0a0e0a", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#33ff66" }}>
      <div className="absolute inset-0 opacity-[0.04]" style={{ background: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, #33ff66 2px, #33ff66 3px)" }} />
      <div className="relative z-10">
        <p className="text-2xl mb-8 opacity-60">$ cat slide_{String(index + 1).padStart(2, "0")}.md</p>
        {slide.kicker && <p className="text-3xl mb-6" style={{ color: "#ffe066" }}># {slide.kicker}</p>}
        <h1 className="font-bold mb-10 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 180 : 130, color: "#33ff66" }}>
          <span style={{ color: "#ffe066" }}>{">"}</span> {slide.title}
        </h1>
        {slide.subtitle && <p className="text-4xl mb-10 opacity-80" style={{ color: "#66ccff" }}>// {slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-4">
                <span style={{ color: "#ff6b9d" }}>{String(i + 1).padStart(2, "0")}.</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl mt-10 leading-relaxed opacity-85">{slide.body}</p>}
      </div>
      <p className="absolute bottom-12 left-20 text-xl opacity-50">user@megsy:~$ <span className="animate-pulse">_</span></p>
      <PageNum index={index} total={total} color="#33ff66" />
    </div>
  );
}
