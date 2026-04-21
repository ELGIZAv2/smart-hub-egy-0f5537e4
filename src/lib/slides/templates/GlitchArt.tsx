import { PageNum, type TemplateProps } from "./_shared";

export default function GlitchArt({ slide, palette, index, total }: TemplateProps) {
  const title = slide.title || "";
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "#0c0c0c", color: "#fff", fontFamily: "'Space Mono', monospace" }}>
      <div className="absolute inset-0 opacity-[0.06]" style={{ background: "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 4px)" }} />
      <div className="relative z-10 h-full flex flex-col justify-center">
        {slide.kicker && <p className="text-3xl mb-8 uppercase tracking-[0.5em] text-[#ff003c]">▓▓ {slide.kicker} ▓▓</p>}
        <div className="relative">
          <h1 className="absolute font-black leading-[0.9]" style={{ fontSize: slide.type === "cover" ? 200 : 150, color: "#ff003c", transform: "translate(-6px, -3px)" }}>{title}</h1>
          <h1 className="absolute font-black leading-[0.9]" style={{ fontSize: slide.type === "cover" ? 200 : 150, color: "#00ffea", transform: "translate(6px, 3px)" }}>{title}</h1>
          <h1 className="relative font-black leading-[0.9]" style={{ fontSize: slide.type === "cover" ? 200 : 150 }}>{title}</h1>
        </div>
        {slide.subtitle && <p className="text-4xl mt-12 opacity-85 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-10">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-4"><span className="text-[#00ffea]">[{String(i).padStart(2, "0")}]</span> {b}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#fff" />
    </div>
  );
}
