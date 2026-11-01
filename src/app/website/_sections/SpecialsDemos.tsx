"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, Lock, Armchair, Scan, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion, useSequence } from "../_components/motion";

/* Six small stages for the Specials grid. Each is a white mini-UI on a dotted
   ground that loops while in view and rests on a complete frame otherwise. */

function useDemo(durations: readonly number[]) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, threshold: 0.3, margin: "0px" });
  const step = useSequence(durations, inView);
  return { ref, step };
}

function Stage({ stageRef, children }: { stageRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <div ref={stageRef} aria-hidden className="cf-dots grid h-[180px] place-items-center overflow-hidden rounded-xl px-4">
      <div className="w-full max-w-[250px] rounded-card bg-card p-3 text-[12px] text-fg shadow-card">{children}</div>
    </div>
  );
}

const taka = (n: number) => "৳" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Eases a displayed number toward `target`, like a till total ticking. */
function useTween(target: number, ms = 600) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduce) return;
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const val = a + (target - a) * (1 - Math.pow(1 - k, 3));
      from.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return reduce ? target : v;
}

/* 1 ── seats get picked */
const CHOSEN = [11, 12, 13];
export function SeatsDemo() {
  const { ref, step } = useDemo([900, 600, 600, 600, 2600]);
  const n = Math.min(step, 3);
  return (
    <Stage stageRef={ref}>
      <p className="mb-2 text-center text-[12px] font-medium tracking-wide text-muted">SCREEN</p>
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 24 }, (_, i) => {
          const taken = [2, 3, 8, 17, 20].includes(i);
          const sel = CHOSEN.indexOf(i);
          const on = sel > -1 && sel < n;
          return (
            <span
              key={i}
              className={cn(
                "h-4 rounded-[5px] transition-colors duration-300",
                taken ? "bg-neutral-200" : on ? "bg-ember-solid" : "bg-ember-wash",
              )}
            />
          );
        })}
      </div>
      <div
        className={cn(
          "mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors duration-300",
          n === 3 ? "bg-ember-solid text-on-solid" : "bg-subtle text-muted",
        )}
      >
        <Armchair size={13} strokeWidth={1.8} />
        {n === 3 ? "Add 3 seats — ৳1,200.00" : n === 0 ? "Choose seats" : `${n} selected`}
      </div>
    </Stage>
  );
}

/* 2 ── one scan, the whole family */
export function FamilyDemo() {
  const { ref, step } = useDemo([900, 500, 500, 500, 500, 2600]);
  const n = Math.min(4, Math.max(0, step - 1));
  const done = step >= 5;
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center justify-between">
        <span className="cf-mono text-[12px] text-muted">CF-2026-001053</span>
        <span className="text-[12px] text-muted">Family</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-control bg-ember-wash px-2.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-brand-foreground">
          <Scan size={15} strokeWidth={1.8} /> ADMIT 4
        </span>
        <span className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-2.5 w-2.5 rounded-full transition-colors duration-300", i < n ? "bg-ember-solid" : "bg-neutral-200")} />
          ))}
        </span>
      </div>
      <p className={cn("mt-2 flex items-center gap-1 text-[12px] transition-colors", done ? "text-success" : "text-muted")}>
        {done ? (
          <>
            <Check size={12} strokeWidth={2.4} /> Admitted · 4 of 4
          </>
        ) : (
          `Scanning · ${n} of 4`
        )}
      </p>
    </Stage>
  );
}

