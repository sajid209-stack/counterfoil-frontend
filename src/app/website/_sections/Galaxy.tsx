"use client";

import { useRef } from "react";
import { useReducedMotion } from "../_components/motion";
import { LinkButton, Section, delay } from "../_components/ui";
import { seeded, useCanvasLoop } from "./ConstellationCanvas";

/* A slowly rotating spiral disc seen at an angle: warm-white near the core,
   ember in the arms. Deterministic; one static frame under reduced motion. */

const N = 2200;
const P = (() => {
  const r = seeded(21);
  const out = new Float32Array(N * 5); // radius, angle, size, alpha, ember(0..1)
  for (let i = 0; i < N; i++) {
    const rad = Math.pow(r(), 1.7);
    const arm = Math.floor(r() * 3) * ((Math.PI * 2) / 3);
    const th = arm + rad * 5.2 + (r() - 0.5) * (0.35 + rad * 0.5);
    out[i * 5] = 0.03 + rad;
    out[i * 5 + 1] = th;
    out[i * 5 + 2] = 0.6 + r() * 1.4;
    out[i * 5 + 3] = 0.25 + r() * 0.7;
    out[i * 5 + 4] = Math.min(1, rad * 1.4 + (r() - 0.5) * 0.3);
  }
  return out;
})();

export function Galaxy() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useCanvasLoop(
    canvas,
    (ctx, w, h, t) => {
      const n = w < 640 ? Math.floor(N * 0.4) : N;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w * 0.62, h * 1.3);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
      core.addColorStop(0, "rgba(255,226,196,0.55)");
      core.addColorStop(0.3, "rgba(255,120,50,0.18)");
      core.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.22);
      for (let i = 0; i < n; i++) {
        const rad = P[i * 5];
        const th = P[i * 5 + 1] + (t * 0.12) / Math.sqrt(rad + 0.15);
        const x = Math.cos(th) * rad * R;
        const y = Math.sin(th) * rad * R * 0.38;
        const e = P[i * 5 + 4];
        const gr = Math.round(240 - e * 120);
        const b = Math.round(225 - e * 195);
        ctx.fillStyle = `rgba(255,${gr},${b},${(P[i * 5 + 3] * (1 - rad * 0.35)).toFixed(3)})`;
        const s = P[i * 5 + 2];
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
    },
    reduce,
  );

  return (
    <Section id="galaxy" flush label="Asked at every counter" className="relative overflow-hidden">
      <div className="relative flex min-h-[88vh] items-center justify-center px-5 py-24 text-center">
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        <div data-spark aria-hidden className="absolute left-1/2 top-1/2 h-px w-px" />
        <div className="relative z-10 mx-auto max-w-[860px]">
          <h2 data-reveal className="text-[clamp(2.25rem,6.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
            <span className="cf-dimtext">&ldquo;Is 6 PM still free?&rdquo;</span>
            <span className="block text-[var(--cf-fg)]">Asked at every counter, every day.</span>
          </h2>
          <p data-reveal style={delay(120)} className="cf-lead mx-auto mt-6 max-w-[460px]">
            Counterfoil answers it before anyone asks.
          </p>
          <div data-reveal style={delay(200)} className="mt-8 flex justify-center">
            <LinkButton href="/sign-up" variant="primary">
              Start for free
            </LinkButton>
          </div>
        </div>
      </div>
    </Section>
  );
}
