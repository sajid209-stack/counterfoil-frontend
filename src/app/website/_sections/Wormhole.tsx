"use client";

import { useEffect, useRef, useState } from "react";
import { Heading } from "../_components/ui";
import { useInView, useReducedMotion } from "../_components/motion";
import { EMBER, Starfield, useCanvas } from "./space";

const QA = [
  { q: "Is 6 PM still free?", a: "18:00 · Field 2 · Free · ৳2,000" },
  { q: "Can they pay with bKash?", a: "Yes — bKash, Bangla QR, card or cash" },
  { q: "Is the whole family in?", a: "Let all 4 in · Family ticket" },
];

const VP_Y = 0.46;
const RINGS = 16;
const SPOKES = 28;

/** A perspective grid that warps into a funnel and flows toward its mouth. */
function Funnel() {
  const ref = useCanvas(({ ctx, w, h, t }) => {
    const cx = w / 2;
    const vy = h * VP_Y;
    const maxRx = Math.max(w * 0.95, 420);
    const depth = (z: number) => z * z * 1.0;
    const ringAt = (z: number) => {
      const d = depth(z);
      return { rx: 8 + maxRx * d, ry: 3 + maxRx * d * 0.26, y: vy + d * h * 0.42 };
    };

    // Spokes first, so rings sit on them.
    ctx.lineWidth = 1;
    for (let s = 0; s < SPOKES; s++) {
      const a = (s / SPOKES) * 6.283 + t * 0.02;
      const front = Math.sin(a) > 0 ? 1 : 0.55;
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const z = k / 14;
        const r = ringAt(z);
        const x = cx + r.rx * Math.cos(a);
        const y = r.y + r.ry * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,226,200,${0.09 * front})`;
      ctx.stroke();
    }

    // Rings slide toward the viewer, fading in from the mouth and out at the edge.
    const flow = (t * 0.12) % 1;
    for (let i = 0; i < RINGS; i++) {
      const z = (i + flow) / RINGS;
      const r = ringAt(z);
      const fade = Math.min(1, z * 5) * (1 - Math.pow(z, 6));
      ctx.strokeStyle = `rgba(255,226,200,${(0.05 + 0.3 * z) * fade})`;
      ctx.beginPath();
      ctx.ellipse(cx, r.y, r.rx, r.ry, 0, 0, 6.283);
      ctx.stroke();
    }

    // The mouth.
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, vy, 0, cx, vy, Math.min(w, 520) * 0.5);
    g.addColorStop(0, `rgba(${EMBER},${0.34 + 0.06 * Math.sin(t * 1.1)})`);
    g.addColorStop(0.35, `rgba(${EMBER},0.1)`);
    g.addColorStop(1, `rgba(${EMBER},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  });
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}

type View = { q: number; n: number; show: boolean };

/** A question that types itself, and an answer chip that rises out of the funnel. */
function Demo({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [st, setSt] = useState<View>({ q: 0, n: 0, show: false });

  useEffect(() => {
    if (!active || reduce) return;
    let dead = false;
    let id = 0;
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        id = window.setTimeout(res, ms);
      });
    (async () => {
      await wait(0);
      for (let q = 0; !dead; q = (q + 1) % QA.length) {
        setSt({ q, n: 0, show: false });
        await wait(700);
        for (let n = 1; n <= QA[q].q.length; n++) {
          if (dead) return;
          setSt({ q, n, show: false });
          await wait(55);
        }
        await wait(450);
        if (dead) return;
        setSt({ q, n: QA[q].q.length, show: true });
        await wait(3000);
        if (dead) return;
        setSt({ q, n: QA[q].q.length, show: false });
        await wait(600);
      }
    })();
    return () => {
      dead = true;
      window.clearTimeout(id);
    };
  }, [active, reduce]);

  const v: View = reduce ? { q: 0, n: QA[0].q.length, show: true } : st;
  const item = QA[v.q];
  const typing = !v.show && v.n < item.q.length;

  return (
    <>
      {/* The answer: it rises from the mouth, behind the input. */}
      <div
        aria-hidden
        className={`absolute left-1/2 top-[28%] z-10 w-[min(92%,440px)] -translate-x-1/2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          v.show ? "translate-y-0 scale-100 opacity-100 blur-0" : "translate-y-10 scale-90 opacity-0 blur-sm"
        }`}
      >
        <div className="flex items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-5 py-3 text-[15px] text-[var(--cf-fg)] shadow-[0_0_40px_rgba(249,74,0,0.18)] backdrop-blur-md">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#34d399] shadow-[0_0_10px_#34d399]" />
          <span className="min-w-0 text-center">{item.a}</span>
        </div>
      </div>
      {/* The input. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[58%] z-10 w-[min(92%,520px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/60 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="flex min-h-[28px] items-center gap-2 text-[17px] font-light text-[var(--cf-fg)]">
          <span className="min-w-0 truncate">{item.q.slice(0, v.n)}</span>
          <span className={`h-5 w-px shrink-0 bg-[var(--cf-accent)] ${typing || !reduce ? "animate-pulse" : ""}`} />
          {v.n === 0 && <span className="text-[#8d897f]">Ask the counter…</span>}
        </div>
      </div>
      <p className="sr-only">
        Example: asked “{QA[0].q}”, the counter answers “{QA[0].a}”. Asked “{QA[1].q}”: “{QA[1].a}”. Asked “{QA[2].q}”: “{QA[2].a}”.
      </p>
    </>
  );
}

export function Wormhole() {
  const stage = useRef<HTMLDivElement>(null);
  const active = useInView(stage, { once: false, margin: "0px", threshold: 0.25 });
  return (
    <section id="ask" className="cf-sec relative scroll-mt-16 overflow-hidden bg-black px-5 py-24 md:px-12 md:py-32">
      <div className="absolute inset-0">
        <Starfield density={0.5} />
      </div>
      <div className="relative">
        <Heading align="center" label="Ask" title="Ask the counter anything." dim="It already knows." />
        <div ref={stage} className="relative mx-auto mt-6 h-[540px] w-full max-w-[1000px] md:h-[640px]">
          <Funnel />
          <span
            data-spark
            aria-hidden
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${VP_Y * 100}%` }}
          />
          <Demo active={active} />
        </div>
      </div>
    </section>
  );
}
