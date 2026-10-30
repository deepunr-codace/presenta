"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  { n: "03", title: "Ideas in Motion.", tone: "linear-gradient(170deg, #0d2a5c 0%, #0a1733 55%, #2f5cff 130%)" },
  { n: "02", title: "Brand Strategy", tone: "linear-gradient(170deg, #0f4a3f 0%, #0a2a25 60%, #1fbf9a 140%)" },
  { n: "01", title: "Ideas That Inspire Change", tone: "linear-gradient(170deg, #1d1a18 0%, #0e0d0c 55%, #ff9a2e 150%)" },
  { n: "04", title: "Creative Possibilities", tone: "linear-gradient(170deg, #3a1d6e 0%, #1a0f36 60%, #b15cff 140%)" },
  { n: "05", title: "From Vision to Impact.", tone: "linear-gradient(170deg, #5a1830 0%, #220a14 60%, #ff4d6d 140%)" },
];

const INTERVAL_MS = 4500;

/** Coverflow of cards standing on the floor of the backdrop. It advances on its own, pauses on hover or focus, and can be steered. */
export function FloorCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = SLIDES.length;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % total), INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [paused, total]);

  const shift = (step: number) => setIndex((i) => (i + step + total) % total);

  return (
    <div className="ps-floor" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="ps-floor-track">
        {SLIDES.map((s, i) => {
          let d = i - index;
          if (d > total / 2) d -= total;
          if (d < -total / 2) d += total;
          const dist = Math.abs(d);
          return (
            <article
              key={s.n}
              className="ps-floor-card"
              aria-hidden={d !== 0}
              style={{
                background: s.tone,
                transform: `translate(-50%, -50%) translateX(${d * 10}cqw) scale(${dist === 0 ? 1 : dist === 1 ? 0.86 : 0.74})`,
                opacity: dist > 2 ? 0 : 1,
                filter: `brightness(${dist === 0 ? 1 : dist === 1 ? 0.72 : 0.45})`,
                zIndex: 10 - dist,
              }}
            >
              <span className="ps-floor-num">{s.n}</span>
              <span className="ps-floor-title">{s.title}</span>
              <span className="ps-floor-arrow" aria-hidden>→</span>
            </article>
          );
        })}
      </div>
      <div className="ps-floor-controls">
        <button type="button" className="ps-floor-nav" aria-label="Previous slide" onClick={() => shift(-1)}>‹</button>
        <div className="ps-floor-dots">
          {SLIDES.map((s, i) => (
            <button key={s.n} type="button" aria-label={`Show slide ${s.n}`} aria-current={i === index ? "true" : undefined} data-active={i === index ? "true" : undefined} onClick={() => setIndex(i)} />
          ))}
        </div>
        <button type="button" className="ps-floor-nav" aria-label="Next slide" onClick={() => shift(1)}>›</button>
      </div>
    </div>
  );
}
