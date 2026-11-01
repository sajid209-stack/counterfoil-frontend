"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Users,
  BarChart3,
  ScanLine,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  Ticket,
  Clock,
  MapPin,
  Disc3,
  Armchair,
  TrendingUp,
  UserCheck,
  CalendarClock,
  Banknote,
  Send,
  QrCode,
  CreditCard,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Cursor } from "../_components/ui";
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

/* The story, in beats. Index = step; the till is 520x500 and cursor coordinates
   are in the till's own pixels. */
const STEPS = [700, 1000, 450, 900, 900, 450, 800, 400, 250, 400, 1000, 450, 1500, 1900, 2200, 800];
const CURSOR: Array<{ x: number; y: number; click?: boolean }> = [
  { x: 250, y: 440 },
  { x: 226, y: 146 },
  { x: 226, y: 146, click: true },
  { x: 226, y: 146 },
  { x: 150, y: 116 },
  { x: 150, y: 116, click: true },
  { x: 276, y: 302 },
  { x: 276, y: 302, click: true },
  { x: 276, y: 302 },
  { x: 276, y: 302, click: true },
  { x: 400, y: 462 },
  { x: 400, y: 462, click: true },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
  { x: 440, y: 470 },
];

const PRODUCTS: Array<{ name: string; price: string; sub: string; free?: string; Icon: LucideIcon }> = [
  { name: "General Admission", price: "৳500", sub: "Open entry", Icon: Ticket },
  { name: "Planetarium Show", price: "৳500", sub: "Every 45 min", free: "Next 11:00 · 18 left", Icon: Clock },
  { name: "Football Field", price: "৳1,500", sub: "Hourly slots", free: "2 of 2 free", Icon: MapPin },
  { name: "Bowling Lanes", price: "৳800", sub: "From 1 hr", free: "4 of 4 free", Icon: Disc3 },
  { name: "Deep Tissue Massage", price: "৳3,000", sub: "Karim or Nadia", free: "2 of 2 free", Icon: Users },
  { name: "Evening Film", price: "৳400", sub: "Stalls & Balcony", Icon: Armchair },
];
const SESSIONS = [
  ["11:00", "18 left", 55],
  ["11:45", "32 left", 20],
  ["12:30", "40 left", 0],
];
const METHODS: Array<[string, LucideIcon]> = [
  ["Cash", Banknote],
  ["bKash", Send],
  ["Bangla QR", QrCode],
  ["Card", CreditCard],
];

const SURFACE = "bg-[var(--color-surface,#f5f2eb)]";
const CARD = "bg-[var(--color-card,#fff)]";

