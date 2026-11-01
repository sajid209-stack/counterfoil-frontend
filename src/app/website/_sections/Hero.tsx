"use client";

import { useEffect, useRef } from "react";
import { LinkButton } from "../_components/ui";
import { delay } from "../_components/ui";
import { EMBER, Starfield, clamp01, useCanvas } from "./space";

/** The planet: a huge ember rim mostly off-screen, breathing, with thin orbit arcs. */
function HeroPlanet() {
  const ref = useCanvas(({ ctx, w, h, t }) => {
    const p = clamp01(window.scrollY / Math.max(1, window.innerHeight));
    const small = w < 768;
    const R = small ? w * 1.3 : Math.max(h * 0.8, w * 0.42);
    const cx = small ? w * 0.5 - p * w * 0.1 : w * 0.85 - p * w * 0.1;
    const cy = (small ? h + R * 0.42 : h * 1.02) + p * h * 0.22;
    const breath = 1 + 0.5 * Math.sin(t * 0.55) * 0.5;

    // Atmospheric bloom outside the rim.
    ctx.globalCompositeOperation = "lighter";
    const bloom = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.55);
    bloom.addColorStop(0, `rgba(${EMBER},${0.34 * breath})`);
    bloom.addColorStop(0.25, `rgba(${EMBER},${0.12 * breath})`);
    bloom.addColorStop(1, `rgba(${EMBER},0)`);
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";

    // The dark body, lit only at its edge.
    const body = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
    body.addColorStop(0, "rgba(0,0,0,1)");
    body.addColorStop(0.78, "rgba(2,1,1,1)");
    body.addColorStop(0.93, `rgba(110,28,0,${0.7 * breath})`);
    body.addColorStop(0.985, `rgba(${EMBER},${0.85 * breath})`);
    body.addColorStop(1, "rgba(255,226,200,1)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 6.283);
    ctx.fill();

    // The rim catches more light toward the upper left.
    const rimGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.2);
    rimGrad.addColorStop(0, "rgba(255,240,226,0.95)");
    rimGrad.addColorStop(0.55, "rgba(255,170,120,0.35)");
    rimGrad.addColorStop(1, "rgba(255,120,60,0.05)");
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 6.283);
    ctx.stroke();

    // Orbit arcs, thin and quiet.
    for (let k = 0; k < 4; k++) {
      const rx = R * (1.1 + k * 0.17);
      const ry = rx * (0.3 + k * 0.05);
      const rot = -0.55 + k * 0.1 + p * 0.5 * (k % 2 ? 1 : -1) + t * 0.004 * (k + 1);
      const a0 = 3.3 + k * 0.5;
      ctx.strokeStyle = `rgba(255,214,190,${0.14 - k * 0.025})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, a0, a0 + 3.1 + k * 0.3);
      ctx.stroke();
      if (k === 1 || k === 3) {
        const a = a0 + 1.6 + Math.sin(t * 0.12 + k) * 0.5;
        const px = cx + rx * Math.cos(a) * Math.cos(rot) - ry * Math.sin(a) * Math.sin(rot);
        const py = cy + rx * Math.cos(a) * Math.sin(rot) + ry * Math.sin(a) * Math.cos(rot);
        ctx.fillStyle = "rgba(255,225,205,0.8)";
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, 6.283);
        ctx.fill();
      }
    }
  });
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** The first screen: black space, an ember planet rim, one calm headline. */
export function Hero() {
  const drift = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = drift.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const p = clamp01(window.scrollY / Math.max(1, window.innerHeight * 0.8));
      el.style.transform = `translate3d(0, ${(-p * 90).toFixed(1)}px, 0)`;
      el.style.opacity = String(Math.max(0, 1 - p * 1.3).toFixed(3));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", queue, { passive: true });
    return () => {
      window.removeEventListener("scroll", queue);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section aria-label="Counterfoil" className="cf-sec relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-5 pb-24 pt-28 md:px-12">
      <Starfield />
      <HeroPlanet />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--cf-bg)]" />
      <div ref={drift} className="relative z-10 mx-auto flex max-w-[980px] flex-col items-center text-center will-change-transform">
        <h1 className="text-[clamp(2.4rem,7vw,5.6rem)] font-light leading-[1.04] tracking-[-0.035em] text-[var(--cf-fg)] [text-wrap:balance]">
          <span data-reveal style={delay(60)} className="block">
            Counterfoil runs the places
          </span>
          <span data-reveal style={delay(200)} className="block text-[#a29e95]">
            that sell{" "}
            <span className="relative inline-block text-[var(--cf-accent)]">
              time
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--cf-accent)] to-transparent"
              />
              <span
                aria-hidden
                className="absolute -bottom-2 left-[-10%] right-[-10%] h-4 bg-[radial-gradient(ellipse_at_center,rgba(249,74,0,0.5),transparent_70%)] blur-md"
              />
            </span>
            .
          </span>
        </h1>
        <p data-reveal style={delay(340)} className="mx-auto mt-7 max-w-[520px] text-[17px] font-light leading-relaxed text-[#b4b0a7]">
          Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close.
        </p>
        <div data-reveal style={delay(460)} className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
          <LinkButton href="/sign-up" variant="primary" arrow>
            Start for free
          </LinkButton>
          <LinkButton href="/" variant="secondary">
            Try the live demo
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
