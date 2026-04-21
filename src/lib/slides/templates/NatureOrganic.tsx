import { PageNum, type TemplateProps } from "./_shared";

export default function NatureOrganic({ slide, palette, index, total }: TemplateProps) {
  return (
    <div className="relative w-full h-full overflow-hidden p-24" style={{ background: "linear-gradient(135deg, #f4f1e8, #e8efe2)", color: "#2d3e2d", fontFamily: "'Source Serif Pro', Georgia, serif" }}>
      <svg className="absolute top-0 right-0 w-[600px] h-[600px] opacity-20" viewBox="0 0 200 200">
        <path d="M100,20 Q140,50 130,100 Q100,150 60,140 Q20,110 40,60 Q70,30 100,20 Z" fill="#5a8a3a" />
        <path d="M50,80 Q80,60 100,90 M100,90 Q120,110 140,100 M70,120 Q90,100 110,130" stroke="#3a5a2a" strokeWidth="1.5" fill="none" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-[500px] h-[500px] opacity-15" viewBox="0 0 200 200">
        <path d="M100,30 Q150,80 120,150 Q70,170 30,120 Q40,60 100,30 Z" fill="#8aa67a" />
      </svg>
      <div className="relative z-10 h-full flex flex-col justify-center max-w-5xl">
        {slide.kicker && <p className="text-3xl italic mb-8 opacity-75">~ {slide.kicker} ~</p>}
        <h1 className="font-bold mb-12 leading-[0.95]" style={{ fontSize: slide.type === "cover" ? 180 : 130 }}>{slide.title}</h1>
        {slide.subtitle && <p className="text-4xl italic font-light opacity-85 mb-10 leading-snug">{slide.subtitle}</p>}
        {slide.bullets?.length ? (
          <ul className="space-y-5 mt-8">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-3xl flex gap-5"><span className="text-4xl">🌿</span> {b}</li>
            ))}
          </ul>
        ) : null}
        {slide.body && <p className="text-3xl leading-relaxed opacity-90 max-w-4xl">{slide.body}</p>}
      </div>
      <PageNum index={index} total={total} color="#2d3e2d" />
    </div>
  );
}
