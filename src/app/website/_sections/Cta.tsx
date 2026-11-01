"use client";

import { useRef } from "react";
import { LOGO_MARK } from "@/components/brand/logoArt";
import { useInView, useReducedMotion } from "../_components/motion";
import { Heading, LinkButton, Section } from "../_components/ui";
import styles from "./Cta.module.css";

/* The closing visual: one counterfoil ticket that tears along its perforation
   once when scrolled into view, then idles. Reduced motion: shown torn, still. */

function Ticket() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { threshold: 0.5 });
  const reduce = useReducedMotion();
  const torn = seen || reduce;
  const ease = reduce ? "none" : "transform 1000ms var(--cf-ease)";
  return (
    <div ref={ref} aria-hidden className="flex w-full max-w-[520px] items-stretch justify-center">
      <div
        className={`${styles.half} relative z-10 origin-bottom-right`}
        style={{ width: "30%", transform: torn ? "translate(-14px, 8px) rotate(-5deg)" : "none", transition: ease }}
      >
        <div className={reduce ? undefined : styles.floatStub}>
          <div className={`${styles.stub} flex h-[132px] flex-col items-center justify-center gap-3 rounded-l-[10px] bg-white sm:h-[148px]`}>
            <svg width="38" height="38" viewBox="0 0 70 70" fill="#111110">
              <path d={LOGO_MARK} />
            </svg>
            <span className="cf-mono text-[12px] uppercase tracking-[0.06em] text-[var(--cf-muted)]">Admit 2</span>
          </div>
        </div>
      </div>
      <div className={`${styles.half} relative flex-1`} style={{ transform: torn ? "translate(4px, 0)" : "none", transition: ease }}>
        <div className={reduce ? undefined : styles.float}>
          <div className={`${styles.main} flex h-[132px] flex-col justify-center rounded-r-[10px] border-l border-dashed border-[var(--cf-line-2)] bg-white px-5 sm:h-[148px] sm:px-7`}>
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
  return (
    <Section label="Get started" flush>
      <div className="px-5 pb-12 pt-20 md:px-12 md:pb-16 md:pt-28">
        <Heading align="center" title="Start with one counter." dim="Add the rest when you're ready.">
          <LinkButton href="/sign-up" variant="dark">
            Start for free
          </LinkButton>
          <LinkButton href="/" variant="light">
            Try the live demo
          </LinkButton>
        </Heading>
      </div>
      <div className="cf-dots flex justify-center overflow-hidden border-t border-[var(--cf-line)] px-5 py-16 md:py-24">
        <Ticket />
      </div>
    </Section>
  );
}
