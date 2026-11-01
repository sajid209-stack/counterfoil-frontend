"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion, useScrollProgress } from "../_components/motion";
import { Label } from "../_components/ui";
import { seeded, useCanvasLoop } from "./ConstellationCanvas";

/* A perspective dot-grid floor. The counter's real questions appear as glass
   bubbles, each collapses into floor points that rise into a small
   constellation; then the stars re-form into three product facts. Scroll-driven
   (the stage is sticky inside a tall section). Reduced motion: the finale. */

const QUESTIONS = ["Is 6 PM still free?", "Which lane is open?", "Did the family get in?", "Can I pay with bKash?", "Is the 11:00 show full?"];
const BX = [0.16, 0.34, 0.5, 0.68, 0.84];
const BX_PHONE = [0.3, 0.7, 0.35, 0.65, 0.5];
const BY = [0.3, 0.2, 0.34, 0.22, 0.3];
const FACTS = [
  { n: "14", label: "ways to book" },
  { n: "2", label: "languages" },
  { n: "0%", label: "cut of your ticket sales" },
];
const FACT_POS = [
  [0.2, 0.4],
  [0.5, 0.4],
  [0.8, 0.4],
];
const FACT_POS_PHONE = [
  [0.5, 0.2],
  [0.5, 0.45],
  [0.5, 0.7],
];
const PER = 7;
const WIN = 0.125;
const START = 0.04;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const ease = (a: number, b: number, k: number) => a + (b - a) * k;

// Star shape offsets per cluster, seeded.
const OFFS = (() => {
  const r = seeded(11);
  return QUESTIONS.map(() =>
    Array.from({ length: PER }, (_, j) => {
      const a = (j / PER) * Math.PI * 2 + r() * 0.8;
      const d = 18 + r() * 40;
      return [Math.cos(a) * d * 1.3, Math.sin(a) * d] as const;
    }),
  );
})();
const STARS = (() => {
  const r = seeded(5);
  return Array.from({ length: 70 }, () => [r(), r() * 0.5, r() * 0.8 + 0.2] as const);
})();

function countFor(p: number) {
  if (p <= 0.05) return 48;
  if (p < 0.38) return Math.round(ease(48, 16, (p - 0.05) / 0.33));
  if (p < 0.7) return Math.round(ease(16, 0, (p - 0.38) / 0.32));
  return 0;
}

