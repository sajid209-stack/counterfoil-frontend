"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banknote, CalendarDays, Check, CreditCard, MoreHorizontal, QrCode, ScanLine, Send, Store, Ticket, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo, StatusPill, type PillTone } from "@/components/ui";
import { Cursor, Window } from "../_components/ui";
import { useSequence } from "../_components/motion";
import styles from "./Platform.module.css";

/* Five product demos, each a fixed 560px-wide design canvas that plays its own
   timeline (useSequence) and looks like the real screen: the app's own tokens
   (surface / card / subtle, ember primary, brand-50 icon tiles), the real
   StatusPill and Logo, and no borders anywhere: things are separated by gaps,
   soft fills and radius. DemoStage scales the canvas to fit a phone, so layouts
   use fixed pixel blocks, which is what lets the cursor land on the right
   control at any scale. Text inside is 12px or more. */

const CW = 560;

const MUTED = "text-muted";
const SOFT = "shadow-[0_1px_2px_rgb(17_17_16/0.05)]";
const FOCUS = "shadow-[inset_0_0_0_2px_var(--color-ember)]";
const BTN = "bg-ember-solid text-on-solid";

/** A StatusPill for coloured states, a quiet subtle pill for neutral ones. */
function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  if (tone === "neutral") {
    return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium leading-5 text-fg-secondary", className)}>{children}</span>;
  }
  return (
    <StatusPill tone={tone} className={cn("whitespace-nowrap", className)}>
      {children}
    </StatusPill>
  );
}

/** Initials avatar, the app's brand-100 tile with brand-foreground letters. */
function Initials({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-foreground"
      style={{ width: size, height: size, fontSize: size > 32 ? 14 : 12 }}
    >
      {initials}
    </span>
  );
}

