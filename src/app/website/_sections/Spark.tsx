"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "../_components/motion";
import { EMBER, clamp01, lerp, smooth, useCanvas } from "./space";

type Pt = { x: number; y: number };

/** The guide light: one ember point that travels down the page between `[data-spark]` anchors. */
function SparkLayer() {
  const anchors = useRef<Pt[]>([]);
  const pos = useRef<Pt | null>(null);
  const trail = useRef<Pt[]>([]);

  useEffect(() => {
    const refresh = () => {
      const sy = window.scrollY;
      const sx = window.scrollX;
      anchors.current = Array.from(document.querySelectorAll<HTMLElement>("[data-spark]"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2 + sx, y: r.top + r.height / 2 + sy };
        })
        .sort((a, b) => a.y - b.y);
    };
    refresh();
    const id = window.setInterval(refresh, 700);
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("load", refresh);
    };
  }, []);

  const ref = useCanvas(({ ctx, w, h, t, dt }) => {
    const small = w < 768;
    const scale = small ? 0.72 : 1;
    const sy = window.scrollY;
    const c = sy + h / 2;
    const list = anchors.current;

    // Where the spark wants to be: on the viewport's centre line, weaving
    // sideways between the two anchors that bracket it.
    let tx = w * 0.82;
    let ty = h / 2;
    let alpha = 1;
    if (list.length) {
      const seq: Pt[] = [{ x: w * 0.82, y: Math.min(0, list[0].y - h) }, ...list];
      const last = seq[seq.length - 1];
      if (c >= last.y) {
        tx = last.x;
        alpha = 1 - clamp01((c - last.y) / (h * 0.7));
      } else {
        let i = 0;
        while (i < seq.length - 2 && c > seq[i + 1].y) i++;
        const a = seq[i];
        const b = seq[i + 1];
        const u = clamp01((c - a.y) / Math.max(1, b.y - a.y));
        const amp = Math.min(w * 0.16, 230) * (i % 2 ? 1 : -1);
        tx = lerp(a.x - sx0(), b.x - sx0(), smooth(u)) + Math.sin(Math.PI * u) * amp;
        ty = h / 2 + Math.sin(Math.PI * 2 * u) * h * 0.06;
      }
    }
    tx += Math.sin(t * 0.9) * 8 * scale;
    ty += Math.cos(t * 0.7) * 6 * scale;
    tx = Math.min(w - 20, Math.max(20, tx));

    // Ease toward the target so scroll never makes it jitter.
    const cur = pos.current ?? { x: tx, y: ty };
    const k = 1 - Math.exp(-Math.max(dt, 0.001) * 5);
    cur.x += (tx - cur.x) * k;
    cur.y += (ty - cur.y) * k;
    pos.current = cur;

    const tr = trail.current;
    tr.push({ x: cur.x, y: cur.y });
    if (tr.length > 30) tr.shift();

    if (alpha <= 0.01) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    const r = 3.6 * scale * (1 + 0.12 * Math.sin(t * 2.4));
    for (let i = 0; i < tr.length - 1; i++) {
      const f = i / tr.length;
      ctx.fillStyle = `rgba(${EMBER},${(f * f * 0.45).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(tr[i].x, tr[i].y, r * (0.25 + f * 0.7), 0, 6.283);
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, r * 11);
    halo.addColorStop(0, `rgba(${EMBER},0.55)`);
    halo.addColorStop(0.25, `rgba(${EMBER},0.2)`);
    halo.addColorStop(1, `rgba(${EMBER},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, r * 11, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "rgba(255,150,80,0.95)";
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, r * 1.5, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "#fff4e8";
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, r * 0.7, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full" />;
}

/** Anchors are measured in page coordinates; this is the horizontal scroll to undo (normally 0). */
function sx0() {
  return window.scrollX;
}

/** Fixed, pointer-events-none overlay below the nav. Hidden under reduced motion. */
export function Spark() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <SparkLayer />;
}