/* 3 ── taka to the paisa */
export function TakaDemo() {
  const { ref, step } = useDemo([700, 900, 900, 2600]);
  const total = useTween(step <= 0 ? 0 : step === 1 ? 1000 : 1400);
  return (
    <Stage stageRef={ref}>
      {[
        { n: "Adult × 2", a: "1,000.00", v: "VAT 15%", at: 1 },
        { n: "Evening Film", a: "400.00", v: "VAT 7.5%", at: 2 },
      ].map((l) => (
        <div key={l.n} className={cn("flex items-center gap-2 py-1.5 transition-opacity duration-500", step >= l.at ? "opacity-100" : "opacity-0")}>
          <span className="min-w-0 flex-1 truncate">{l.n}</span>
          <span className="rounded-full bg-subtle px-1.5 text-[12px] text-muted">{l.v}</span>
          <span className="w-[62px] text-right">৳{l.a}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between rounded-control bg-ember-wash px-2 py-1.5 text-[13px] font-semibold">
        <span>Total</span>
        <span className="text-brand-foreground">{taka(total)}</span>
      </div>
    </Stage>
  );
}

/* 4 ── Bangla and English */
export function LanguageDemo() {
  const { ref, step } = useDemo([2400, 2400]);
  const bn = step === 1;
  const layer = (show: boolean, lang: "en" | "bn") => (
    <div
      lang={lang}
      className={cn("col-start-1 row-start-1 transition-[opacity,filter] duration-700", show ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[3px]")}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{lang === "en" ? "Family ticket" : "পারিবারিক টিকিট"}</span>
        <span>{lang === "en" ? "৳1,400.00" : "৳১,৪০০.০০"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-muted">
        <span>{lang === "en" ? "4 people" : "৪ জন"}</span>
        <span>{lang === "en" ? "Total" : "মোট"}</span>
      </div>
      <div className="mt-3 flex h-9 items-center justify-center rounded-full bg-ember-solid text-[12px] font-semibold text-on-solid">{lang === "en" ? "Charge" : "পরিশোধ নিন"}</div>
    </div>
  );
  return (
    <Stage stageRef={ref}>
      <div className="mb-2 flex gap-1 rounded-full bg-subtle p-0.5 w-fit">
        {["EN", "বাংলা"].map((l, i) => (
          <span key={l} className={cn("rounded-full px-2 py-0.5 text-[12px] transition-colors duration-500", (i === 1) === bn ? "bg-ember-solid text-on-solid" : "bg-subtle text-muted")}>
            {l}
          </span>
        ))}
      </div>
      <div className="grid">
        {layer(!bn, "en")}
        {layer(bn, "bn")}
      </div>
    </Stage>
  );
}

/* 5 ── holds */
export function HoldsDemo() {
  const { ref, step } = useDemo([900, 900, 2400, 1000, 1200]);
  const held = step === 1 || step === 2 || step === 3;
  const left = held ? 7 : 32;
  return (
    <Stage stageRef={ref}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Planetarium Show · 12:30</span>
        <span className="cf-mono text-[12px] text-muted">{left} left</span>
      </div>
      <div className="relative mt-2 flex h-4 overflow-hidden rounded bg-subtle">
        <span className="h-full bg-neutral-300" style={{ width: "20%" }} />
        <span
          className="h-full transition-[width] duration-700 ease-[var(--cf-ease)]"
          style={{
            width: held ? "62.5%" : "0%",
            backgroundImage: "repeating-linear-gradient(135deg, var(--color-ember) 0 2px, var(--color-brand-100) 2px 6px)",
          }}
        />
      </div>
      <div className="mt-3 h-7">
        {held && (
          <div key={step === 3 ? "r" : "h"} className="cf-arrive flex h-8 items-center gap-1.5 rounded-control bg-ember-wash px-2 text-[12px] text-brand-foreground">
            <Lock size={12} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate">Held · School group · 25 places</span>
          </div>
        )}
        {step === 4 && (
          <div className="cf-arrive flex h-7 items-center gap-1.5 text-[12px] text-success">
            <Check size={12} strokeWidth={2.4} /> Released · on sale again
          </div>
        )}
      </div>
    </Stage>
  );
}

/* 6 ── repeat weekly */
const WEDS = ["4 Nov", "11 Nov", "18 Nov", "25 Nov", "2 Dec", "9 Dec", "16 Dec"];
export function RepeatDemo() {
  const { ref, step } = useDemo([700, 220, 220, 220, 220, 220, 220, 220, 700, 2600]);
  const shown = Math.min(7, Math.max(0, step - 0));
  const skipped = step >= 8;
  const done = step >= 9;
  return (
    <Stage stageRef={ref}>
      <div className="mb-2 flex items-center gap-1.5 font-medium">
        <Repeat size={13} strokeWidth={1.8} className="text-brand-foreground" /> Repeat weekly
      </div>
      <div className="grid grid-cols-4 gap-1">
        {WEDS.map((d, i) => {
          const taken = i === 2;
          return (
            <span
              key={d}
              className={cn(
                "rounded px-1 py-1 text-center text-[12px] transition-all duration-300",
                i < shown ? "opacity-100" : "opacity-0",
                taken && skipped ? "bg-danger-wash text-danger line-through" : "bg-ember-wash text-brand-foreground",
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
      <p className={cn("mt-2 text-[12px] leading-snug text-muted transition-opacity duration-500", done ? "opacity-100" : "opacity-0")}>
        Next 7 Wednesdays at 18:00 · 1 already taken — skipped
      </p>
    </Stage>
  );
}