/** The app's icon tile: brand-50 fill, brand-foreground glyph. */
function IconTile({ children, size = 32 }: { children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-foreground" style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** Hides the cursor on steps where it has nothing to do. */
function Pointer({ x, y, click, show = true }: { x: number; y: number; click?: boolean; show?: boolean }) {
  return (
    <div className="pointer-events-none transition-opacity duration-300" style={{ opacity: show ? 1 : 0 }}>
      <Cursor x={x} y={y} click={click} />
    </div>
  );
}

/** The scaled design canvas: measures its container, scales to fit, keeps the height following. */
export function DemoStage({ height, children }: { height: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / CW)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="w-full overflow-hidden">
      <div className="mx-auto" style={{ width: CW * scale, height: height * scale }}>
        <div className="relative origin-top-left" style={{ width: CW, height, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── 1 · Set up: the OS catalog editor ─────────────────────────────────── */

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function sessionTimes(every: number, first: string, last: string) {
  const out: string[] = [];
  for (let t = toMin(first); t <= toMin(last) && out.length < 40; t += every) out.push(fmt(t));
  return out;
}
const FINAL_TIMES = sessionTimes(45, "11:00", "16:30");

// 0 rest · 1-3 type the interval · 4-5 first · 6-7 last · 8-9 seats · 10-17 chips · 18 prices · 19 save · 20 saved
const SETUP_T = [700, 900, 450, 700, 900, 700, 800, 700, 800, 700, 260, 260, 260, 260, 260, 260, 260, 260, 900, 600, 2600];

export const SETUP_HEIGHT = 430;

export function SetupDemo({ run }: { run: boolean }) {
  const step = useSequence(SETUP_T, run);
  const every = step >= 3 ? "45" : step === 2 ? "4" : "30";
  const first = step >= 5 ? "11:00" : "10:00";
  const last = step >= 7 ? "16:30" : "17:00";
  const seats = step >= 9 ? "40" : "20";
  const times = sessionTimes(step >= 3 ? 45 : 30, first, last);
  const shown = Math.min(8, Math.max(0, step - 9));
  const focus = step >= 2 && step <= 4 ? 0 : step === 5 || step === 6 ? 1 : step === 7 || step === 8 ? 2 : step === 9 ? 3 : -1;
  const saved = step >= 20;

  const cursor = step <= 3 ? [80, 178] : step <= 6 ? [205, 178] : step <= 8 ? [335, 178] : step <= 9 ? [470, 178] : [500, 384];
  const pos = step === 0 ? [330, 300] : cursor;
  const click = [2, 5, 7, 9, 19].includes(step);

  const fields = [
    { label: "Every (min)", value: every },
    { label: "First session", value: first },
    { label: "Last session", value: last },
    { label: "Seats each", value: seats },
  ];

  return (
    <DemoStage height={SETUP_HEIGHT}>
      <Window title={<Logo size={14} />} dots className="h-[430px]" bodyClassName="flex flex-col gap-4 bg-card p-5">
        <div className="flex h-8 items-center gap-2.5">
          <IconTile>
            <Ticket size={16} strokeWidth={1.8} />
          </IconTile>
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Planetarium Show</span>
          <Pill>Timed sessions</Pill>
          <span className="ml-auto">{saved ? <Pill tone="success">Saved</Pill> : <Pill>Unsaved changes</Pill>}</span>
        </div>
        <p className="cf-label h-4 leading-4">Weekly schedule</p>
        <div className="-mt-1 grid h-14 grid-cols-4 gap-3">
          {fields.map((f, i) => (
            <div key={f.label}>
              <p className={cn("mb-1 h-4 text-[12px] leading-4", MUTED)}>{f.label}</p>
              <div className={cn("flex h-9 items-center rounded-control bg-subtle px-3 text-[13px] font-medium transition-shadow duration-300", focus === i && cn(FOCUS, "bg-card"))}>
                {f.value}
                {focus === i && <span className="cf-caret" />}
              </div>
            </div>
          ))}
        </div>
        <div className="flex h-8 items-center rounded-control bg-brand-50 px-3 text-[13px]">
          <span className="truncate">
            <span className="font-semibold text-brand-foreground">Every {every === "4" ? "30" : every} min</span> · {first}–{last} · {times.length} sessions a day · {seats} seats each
          </span>
        </div>
        <div className="grid h-7 grid-cols-8 gap-1.5">
          {FINAL_TIMES.map((t, i) =>
            step >= 10 && i < shown ? (
              <span key={t} className="cf-pop flex items-center justify-center rounded-full bg-brand-100 text-[12px] font-medium text-brand-foreground cf-mono">
                {t}
              </span>
            ) : (
              <span key={t} className="cf-skeleton rounded-full" />
            ),
          )}
        </div>
        <div className="h-14">
          {step >= 18 && (
            <div className="cf-arrive grid h-14 grid-cols-3 gap-2">
              {[
                ["Adult", "৳500"],
                ["Child", "৳300"],
                ["Family", "৳1,400 · admits 4"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col justify-center rounded-control bg-subtle px-3">
                  <span className={cn("text-[12px]", MUTED)}>{k}</span>
                  <span className="text-[13px] font-semibold text-brand-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex h-9 items-center justify-between">
          <span className="min-h-7">
            {saved && (
              <span className="cf-pop inline-flex h-7 items-center gap-1.5 rounded-full bg-inverse px-3 text-[12px] font-medium text-inverse-fg">
                <Check size={14} strokeWidth={2} /> Saved
              </span>
            )}
          </span>
          <span className={cn("inline-flex h-9 w-[72px] items-center justify-center rounded-control text-[13px] font-medium", BTN)}>Save</span>
        </div>
      </Window>
      <Pointer x={pos[0]} y={pos[1]} click={click} />
    </DemoStage>
  );
}

/* ── 2 · Sell: the Go slot sheet, cart and payment control ─────────────── */

// 0 rest · 1-2 pick Field 2 · 18:00 · 3-4 repeat weekly · 5-6 bKash · 7-8 charge · 9 paid
const SELL_T = [800, 900, 600, 900, 700, 900, 700, 900, 600, 2600];
export const SELL_HEIGHT = 440;

const HOURS = [
  { t: "17:00", f1: 1500, f2: 1500 },
  { t: "18:00", f1: null, f2: 2000 },
  { t: "19:00", f1: 2000, f2: 2000 },
  { t: "20:00", f1: 2000, f2: 2000 },
];
const baht = (n: number) => `৳${n.toLocaleString("en-US")}`;

export function SellDemo({ run }: { run: boolean }) {
  const step = useSequence(SELL_T, run);
  const picked = step >= 2;
  const repeat = step >= 4;
  const method = step >= 6 ? 1 : 0;
  const paid = step >= 9;
  const total = repeat ? 8000 : picked ? 2000 : 0;

  const pos = step === 0 ? [480, 150] : step <= 2 ? [262, 192] : step <= 4 ? [316, 324] : step <= 6 ? [150, 398] : [462, 398];
  const click = [2, 4, 6, 8].includes(step);
  const methods = [
    { name: "Cash", Icon: Banknote },
    { name: "bKash", Icon: Send },
    { name: "Bangla QR", Icon: QrCode },
    { name: "Card", Icon: CreditCard },
  ];

  return (
    <DemoStage height={SELL_HEIGHT}>
      <Window title={<Logo variant="go" size={14} />} dots className="h-[440px]" bodyClassName="flex flex-col bg-surface p-4">
        <div className="flex h-[304px] gap-4">
          <div className="flex w-[320px] shrink-0 flex-col">
            <div className="h-10">
              <p className="text-[15px] font-semibold tracking-[-0.015em]">Football · Field 1/2</p>
              <p className={cn("text-[12px]", MUTED)}>Wed 4 Nov · ৳1,500 base · ৳2,000 evening</p>
            </div>
            <div className="mt-3 grid grid-cols-[44px_1fr_1fr] gap-1">
              <span className="h-6" />
              <span className={cn("flex h-6 items-center px-1 text-[12px]", MUTED)}>Field 1</span>
              <span className={cn("flex h-6 items-center px-1 text-[12px]", MUTED)}>Field 2</span>
              {HOURS.map((h) => (
                <SlotRow key={h.t} h={h} picked={picked} />
              ))}
            </div>
            <div className="mt-3 flex h-9 items-center justify-between">
              <span className="text-[13px] font-medium">Repeat weekly</span>
              <span className={cn("relative h-5 w-9 rounded-full transition-colors duration-300", repeat ? "bg-ember-solid" : "bg-strong")}>
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300", repeat ? "left-[18px]" : "left-0.5")} />
              </span>
            </div>
            <p className={cn("mt-1 h-4 text-[12px] leading-4 transition-opacity duration-500", MUTED, repeat ? "opacity-100" : "opacity-0")}>Next 4 Wednesdays · 1 already taken — skipped</p>
          </div>
          <div className={cn("flex min-w-0 flex-1 flex-col rounded-card bg-card p-3", SOFT)}>
            <div className="mb-2 flex items-center justify-between">
              <span className="cf-label">Cart</span>
              {paid && <Pill tone="success">Paid</Pill>}
            </div>
            {picked ? (
              <div className="cf-arrive flex items-start gap-2">
                <IconTile size={28}>
                  <CalendarDays size={14} strokeWidth={1.8} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">Football · Field 2</p>
                  <p className={cn("text-[12px]", MUTED)}>Wed 4 Nov · 18:00</p>
                </div>
                <span className="text-[12px] font-semibold">৳2,000</span>
              </div>
            ) : (
              <p className={cn("text-[12px]", MUTED)}>No items yet</p>
            )}
            {repeat && (
              <div className="mt-2 flex flex-col gap-1">
                {(
                  [
                    ["Wed 11 Nov", false],
                    ["Wed 18 Nov", true],
                    ["Wed 25 Nov", false],
                    ["Wed 2 Dec", false],
                  ] as const
                ).map(([d, skipped], i) => (
                  <div key={d} className="cf-arrive flex h-7 items-center justify-between rounded-control bg-subtle px-2 text-[12px]" style={{ animationDelay: `${i * 90}ms` }}>
                    <span className={skipped ? "text-faint line-through" : "text-fg-secondary"}>{d}</span>
                    {skipped ? <Pill tone="danger">Taken</Pill> : <span className="font-medium">৳2,000</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between pt-2">
              <span className={cn("text-[12px]", MUTED)}>{repeat ? "4 sessions" : "Total"}</span>
              <span className="text-[16px] font-semibold tracking-[-0.02em]">{baht(total)}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex h-10 gap-4">
          <div className="relative flex h-10 w-[360px] shrink-0 gap-2">
            <span
              className={cn("absolute left-0 top-0 h-10 w-[84px] rounded-full bg-brand-50 transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]", FOCUS)}
              style={{ transform: `translateX(${method * 92}px)` }}
            />
            {methods.map(({ name, Icon }, i) => (
              <span
                key={name}
                className={cn(
                  "relative z-10 flex h-10 w-[84px] items-center justify-center gap-1 rounded-full text-[12px] font-medium transition-colors duration-300",
                  i === method ? "text-brand-foreground" : cn("bg-card", MUTED),
                )}
                style={i === method ? undefined : { boxShadow: "0 1px 2px rgb(17 17 16 / 0.05)" }}
              >
                <Icon size={13} strokeWidth={1.8} aria-hidden className="shrink-0" />
                <span className="truncate">{name}</span>
              </span>
            ))}
          </div>
          <span
            className={cn(
              "flex h-10 w-[152px] items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-300",
              paid ? "bg-success-solid text-on-solid" : picked ? BTN : "bg-ember-disabled text-brand-foreground",
            )}
          >
            {paid ? (
              <>
                <Check size={15} strokeWidth={2.2} className="cf-pop" /> Paid
              </>
            ) : step === 8 ? (
              "Charging…"
            ) : (
              `Charge ${baht(total)}`
            )}
          </span>
        </div>
      </Window>
      <Pointer x={pos[0]} y={pos[1]} click={click} />
    </DemoStage>
  );
}

function SlotRow({ h, picked }: { h: { t: string; f1: number | null; f2: number | null }; picked: boolean }) {
  const cell = (price: number | null, selected: boolean) =>
    price === null ? (
      <span className={cn("flex h-9 items-center justify-center rounded-[14px] text-[12px] font-medium text-muted", styles.hatch)}>Booked</span>
    ) : (
      <span
        className={cn(
          "flex h-9 items-center justify-center rounded-[14px] text-[13px] font-semibold text-brand-foreground transition-all duration-300",
          selected ? cn("bg-brand-50", FOCUS) : cn("bg-card", SOFT),
        )}
      >
        {baht(price)}
      </span>
    );
  return (
    <>
      <span className={cn("flex h-9 items-center text-[12px] cf-mono", MUTED)}>{h.t}</span>
      {cell(h.f1, false)}
      {cell(h.f2, picked && h.t === "18:00")}
    </>
  );
}

/* ── 3 · Admit: the Go scan screen ─────────────────────────────────────── */

// 0 ready · 1 reading · 2-5 admit 4 (+1, then all) · 6 done · 7 ready · 8 reading · 9 refused
const ADMIT_T = [900, 900, 800, 600, 900, 600, 1500, 900, 800, 3000];
export const ADMIT_HEIGHT = 440;

const QR = ["1110111", "1010100", "1110111", "0001010", "1101110", "0110101", "1011011"];

export function AdmitDemo({ run }: { run: boolean }) {
  const step = useSequence(ADMIT_T, run);
  const reading = step === 1 || step === 8;
  const ready = step === 0 || step === 7;
  const admit = step >= 2 && step <= 6;
  const refused = step === 9;
  const dots = step >= 5 && step <= 6 ? 4 : step >= 3 && step <= 4 ? 1 : 0;
  const pos = step <= 3 ? [88, 314] : [198, 314];
  const cursorOn = step >= 2 && step <= 5;
  const click = step === 3 || step === 5;
  const inside = step >= 5 ? 11 : 7;

  return (
    <DemoStage height={ADMIT_HEIGHT}>
      <div className="cf-window absolute left-7 top-3 flex h-[416px] w-[268px] flex-col overflow-hidden rounded-[28px]" style={{ background: "var(--color-surface)" }}>
        <div className="flex h-11 shrink-0 items-center justify-between px-5 pt-1">
          <Logo variant="go" size={14} />
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-inverse text-[12px] font-medium text-inverse-fg">N</span>
        </div>
        <div className="mx-3 mt-1 h-[292px]">
          {(ready || reading) && (
            <div className="flex h-full flex-col">
              <div className="relative h-[188px] overflow-hidden rounded-[20px] bg-inverse">
                {["left-4 top-4 border-l-2 border-t-2", "right-4 top-4 border-r-2 border-t-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((c) => (
                  <span key={c} className={cn("absolute h-5 w-5 rounded-[3px] border-[var(--color-paper)]/70", c)} />
                ))}
                {reading && (
                  <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-7 gap-[3px]">
                    {QR.join("")
                      .split("")
                      .map((b, i) => (
                        <span key={i} className={cn("h-3 w-3 rounded-[2px]", b === "1" ? "bg-paper" : "bg-white/10")} />
                      ))}
                  </div>
                )}
                {(ready || reading) && <span className={cn("absolute inset-x-5 h-[2px] rounded-full bg-ember-solid", styles.scan)} />}
              </div>
              {ready ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
                  <span className="cf-live h-2 w-2 rounded-full bg-ember-solid" />
                  <p className="text-[13px] font-medium">Ready for the next scan</p>
                  <p className={cn("text-[12px]", MUTED)}>Hold the code inside the frame</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <span className="cf-skeleton h-5 w-28 rounded-full" />
                  <span className="cf-skeleton h-4 w-44 rounded-full" />
                </div>
              )}
            </div>
          )}
          {admit && (
            <div className="cf-arrive relative h-full rounded-[20px] bg-inverse p-4 text-paper">
              <div className="flex h-9 items-center justify-between">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.035em]">ADMIT 4</span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ember-solid text-on-solid">
                  <Check size={14} strokeWidth={2.6} />
                </span>
              </div>
              <p className="mt-1 truncate text-[13px] leading-5 text-paper/80">Family · Planetarium Show 11:00</p>
              <div className="mt-4 flex h-8 items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[12px] transition-colors duration-300",
                      i < dots ? "bg-paper text-inverse" : "bg-white/10 text-paper/60",
                    )}
                  >
                    {i < dots ? <Check size={14} strokeWidth={2.4} /> : i + 1}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-paper/70">
                Group of 4 · {dots} in
              </p>
              <div className="absolute inset-x-4 bottom-4 flex h-11 gap-2">
                <span className="flex h-11 w-16 items-center justify-center rounded-full bg-white/15 text-[14px] font-medium">+1</span>
                <span className={cn("flex h-11 flex-1 items-center justify-center rounded-full text-[14px] font-semibold", BTN)}>Admit all</span>
              </div>
            </div>
          )}
          {refused && (
            <div className={cn("cf-arrive flex h-full flex-col items-center justify-center rounded-[20px] px-3 text-center text-white", styles.hatchDanger)}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <X size={34} strokeWidth={3} />
              </span>
              <p className="mt-3 text-[24px] font-bold leading-none tracking-[-0.03em]">DO NOT ADMIT</p>
              <p className="mt-2 text-[14px]">Already admitted at 11:04 AM</p>
              <p className="mt-1 text-[12px] text-white/75 cf-mono">CF-2026-001053-A</p>
              <p className="mt-3 text-[12px] text-white/75">Ready for the next scan in a moment</p>
            </div>
          )}
        </div>
        <div className={cn("mx-3 mb-3 mt-auto flex h-12 items-center justify-around rounded-full bg-card", SOFT)}>
          {[Store, CalendarDays, ScanLine, UserCheck, MoreHorizontal].map((Icon, i) => (
            <span key={i} className={cn("flex h-9 w-11 items-center justify-center rounded-full", i === 2 ? "bg-brand-100 text-brand-foreground" : MUTED)}>
              <Icon size={18} strokeWidth={1.7} aria-hidden />
            </span>
          ))}
        </div>
      </div>

      <div className="absolute left-[316px] top-3 flex h-[416px] w-[228px] flex-col">
        <div className={cn("rounded-card bg-card p-3", SOFT)}>
          <p className="text-[13px] font-medium">Planetarium Show 11:00</p>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className={MUTED}>Admitted</span>
            <span className="font-semibold">{inside} / 40</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-ember-solid transition-[width] duration-700" style={{ width: `${(inside / 40) * 100}%` }} />
          </div>
        </div>
        <p className="cf-label mb-2 mt-5">Gate log</p>
        <div className="flex flex-col gap-1.5">
          {step >= 9 && <LogRow time="11:09 AM" code="CF-…1053-A" what="Refused" tone="danger" fresh />}
          {step >= 6 && <LogRow time="11:04 AM" code="CF-…1053-A" what="Family · 4 in" tone="success" fresh={step < 9} />}
          <LogRow time="10:58 AM" code="CF-…0987" what="Adult · 1 in" tone="success" />
          {step < 6 && <LogRow time="10:52 AM" code="CF-…0961" what="Child · 1 in" tone="success" />}
        </div>
      </div>
      <Pointer x={pos[0]} y={pos[1]} click={click} show={cursorOn} />
    </DemoStage>
  );
}

function LogRow({ time, code, what, tone, fresh }: { time: string; code: string; what: string; tone: PillTone; fresh?: boolean }) {
  return (
    <div className={cn("flex h-11 items-center gap-2 rounded-control bg-card px-3", SOFT, fresh && "cf-arrive")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium cf-mono">{code}</p>
        <p className={cn("text-[12px]", MUTED)}>{time}</p>
      </div>
      <Pill tone={tone}>{what}</Pill>
    </div>
  );
}

/* ── 4 · Reconcile: shift close and the analytics bars ─────────────────── */

// 0 rest · 1-2 count the drawer · 3-4 close · 5 bars grow · 6 payment mix
const REC_T = [700, 700, 800, 900, 1300, 1300, 3200];
export const REC_HEIGHT = 430;
const BARS: [string, number][] = [
  ["10", 22],
  ["11", 38],
  ["12", 55],
  ["13", 72],
  ["14", 64],
  ["15", 90],
  ["16", 78],
  ["17", 46],
];
const MIX: [string, number, string][] = [
  ["Cash", 46, "var(--color-brand-500)"],
  ["bKash", 31, "var(--color-brand-300)"],
  ["Bangla QR", 15, "var(--color-neutral-400)"],
  ["Card", 8, "var(--color-neutral-200)"],
];

export function ReconcileDemo({ run }: { run: boolean }) {
  const step = useSequence(REC_T, run);
  const counted = step >= 2 ? "৳18,400.00" : step === 1 ? "৳18,000.00" : "—";
  const closed = step >= 4;
  const pos = step < 3 ? [300, 150] : [486, 74];
  const tile = cn("flex flex-col justify-center rounded-card bg-card px-3", SOFT);

  return (
    <DemoStage height={REC_HEIGHT}>
      <Window title={<Logo variant="go" size={14} />} dots className="h-[430px]" bodyClassName="flex flex-col gap-4 bg-surface p-5">
        <div className="flex h-7 items-center gap-2.5">
          <Initials initials="NI" size={28} />
          <p className="text-[14px] font-semibold">Close shift</p>
          <span className={cn("truncate text-[12px]", MUTED)}>Nadia Islam · Counter 1</span>
          <span className="ml-auto">
            {closed ? (
              <Pill tone="success" className="cf-pop">
                Closed
              </Pill>
            ) : (
              <span className={cn("inline-flex h-7 items-center rounded-full px-3.5 text-[12px] font-semibold", BTN)}>Close shift</span>
            )}
          </span>
        </div>
        <div className="grid h-20 grid-cols-3 gap-3">
          <div className={tile}>
            <span className="cf-label leading-4">Expected</span>
            <span className="text-[19px] font-semibold tracking-[-0.02em]">৳18,450.00</span>
          </div>
          <div className={tile}>
            <span className="cf-label leading-4">Counted</span>
            <span key={counted} className="cf-arrive text-[19px] font-semibold tracking-[-0.02em]">
              {counted}
            </span>
          </div>
          <div className={tile}>
            <span className="cf-label leading-4">Variance</span>
            {closed ? (
              <>
                <span className="cf-arrive text-[19px] font-semibold tracking-[-0.02em]">−৳50.00</span>
                <span className="cf-arrive inline-flex items-center gap-1 text-[12px] font-medium text-success">
                  <Check size={12} strokeWidth={2.4} /> Within ৳100 — closed square
                </span>
              </>
            ) : (
              <span className="text-[19px] font-semibold text-faint">—</span>
            )}
          </div>
        </div>
        <div className={cn("rounded-card bg-card px-3 pb-2 pt-2.5", SOFT)}>
          <p className="cf-label h-4 leading-4">Sales by hour</p>
          <div className="mt-2 flex h-[72px] items-end gap-2">
            {BARS.map(([h, v], i) => (
              <div key={h} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="rounded-t-[4px] transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    height: step >= 5 ? `${v}%` : "0%",
                    transitionDelay: `${i * 70}ms`,
                    background: i === 5 ? "var(--color-brand-500)" : "var(--color-brand-200)",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {BARS.map(([h]) => (
              <span key={h} className={cn("flex-1 text-center text-[12px] cf-mono", MUTED)}>
                {h}
              </span>
            ))}
          </div>
        </div>
        <div className="px-1">
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {MIX.map(([n, p, c], i) => (
              <span
                key={n}
                className="h-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: step >= 6 ? `${p}%` : "0%", background: c, transitionDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MIX.map(([n, p, c]) => (
              <div key={n} className="flex items-center gap-1.5 text-[12px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                <span className="truncate text-fg-secondary">{n}</span>
                <span className="ml-auto font-semibold">{p}%</span>
              </div>
            ))}
          </div>
        </div>
      </Window>
      <Pointer x={pos[0]} y={pos[1]} click={step === 4} show={step >= 3 && step <= 4} />
    </DemoStage>
  );
}

/* ── 5 · Grow: the OS customer record ──────────────────────────────────── */

// 0 rest · 1 a visit lands · 2-4 points tick up · 5 duplicate found · 6 merged
const GROW_T = [800, 1000, 500, 500, 800, 1300, 3200];
export const GROW_HEIGHT = 440;

export function GrowDemo({ run }: { run: boolean }) {
  const step = useSequence(GROW_T, run);
  const visit = step >= 1;
  const points = step >= 4 ? 4600 : step === 3 ? 4220 : step === 2 ? 3835 : 3450;
  const dup = step >= 5;
  const merged = step >= 6;
  const card = cn("rounded-card bg-card", SOFT);

  return (
    <DemoStage height={GROW_HEIGHT}>
      <Window title={<Logo size={14} />} dots className="h-[440px]" bodyClassName="flex flex-col gap-3 bg-surface p-5">
        <div className={cn("flex h-14 items-center gap-3 px-3", card)}>
          <Initials initials="AR" size={36} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.015em]">Ayesha Rahman</p>
            <p className={cn("text-[12px] cf-mono", MUTED)}>01712-345678</p>
          </div>
          <Pill tone="info" className="ml-auto">
            Family annual
          </Pill>
        </div>
        <div className="grid h-[52px] grid-cols-3 gap-3">
          {[
            ["Visits", visit ? "13" : "12"],
            ["Total spent", visit ? "৳18,200" : "৳16,800"],
            ["Last seen", visit ? "Today" : "28 Oct"],
          ].map(([k, v]) => (
            <div key={k} className={cn("flex flex-col justify-center px-3", card)}>
              <span className="cf-label leading-4">{k}</span>
              <span key={v} className="cf-arrive text-[14px] font-semibold leading-5">
                {v}
              </span>
            </div>
          ))}
        </div>
        <div className="grid h-[88px] grid-cols-2 gap-3">
          <div className={cn("flex flex-col justify-center px-3", card)}>
            <p className="cf-label leading-4">Membership</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[14px] font-semibold">Family annual</span>
              <Pill tone="success">Active</Pill>
            </div>
            <p className={cn("text-[12px]", MUTED)}>Active until 14 Mar 2027 · covers 4</p>
          </div>
          <div className={cn("flex flex-col justify-center px-3", card)}>
            <p className="cf-label leading-4">Points</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[22px] font-semibold leading-6 tracking-[-0.02em] text-brand-foreground">{points.toLocaleString("en-US")}</span>
              {step >= 2 && (
                <Pill tone="success" className="cf-pop">
                  +1,150 points
                </Pill>
              )}
            </div>
            <p className={cn("text-[12px]", MUTED)}>Earned after each paid sale</p>
          </div>
        </div>
        <div className={cn("flex h-10 items-center gap-2.5 px-3", card)}>
          {visit ? (
            <div className="cf-arrive flex min-w-0 flex-1 items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-solid" />
              <span className="truncate text-[13px]">
                <span className="font-medium">Visit</span> · Family · Planetarium Show 11:00
              </span>
              <span className="ml-auto text-[13px] font-semibold">৳1,400</span>
            </div>
          ) : (
            <span className="cf-skeleton h-3 w-48 rounded-full" />
          )}
        </div>
        <div className={cn("flex h-10 items-center gap-2 px-3", card)}>
          <span className="cf-label">Consent</span>
          <Pill tone="success">SMS ✓</Pill>
          <Pill tone="success">Email ✓</Pill>
          <span className={cn("ml-auto text-[12px]", MUTED)}>Logged per channel</span>
        </div>
        <div className="h-[52px]">
          {dup && (
            <div className={cn("cf-arrive flex h-[52px] items-center gap-3 rounded-card bg-brand-50 px-3")}>
              <Initials initials="AR" size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">Ayesha Rehman</p>
                <p className={cn("truncate text-[12px]", MUTED)}>Same phone · 880 1712 345678</p>
              </div>
              {merged ? (
                <Pill tone="success" className="cf-pop">
                  Merged
                </Pill>
              ) : (
                <>
                  <Pill tone="warning">High match</Pill>
                  <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold", BTN)}>Merge</span>
                </>
              )}
            </div>
          )}
        </div>
      </Window>
    </DemoStage>
  );
}
