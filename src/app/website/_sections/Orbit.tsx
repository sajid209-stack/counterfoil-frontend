"use client";

import { useRef } from "react";
import { Heading } from "../_components/ui";
import { Starfield, clamp01, smooth, useCanvas } from "./space";

const RINGS = [0.13, 0.25, 0.38, 0.52, 0.68, 0.84];
const TICKS = 60;

/** The target: rings expand and turn as the section scrolls in, and the ticks sweep like a clock. */
function OrbitTarget({ progress }: { progress: () => number }) {
  const ref = useCanvas(({ ctx, w, h, t }) => {
    const p = progress();
    const e = smooth((p - 0.05) / 0.4);
    const size = Math.min(w, h);
    const R = size * 0.5 - 6;
    const cx = w / 2;
    const cy = h / 2;

    // Crosshair hairlines.
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,240,220,${0.1 * e})`;
    ctx.beginPath();
    ctx.moveTo(cx - R * e, cy);
    ctx.lineTo(cx + R * e, cy);
    ctx.moveTo(cx, cy - R * e);
    ctx.lineTo(cx, cy + R * e);
    ctx.stroke();

    // Rings, each turning at its own speed. Dashed arcs carry the rotation.
    RINGS.forEach((f, i) => {
      const r = R * f * e;
      if (r < 1) return;
      const rot = p * (i % 2 ? 1 : -1) * (1.2 + i * 0.5) + t * 0.03 * (i % 2 ? 1 : -1);
      ctx.strokeStyle = `rgba(255,236,214,${0.1 + (i % 3) * 0.04})`;
      ctx.setLineDash(i % 2 ? [] : [r * 0.09, r * 0.05]);
      ctx.lineDashOffset = -rot * r;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.283);
      ctx.stroke();
      ctx.setLineDash([]);
      // A small moon per ring.
      const a = rot * 2 + i * 1.7;
      ctx.fillStyle = i === 2 ? "rgba(249,74,0,0.9)" : "rgba(255,236,214,0.55)";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i === 2 ? 2.6 : 1.8, 0, 6.283);
      ctx.fill();
    });

    // The ring of 60 clock ticks; the hand sweeps and lights the ticks it just passed.
    const hand = (p * 3 + t * 0.08) * 6.283;
    const tr = R * (0.94 + 0.06 * (1 - e) * 0);
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * 6.283 - 1.5708;
      const long = i % 5 === 0;
      let d = (((hand - 1.5708 - a) % 6.283) + 6.283) % 6.283;
      d = d / 6.283; // 0 = under the hand, 1 = just ahead of it
      const lit = d < 0.25 ? 1 - d / 0.25 : 0;
      const len = (long ? 11 : 6) * e;
      const alpha = (0.18 + (long ? 0.15 : 0)) * e + lit * 0.7 * e;
      ctx.strokeStyle = lit > 0.05 ? `rgba(249,${Math.round(74 + (1 - lit) * 120)},${Math.round((1 - lit) * 110)},${alpha})` : `rgba(255,240,220,${alpha})`;
      ctx.lineWidth = long ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (tr - len), cy + Math.sin(a) * (tr - len));
      ctx.lineTo(cx + Math.cos(a) * tr, cy + Math.sin(a) * tr);
      ctx.stroke();
    }

    // Glow at the centre where the spark lands.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3);
    g.addColorStop(0, `rgba(249,74,0,${0.22 * e})`);
    g.addColorStop(1, "rgba(249,74,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

export function Orbit() {
  const sec = useRef<HTMLElement>(null);
  // Scroll progress through the section: 0 as it enters, 1 as it leaves.
  const progress = () => {
    const el = sec.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return clamp01((vh - r.top) / (r.height + vh));
  };
  return (
    <section id="orbit" ref={sec} className="cf-sec relative scroll-mt-16 overflow-hidden bg-black px-5 py-24 md:px-12 md:py-36">
      <div className="absolute inset-0">
        <Starfield density={0.5} />
      </div>
      <div className="relative mx-auto grid max-w-[1120px] items-center gap-14 md:grid-cols-[1fr_1.15fr] md:gap-8">
        <Heading
          label="One clock"
          title="Every seat, slot and lane."
          dim="On one clock."
          lead="Sold at the counter, online or at the gate — Counterfoil keeps a single, live count of what's left."
        />
        <div className="relative mx-auto aspect-square w-full max-w-[560px]">
          <OrbitTarget progress={progress} />
          <span data-spark aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    </section>
  );
}
