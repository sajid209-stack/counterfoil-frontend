"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useReducedMotion } from "../_components/motion";

/* Shared canvas helpers for the dark "space" sections: a seeded PRNG, a canvas
   hook that handles DPR / resize / in-view RAF / reduced motion, and the
   Starfield. Nothing here uses Math.random, so every frame is deterministic. */

/** mulberry32 — a tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (k: number) => {
  const x = clamp01(k);
  return x * x * (3 - 2 * x);
};

export const EMBER = "249,74,0";

export type CanvasFrame = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size of the canvas. */
  w: number;
  h: number;
  /** Seconds since the canvas first ran (a fixed frame under reduced motion). */
  t: number;
  /** Seconds since the previous frame, capped. */
  dt: number;
  dpr: number;
  reduced: boolean;
  /** Whether the canvas just got its first frame / was resized. */
  canvas: HTMLCanvasElement;
};

/**
 * Sizes a canvas to its box × DPR (capped at 2), redraws on resize, and runs a
 * requestAnimationFrame loop only while the canvas is in view. Under reduced
 * motion it draws a single still frame. Attach the returned ref to a <canvas>.
 */
export function useCanvas(
  draw: (f: CanvasFrame) => void,
  { fps = 60, clear = true }: { fps?: number; clear?: boolean } = {},
): RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  const reduce = useReducedMotion();
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let w = 1;
    let h = 1;
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let last = 0;
    const t0 = performance.now();
    const interval = 1000 / fps - 1;

    const frame = (now: number, dt: number) => {
      const t = reduce ? 2.5 : (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (clear) ctx.clearRect(0, 0, w, h);
      drawRef.current({ ctx, w, h, t, dt, dpr, reduced: reduce, canvas: cv });
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < interval) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frame(now, dt);
    };
    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      if (visible && (reduce || !raf)) frame(performance.now(), 0.016);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        if (reduce) frame(performance.now(), 0.016);
        else start();
      } else stop();
    });
    io.observe(cv);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, [reduce, fps, clear]);
  return ref;
}

type Star = { x: number; y: number; r: number; ph: number; f: number; layer: number; warm: boolean };

function makeStars(n: number): Star[] {
  const rand = mulberry32(20261101);
  return Array.from({ length: n }, (_, i) => {
    const layer = i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2;
    return {
      x: rand(),
      y: rand(),
      r: [0.5, 0.8, 1.25][layer] * (0.7 + rand() * 0.6),
      ph: rand() * 6.283,
      f: 0.5 + rand() * 1.6,
      layer,
      warm: rand() < 0.22,
    };
  });
}

const DRIFT = [3, 6, 11];
const PARALLAX = [0.02, 0.05, 0.1];
const BASE_ALPHA = [0.4, 0.62, 0.9];

/**
 * Twinkling stars at three depths. Drift slowly sideways and shift a little with
 * scroll (deeper = slower). Fill the nearest `relative` parent.
 */
export function Starfield({ className = "", density = 1 }: { className?: string; density?: number }) {
  const stars = useMemo(() => makeStars(Math.round(340 * density)), [density]);
  const ref = useCanvas(({ ctx, w, h, t, canvas }) => {
    const count = w < 640 ? Math.round(stars.length * 0.4) : stars.length;
    const top = canvas.getBoundingClientRect().top;
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      const x = (((s.x * w + t * DRIFT[s.layer]) % w) + w) % w;
      const y = (((s.y * h - top * PARALLAX[s.layer]) % h) + h) % h;
      const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.ph);
      ctx.globalAlpha = BASE_ALPHA[s.layer] * tw;
      ctx.fillStyle = s.warm ? "#ffd9bf" : "#f1ede4";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
