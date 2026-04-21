import { PageNum, type TemplateProps } from "./_shared";

export default function ScientificPaper({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-32" style={{ background: "#fdfdf8", color: "#1a1a1a", fontFamily: "'Computer Modern Serif', 'Latin Modern Roman', Georgia, serif" }}>
      <div className="absolute top-12 left-32 right-32 flex justify-between text-sm opacity-60 border-b border-black/20 pb-2">
        <span className="italic">Megsy · Research Series</span>
        <span>Vol. {index + 1} / {total}</span>
      </div>
      <div className="h-full flex flex-col justify-center max-w-5xl">
        {slide.kicker && <p className="text-2xl uppercase tracking-[0.3em] mb-6 opacity-70">§ {slide.kicker}</p>}
        <h1 className="font-bold mb-12 leading-[1.05]" style={{ fontSize: slide.type === "cover" ? 130 : 90 }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="text-3xl italic mb-10 opacity-80 leading-snug border-l-4 border-black/30 pl-6">{slide.subtitle}</p>
        )}
        {slide.body && (
          <p className="text-3xl leading-relaxed opacity-95 max-w-5xl" style={{ textIndent: "3em" }}>{slide.body}</p>
        )}
        {slide.bullets?.length ? (
          <ol className="space-y-4 mt-8 list-decimal list-inside">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl leading-snug">{b}</li>
            ))}
          </ol>
        ) : null}
      </div>
      <PageNum index={index} total={total} color="#1a1a1a" opacity={0.5} />
    </div>
  );
}
