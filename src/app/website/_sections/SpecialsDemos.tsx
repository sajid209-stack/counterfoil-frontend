"use client";

import { useRef } from "react";
import { Check, Lock, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountUp, useInView, useReducedMotion, useTicker } from "../_components/motion";

/* Live mini-demos for the Specialities bento. Each runs only while in view and
   rests on its end state, still, under reduced motion. Everything is aria-hidden:
   the card's heading and sentence carry the meaning. */

function useLoop(count: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: false, threshold: 0.3 });
  const reduce = useReducedMotion();
  const i = useTicker(count, ms, seen && !reduce);
  return { ref, i, reduce };
}

const PAPER = "rounded-[14px] bg-[var(--w-paper)] text-[var(--w-ink)]";
const EASE = "transition-[opacity,transform] duration-700 [transition-timing-function:var(--w-ease)]";

/* ── Never sold twice ─────────────────────────────────────────────────── */

export function NeverSoldTwice() {
  const { ref, i, reduce } = useLoop(4, 1500);
  const c1 = reduce || i >= 1;
  const c2 = reduce || i >= 2;
  const tiles = [
    { till: "Counter 1", on: c1, label: "Sold" },
    { till: "Counter 2", on: c2, label: "Taken" },
  ];
  return (
    <div ref={ref} aria-hidden className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      {tiles.map(({ till, on, label }, k) => (
        <div key={till} className={cn(PAPER, EASE, "flex h-[84px] flex-col justify-center px-4", k === 1 && on && "opacity-60")}>
          <p className="text-[13px] text-[var(--w-muted)]">{till} · Field 1</p>
          <p className="mt-1 flex items-center justify-between gap-2">
            <span className={cn("text-[18px] font-semibold tabular-nums", k === 1 && on && "line-through")}>6:00 PM</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none",
                EASE,
                on ? (k === 0 ? "bg-[var(--w-ink)] text-[var(--w-paper)]" : "bg-[var(--w-line)] text-[var(--w-muted)]") : "bg-[var(--w-ember-wash)] text-[var(--w-ember-text)]",
              )}
            >
              {on ? label : "Open"}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── One scan, the whole family ───────────────────────────────────────── */

export function FamilyScan() {
  const { ref, i, reduce } = useLoop(6, 900);
  const n = reduce ? 4 : Math.min(i, 4);
  return (
    <div ref={ref} aria-hidden className={cn(PAPER, "flex h-[84px] items-center justify-between gap-3 px-4")}>
      <div className="min-w-0">
        <p className="text-[20px] font-bold leading-none tracking-[-0.01em]">ADMIT 4</p>
        <p className="mt-1.5 text-[13px] text-[var(--w-muted)]">Family · {n} of 4 in</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {[0, 1, 2, 3].map((k) => (
          <span
            key={k}
            className={cn(
              "grid h-[30px] w-[30px] place-items-center rounded-full",
              EASE,
              k < n ? "scale-100 bg-[var(--w-success)] text-white" : "scale-90 text-[var(--w-muted)] ring-1 ring-inset ring-[var(--w-line)]",
            )}
          >
            {k < n ? <Check size={15} strokeWidth={2.6} /> : <UserRound size={14} strokeWidth={1.8} />}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Seat map ─────────────────────────────────────────────────────────── */

const SOLD = new Set(["0-4", "0-5", "3-6", "3-7", "4-0", "4-1"]);
const PICKS = ["2-3", "2-4", "2-5"];

export function SeatDemo() {
  const { ref, i, reduce } = useLoop(6, 1000);
  const n = reduce ? 3 : Math.min(i, 3);
  const picked = new Set(PICKS.slice(0, n));
  return (
    <div ref={ref} aria-hidden className={cn(PAPER, "p-4")}>
      <p className="w-mono rounded-md bg-[var(--w-paper-2)] py-1 text-center text-[12px] uppercase tracking-[0.2em] text-[var(--w-muted)]">Screen</p>
      <div className="mt-3 grid grid-cols-9 gap-1.5">
        {Array.from({ length: 45 }, (_, k) => {
          const key = `${Math.floor(k / 9)}-${k % 9}`;
          const sold = SOLD.has(key);
          const on = picked.has(key);
          return (
            <span
              key={key}
              className={cn(
                "aspect-square rounded-[5px] border transition-colors duration-500",
                sold ? "border-transparent bg-[var(--w-line)]" : on ? "border-[var(--w-ember)] bg-[var(--w-ember)]" : "border-[var(--w-ember)]/50 bg-[var(--w-ember-wash)]",
              )}
            />
          );
        })}
      </div>
      <p className="mt-3 flex items-center justify-between gap-2 rounded-full bg-[var(--w-ember)] px-4 py-2 text-[13px] font-semibold text-[var(--w-ink)]">
        <span>{n ? `Add ${n} seats` : "Pick your seats"}</span>
        <span className="tabular-nums">{n ? `৳${(n * 400).toLocaleString("en-US")}.00` : "Stalls · ৳400"}</span>
      </p>
    </div>
  );
}

/* ── Taka to the paisa, VAT per line ──────────────────────────────────── */

const money = (n: number) => `৳${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Receipt() {
  const rows: [string, number][] = [
    ["Subtotal", 900],
    ["VAT 15%", 135],
    ["Total", 1035],
  ];
  return (
    <div aria-hidden className={cn(PAPER, "w-mono p-4 text-[13px]")}>
      <div className="flex justify-between gap-3 border-b border-dashed border-[var(--w-line)] pb-2 text-[var(--w-muted)]">
        <span>Planetarium Show ×2</span>
        <span>{money(600)}</span>
      </div>
      <div className="flex justify-between gap-3 border-b border-dashed border-[var(--w-line)] py-2 text-[var(--w-muted)]">
        <span>Gift shop</span>
        <span>{money(300)}</span>
      </div>
      <dl className="pt-2">
        {rows.map(([k, v]) => (
          <div key={k} className={cn("flex justify-between gap-3 py-[3px]", k === "VAT 15%" && "font-semibold text-[var(--w-ember-text)]", k === "Total" && "text-[15px] font-semibold")}>
            <dt>{k}</dt>
            <dd>
              <CountUp value={v} format={money} duration={1200} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12px] text-[var(--w-muted)]">15% or 7.5%, worked per line.</p>
    </div>
  );
}

/* ── Bangla + English ─────────────────────────────────────────────────── */

export function Bilingual() {
  const { ref, i, reduce } = useLoop(2, 2200);
  const bn = i === 1;
  const words = [
    { lang: "bn", script: "বাংলা", said: "টিকিট ইস্যু হয়েছে" },
    { lang: "en", script: "English", said: "Ticket issued" },
  ];
  if (reduce)
    return (
      <div ref={ref} aria-hidden className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {words.map((w) => (
          <div key={w.lang} lang={w.lang} className={cn(PAPER, "px-4 py-4")}>
            <p className="text-[32px] font-semibold leading-none tracking-[-0.02em]">{w.script}</p>
            <p className="mt-3 text-[14px] text-[var(--w-muted)]">{w.said}</p>
          </div>
        ))}
      </div>
    );
  return (
    <div ref={ref} aria-hidden className={cn(PAPER, "p-4")}>
      <div className="grid h-[84px] [&>*]:col-start-1 [&>*]:row-start-1">
        {words.map((w) => {
          const on = (w.lang === "bn") === bn;
          return (
            <div key={w.lang} lang={w.lang} className={cn(EASE, on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
              <p className="text-[40px] font-semibold leading-none tracking-[-0.02em]">{w.script}</p>
              <p className="mt-3 flex items-center gap-2 text-[14px] text-[var(--w-muted)]">
                <span className="grid h-[20px] w-[20px] place-items-center rounded-full bg-[var(--w-success)] text-[12px] font-bold text-white">✓</span>
                {w.said}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex rounded-full bg-[var(--w-paper-2)] p-1 text-[13px] font-medium">
        {["বাংলা", "English"].map((l, k) => (
          <span key={l} className={cn("flex-1 rounded-full py-1 text-center transition-colors duration-500", (k === 0) === bn ? "bg-[var(--w-ink)] text-[var(--w-paper)]" : "text-[var(--w-muted)]")}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Holds ────────────────────────────────────────────────────────────── */

export function HoldsDemo() {
  const { ref, i, reduce } = useLoop(4, 1700);
  const held = reduce || (i >= 1 && i < 3);
  const hours = ["09", "10", "11", "12", "13"];
  const cell = "border-l border-t border-[var(--w-line)]";
  return (
    <div ref={ref} aria-hidden className={cn(PAPER, "p-4")}>
      <div className="grid grid-cols-[44px_repeat(5,minmax(0,1fr))] text-[12px] text-[var(--w-muted)]">
        <span />
        {hours.map((h) => (
          <span key={h} className="w-mono pb-1 pl-1">
            {h}:00
          </span>
        ))}
        {["Lane 1", "Lane 2", "Lane 3"].map((l, r) => (
          <div key={l} className="contents">
            <span className="flex h-11 items-center">{l}</span>
            {hours.map((h) => (
              <span key={h + r} className={cn(cell, "h-11", h === "13" && "border-r")} />
            ))}
          </div>
        ))}
      </div>
      {/* Blocks sit over the same grid. */}
      <div className="pointer-events-none relative -mt-[132px] grid h-[132px] grid-cols-[44px_repeat(5,minmax(0,1fr))] grid-rows-3 p-[2px]">
        <span className="col-span-2 col-start-2 row-start-1 flex items-center rounded-md bg-[var(--w-ember-wash)] px-2 text-[12px] font-medium text-[var(--w-ember-text)]">Booked</span>
        <span
          className={cn(
            "col-span-3 col-start-3 row-start-3 flex items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-[var(--w-ink)] ring-1 ring-inset ring-[var(--w-ink)]/30",
            EASE,
            held ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
          style={{ backgroundImage: "repeating-linear-gradient(135deg, rgb(20 20 19 / 0.14) 0 5px, transparent 5px 10px)" }}
        >
          <Lock size={12} strokeWidth={2} />
          Maintenance
        </span>
      </div>
      <p className="mt-3 text-[13px] text-[var(--w-muted)]">Taken off public sale. Who for, and when it goes back, on record.</p>
    </div>
  );
}
