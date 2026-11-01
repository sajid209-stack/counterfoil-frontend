"use client";

import { useRef } from "react";
import { Label, Section } from "../_components/ui";
import { ScrollWords } from "../_components/fx";
import { useScrollProgress } from "../_components/motion";

const TICKS = Array.from({ length: 12 }, (_, i) => i);

/** One huge statement that lights up as you read, over a slow ember clock whose hand follows the scroll. */
export function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref);
  return (
    <Section label="Why Counterfoil" flush className="overflow-x-clip px-5 py-24 md:px-12 md:py-40">
      <div ref={ref} className="relative mx-auto max-w-[1000px]">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] md:block">
          <div className="sticky top-[18vh] ml-auto aspect-square w-full max-w-[460px] opacity-[0.55]">
            <div className="absolute inset-0 rounded-full bg-[var(--color-brand-50,#fff5ee)]" />
            <div className="absolute inset-[8%] rounded-full bg-white shadow-[0_30px_70px_-30px_rgb(140_50_0/0.25)]" />
            {TICKS.map((i) => (
              <span key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 30}deg)` }}>
                <span className={`absolute left-1/2 top-[11%] -translate-x-1/2 rounded-full bg-[var(--cf-accent)] ${i % 3 === 0 ? "h-[6%] w-[1.6%]" : "h-[3.5%] w-[1%] opacity-60"}`} />
              </span>
            ))}
            <span className="absolute inset-0" style={{ transform: "rotate(calc(var(--cf-p, 0) * 720deg))" }}>
              <span className="absolute bottom-1/2 left-1/2 h-[38%] w-[1.2%] -translate-x-1/2 rounded-full bg-[var(--cf-accent)]" />
            </span>
            <span className="absolute inset-0" style={{ transform: "rotate(calc(var(--cf-p, 0) * 60deg + 300deg))" }}>
              <span className="absolute bottom-1/2 left-1/2 h-[26%] w-[2%] -translate-x-1/2 rounded-full bg-[#aa3000]" />
            </span>
            <span className="absolute left-1/2 top-1/2 h-[4%] w-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cf-accent)]" />
          </div>
        </div>
        <div className="relative z-10">
          <Label>Why Counterfoil</Label>
          <ScrollWords
            className="mt-8 max-w-[880px] text-[clamp(2rem,4.6vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-[var(--cf-fg)]"
            text="Venues sell time with tools built for shelves. A retail till knows a product. It doesn't know 6 PM. Counterfoil does — every seat, slot and lane, at every counter, in real time."
            accent={["time", "Counterfoil", "6", "PM"]}
          />
        </div>
      </div>
    </Section>
  );
}
