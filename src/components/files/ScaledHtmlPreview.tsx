import { useEffect, useRef, useState } from "react";

/**
 * Renders generated HTML inside an iframe sized at a fixed desktop
 * resolution (1280×800) and scales it down to fit the container.
 * This makes desktop-designed documents readable on mobile without
 * breaking layout or fonts.
 */
const BASE_W = 1280;
const BASE_H = 800;

interface Props {
  html: string;
}

const ScaledHtmlPreview = ({ html }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setSize({ w, h });
      setScale(Math.min(w / BASE_W, h / BASE_H, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Inject viewport + safety CSS so generated HTML doesn't overflow weirdly
  const wrappedHtml = html?.includes("<head>")
    ? html.replace(
        "<head>",
        `<head><meta name="viewport" content="width=${BASE_W}, initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff;overflow-x:hidden;} *{box-sizing:border-box;}</style>`,
      )
    : `<!doctype html><html><head><meta name="viewport" content="width=${BASE_W}"><style>html,body{margin:0;background:#fff;}</style></head><body>${html || ""}</body></html>`;

  return (
    <div ref={wrapRef} className="relative flex-1 w-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
      {size.w > 0 && (
        <div
          className="absolute left-1/2 top-1/2 origin-center shadow-2xl bg-white"
          style={{
            width: BASE_W,
            height: BASE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <iframe
            srcDoc={wrappedHtml}
            title="Document preview"
            className="w-full h-full bg-white border-0"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )}
    </div>
  );
};

export default ScaledHtmlPreview;
