"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useReducedMotion, useScrollProgress } from "../_components/motion";
import { Heading, LinkButton, Section } from "../_components/ui";

/* The FAQ as a chat. Every question and answer is in the DOM; scrolling reveals
   them one after another, with typing dots before each answer. */

const QA: { q: string; a: string }[] = [
  { q: "What is Counterfoil?", a: "Software for places that sell time: tours, courts, lanes, shows and attractions. One live capacity behind every sale, at the counter and online." },
  { q: "Does it work at the counter and online?", a: "Yes. The same slots and seats sell at the counter, on the phone and online, so what one channel sells is gone from the others." },
  { q: "Which payments does it take?", a: "bKash, Bangla QR, SSLCOMMERZ, Stripe, a card terminal, and cash." },
  { q: "Is it in Bangla?", a: "Yes. Counterfoil runs in Bangla and English." },
  { q: "Does it take a cut of my tickets?", a: "Not on the monthly plans: the plan price is the same whatever you sell. The Events plan is 6% of ticket revenue with nothing monthly." },
  { q: "Can two counters sell the same seat?", a: "No. There is one live capacity, so a seat or slot sold at one counter is gone at every other." },
  { q: "How do I start?", a: "Lite is free: one counter, one location. Add seats, locations and plans when you are ready." },
];
const N = QA.length * 3;

export function Faq() {
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [raw, setRaw] = useState(N);
  const step = reduce ? N : raw;
  useScrollProgress(box, {
    onChange: (p) => {
      const s = Math.min(N, Math.floor(Math.min(1, p * 1.9) * (N + 1)));
      setRaw((prev) => (prev === s ? prev : s));
    },
  });

  return (
    <Section id="faq" className="px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Heading label="FAQ" title="Short answers" dim="to good questions.">
            <LinkButton href="/sign-up" variant="primary">
              Start for free
            </LinkButton>
          </Heading>
        </div>
        <div ref={box} className="flex flex-col gap-3" role="list" aria-label="Frequently asked questions">
          {QA.map((m, i) => {
            const qShown = step >= i * 3;
            const typing = step === i * 3 + 1;
            const aShown = step >= i * 3 + 2;
            const fade = "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none";
            return (
              <div key={m.q} role="listitem" className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <p className={cn("cf-glass max-w-[85%] px-4 py-3 text-[15px] text-[var(--cf-fg)]", fade, qShown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")} style={{ borderRadius: 18 }}>
                    {m.q}
                  </p>
                </div>
                <div className="relative flex justify-start">
                  <span
                    aria-hidden
                    className={cn("absolute left-0 top-0 flex h-[46px] items-center gap-1 rounded-[18px] bg-[var(--cf-bg-3)] px-4", fade, typing ? "opacity-100" : "opacity-0")}
                  >
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cf-muted)]" style={{ animationDelay: `${d * 160}ms` }} />
                    ))}
                  </span>
                  <p
                    className={cn("max-w-[90%] rounded-[18px] bg-[rgb(245_242_235/0.09)] px-4 py-3 text-[15px] leading-[1.55] text-[var(--cf-fg-2)]", fade, aShown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}
                  >
                    {m.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
