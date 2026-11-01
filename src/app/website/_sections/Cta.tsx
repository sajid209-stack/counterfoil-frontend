"use client";

import { useRef } from "react";
import { Magnetic } from "../_components/fx";
import { useScrollProgress } from "../_components/motion";
import { LinkButton, Section, delay } from "../_components/ui";
import styles from "./Cta.module.css";

/* The finale: the ember planet rises from the bottom like a sunrise as you
   scroll in. Reduced motion: risen, still. */

export function Cta() {
  const stage = useRef<HTMLDivElement>(null);
  useScrollProgress(stage);
  return (
    <Section id="start" label="Get started" flush>
      <div ref={stage} className={styles.stage}>
        <div aria-hidden className={styles.wash} />
        <div aria-hidden className={styles.planet} />
        <div data-spark aria-hidden className="absolute bottom-[12%] left-1/2 h-px w-px" />
        <div className={styles.content}>
          <h2 data-reveal className="text-[clamp(2.75rem,9vw,8rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--cf-fg)]">
            Start with one counter.
            <span className="cf-dimtext mt-3 block text-[clamp(1.5rem,4.5vw,3.5rem)] leading-[1.05] tracking-[-0.04em]">Add the rest when you&apos;re ready.</span>
          </h2>
          <div data-reveal style={delay(160)} className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
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
      </div>
    </Section>
  );
}