function Till({ step }: { step: number }) {
  const picked = step >= 5;
  const qty = step >= 9 ? 2 : step >= 7 ? 1 : 0;
  const sub = qty * 500;
  const vat = qty * 75;
  const paying = step >= 12;
  const paid = step >= 13;
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-[18px] shadow-[var(--cf-shadow-lg)]", SURFACE)}>
      <div className="flex h-11 shrink-0 items-center gap-2.5 px-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-go.png" alt="" className="h-[18px] w-auto" />
        <span className="rounded-full bg-[var(--color-subtle,#efece5)] px-2.5 py-1 text-[12px] text-[var(--cf-fg-2)]">Fort Main Gate</span>
        <span className="cf-mono text-[12px] text-[var(--cf-muted)]">Nadia Islam</span>
        <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-[var(--cf-fg)] text-[12px] font-medium text-white">N</span>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* sell wall */}
        <div className="w-[316px] shrink-0 overflow-hidden px-3 pt-1">
          {step < 3 ? (
            <>
              <div className="flex h-7 items-center gap-1.5">
                {["All", "Admission", "Courts", "Events"].map((c, i) => (
                  <span key={c} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", i === 0 ? "bg-[var(--color-ember-solid,#f94a00)] text-white" : cn(CARD, "text-[var(--cf-fg-2)]"))}>
                    {c}
                  </span>
                ))}
                <Search size={14} className="ml-auto text-[var(--cf-muted)]" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PRODUCTS.map(({ name, price, sub: s2, free, Icon }, i) => (
                  <div
                    key={name}
                    className={cn(
                      "h-[104px] rounded-[14px] p-2.5 transition-shadow duration-300",
                      CARD,
                      i === 1 && step === 2 ? "shadow-[0_0_0_2px_var(--cf-accent)]" : "shadow-[var(--cf-shadow)]",
                    )}
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--color-subtle,#efece5)] text-[var(--cf-muted)]">
                      <Icon size={13} strokeWidth={1.8} />
                    </span>
                    <p className="mt-1.5 truncate text-[13px] font-semibold leading-tight text-[var(--cf-fg)]">{name}</p>
                    <p className="text-[18px] font-semibold leading-tight tracking-tight text-[var(--cf-accent)]">{price}</p>
                    <p className="truncate text-[12px] leading-tight text-[var(--cf-muted)]">{s2}</p>
                    {free && (
                      <p className="flex items-center gap-1 truncate text-[12px] leading-tight text-[var(--cf-green)]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cf-green)]" />
                        {free}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="cf-arrive">
              <div className="flex h-7 items-center gap-1.5 text-[13px] font-semibold">
                <ArrowLeft size={14} strokeWidth={1.8} className="text-[var(--cf-muted)]" />
                Planetarium Show
                <span className="ml-auto text-[12px] font-normal text-[var(--cf-muted)]">Today</span>
              </div>
              <div className="mt-3 space-y-2">
                {SESSIONS.map(([t, left, fill], i) => (
                  <div
                    key={t}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-[14px] px-3 transition-shadow duration-300",
                      i === 0 && picked ? "bg-[var(--color-brand-50,#fff5ee)] shadow-[0_0_0_2px_var(--cf-accent)]" : cn(CARD, "shadow-[var(--cf-shadow)]"),
                    )}
                  >
                    <span className="cf-mono text-[13px] font-semibold">{t}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-subtle,#efece5)]">
                      <span className="block h-full rounded-full bg-[var(--cf-accent)]" style={{ width: `${fill}%` }} />
                    </span>
                    <span className="text-[12px] font-medium text-[var(--cf-green)]">{left}</span>
                  </div>
                ))}
              </div>
              {picked && (
                <div className="cf-arrive mt-4">
                  <p className="cf-label mb-2">Tickets</p>
                  <div className={cn("flex h-11 items-center rounded-[14px] px-3 shadow-[var(--cf-shadow)]", CARD)}>
                    <span className="text-[13px] font-semibold">Adult</span>
                    <span className="ml-2 text-[12px] font-semibold text-[var(--cf-accent)]">৳500</span>
                    <span className="ml-auto flex h-8 items-center rounded-full bg-[var(--color-subtle,#efece5)] px-1">
                      <Minus size={13} className="mx-1.5 text-[var(--cf-muted)]" />
                      <span className="w-5 text-center text-[13px] font-semibold">{qty}</span>
                      <Plus size={13} className="mx-1.5 text-[var(--cf-fg)]" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* cart */}
        <div className="relative flex min-w-0 flex-1 flex-col px-3 pb-3 pt-1">
          <div className="flex h-7 items-center justify-between text-[13px] font-semibold">
            {qty} {qty === 1 ? "item" : "items"}
            <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--cf-fg-2)]", CARD)}>Park</span>
          </div>
          {qty === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--cf-muted)]">Nothing added yet.</p>
          ) : (
            <div className={cn("cf-arrive mt-3 rounded-[14px] p-2.5 shadow-[var(--cf-shadow)]", CARD)}>
              <div className="flex justify-between gap-2">
                <p className="text-[13px] font-semibold leading-tight">Planetarium Show</p>
                <p className="shrink-0 text-[13px] font-semibold">{money(sub)}</p>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--cf-muted)]">11:00 · {qty} Adult</p>
              <span className="mt-2 inline-flex h-7 items-center rounded-full bg-[var(--color-subtle,#efece5)] px-1">
                <Minus size={12} className="mx-1.5 text-[var(--cf-muted)]" />
                <span className="w-4 text-center text-[12px] font-semibold">{qty}</span>
                <Plus size={12} className="mx-1.5" />
              </span>
            </div>
          )}
          <div className="mt-auto space-y-1 text-[12px] text-[var(--cf-muted)]">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-[var(--cf-fg)]">{money(sub)}</span>
            </p>
            <p className="flex justify-between">
              <span>VAT 15%</span>
              <span className="text-[var(--cf-fg)]">{money(vat)}</span>
            </p>
          </div>
          <div className={cn("mt-2 grid grid-cols-2 gap-1.5 rounded-[14px] p-1.5", CARD)}>
            {METHODS.map(([m, Icon]) => (
              <span
                key={m}
                className={cn(
                  "flex h-8 items-center justify-center gap-1 rounded-[10px] text-[12px] font-medium",
                  m === "bKash" ? "bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)] shadow-[inset_0_0_0_1.5px_var(--cf-accent)]" : "bg-[var(--color-subtle,#efece5)] text-[var(--cf-muted)]",
                )}
              >
                <Icon size={12} strokeWidth={1.8} />
                {m}
              </span>
            ))}
          </div>
          <div
            className={cn(
              "mt-2 flex h-11 items-center justify-center gap-1 rounded-full text-[12px] font-semibold text-white transition-all duration-300",
              qty === 2 ? "bg-[var(--color-ember-solid,#f94a00)]" : "bg-[var(--color-brand-200,#ffc9a8)]",
              step === 11 && "scale-[0.97]",
            )}
          >
            {qty === 2 ? "Charge ৳1,150.00 — bKash" : "Charge"}
            <ArrowRight size={13} strokeWidth={2.2} />
          </div>

          {paying && (
            <div className={cn("cf-arrive absolute inset-0 z-10 flex flex-col px-3 pb-3 pt-1", SURFACE)}>
              <div className="h-7" />
              {!paid ? (
                <div className={cn("rounded-[14px] p-3 shadow-[var(--cf-shadow)]", CARD)}>
                  <p className="text-[13px] font-semibold">Waiting for bKash…</p>
                  <p className="mt-0.5 text-[12px] text-[var(--cf-muted)]">৳1,150.00</p>
                  <div className="cf-skeleton mt-4 h-3 w-4/5 rounded" />
                  <div className="cf-skeleton mt-2 h-3 w-3/5 rounded" />
                  <div className="cf-skeleton mt-5 h-20 rounded-lg" />
                </div>
              ) : (
                <>
                  <div className={cn("flex items-center gap-2.5 rounded-[14px] p-3 shadow-[var(--cf-shadow)]", CARD)}>
                    <span className="cf-pop grid h-8 w-8 place-items-center rounded-full bg-[var(--cf-green-wash)] text-[var(--cf-green)]">
                      <Check size={16} strokeWidth={2.4} />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--cf-green)]">Paid</p>
                      <p className="text-[12px] text-[var(--cf-muted)]">bKash · ৳1,150.00</p>
                    </div>
                  </div>
                  <div className={cn("cf-arrive mt-2 rounded-[14px] p-3 shadow-[var(--cf-shadow)]", CARD)}>
                    <p className="cf-label">Ticket</p>
                    <p className="cf-mono mt-1 text-[13px] font-semibold">CF-2026-001054</p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--cf-muted)]">Planetarium Show · 11:00 · 2 Adult</p>
                    <div className="mt-3 grid grid-cols-8 gap-[3px]" aria-hidden>
                      {Array.from({ length: 32 }, (_, i) => (
                        <span key={i} className={cn("h-2 rounded-[1px]", [0, 3, 4, 7, 9, 12, 14, 17, 18, 21, 22, 25, 27, 30].includes(i) ? "bg-[var(--cf-fg)]" : "bg-[var(--color-subtle,#efece5)]")} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CHART = "M0 62 C14 60 22 40 36 48 S58 66 72 52 S92 20 106 34 S128 58 142 46 S164 14 180 28 S206 50 222 38 S250 22 266 30 L282 24";

function StatTile({ Icon, label, value, note, pill }: { Icon: LucideIcon; label: string; value: React.ReactNode; note?: string; pill?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[14px] p-2.5 shadow-[var(--cf-shadow)]", CARD)}>
      <div className="flex items-start justify-between">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]">
          <Icon size={14} strokeWidth={1.8} />
        </span>
        {pill && <span className="rounded-full bg-[var(--cf-green-wash)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--cf-green)]">{pill}</span>}
      </div>
      <p className="mt-2 truncate text-[12px] text-[var(--cf-muted)]">{label}</p>
      <p className="truncate text-[16px] font-semibold tracking-tight text-[var(--cf-fg)]">{value}</p>
      {note && <p className="truncate text-[12px] text-[var(--cf-muted)]">{note}</p>}
    </div>
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
    <div className={cn("flex h-full overflow-hidden rounded-[18px] shadow-[var(--cf-shadow-lg)]", SURFACE)}>
      <div className="flex w-12 shrink-0 flex-col items-center gap-3 pt-3.5 text-[var(--cf-muted)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark-plain.png" alt="" className="mb-1 h-5 w-auto" />
        {[LayoutDashboard, CalendarDays, Receipt, Users, BarChart3].map((I, i) => (
          <span key={i} className={cn("grid h-8 w-8 place-items-center rounded-lg", i === 0 && "bg-[var(--color-subtle,#efece5)] text-[var(--cf-fg)]")}>
            <I size={15} strokeWidth={1.7} />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-3 pl-1">
        <div className="flex h-8 items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Lalbagh Heritage Attractions</p>
          </div>
          <span className="flex items-center rounded-lg bg-[var(--color-subtle,#efece5)] p-0.5 text-[12px] font-medium">
            <span className="rounded-md bg-[var(--color-ember-solid,#f94a00)] px-2 py-0.5 text-white">Today</span>
            <span className="px-2 text-[var(--cf-muted)]">This week</span>
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          <StatTile Icon={TrendingUp} label="Revenue today" value={<Tick value={sold ? 39600 : 38450} format={money} />} pill="↗ 3%" />
          <StatTile Icon={Users} label="Tickets sold" value={<Tick value={sold ? 66 : 64} format={(n) => String(Math.round(n))} />} note="of 735 places" />
          <StatTile Icon={UserCheck} label="Arrived" value="3 of 8" note="check-in open" />
          <StatTile Icon={CalendarClock} label="Booked ahead" value="৳29,172.00" note="Next 7 days" />
        </div>
        <div className="mt-2 flex gap-2">
          <div className={cn("min-w-0 flex-1 rounded-[14px] p-2.5 shadow-[var(--cf-shadow)]", CARD)}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[13px] font-semibold">Revenue trend</span>
              <span className="rounded-md bg-[var(--color-ember-solid,#f94a00)] px-1.5 py-0.5 font-medium text-white">30D</span>
            </div>
            <svg viewBox="0 0 282 78" className="mt-2 h-[84px] w-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#f94a00" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#f94a00" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${CHART} L282 78 L0 78 Z`} fill="url(#hero-area)" />
              <path d={CHART} fill="none" stroke="#f94a00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className={cn("w-[176px] shrink-0 rounded-[14px] p-2.5 shadow-[var(--cf-shadow)]", CARD)}>
            <p className="text-[13px] font-semibold">Up next</p>
            {[
              ["11:00", left],
              ["11:45", 32],
              ["12:30", 40],
            ].map(([t, l], i) => (
              <div key={t as string} className="mt-2">
                <div className="flex justify-between text-[12px]">
                  <span className="cf-mono font-medium">{t}</span>
                  <span className="text-[var(--cf-muted)]">{l} left</span>
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-subtle,#efece5)]">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-[900ms] ease-[var(--cf-ease)]", i === 0 ? "bg-[var(--cf-accent)]" : "bg-[var(--color-brand-300,#ffa572)]")}
                    style={{ width: `${((l as number) / 40) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={cn("mt-2 rounded-[14px] px-2.5 pb-1 pt-2.5 shadow-[var(--cf-shadow)]", CARD)}>
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            Live activity
            <span className="cf-live h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
          </p>
          {feed.map(([code, via, amt, when], i) => (
            <div key={code} className={cn("flex h-8 items-center gap-2 text-[12px]", i === 0 && sold && "cf-arrive")}>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--cf-green-wash)] text-[var(--cf-green)]">
                <Check size={11} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--cf-fg-2)]">
                <span className="cf-mono">{code}</span> paid · {via} · {amt}
              </span>
              <span className="shrink-0 text-[var(--cf-muted)]">{when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toast() {
  return (
    <div className={cn("cf-pop flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 shadow-[var(--cf-shadow-lg)]", CARD)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--cf-green-wash)] text-[var(--cf-green)]">
        <ScanLine size={16} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-[13px] font-semibold leading-tight">Admit 2</p>
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
    <div ref={ref} aria-hidden className="cf-dots relative overflow-hidden rounded-3xl" style={{ height: H * s }}>
      <div className="absolute top-0" style={stage}>
        <div className="absolute z-10" style={{ left: wide ? 24 : 16, top: wide ? 28 : 16, width: 520, height: 500 }}>
          <Till step={step} />
          <Cursor x={c.x} y={c.y} click={c.click} />
        </div>
        {wide && (
          <>
            <div className="absolute" style={{ left: 500, top: 36, width: 540, height: 490 }}>
              <OsWindow step={step} />
            </div>
            {step >= 14 && (
              <div className="absolute z-20" style={{ left: 760, top: 440 }}>
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
