"use client";

import { useEffect, useRef } from "react";

/**
 * Die-cut stickers from the Wavelink film, scattered in the hero's side gutters (wide screens only, so they never
 * cover the headline). Micro-interactions: they slap in on load, float at rest, lift and tilt on hover, squash on
 * press and "boop" on click, and drift with the pointer for a little depth. Reduced motion: still stickers, no drift.
 */
const STICKERS = [
  { src: "voice", w: 168, side: "left", x: "1%", y: 104, r: -10, d: 0.7, delay: 0.25, float: 6.2 },
  { src: "chai", w: 118, side: "left", x: "7%", y: 330, r: 8, d: 1.2, delay: 0.4, float: 5.4 },
  { src: "coin", w: 84, side: "left", x: "15%", y: 500, r: -14, d: 1.5, delay: 0.55, float: 4.8 },
  { src: "clock", w: 120, side: "right", x: "3%", y: 88, r: 12, d: 0.9, delay: 0.32, float: 5.8 },
  { src: "check", w: 128, side: "right", x: "1%", y: 318, r: -8, d: 1.1, delay: 0.47, float: 6.6 },
  { src: "plane", w: 112, side: "right", x: "13%", y: 486, r: -6, d: 1.4, delay: 0.62, float: 5.1 },
] as const;

export function HeroStickers() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    const hero = box?.closest("section");
    if (!box || !hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        box.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        box.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
    };
    const leave = () => {
      box.style.setProperty("--mx", "0");
      box.style.setProperty("--my", "0");
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, []);

  const boop = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    el.classList.remove("boop");
    void el.offsetWidth; // restart the animation on repeated clicks
    el.classList.add("boop");
  };

  return (
    <div ref={ref} className="hero-stickers" aria-hidden="true">
      {STICKERS.map((s) => (
        <span
          key={s.src}
          className="hs"
          style={{
            [s.side]: s.x,
            top: s.y,
            width: s.w,
            "--r": `${s.r}deg`,
            "--d": s.d,
            "--delay": `${s.delay}s`,
            "--fd": `${s.float}s`,
          } as React.CSSProperties}
        >
          <span className="hs-in">
            <span className="hs-hit" onClick={boop} onAnimationEnd={(e) => e.currentTarget.classList.remove("boop")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative WebP, no layout shift (absolute) */}
              <img src={`/stickers/${s.src}.webp`} alt="" width={s.w} draggable={false} />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
