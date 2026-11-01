"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { useInView } from "../_components/motion";
import { Micro } from "./TypesMicro";
import { Q1_OPTIONS, Q2, Q3, derive, type Q1 } from "./TypesData";
import m from "./Types.module.css";

/** A radiogroup of pills: arrow keys move and select, one tab stop, 44px targets. */
function Choice({ label, options, value, onChange, step }: { label: string; options: string[]; value: number; onChange: (i: number) => void; step: number }) {
  const id = useId();
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const d = k === "ArrowRight" || k === "ArrowDown" ? 1 : k === "ArrowLeft" || k === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (value + d + options.length) % options.length;
    onChange(next);
    const btns = e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]");
    btns[next]?.focus();
  };
  return (
    <div>
      <p id={id} className="flex items-baseline gap-3 text-[15px] font-medium tracking-[-0.01em]">
        <span className="w-mono text-[12px] text-[var(--w-ember-text)]">0{step}</span>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} onKeyDown={onKey} className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => {
          const on = i === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(i)}
              className={cn(
                "min-h-[44px] rounded-full px-4 text-[14px] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow] duration-200",
                on
                  ? "bg-[var(--w-ink)] text-[var(--w-fg-ink)] shadow-[0_6px_16px_-8px_rgb(20_20_19/0.6)]"
                  : "bg-[var(--w-white)] text-[var(--w-fg)] shadow-[inset_0_0_0_1px_var(--w-line)] hover:shadow-[inset_0_0_0_1px_var(--w-muted)]",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TypesChooser() {
  const [q1, setQ1] = useState<Q1>("time");
  const [a2, setA2] = useState<0 | 1>(0);
  const [a3, setA3] = useState<0 | 1>(0);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const q2 = Q2[q1];
  const showQ3 = q1 === "space" && a2 === 0;
  const { way, note } = derive(q1, a2, a3);
  const Icon = way.icon;

  return (
    <div ref={ref} data-reveal className="mt-14 grid gap-5 rounded-[28px] bg-[var(--w-paper)] p-5 shadow-[inset_0_0_0_1px_var(--w-line)] md:p-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      <div className="flex flex-col gap-7">
        <Choice
          step={1}
          label="How do people book it?"
          options={Q1_OPTIONS.map((o) => o.label)}
          value={Q1_OPTIONS.findIndex((o) => o.value === q1)}
          onChange={(i) => {
            setQ1(Q1_OPTIONS[i].value);
            setA2(0);
            setA3(0);
          }}
        />
        {q2 && <Choice key={q1} step={2} label={q2.title} options={q2.options} value={a2} onChange={(i) => setA2(i as 0 | 1)} />}
        {showQ3 && <Choice step={3} label={Q3.title} options={Q3.options} value={a3} onChange={(i) => setA3(i as 0 | 1)} />}
        {!q2 && <p className="text-[14px] text-[var(--w-muted)]">That is all it needs to know. The rest is prices and times.</p>}
      </div>

      <div aria-live="polite" className="relative min-h-[220px]">
        <div key={way.id + a3} className={cn(m.result, "flex h-full flex-col rounded-[22px] bg-[var(--w-ink)] p-6 text-[var(--w-fg-ink)] md:p-7")}>
          <p className="w-eyebrow text-[var(--w-ember-soft)]">Counterfoil works out</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white/[0.08] text-[var(--w-ember-soft)]">
              <Icon aria-hidden size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[22px] font-semibold leading-tight tracking-[-0.03em] md:text-[26px]">{way.name}</p>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--w-muted-ink)]">{note}</p>
          <p className="mt-3 text-[14px] text-[var(--w-fg-ink)]">
            <span className="text-[var(--w-muted-ink)]">Like </span>
            {way.example}
          </p>
          <div className="mt-auto pt-6">
            <div className="rounded-[12px] bg-white/[0.06] px-4 py-3 [--w-ink:#f5f2eb] [--w-line:rgb(245_242_235/0.18)] [--w-muted:rgb(245_242_235/0.5)]">
              <Micro key={way.id + a3} kind={way.micro} n={way.n} play={seen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
