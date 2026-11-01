"use client";

import { useRef } from "react";
import { CountUp, useInView, useReducedMotion, useTicker } from "../_components/motion";
import { Section } from "../_components/ui";

/* Four product facts, never usage. The payment count is the deck's PAY list
   (Close.tsx): bKash, Bangla QR, SSLCOMMERZ, Stripe, card terminal, cash. */

const FACTS: { value: number; suffix?: string; caption: string; cycle: string[] }[] = [
  { value: 14, caption: "ways to book: sessions, courts, seats, tours and more", cycle: ["Sessions", "Courts", "Seats", "Tours"] },
  { value: 2, caption: "languages, Bangla and English, across the admin and the till", cycle: ["বাংলা", "English"] },
  { value: 6, caption: "ways to take payment, local rails first", cycle: ["bKash", "Bangla QR", "SSLCOMMERZ", "Stripe", "Card", "Cash"] },
  { value: 0, suffix: "%", caption: "cut of your ticket sales on a monthly plan", cycle: ["Lite", "Starter", "Growth", "Advanced"] },
];

function Fact({ value, suffix, caption, cycle, index }: (typeof FACTS)[number] & { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useInView(ref, { once: false });
  const reduce = useReducedMotion();
  const i = useTicker(cycle.length, 2200 + index * 350, live && !reduce);
  return (
    <div ref={ref} className="flex min-w-0 flex-col p-5 md:p-8">
      <p className="text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums text-[var(--cf-fg)]">
        <CountUp value={value} />
        {suffix}
      </p>
      <p className="cf-mono mt-4 h-5 truncate text-[12px] uppercase tracking-[0.06em] text-[var(--cf-fg-2)]" aria-hidden>
        <span key={i} className="cf-arrive inline-flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-[var(--cf-accent)]" />
          {cycle[i]}
        </span>
      </p>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--cf-muted)]">{caption}</p>
    </div>
  );
}

export function Facts() {
  return (
    <Section label="Counterfoil in numbers" flush>
      <div className="px-5 pb-6 pt-14 md:px-12 md:pt-20">
        <p data-reveal className="cf-label">
          Counterfoil in numbers
        </p>
      </div>
      <div data-reveal className="cf-cells grid-cols-2 border-y border-[var(--cf-line)] lg:grid-cols-4">
        {FACTS.map((f, i) => (
          <Fact key={f.caption} {...f} index={i} />
        ))}
      </div>
      <div className="h-14 md:h-20" aria-hidden />
    </Section>
  );
}
