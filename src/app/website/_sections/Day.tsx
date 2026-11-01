"use client";

import { useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { ChapterHead, Container, Section } from "../_components/ui";
import { useInView, useScrollProgress } from "../_components/motion";
import { Scene, type SceneId } from "./DayScenes";

const STEPS: { id: SceneId; name: string; line: string; time: string }[] = [
  { id: "setup", name: "Set up", line: "Locations, counters, what you sell, its prices and its tax.", time: "08:00" },
  { id: "sell", name: "Sell", line: "At the till or online — bKash, Bangla QR, card or cash.", time: "11:00" },
  { id: "admit", name: "Admit", line: "Scan at the gate. A family ticket lets the whole family in.", time: "14:00" },
  { id: "reconcile", name: "Reconcile", line: "Count the drawer, close the shift, read the day by the hour.", time: "22:00" },
];

const START = 8 * 60;
const SPAN = 14 * 60;

function clockText(p: number) {
  const m = Math.round(START + p * SPAN);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Below lg: one scene per step, stacked; each plays when it scrolls into view. */
function StackedStep({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const on = useInView(ref, { once: false, margin: "-15% 0px -15% 0px", threshold: 0.3 });
  return (
    <li ref={ref} data-reveal className="pt-4">
      <div className="flex items-baseline gap-3">
        <span className="w-mono text-[26px] font-medium tracking-[-0.04em]">{step.time}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--w-line)]" />
        <span className="w-mono text-[12px] text-[var(--w-muted)]">Step {index + 1}</span>
      </div>
      <h3 className="w-h3 mt-4">{step.name}</h3>
      <p className="mt-1.5 max-w-[440px] text-[15px] leading-relaxed text-[var(--w-muted)]">{step.line}</p>
      <div className="mt-6">
        <Scene id={step.id} on={on} />
      </div>
    </li>
  );
}

export function Day() {
  const trackRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const stepRef = useRef(0);
  const [step, setStep] = useState(0);

  useScrollProgress(trackRef, {
    from: "top",
    onChange: (p) => {
      if (clockRef.current) clockRef.current.textContent = clockText(p);
      const next = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
      if (next !== stepRef.current) {
        stepRef.current = next;
        setStep(next);
      }
    },
  });

  return (
    <Section id="day" tone="paper" className="!pb-0">
      <Container>
        <ChapterHead n="03" eyebrow="How it works" title="A day at the venue, from the first ticket to the last count." />
      </Container>

      {/* Below lg: the four scenes stack. */}
      <Container className="mt-14 pb-24 lg:hidden">
        <ol className="flex flex-col gap-16">
          {STEPS.map((st, i) => (
            <StackedStep key={st.id} step={st} index={i} />
          ))}
        </ol>
      </Container>

      {/* lg+: a tall track with a sticky stage; the scroll drives the clock and the scene. */}
      <div ref={trackRef} className="relative mt-16 hidden h-[400vh] lg:block">
        <div className="sticky top-0 flex h-screen items-center">
          <Container wide className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-12 xl:gap-20">
            <div>
              <p className="w-mono text-[12px] uppercase tracking-[0.12em] text-[var(--w-muted)]">The venue clock</p>
              <p aria-hidden className="w-mono mt-2 text-[clamp(4.5rem,9vw,8rem)] font-medium leading-none tracking-[-0.06em]">
                <span ref={clockRef}>08:00</span>
              </p>

              <div className="relative mt-10 pl-8">
                <span aria-hidden className="absolute bottom-1 left-[5px] top-1 w-px bg-[var(--w-line)]" />
                <span
                  aria-hidden
                  className="absolute bottom-1 left-[4px] top-1 w-[3px] origin-top rounded-full bg-[var(--w-ember)]"
                  style={{ transform: "scaleY(var(--w-p, 0))" } as CSSProperties}
                />
                <ol className="flex flex-col gap-6">
                  {STEPS.map((st, i) => {
                    const lit = i === step;
                    return (
                      <li key={st.id} aria-current={lit ? "step" : undefined} className="relative">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -left-8 top-[9px] h-[11px] w-[11px] rounded-full transition-[background-color,box-shadow] duration-500",
                            i <= step ? "bg-[var(--w-ember)]" : "bg-[var(--w-paper)] shadow-[inset_0_0_0_1.5px_var(--w-line)]",
                            lit && "shadow-[0_0_0_5px_rgb(249_74_0/0.18)]",
                          )}
                        />
                        <div className="flex items-baseline gap-3">
                          <h3
                            className={cn(
                              "text-[22px] font-semibold tracking-[-0.03em] transition-colors duration-500",
                              lit ? "text-[var(--w-fg)]" : "text-[var(--w-muted)]",
                            )}
                          >
                            {st.name}
                          </h3>
                          <span className="w-mono text-[12px] text-[var(--w-muted)]">{st.time}</span>
                        </div>
                        <p
                          className={cn(
                            "mt-1 max-w-[380px] text-[15px] leading-relaxed transition-colors duration-500",
                            lit ? "text-[var(--w-fg)]" : "text-[var(--w-muted)]",
                          )}
                        >
                          {st.line}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            <div className="relative h-[min(74vh,560px)]">
              {STEPS.map((st, i) => (
                <div
                  key={st.id}
                  aria-hidden={i !== step}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-700 ease-[var(--w-ease)] motion-reduce:transform-none motion-reduce:transition-none",
                    i === step ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-6 scale-[0.97] opacity-0",
                  )}
                >
                  <Scene id={st.id} on={i === step} />
                </div>
              ))}
            </div>
          </Container>
        </div>
      </div>
    </Section>
  );
}
