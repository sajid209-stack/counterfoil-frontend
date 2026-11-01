"use client";

import { useRef } from "react";
import { LOGO_MARK } from "@/components/brand/logoArt";
import { Magnetic, SplitReveal } from "../_components/fx";
import { useInView, useReducedMotion } from "../_components/motion";
import { LinkButton, Section } from "../_components/ui";
import styles from "./Cta.module.css";

/* The finale. ~24 small paper tickets fall into a soft pile when the stage
   comes into view, then sway; the big counterfoil ticket lands last and tears
   along its perforation. Reduced motion: the finished pile, still. Phones keep
   every other ticket (12). Pile values are precomputed, never random in render. */

type Piece = { x: number; rest: number; rot: number; r0: number; dur: number; del: number; ember: boolean; extra: boolean };

const COUNT = 24;
const PIECES: Piece[] = (() => {
  let s = 7;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: COUNT }, (_, i) => {
    const x = 3 + (i / (COUNT - 1)) * 80 + (rnd() - 0.5) * 5; // spread across the stage, 3–86%
    const centre = 1 - Math.abs(x - 45) / 45; // taller pile mid-stage
    return {
      x,
      rest: 4 + rnd() * 16 + Math.max(0, centre) * rnd() * 34,
      rot: (rnd() - 0.5) * 60,
      r0: (rnd() - 0.5) * 240,
      dur: 1100 + rnd() * 700,
      del: Math.round(i * 55 + rnd() * 260),
      ember: i % 3 === 1,
      extra: i % 2 === 1,
    };
  }).sort(() => 0); // order stays deterministic
})();

const BIG_DELAY = 2300;

function Rain({ run }: { run: boolean }) {
  return (
    <>
      {PIECES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={`${styles.piece} ${p.extra ? styles.extra : ""}`}
          style={{
            left: `${p.x}%`,
            bottom: `${p.rest}px`,
            zIndex: Math.round(p.rest),
            ["--r" as string]: `${p.rot.toFixed(1)}deg`,
            ["--r0" as string]: `${p.r0.toFixed(1)}deg`,
            ["--dur" as string]: `${Math.round(p.dur)}ms`,
            ["--del" as string]: `${p.del}ms`,
            animationPlayState: run ? "running" : undefined,
          }}
        >
          <span className={`${styles.chip} ${p.ember ? "bg-[var(--cf-accent)]" : "bg-white"}`}>
            <svg width="16" height="16" viewBox="0 0 70 70" fill={p.ember ? "#fff" : "#f94a00"}>
              <path d={LOGO_MARK} />
            </svg>
          </span>
        </span>
      ))}
    </>
  );
}

function Ticket({ run }: { run: boolean }) {
  const reduce = useReducedMotion();
  const torn = run || reduce;
  const wait = reduce ? 0 : BIG_DELAY + 1300;
  const ease = reduce ? "none" : `transform 1000ms var(--cf-ease) ${wait}ms`;
  return (
    <div className="flex w-full max-w-[520px] items-stretch justify-center">
      <div
        className={`${styles.half} relative z-10 origin-bottom-right`}
        style={{ width: "30%", transform: torn ? "translate(-14px, 8px) rotate(-5deg)" : "none", transition: ease }}
      >
        <div className={reduce ? undefined : styles.floatStub}>
          <div className={`${styles.stub} flex h-[132px] flex-col items-center justify-center gap-3 rounded-l-[14px] bg-white sm:h-[148px]`}>
            <svg width="38" height="38" viewBox="0 0 70 70" fill="#f94a00">
              <path d={LOGO_MARK} />
            </svg>
            <span className="cf-mono text-[12px] uppercase tracking-[0.06em] text-[var(--cf-muted)]">Admit 2</span>
          </div>
        </div>
      </div>
      <div className={`${styles.half} relative flex-1`} style={{ transform: torn ? "translate(4px, 0)" : "none", transition: ease }}>
        <div className={reduce ? undefined : styles.float}>
          <div className={`${styles.main} flex h-[132px] flex-col justify-center rounded-r-[14px] bg-white px-5 sm:h-[148px] sm:px-7`}>
            <p className="cf-mono flex items-center gap-2 text-[12px] uppercase tracking-[0.06em] text-[var(--cf-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
              Admit one scan
            </p>
            <p className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.025em] text-[var(--cf-fg)] sm:text-[24px]">Planetarium Show</p>
            <p className="mt-1 text-[13px] text-[var(--cf-fg-2)]">11:00 · Admit 2</p>
            <p className="cf-mono mt-3 text-[12px] text-[var(--cf-muted)]">CF-2026-001054</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cta() {
  const stage = useRef<HTMLDivElement>(null);
  const seen = useInView(stage, { threshold: 0.35 });
  return (
    <Section label="Get started" flush>
      <div className="px-5 pb-12 pt-20 text-center md:px-12 md:pb-16 md:pt-28">
        <SplitReveal
          as="h2"
          className="text-[clamp(2.75rem,9vw,8rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--cf-fg)]"
          parts={[{ text: "Start with " }, { text: "one", className: "cf-accent" }, { text: " counter." }]}
        />
        <SplitReveal
          as="p"
          delay={300}
          className="cf-dimtext mt-3 block text-[clamp(1.5rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.04em]"
          parts="Add the rest when you're ready."
        />
        <div data-reveal className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          <Magnetic>
            <LinkButton href="/sign-up" variant="primary">
              Start for free
            </LinkButton>
          </Magnetic>
          <Magnetic>
            <LinkButton href="/" variant="secondary">
              Try the live demo
            </LinkButton>
          </Magnetic>
        </div>
      </div>
      <div
        ref={stage}
        aria-hidden
        className={`${styles.stage} ${seen ? styles.run : ""} relative mx-5 mb-16 flex min-h-[420px] items-end justify-center overflow-hidden rounded-2xl bg-[var(--cf-bg-2)] px-5 pb-16 md:mx-12 md:mb-24 md:min-h-[520px] md:pb-20`}
      >
        <Rain run={seen} />
        <div className={`${styles.big} relative z-[60] flex w-full justify-center`} style={{ ["--bigdel" as string]: `${BIG_DELAY}ms`, animationPlayState: seen ? "running" : undefined }}>
          <Ticket run={seen} />
        </div>
      </div>
    </Section>
  );
}
