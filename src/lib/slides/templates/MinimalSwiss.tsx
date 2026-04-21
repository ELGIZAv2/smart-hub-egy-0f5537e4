import { PageNum, type TemplateProps } from "./_shared";

export default function MinimalSwiss({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-32" style={{ background: "#fff", color: "#000", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="absolute top-0 left-32 right-32 h-px bg-black" />
      <div className="absolute bottom-32 left-32 right-32 h-px bg-black" />
      <div className="grid grid-cols-12 gap-8 h-full">
        <div className="col-span-2 flex flex-col justify-between pt-6">
          <p className="text-2xl font-bold tracking-widest">{String(index + 1).padStart(2, "0")}</p>
          <p className="text-xs tracking-[0.4em] uppercase rotate-[-90deg] origin-left">— {slide.kicker || "Section"}</p>
        </div>
        <div className="col-span-10 flex flex-col justify-center">
          <h1 className="font-bold mb-12 leading-[0.92] tracking-[-0.02em]" style={{ fontSize: slide.type === "cover" ? 200 : 150 }}>
            {slide.title}
          </h1>
          {slide.subtitle && <p className="text-5xl font-light mb-10 max-w-5xl leading-tight">{slide.subtitle}</p>}
          {slide.bullets?.length ? (
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 mt-8 max-w-5xl">
              {slide.bullets.map((b, i) => (
                <div key={i} className="border-t border-black pt-4">
                  <span className="text-xs uppercase tracking-widest opacity-50">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-3xl mt-2">{b}</p>
                </div>
              ))}
            </div>
          ) : null}
          {slide.body && <p className="text-3xl leading-relaxed max-w-4xl">{slide.body}</p>}
        </div>
      </div>
      <PageNum index={index} total={total} color="#000" opacity={0.4} />
    </div>
  );
}
