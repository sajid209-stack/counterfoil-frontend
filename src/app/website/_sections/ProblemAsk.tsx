"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Store } from "lucide-react";
import { useInView, useReducedMotion } from "../_components/motion";
import styles from "./Problem.module.css";

const QUESTION = "“Is 6 PM still free?”";

/** The ember card: the question is typed, then Counterfoil's answer lands. Loops while in view. */
export function ProblemAsk() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const reduce = useReducedMotion();
  // Starts on the finished state, so the card reads without JS and under reduced motion.
  const [n, setN] = useState(QUESTION.length);
  const [answered, setAnswered] = useState(true);

  useEffect(() => {
    if (!inView || reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      setN(0);
      setAnswered(false);
      let i = 0;
      const type = () => {
        i += 1;
        setN(i);
        if (i < QUESTION.length) t = setTimeout(type, 55 + (i % 4) * 14);
        else {
          t = setTimeout(() => {
            setAnswered(true);
            t = setTimeout(run, 5200);
          }, 650);
        }
      };
      t = setTimeout(type, 500);
    };
    t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, [inView, reduce]);

  const typing = n < QUESTION.length;

  return (
    <div
      ref={ref}
      className="relative flex h-full min-h-[460px] flex-col justify-between overflow-hidden rounded-[24px] bg-[var(--w-ember)] p-7 text-[var(--w-ink)] md:p-10"
    >
      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-[var(--w-ink)]/10">
        <Store size={22} strokeWidth={1.6} />
      </span>
      <div>
        <p className="sr-only">{QUESTION}</p>
        <p aria-hidden className="min-h-[2.1em] text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
          {QUESTION.slice(0, n)}
          <span className={`${typing || !answered ? "" : "w-blink"} ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.1em] bg-[var(--w-ink)]`} />
        </p>
        <p className="mt-5 max-w-[440px] text-[17px] leading-[1.5]">
          Asked at every counter, every day — and answered by a spreadsheet, a WhatsApp group and a guess.
        </p>
        <div
          className={`${styles.answer} mt-7 flex items-center gap-3 rounded-2xl bg-[var(--w-ink)] p-3 pr-4 text-[var(--w-fg-ink)] shadow-[0_20px_40px_-20px_rgb(20_20_19/0.7)]`}
          style={{ opacity: answered ? 1 : 0, transform: answered ? "none" : "translate3d(0,12px,0)" }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--w-success)] text-white">
            <Check size={18} strokeWidth={2.4} aria-hidden />
          </span>
          <span className="min-w-0 text-[15px] font-medium leading-snug">
            <span className="w-mono tabular-nums">18:00</span> · Field 2 · <span className="text-[#7fe0a6]">Free</span> ·{" "}
            <span className="tabular-nums">৳2,000</span>
            <span className="block text-[12px] font-normal text-[var(--w-muted-ink)]">Counterfoil’s answer, live</span>
          </span>
        </div>
      </div>
    </div>
  );
}
