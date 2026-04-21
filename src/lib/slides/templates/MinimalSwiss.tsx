import { PageNum, type TemplateProps } from "./_shared";

export default function MinimalSwiss({ slide, palette, index, total }: TemplateProps) {
  const isCover = slide.type === "cover";
  const hasContent = !!(slide.bullets?.length || slide.body || slide.subtitle);
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "#fff", color: "#000", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="absolute top-0 left-24 right-24 h-px bg-black" />
      <div className="absolute bottom-24 left-24 right-24 h-px bg-black" />
      <div className="grid grid-cols-12 gap-8 h-full">
        <div className="col-span-2 flex flex-col justify-between pt-6">
          <p className="text-2xl font-bold tracking-widest">{String(index + 1).padStart(2, "0")}</p>
          <p className="text-xs tracking-[0.4em] uppercase rotate-[-90deg] origin-left line-clamp-1">— {slide.kicker || "Section"}</p>
        </div>
        <div className="col-span-10 flex flex-col justify-center overflow-hidden">
          <h1
            className="font-bold mb-8 leading-[0.92] tracking-[-0.02em] break-words"
            style={{ fontSize: isCover ? 130 : 90, overflowWrap: "anywhere" }}
          >
            {slide.title}
          </h1>
          {slide.subtitle && <p className="text-3xl font-light mb-6 max-w-5xl leading-tight line-clamp-3">{slide.subtitle}</p>}
          {slide.bullets?.length ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-4 max-w-5xl">
              {slide.bullets.slice(0, 6).map((b, i) => (
                <div key={i} className="border-t border-black pt-3">
                  <span className="text-xs uppercase tracking-widest opacity-50">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-2xl mt-1 line-clamp-3">{b}</p>
                </div>
              ))}
            </div>
          ) : null}
          {slide.body && <p className="text-2xl leading-relaxed max-w-4xl line-clamp-6 mt-4">{slide.body}</p>}
          {!hasContent && !isCover && (
            <p className="text-2xl opacity-60 italic mt-4">◆ {slide.title}</p>
          )}
        </div>
      </div>
      <PageNum index={index} total={total} color="#000" opacity={0.4} />
    </div>
  );
}