export function Constellation() {
  const outer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const prog = useRef(1);
  const bubbles = useRef<(HTMLDivElement | null)[]>([]);
  const facts = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  });

  const apply = (raw: number) => {
    const p = reduceRef.current ? 1 : raw;
    prog.current = p;
    if (num.current) num.current.textContent = String(countFor(p));
    bubbles.current.forEach((el, i) => {
      if (!el) return;
      const u = (p - (START + i * WIN)) / WIN;
      const o = u < 0 || u > 1 ? 0 : u < 0.2 ? u / 0.2 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      const scale = u > 0.6 ? 1 - ((u - 0.6) / 0.4) * 0.5 : 1;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate(-50%,-50%) translateY(${((1 - clamp01(u / 0.2)) * 14).toFixed(1)}px) scale(${scale.toFixed(3)})`;
    });
    if (facts.current) facts.current.style.opacity = smooth((p - 0.74) / 0.12).toFixed(3);
  };
  useScrollProgress(outer, { from: "top", onChange: apply });
  useEffect(() => {
    apply(prog.current);
  }, [reduce]);

  useCanvasLoop(
    canvas,
    (ctx, w, h, t) => {
      const phone = w < 640;
      const cols = phone ? 22 : 46;
      const rows = phone ? 11 : 22;
      const horizon = h * 0.52;
      const p = prog.current;
      const finale = smooth((p - 0.74) / 0.14);
      const bx = phone ? BX_PHONE : BX;
      const fp = phone ? FACT_POS_PHONE : FACT_POS;

      for (const [sx, sy, sa] of STARS) {
        ctx.fillStyle = `rgba(245,242,235,${(0.12 + sa * 0.25 * (0.6 + 0.4 * Math.sin(t * 0.8 + sx * 40))).toFixed(3)})`;
        ctx.fillRect(sx * w, sy * h, 1.2, 1.2);
      }
      const g = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 40);
      g.addColorStop(0, "rgba(255,90,20,0)");
      g.addColorStop(0.6, "rgba(255,90,20,0.10)");
      g.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon - 60, w, 100);

      const floor = (c: number, r: number) => {
        const z = (r + 1) / rows;
        const persp = z * z;
        const y = horizon + (h - horizon) * persp * 0.95;
        const spread = w * (0.25 + 1.5 * persp);
        const wave = Math.sin(c * 0.45 + t * 0.9 + r * 0.35) * (2 + 10 * persp);
        return [w / 2 + (c / (cols - 1) - 0.5) * spread, y + wave, 0.5 + z * 1.6, 0.15 + z * 0.55] as const;
      };

      const taken = new Set<string>();
      const pts: { x: number; y: number; r: number; a: number; cl: number; k: number }[] = [];
      for (let i = 0; i < QUESTIONS.length; i++) {
        const u = (p - (START + i * WIN)) / WIN;
        const k = smooth((u - 0.55) / 0.45);
        const baseC = Math.round(bx[i] * (cols - 1));
        for (let j = 0; j < PER; j++) {
          const c = Math.min(cols - 1, Math.max(0, baseC + (j % 3) - 1));
          const r = rows - 3 - Math.floor(j / 3) * 2 - (i % 2);
          taken.add(`${c},${r}`);
          const [fx, fy, fr, fa] = floor(c, r);
          const sx = bx[i] * w + OFFS[i][j][0] * (phone ? 0.8 : 1);
          const sy = BY[i] * h + OFFS[i][j][1];
          const gi = (i * PER + j) % 3;
          const idx = Math.floor((i * PER + j) / 3);
          const a = (idx / 12) * Math.PI * 2;
          const tx = fp[gi][0] * w + Math.cos(a) * 34;
          const ty = (fp[gi][1] + (phone ? 0.1 : 0.2)) * h + Math.sin(a) * 18;
          const mx = ease(fx, sx, k);
          const my = ease(fy, sy, k);
          const lit = Math.max(k, finale);
          pts.push({ x: ease(mx, tx, finale), y: ease(my, ty, finale), r: ease(fr, 2.1, lit), a: ease(fa, 0.95, lit), cl: i, k });
        }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const [x, y, fr, fa] = floor(c, r);
          const ghost = taken.has(`${c},${r}`);
          ctx.fillStyle = ghost ? "rgba(245,242,235,0.05)" : `rgba(245,242,235,${fa.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, ghost ? fr * 0.7 : fr, 0, 6.283);
          ctx.fill();
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < QUESTIONS.length; i++) {
        const own = pts.filter((q) => q.cl === i);
        const k = own[0].k;
        if (k < 0.3) continue;
        ctx.strokeStyle = `rgba(255,138,76,${(0.28 * k * (1 - finale)).toFixed(3)})`;
        ctx.beginPath();
        own.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
      if (finale > 0.05) {
        ctx.strokeStyle = `rgba(255,138,76,${(0.3 * finale).toFixed(3)})`;
        for (let gi = 0; gi < 3; gi++) {
          const grp = pts.filter((_, n) => n % 3 === gi);
          ctx.beginPath();
          grp.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.stroke();
        }
      }
      for (const q of pts) {
        ctx.fillStyle = q.k > 0.3 || finale > 0.1 ? `rgba(255,170,120,${q.a.toFixed(3)})` : `rgba(245,242,235,${q.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, 6.283);
        ctx.fill();
      }
    },
    reduce,
  );

  return (
    <section id="constellation" aria-labelledby="constellation-h" className="cf-sec relative scroll-mt-16">
      <div ref={outer} className="relative h-[280vh] md:h-[320vh]">
        <div className="sticky top-0 h-screen min-h-[560px] overflow-hidden">
          <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
          <div className="relative z-10 px-5 pt-20 text-center md:pt-24">
            <div className="mb-5 flex justify-center">
              <Label>What changes</Label>
            </div>
            <h2 id="constellation-h" className="cf-h2 mx-auto max-w-[760px]">
              Questions the counter can&apos;t answer,
              <span className="cf-dimtext">
                {" "}
                down to{" "}
                <span ref={num} className="tabular-nums">
                  {reduce ? 0 : 48}
                </span>
                .
              </span>
            </h2>
          </div>

          {QUESTIONS.map((q, i) => (
            <div
              key={q}
              ref={(el) => {
                bubbles.current[i] = el;
              }}
              className="cf-glass pointer-events-none absolute z-10 flex max-w-[72vw] items-center gap-2.5 px-4 py-3 text-[14px] text-[var(--cf-fg)]"
              style={{ left: `${(BX[i] * 100).toFixed(0)}%`, top: `${BY[i] * 100}%`, opacity: 0, transform: "translate(-50%,-50%)", borderRadius: 14 }}
              data-bubble={i}
            >
              <span aria-hidden className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-[#ff8a4c] to-[#7a1e00]" />
              <span>{q}</span>
            </div>
          ))}

          <div data-spark aria-hidden className="absolute left-1/2 top-[52%] h-px w-px" />

          <div ref={facts} className="pointer-events-none absolute inset-0 z-10" style={{ opacity: reduce ? 1 : 0 }}>
            {FACTS.map((f, i) => (
              <div
                key={f.label}
                data-fact={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: "var(--fx)", top: "var(--fy)", ["--fx" as string]: `${FACT_POS[i][0] * 100}%`, ["--fy" as string]: `${FACT_POS[i][1] * 100}%` }}
              >
                <p className="text-[clamp(3rem,9vw,7rem)] font-semibold leading-none tracking-[-0.05em] text-[var(--cf-fg)]">{f.n}</p>
                <p className="mt-2 text-[15px] text-[var(--cf-muted)]">{f.label}</p>
              </div>
            ))}
          </div>
          {/* Phones: bubbles centre, facts stack (mirrors BX_PHONE / FACT_POS_PHONE). */}
          <style>{`@media (max-width: 639px){[data-fact="0"]{--fx:50%!important;--fy:20%!important}[data-fact="1"]{--fx:50%!important;--fy:45%!important}[data-fact="2"]{--fx:50%!important;--fy:70%!important}${BX_PHONE.map((x, i) => `[data-bubble="${i + x * 0}"]{left:50%!important}`).join("")}}`}</style>
        </div>
      </div>
    </section>
  );
}
