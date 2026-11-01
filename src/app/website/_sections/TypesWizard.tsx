"use client";

import { useRef, useState } from "react";
import { Check, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Cursor, Window } from "../_components/ui";
import { useInView, useSequence } from "../_components/motion";
import { TypesMicro } from "./TypesMicro";
import { PATHS, Q1_OPTIONS, Q2, Q3, derive, stageOf, type Q1 } from "./TypesData";

type View = {
  q1: Q1 | null;
  a2: 0 | 1 | null;
  a3: 0 | 1 | null;
  /** Row the autoplay cursor is on, and whether it is pressing. */
  hover?: number;
  click?: boolean;
  resolved?: boolean;
};

const ROW = 44;
const HEAD = 56;

/** The scripted run: for every path, glide to a row, press it, move on; then resolve the result. */
function build() {
  const frames: View[] = [];
  const ms: number[] = [];
  for (const p of PATHS) {
    let q1: Q1 | null = null;
    let a2: 0 | 1 | null = null;
    let a3: 0 | 1 | null = null;
    const press = (index: number, apply: () => void) => {
      frames.push({ q1, a2, a3, hover: index });
      ms.push(1000);
      frames.push({ q1, a2, a3, hover: index, click: true });
      ms.push(420);
      apply();
    };
    press(
      Q1_OPTIONS.findIndex((o) => o.value === p.q1),
      () => {
        q1 = p.q1;
      },
    );
    if (p.a2 !== undefined) {
      const a = p.a2;
      press(a, () => {
        a2 = a;
      });
    }
    if (p.a3 !== undefined) {
      const a = p.a3;
      press(a, () => {
        a3 = a;
      });
    }
    frames.push({ q1, a2, a3, resolved: false });
    ms.push(800);
    frames.push({ q1, a2, a3, resolved: true });
    ms.push(3400);
  }
  return { frames, ms };
}
const SCRIPT = build();

export function TypesWizard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const [manual, setManual] = useState<View | null>(null);
  const step = useSequence(SCRIPT.ms, inView && !manual);
  const v: View = manual ?? SCRIPT.frames[step];
  const stage = stageOf(v.q1, v.a2, v.a3);
  const auto = !manual;

  const q2 = v.q1 ? Q2[v.q1] : undefined;
  const title = stage === "q1" ? "What are you selling?" : stage === "q2" ? q2!.title : Q3.title;
  const options: string[] = stage === "q1" ? Q1_OPTIONS.map((o) => o.label) : stage === "q2" ? [...q2!.options] : [...Q3.options];
  const n = stage === "q1" ? 1 : stage === "q2" ? 2 : 3;

  const choose = (i: number) => {
    if (stage === "q1") setManual({ q1: Q1_OPTIONS[i].value, a2: null, a3: null, resolved: true });
    else if (stage === "q2") setManual({ q1: v.q1, a2: i as 0 | 1, a3: null, resolved: true });
    else setManual({ q1: v.q1, a2: v.a2, a3: i as 0 | 1, resolved: true });
  };

  const result = stage === "result" ? derive(v.q1!, v.a2 ?? 0, v.a3 ?? 0) : null;
  const cursorRow = v.hover ?? 0;
  const crumbs = [
    v.q1 ? Q1_OPTIONS.find((o) => o.value === v.q1)!.label : null,
    v.a2 !== null && q2 ? q2.options[v.a2] : null,
    v.a3 !== null ? Q3.options[v.a3] : null,
  ];

  return (
    <div ref={ref} className="relative">
      <Window
        title="New booking"
        dots
        right={
          manual ? (
            <button
              type="button"
              onClick={() => setManual(null)}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-[var(--cf-muted)] hover:text-[var(--cf-fg)]"
            >
              <Play aria-hidden size={12} strokeWidth={2} /> Watch it play
            </button>
          ) : (
            <span className="cf-label flex items-center gap-1.5 text-[12px]">
              <span aria-hidden className="cf-live h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" /> Try it
            </span>
          )
        }
        className="mx-auto w-full max-w-[420px]"
      >
        <div className="relative min-h-[430px]" role="group" aria-label="New booking: answer the questions to see the kind of booking">
          {stage !== "result" ? (
            <div key={stage}>
              <div className="cf-arrive flex flex-col justify-center border-b border-[var(--cf-line)] px-4" style={{ height: HEAD }}>
                <span className="cf-label text-[12px]">Step {n}</span>
                <span className="text-[14px] font-semibold tracking-[-0.01em]">{title}</span>
              </div>
              <div className="p-2">
                {options.map((label, i) => {
                  const hot = auto && v.hover === i;
                  const picked = hot && v.click;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => choose(i)}
                      style={{ height: ROW }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] transition-colors duration-300",
                        picked ? "bg-[var(--cf-accent-wash)] shadow-[inset_0_0_0_1px_var(--cf-accent)]" : hot ? "bg-[var(--cf-bg-3)]" : "hover:bg-[var(--cf-bg-2)]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors", picked ? "border-[var(--cf-accent)]" : "border-[var(--cf-line-2)]")}
                      >
                        {picked && <span className="h-2 w-2 rounded-full bg-[var(--cf-accent)]" />}
                      </span>
                      <span className="min-w-0 truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="cf-arrive p-4" aria-live="polite">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {crumbs.map(
                  (t) =>
                    t && (
                      <span key={t} className="inline-flex items-center gap-1 rounded-md bg-[var(--cf-bg-3)] px-2 py-1 text-[12px] text-[var(--cf-fg-2)]">
                        <Check aria-hidden size={11} strokeWidth={2.2} /> {t}
                      </span>
                    ),
                )}
              </div>
              <div className="rounded-xl border border-[var(--cf-line)] p-4">
                <p className="cf-label text-[12px]">This is a</p>
                {v.resolved ? (
                  <div className="cf-arrive mt-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[20px] font-semibold leading-tight tracking-[-0.025em]">{result!.way.name}</p>
                      <TypesMicro way={result!.way} />
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--cf-muted)]">like {result!.way.example}</p>
                    <p className="mt-4 border-t border-[var(--cf-line)] pt-3 text-[13px] leading-relaxed text-[var(--cf-fg-2)]">{result!.note}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2" aria-hidden>
                    <div className="cf-skeleton h-6 w-2/3 rounded-md" />
                    <div className="cf-skeleton h-3.5 w-1/2 rounded" />
                    <div className="cf-skeleton mt-5 h-3.5 w-full rounded" />
                    <div className="cf-skeleton h-3.5 w-4/5 rounded" />
                  </div>
                )}
              </div>
              {manual && (
                <button
                  type="button"
                  onClick={() => setManual({ q1: null, a2: null, a3: null })}
                  className="mt-3 flex h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-[var(--cf-fg-2)] hover:bg-[var(--cf-bg-2)] md:h-9"
                >
                  <RotateCcw aria-hidden size={13} strokeWidth={1.8} /> Start over
                </button>
              )}
            </div>
          )}
          {auto && <Cursor x={stage === "result" ? 250 : 170} y={stage === "result" ? 200 : HEAD + 8 + cursorRow * ROW + 14} click={v.click} />}
        </div>
      </Window>
    </div>
  );
}
