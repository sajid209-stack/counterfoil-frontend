"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Radio } from "lucide-react";
import { useInView, useReducedMotion, useTicker } from "../_components/motion";
import styles from "./System.module.css";

const TILLS = ["Fort Main Gate", "Museum Shop"] as const;
const CAP = 40;
const START_SEATS = 18;
const BASE_REVENUE = 8500;
/** Seeded demo sales for "Planetarium Show · 11:00", landing alternately at the two tills. */
const SALES = [
  { till: 0, desc: "2 Adult", seats: 2, amount: 1000, at: "10:41" },
  { till: 1, desc: "1 Family", seats: 4, amount: 1400, at: "10:43" },
  { till: 0, desc: "1 Adult", seats: 1, amount: 500, at: "10:44" },
  { till: 1, desc: "2 Adult", seats: 2, amount: 1000, at: "10:46" },
  { till: 0, desc: "1 Family", seats: 4, amount: 1400, at: "10:47" },
] as const;
const STILL_SALES = 3; // what reduced motion shows
const BAND = 64; // height of the connector band, px

const money = (n: number) => `৳${n.toLocaleString("en-US")}`;

export function SystemSync() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const reduce = useReducedMotion();
  const idx = useTicker(7, 2500, inView && !reduce); // 0 reset · 1–5 a sale lands · 6 hold the floor
  const done = reduce ? STILL_SALES : Math.min(idx, SALES.length);
  const landed = !reduce && idx >= 1 && idx <= SALES.length ? SALES[idx - 1] : null;

  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sold = SALES.slice(0, done);
  const seats = START_SEATS - sold.reduce((a, s) => a + s.seats, 0);
  const revenue = BASE_REVENUE + sold.reduce((a, s) => a + s.amount, 0);
  const feed = sold.map((s, i) => ({ ...s, i })).reverse().slice(0, 3);

  // connector geometry, in real pixels so strokes never distort
  const gap = 16;
  const tc = [(w - gap) / 4, w - (w - gap) / 4];
  const os = [w / 2 - 90, w / 2 + 90];
  const toOS = (t: number) => `M ${tc[t]} ${BAND} C ${tc[t]} ${BAND * 0.4}, ${os[t]} ${BAND * 0.6}, ${os[t]} 0`;
  const across = (t: number) => `M ${tc[t]} ${BAND} C ${tc[t]} ${BAND * 0.05}, ${tc[1 - t]} ${BAND * 0.05}, ${tc[1 - t]} ${BAND}`;

  return (
    <div ref={ref} aria-hidden className="mx-auto w-full max-w-[860px] select-none">
      {/* OS */}
      <div className="w-panel-ink mx-auto w-full max-w-[560px] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="w-eyebrow text-[12px] text-[var(--w-muted-ink)]">Counterfoil OS</span>
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--w-ember-soft)]">
            <Radio size={13} strokeWidth={1.8} /> Live
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">Planetarium Show · 11:00</p>
            <p className="mt-1 text-[12px] text-[var(--w-muted-ink)]">Seats left of {CAP}</p>
          </div>
          <p className="text-right text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">
            <span key={`os-${seats}`} className={landed ? styles.pop : "inline-block"}>
              {seats}
            </span>
          </p>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`${styles.bar} h-full w-full rounded-full bg-[var(--w-ember)]`} style={{ transform: `scaleX(${seats / CAP})` }} />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--w-line-ink)] pt-3">
          <span className="text-[12px] text-[var(--w-muted-ink)]">Session revenue</span>
          <span key={`rev-${revenue}`} className={`text-[18px] font-semibold tabular-nums ${landed ? styles.pop : ""}`}>
            {money(revenue)}
          </span>
        </div>
        <ul className="mt-3 h-[108px] space-y-1.5 overflow-hidden">
          {feed.length === 0 && <li className="pt-2 text-[13px] text-[var(--w-muted-ink)]">Waiting for the next sale…</li>}
          {feed.map((f) => (
            <li
              key={f.i}
              className={`${landed && f.i === done - 1 ? styles.enter : ""} flex h-8 items-center gap-2 rounded-lg bg-white/[0.04] px-3 text-[13px]`}
            >
              <span className="w-mono shrink-0 text-[12px] text-[var(--w-muted-ink)]">{f.at}</span>
              <span className="min-w-0 flex-1 truncate">
                {TILLS[f.till]} · {f.desc}
              </span>
              <span className="shrink-0 tabular-nums">{money(f.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* connectors */}
      <div className="relative" style={{ height: BAND }}>
        {w > 0 && (
          <svg width={w} height={BAND} viewBox={`0 0 ${w} ${BAND}`} className="absolute inset-0 overflow-visible" fill="none">
            {[0, 1].map((t) => (
              <g key={t} stroke="rgb(245 242 235 / 0.16)" strokeWidth={1.25} strokeDasharray="3 5" strokeLinecap="round">
                <path d={toOS(t)} />
              </g>
            ))}
            <path d={across(0)} stroke="rgb(245 242 235 / 0.1)" strokeWidth={1.25} strokeDasharray="3 5" strokeLinecap="round" />
            {landed && (
              <g key={idx} stroke="#f94a00" strokeWidth={2} strokeLinecap="round">
                <path d={toOS(landed.till)} pathLength={1} className={styles.lit} />
                <path d={across(landed.till)} pathLength={1} className={styles.lit} style={{ animationDelay: "250ms" }} />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Go tills */}
      <div className="grid grid-cols-2 gap-4">
        {TILLS.map((name, t) => {
          const hit = landed?.till === t;
          const last = [...sold].reverse().find((s) => s.till === t);
          const shown = hit ? landed : last;
          return (
            <div key={name} className="w-panel-ink min-w-0 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="w-eyebrow text-[12px] text-[var(--w-muted-ink)]">Go</span>
                <span className="truncate text-[12px] font-medium sm:text-[13px]">{name}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--w-muted-ink)]">Seats left</span>
                <span key={`t${t}-${seats}`} className={`text-[22px] font-semibold tabular-nums ${landed ? styles.pop : ""}`}>
                  {seats}
                </span>
              </div>
              <p className="mt-2 h-5 truncate text-[12px] text-[var(--w-muted-ink)] sm:text-[13px]">
                {shown ? `${shown.desc} · ${money(shown.amount)}` : "No sales yet"}
              </p>
              <span
                key={hit ? `p${idx}` : "idle"}
                className={`${hit ? styles.press : ""} mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium ${
                  hit ? "bg-[var(--w-ember)] text-[var(--w-ink)]" : "bg-white/[0.08] text-[var(--w-fg-ink)]"
                }`}
              >
                {hit ? (
                  <>
                    <Check size={14} strokeWidth={2.4} /> Sold
                  </>
                ) : (
                  "Charge"
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
