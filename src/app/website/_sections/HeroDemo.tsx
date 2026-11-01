"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, LayoutDashboard, CalendarDays, Receipt, BarChart3, ScanLine, ArrowLeft, Minus, Plus } from "lucide-react";
import { Cursor, Window } from "../_components/ui";
import { useInView, useReducedMotion, useSequence } from "../_components/motion";
import { cn } from "@/lib/cn";

/** Width of an element, kept current. 0 until measured. */
export function useBoxWidth<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const money = (n: number) => `৳${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A number that eases to its new value by writing the DOM, not state. */
function Tick({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || from.current === value) {
      from.current = value;
      el.textContent = format(value);
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const run = (t: number) => {
      const k = Math.min(1, (t - t0) / 800);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      el.textContent = format(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return <span ref={ref}>{format(value)}</span>;
}

/* The story, in beats. Index = step; the till is 520x500, cursor coordinates are
   in the till's own pixels. */
const STEPS = [700, 1000, 450, 900, 900, 450, 800, 400, 250, 400, 1000, 450, 1500, 1900, 2200, 800];
const CURSOR: Array<{ x: number; y: number; click?: boolean }> = [
  { x: 250, y: 430 },
  { x: 226, y: 122 },
  { x: 226, y: 122, click: true },
  { x: 226, y: 122 },
  { x: 150, y: 112 },
  { x: 150, y: 112, click: true },
  { x: 288, y: 312 },
  { x: 288, y: 312, click: true },
  { x: 288, y: 312 },
  { x: 288, y: 312, click: true },
  { x: 400, y: 462 },
  { x: 400, y: 462, click: true },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
];

const PRODUCTS = [
  ["General Admission", "৳500.00"],
  ["Planetarium Show", "From ৳500.00"],
  ["Heritage Walking Tour", "10:00 · 14:00"],
  ["Football Field", "From ৳1,500.00"],
  ["Bowling Lanes", "From ৳800.00"],
  ["Deep Tissue Massage", "৳3,000.00"],
];
const SESSIONS = [
  ["11:00", "18 left"],
  ["11:45", "32 left"],
  ["12:30", "40 left"],
];

function Till({ step }: { step: number }) {
  const picked = step >= 5;
  const qty = step >= 9 ? 2 : step >= 7 ? 1 : 0;
  const sub = qty * 500;
  const vat = qty * 75;
  const paying = step >= 12;
  const paid = step >= 13;
  return (
    <Window
      className="flex h-full flex-col"
      bodyClassName="relative flex min-h-0 flex-1"
      title="Fort Main Gate · Nadia Islam"
      right={
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--cf-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
          Counterfoil Go
        </span>
      }
    >
      {/* selling pane */}
      <div className="relative w-[320px] shrink-0 overflow-hidden p-3">
        <div className="mb-3 flex gap-1.5 text-[12px]">
          {["All", "Attractions", "Courts", "Services"].map((c, i) => (
            <span key={c} className={cn("rounded-full border px-2.5 py-1", i === 0 ? "border-[var(--cf-fg)] bg-[var(--cf-fg)] text-white" : "border-[var(--cf-line)] text-[var(--cf-muted)]")}>
              {c}
            </span>
          ))}
        </div>
        {step < 3 ? (
          <div className="grid grid-cols-2 gap-2">
            {PRODUCTS.map(([name, sub2], i) => (
              <div
                key={name}
                className={cn(
                  "h-[72px] rounded-lg border p-2.5 transition-colors duration-300",
                  i === 1 && step === 2 ? "border-[var(--cf-accent)] bg-[var(--cf-accent-wash)]" : "border-[var(--cf-line)] bg-[var(--cf-bg)]",
                )}
              >
                <p className="text-[13px] font-medium leading-tight text-[var(--cf-fg)]">{name}</p>
                <p className="cf-mono mt-1 text-[12px] text-[var(--cf-muted)]">{sub2}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="cf-arrive">
            <div className="mb-2 flex h-6 items-center gap-1.5 text-[13px] font-medium">
              <ArrowLeft size={14} strokeWidth={1.8} className="text-[var(--cf-muted)]" />
              Planetarium Show
              <span className="ml-auto text-[12px] font-normal text-[var(--cf-muted)]">Today</span>
            </div>
            <div className="space-y-2">
              {SESSIONS.map(([t, left], i) => (
                <div
                  key={t}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-lg border px-3 transition-colors duration-300",
                    i === 0 && picked ? "border-[var(--cf-accent)] bg-[var(--cf-accent-wash)]" : "border-[var(--cf-line)]",
                  )}
                >
                  <span className="cf-mono text-[13px] font-medium">{t}</span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--cf-bg-3)]">
                    <span className="block h-full rounded-full bg-[var(--cf-fg)]/70" style={{ width: `${(i === 0 ? 22 : i === 1 ? 8 : 0) * 2.5}%` }} />
                  </span>
                  <span className="text-[12px] text-[var(--cf-muted)]">{left}</span>
                </div>
              ))}
            </div>
            {picked && (
              <div className="cf-arrive mt-4">
                <p className="cf-label mb-1.5">Tickets</p>
                <div className="flex h-12 items-center rounded-lg border border-[var(--cf-line)] px-3">
                  <span className="text-[13px] font-medium">Adult</span>
                  <span className="cf-mono ml-2 text-[12px] text-[var(--cf-muted)]">৳500.00</span>
                  <span className="ml-auto flex items-center">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--cf-line)] text-[var(--cf-muted)]">
                      <Minus size={13} />
                    </span>
                    <span className="cf-mono w-7 text-center text-[13px]">{qty}</span>
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--cf-line-2)] text-[var(--cf-fg)]">
                      <Plus size={13} />
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* cart pane */}
      <div className="relative flex min-w-0 flex-1 flex-col border-l border-[var(--cf-line)] bg-[var(--cf-bg-2)] p-3">
        <p className="text-[13px] font-medium">Current sale</p>
        {qty === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--cf-muted)]">Nothing added yet.</p>
        ) : (
          <div className="cf-arrive mt-3 rounded-lg border border-[var(--cf-line)] bg-[var(--cf-bg)] p-2.5">
            <p className="text-[13px] font-medium leading-tight">Planetarium Show</p>
            <p className="mt-0.5 text-[12px] text-[var(--cf-muted)]">11:00 · Adult × {qty}</p>
            <p className="cf-mono mt-1 text-[13px]">{money(sub)}</p>
          </div>
        )}
        <div className="mt-auto space-y-1 text-[12px] text-[var(--cf-muted)]">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span className="cf-mono text-[var(--cf-fg)]">{money(sub)}</span>
          </p>
          <p className="flex justify-between">
            <span>VAT 15%</span>
            <span className="cf-mono text-[var(--cf-fg)]">{money(vat)}</span>
          </p>
        </div>
        <div className="mt-2.5 flex gap-1.5 text-[12px]">
          {["Cash", "bKash", "Card"].map((m) => (
            <span key={m} className={cn("flex-1 rounded-md border py-1 text-center", m === "bKash" ? "border-[var(--cf-accent)] bg-[var(--cf-accent-wash)] text-[var(--cf-fg)]" : "border-[var(--cf-line)] text-[var(--cf-muted)]")}>
              {m}
            </span>
          ))}
        </div>
        <div
          className={cn(
            "mt-2 grid h-9 place-items-center rounded-[10px] text-[12px] font-medium text-white transition-all duration-300",
            qty === 2 ? "bg-[var(--cf-fg)]" : "bg-[var(--cf-dim)]",
            step === 11 && "scale-[0.98]",
          )}
        >
          {qty === 2 ? "Charge ৳1,150.00 — bKash" : "Charge"}
        </div>

        {paying && (
          <div className="cf-arrive absolute inset-0 z-10 flex flex-col bg-[var(--cf-bg)] p-3">
            {!paid ? (
              <>
                <p className="text-[13px] font-medium">Waiting for bKash…</p>
                <p className="cf-mono mt-0.5 text-[12px] text-[var(--cf-muted)]">৳1,150.00</p>
                <div className="cf-skeleton mt-4 h-3 w-4/5 rounded" />
                <div className="cf-skeleton mt-2 h-3 w-3/5 rounded" />
                <div className="cf-skeleton mt-6 h-24 rounded-lg" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="cf-pop grid h-7 w-7 place-items-center rounded-full bg-[var(--cf-green-wash)] text-[var(--cf-green)]">
                    <Check size={15} strokeWidth={2.4} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--cf-green)]">Paid</p>
                    <p className="text-[12px] text-[var(--cf-muted)]">bKash · ৳1,150.00</p>
                  </div>
                </div>
                <div className="cf-arrive mt-4 rounded-lg border border-dashed border-[var(--cf-line-2)] p-3">
                  <p className="cf-label">Ticket</p>
                  <p className="cf-mono mt-1 text-[13px] font-medium">CF-2026-001054</p>
                  <p className="mt-2 text-[12px] leading-snug text-[var(--cf-muted)]">Planetarium Show · 11:00 · 2 × Adult</p>
                  <div className="mt-3 grid grid-cols-8 gap-[3px]" aria-hidden>
                    {Array.from({ length: 32 }, (_, i) => (
                      <span key={i} className={cn("h-2 rounded-[1px]", [0, 3, 4, 7, 9, 12, 14, 17, 18, 21, 22, 25, 27, 30].includes(i) ? "bg-[var(--cf-fg)]" : "bg-[var(--cf-line-2)]")} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Window>
  );
}

function OsWindow({ step }: { step: number }) {
  const sold = step >= 13;
  const feed = [
    ...(sold ? [["CF-2026-001054", "bKash", "৳1,150.00", "just now"]] : []),
    ["CF-2026-001053", "Cash", "৳500.00", "4 min ago"],
    ["CF-2026-001052", "bKash", "৳1,400.00", "9 min ago"],
    ["CF-2026-001051", "Card", "৳800.00", "14 min ago"],
  ].slice(0, 3);
  const left = sold ? 16 : 18;
  return (
    <Window className="flex h-full flex-col" bodyClassName="flex min-h-0 flex-1" title="Counterfoil OS · Today">
      <div className="flex w-12 shrink-0 flex-col items-center gap-3.5 border-r border-[var(--cf-line)] bg-[var(--cf-bg-2)] pt-3.5 text-[var(--cf-muted)]">
        {[LayoutDashboard, CalendarDays, Receipt, BarChart3].map((I, i) => (
          <I key={i} size={15} strokeWidth={1.7} className={i === 0 ? "text-[var(--cf-fg)]" : undefined} />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="cf-cells grid-cols-2 border-b border-[var(--cf-line)]">
          <div className="p-3.5">
            <p className="cf-label">Revenue today</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight">
              <Tick value={sold ? 39600 : 38450} format={money} />
            </p>
          </div>
          <div className="p-3.5">
            <p className="cf-label">Tickets sold</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight">
              <Tick value={sold ? 66 : 64} format={(n) => String(Math.round(n))} />
            </p>
          </div>
        </div>
        <div className="border-b border-[var(--cf-line)] p-3.5">
          <p className="cf-label mb-2">Up next</p>
          {[
            ["11:00", "Planetarium Show", left, 40],
            ["11:45", "Planetarium Show", 32, 40],
            ["12:30", "Planetarium Show", 40, 40],
          ].map(([t, name, l, cap], i) => (
            <div key={t as string} className="flex h-8 items-center gap-3 text-[12px]">
              <span className="cf-mono w-11 text-[var(--cf-fg)]">{t}</span>
              <span className="w-32 truncate text-[var(--cf-fg-2)]">{name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--cf-bg-3)]">
                <span className={cn("block h-full rounded-full bg-[var(--cf-fg)]/70 transition-[width] duration-[900ms] ease-[var(--cf-ease)]", i === 0 && "bg-[var(--cf-accent)]")} style={{ width: `${((l as number) / (cap as number)) * 100}%` }} />
              </span>
              <span className="w-14 text-right text-[var(--cf-muted)]">{l} left</span>
            </div>
          ))}
        </div>
        <div className="p-3.5">
          <p className="cf-label mb-2 flex items-center gap-2">
            Live activity
            <span className="cf-live h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
          </p>
          {feed.map(([code, via, amt, when], i) => (
            <div key={code} className={cn("flex h-9 items-center gap-2 border-t border-[var(--cf-line)] text-[12px]", i === 0 && sold && "cf-arrive")}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cf-green)]" />
              <span className="min-w-0 flex-1 truncate text-[var(--cf-fg-2)]">
                <span className="cf-mono">{code}</span> paid · {via} · {amt}
              </span>
              <span className="shrink-0 text-[var(--cf-muted)]">{when}</span>
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

function Toast() {
  return (
    <div className="cf-chip cf-pop flex items-center gap-2.5 px-3 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--cf-green-wash)] text-[var(--cf-green)]">
        <ScanLine size={15} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-[13px] font-medium leading-tight">Admit 2</p>
        <p className="text-[12px] text-[var(--cf-muted)]">Planetarium Show 11:00 · Gate scan</p>
      </div>
    </div>
  );
}

export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const step = useSequence(STEPS, inView);
  const w = useBoxWidth(ref) || 1064;
  const wide = w >= 900;
  const [W, H] = wide ? [1064, 560] : [552, 532];
  const s = Math.min(1, w / W);
  const c = CURSOR[step];
  const stage: CSSProperties = { width: W, height: H, transform: `scale(${s})`, transformOrigin: "top left", left: Math.max(0, (w - W * s) / 2) };
  return (
    <div
      ref={ref}
      aria-hidden
      className="cf-dots relative overflow-hidden rounded-2xl border border-[var(--cf-line)]"
      style={{ height: H * s }}
    >
      <div className="absolute top-0" style={stage}>
        <div className="absolute z-10" style={{ left: wide ? 24 : 16, top: wide ? 28 : 16, width: 520, height: 500 }}>
          <div className="h-full">
            <Till step={step} />
          </div>
          <Cursor x={c.x} y={c.y} click={c.click} />
        </div>
        {wide && (
          <>
            <div className="absolute" style={{ left: 500, top: 48, width: 540, height: 460 }}>
              <OsWindow step={step} />
            </div>
            {step >= 14 && (
              <div className="absolute z-20" style={{ left: 760, top: 430 }}>
                <Toast />
              </div>
            )}
          </>
        )}
        {!wide && step >= 14 && (
          <div className="absolute z-20" style={{ left: 250, top: 440 }}>
            <Toast />
          </div>
        )}
      </div>
    </div>
  );
}
