"use client";

import {
  Banknote,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Ellipsis,
  LayoutGrid,
  Lock,
  LogIn,
  Minus,
  MousePointer2,
  Percent,
  Plus,
  ReceiptText,
  RotateCcw,
  ScanLine,
  ShoppingBag,
  Store,
  Tags,
  Ticket,
  Trash2,
  UserRoundCheck,
  Users,
  VideoOff,
  Wallet,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, formatMoneyCompact, formatPriceShort } from "@/lib/format";
import { Logo } from "@/components/ui";
import s from "./brand-motion.module.css";

/* The four scenes of the brand panel's product story. Each is a miniature of a
   REAL screen — the Go till, the Go scan screen, the OS dashboard and the Go
   schedule board — drawn at 720 x 440 with the product's own tokens, type scale,
   radii and lucide icons, inside a `.dark` island so it matches dark mode in
   either theme. The stage scales the whole window with the container-query zoom
   in brand-motion.module.css. Decorative: the stage is aria-hidden and the
   caption beside it says the same in words. Names and figures are data (the
   demo business's own), words are messages. */

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
const v = (o: Vars) => o;

/* ── Shared pieces ────────────────────────────────────────────────────── */

/** The app window every scene sits in. `dark` re-asserts the dark tokens. */
function Win({ children }: { children: React.ReactNode }) {
  return <div className="dark absolute inset-0 flex overflow-hidden rounded-card border border-line bg-surface text-fg shadow-lg">{children}</div>;
}

/** Go's sidebar, as in (go)/_components/shell/DesktopSidebar: counter picker on
 *  top, the four destinations, the shift and the signed-in person below. */
function GoSidebar({ active }: { active: "sell" | "schedule" | "scan" | "checkIn" }) {
  const t = useTranslations("auth.shell.story.mini");
  const rows = [
    { k: "sell", Icon: Store },
    { k: "schedule", Icon: CalendarDays },
    { k: "scan", Icon: ScanLine },
    { k: "checkIn", Icon: UserRoundCheck },
  ] as const;
  return (
    <aside className="flex w-37 shrink-0 flex-col border-r border-hairline">
      <div className="flex h-14 shrink-0 items-center gap-tight border-b border-hairline px-tight">
        <span className="flex size-6 shrink-0 items-center justify-center text-sm font-semibold">F</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">Fort Main Gate</span>
          <span className="block truncate text-xs text-muted">Lalbagh Fort</span>
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 p-tight">
        {rows.map(({ k, Icon }) => (
          <span key={k} className={cn("flex h-9 items-center gap-tight rounded-control px-tight text-sm", k === active ? "bg-nav-selected font-semibold text-fg" : "text-muted")}>
            <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">{t(k)}</span>
          </span>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-tight border-t border-hairline p-tight">
        <span className="flex items-center gap-tight text-xs text-muted">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
          <span className="truncate">{t("shiftOpen", { time: "3:24" })}</span>
        </span>
        <span className="flex items-center gap-tight">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-inverse text-xs font-semibold text-inverse-fg">N</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-semibold">Nadia Islam</span>
            <span className="block truncate text-2xs text-muted">{t("supervisor")}</span>
          </span>
        </span>
      </div>
    </aside>
  );
}

/** One digit column that rolls to its digit. */
function Odometer({ text, t0 }: { text: string; t0: number }) {
  let n = 0;
  return (
    <span className={s.odo} style={v({ "--t": `${t0}ms` })}>
      {[...text].map((ch, k) => {
        if (!/\d/.test(ch)) return <span key={k}>{ch}</span>;
        const i = n++;
        return (
          <span key={k} className={s.odoCol}>
            <span className={s.odoStrip} style={v({ "--d": ch, "--i": i })}>
              {"0123456789".split("").map((x) => <span key={x}>{x}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Two values stacked in a one-line window; the strip slides to the second at `t`. */
function Roll({ a, b, t, lh = 20, className }: { a: string; b: string; t: number; lh?: number; className?: string }) {
  return (
    <span className={cn(s.roll, className)} style={v({ "--lh": `${lh}px`, "--t": `${t}ms` })}>
      <span className={s.rollStrip}>
        <span>{a}</span>
        <span>{b}</span>
      </span>
    </span>
  );
}

function Pointer({ className }: { className: string }) {
  return (
    <span className={cn(s.cursor, className)} aria-hidden>
      <MousePointer2 size={22} className="fill-fg text-surface" strokeWidth={1.5} />
    </span>
  );
}

/* ── 1 · Sell — the Go till ───────────────────────────────────────────── */

/* The wall card, drawn the way (go)/_components/WallTile draws it: a white card,
   the picture inset with a concentric radius, the name, one quiet line, the
   price, and a round "+" (adds now) or "›" (opens a sheet). */
type Card = {
  key: string;
  name: string;
  meta: string;
  image: string;
  priceMinor: number;
  sheet?: boolean;
  live?: string;
  tap?: number[];
};
const CARDS: Card[] = [
  { key: "yoga", name: "10-Class Yoga Pack", meta: "10 visits in one pass", image: "/demo/pages/yoga-2.jpg", priceMinor: 400000 },
  { key: "reentry", name: "All-Day Re-entry Pass", meta: "Any day · no time to pick", image: "/demo/pages/reentry-1.jpg", priceMinor: 80000, tap: [1300, 2500] },
  { key: "badminton", name: "Badminton Court", meta: "From 1 hr · 1 court", image: "/demo/pages/badminton-1.jpg", priceMinor: 80000, sheet: true, live: "1 of 1" },
  { key: "bowling", name: "Bowling Lane", meta: "From 1 hr · 4 lanes", image: "/seed/bowling.jpg", priceMinor: 100000, sheet: true, live: "4 of 4" },
];
const VAT = 0.15;
const money = (units: number) => formatMoney(Math.round(units * 100));

export function SceneSell() {
  const t = useTranslations("auth.shell.story.mini");
  const sub1 = 800, sub2 = 1600;
  const tot1 = sub1 * (1 + VAT), tot2 = sub2 * (1 + VAT);
  return (
    <Win>
      <GoSidebar active="sell" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-tight border-b border-hairline px-tight">
          <span className="card-surface flex h-9 min-w-0 flex-1 items-center gap-tight rounded-control px-comfortable text-sm font-semibold">
            <CalendarDays size={14} aria-hidden className="shrink-0 text-muted" />
            <span className="truncate">{t("today")} · Wed 29 Jul</span>
            <ChevronDown size={14} aria-hidden className="ml-auto shrink-0 text-muted" />
          </span>
          <span className="card-surface flex h-9 shrink-0 items-center gap-1.5 rounded-control px-comfortable text-sm font-semibold">
            <Lock size={14} aria-hidden className="text-muted" />
            {t("held")}
            <span className="flex size-5 items-center justify-center rounded-full bg-ember-solid text-xs font-semibold text-on-solid">2</span>
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-tight p-tight">
          {CARDS.map((c) => (
            <div key={c.key} className="card-surface relative flex min-w-0 flex-col gap-1 p-1.5 text-left">
              <span className="relative block h-16 w-full shrink-0 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative demo photo, as on the real wall */}
                <img src={c.image} alt="" className="absolute inset-0 size-full object-cover" />
                {c.tap && (
                  <span className={s.count} style={v({ "--t": `${c.tap[0]}ms`, "--t2": `${c.tap[1]}ms` })}>
                    <span className={s.count1}>1</span>
                    <span className={s.count2}>2</span>
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
                <span className="truncate text-sm font-semibold leading-snug">{c.name}</span>
                <span className="truncate text-xs leading-snug text-muted">{c.meta}</span>
                {c.live && (
                  <span className="flex items-center gap-inline text-xs leading-snug text-muted">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
                    {t("liveFree", { n: c.live.split(" of ")[0], m: c.live.split(" of ")[1] })}
                  </span>
                )}
                <span className="mt-auto flex items-center justify-between pt-0.5">
                  <span className="text-lg font-bold leading-none tabular-nums">{formatPriceShort(c.priceMinor)}</span>
                  <span
                    aria-hidden
                    className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", c.sheet ? "bg-card text-fg ring-1 ring-inset ring-strong" : "bg-inverse text-inverse-fg")}
                  >
                    {c.sheet ? <ChevronRight size={16} strokeWidth={2} /> : <Plus size={16} strokeWidth={2} />}
                  </span>
                </span>
              </span>
              {c.tap && (
                <span aria-hidden className={s.pick} style={v({ "--t": `${c.tap[0]}ms` })}>
                  <span className={s.ripple} style={v({ "--t": `${c.tap[0]}ms` })} />
                  <span className={s.ripple} style={v({ "--t": `${c.tap[1]}ms` })} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <aside className="flex w-54 shrink-0 flex-col border-l border-hairline">
        <div className="flex h-14 shrink-0 items-center justify-between px-comfortable">
          <span className="leading-tight">
            <span className="block text-md font-semibold">{t("currentSale")}</span>
            <span className="relative block h-4 text-xs text-muted">
              <span className={s.itemsOld}>{t("items", { n: 0 })}</span>
              <span className={s.items1} style={v({ "--t": "1300ms" })}>{t("items", { n: 1 })}</span>
              <span className={s.items2} style={v({ "--t": "2500ms" })}>{t("items", { n: 2 })}</span>
            </span>
          </span>
          <span className={cn(s.pop, "flex size-8 items-center justify-center rounded-full ring-1 ring-inset ring-line")} style={v({ "--t": "1500ms" })}>
            <Ellipsis size={14} aria-hidden className="text-muted" />
          </span>
        </div>
        <div className="relative min-h-0 flex-1 border-t border-hairline">
          <div className={cn(s.empty, "absolute inset-0 flex flex-col items-center justify-center gap-1 px-section text-center")} style={v({ "--t": "1300ms" })}>
            <ShoppingBag size={18} strokeWidth={1.5} aria-hidden className="mb-1 text-muted" />
            <span className="text-sm font-semibold">{t("noItems")}</span>
            <span className="text-xs text-muted">{t("tapToAdd")}</span>
          </div>
          <div className={cn(s.line, "absolute inset-x-0 top-0 flex flex-col gap-tight p-comfortable")} style={v({ "--t": "1300ms" })}>
            <div className="flex items-start gap-tight">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative */}
              <img src="/demo/pages/reentry-1.jpg" alt="" className="size-8 shrink-0 rounded-inner object-cover" />
              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-tight">All-Day Re-entry Pass</span>
              <Roll a={money(sub1)} b={money(sub2)} t={2500} className="text-sm tabular-nums" />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex h-8 items-center gap-tight rounded-full border border-line px-1.5">
                <Minus size={12} aria-hidden className="text-muted" />
                <Roll a="1" b="2" t={2500} className="w-3 text-center text-sm font-semibold" />
                <Plus size={12} aria-hidden />
              </span>
              <Percent size={14} aria-hidden className="text-muted" />
              <Trash2 size={14} aria-hidden className="text-muted" />
            </div>
          </div>
        </div>
        <div className={cn(s.foot, "flex flex-col gap-1 border-t border-hairline p-comfortable")} style={v({ "--t": "1300ms" })}>
          <span className="flex items-center justify-between text-xs text-muted">
            <span>{t("subtotal")}</span>
            <Roll a={money(sub1)} b={money(sub2)} t={2500} lh={18} />
          </span>
          <span className="flex items-center justify-between text-xs text-muted">
            <span>{t("vat", { pct: 15 })}</span>
            <Roll a={money(sub1 * VAT)} b={money(sub2 * VAT)} t={2500} lh={18} />
          </span>
          <span className="my-0.5 border-t border-hairline" />
          <span className="flex items-center justify-between">
            <span className="text-base font-semibold">{t("total")}</span>
            <Roll a={money(tot1)} b={money(tot2)} t={2500} lh={28} className="text-xl font-bold tabular-nums" />
          </span>
          <span className={cn(s.take, "mt-1 flex h-10 items-center justify-center gap-tight rounded-control bg-ember-solid text-base font-semibold text-on-solid")}>
            <Banknote size={16} aria-hidden />
            <Roll a={t("take", { amount: formatPriceShort(Math.round(tot1 * 100)) })} b={t("take", { amount: formatPriceShort(Math.round(tot2 * 100)) })} t={2500} lh={20} />
          </span>
        </div>
      </aside>
      <Pointer className={s.cursorSell} />
    </Win>
  );
}

/* ── 2 · Scan — the Go scan screen, then the verdict ──────────────────── */

/* A deterministic QR-looking pattern, so server and client draw the same one. */
const QR = (() => {
  const N = 21;
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        return ring || core ? 1 : 0;
      }
      if (dx >= -1 && dx < 8 && dy >= -1 && dy < 8) return 0;
    }
    return -1;
  };
  let d = "";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = finder(x, y);
    const on = f === -1 ? rnd() > 0.52 : f === 1;
    if (f === -1) rnd();
    if (on) d += `M${x} ${y}h1v1h-1z`;
  }
  return d;
})();

const CODE = "CF-2026-001001-01";

/** The kept counterfoil with its check — the admit mark of (go)/scan/_components/Verdict. */
function AdmitMark() {
  return (
    <svg viewBox="0 0 80 104" className="h-24 w-18 overflow-visible" aria-hidden>
      <rect x="4" y="10" width="58" height="84" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
      <path className={s.mark} d="M16 54 L27 65 L50 39" fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="71" y1="14" x2="71" y2="90" stroke="currentColor" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function SceneScan() {
  const t = useTranslations("auth.shell.story.mini");
  return (
    <Win>
      <GoSidebar active="scan" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 flex-col justify-center border-b border-hairline px-comfortable leading-tight">
          <span className="text-md font-semibold">{t("scanTitle")}</span>
          <span className="text-xs text-muted">{t("scanSub")}</span>
        </div>
        <div className="flex min-h-0 flex-1 gap-tight p-tight">
          {/* the camera viewport: placeholder ground, the ember corners, the
              ticket arriving in front of it */}
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-card bg-neutral-800">
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
              <VideoOff size={32} strokeWidth={1.5} className="text-neutral-500" />
            </span>
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
              <span className={cn("relative block size-44", s.frame)}>
                <span className="absolute left-0 top-0 size-7 rounded-tl-inner border-l-4 border-t-4 border-ember" />
                <span className="absolute right-0 top-0 size-7 rounded-tr-inner border-r-4 border-t-4 border-ember" />
                <span className="absolute bottom-0 left-0 size-7 rounded-bl-inner border-b-4 border-l-4 border-ember" />
                <span className="absolute bottom-0 right-0 size-7 rounded-br-inner border-b-4 border-r-4 border-ember" />
                <span className={s.ticketIn}>
                  <span className={s.qr}>
                    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden><path d={QR} /></svg>
                  </span>
                </span>
                <span className={s.beam} />
              </span>
            </span>
          </div>

          <div className="flex w-60 shrink-0 flex-col gap-tight">
            <div className="card-surface flex flex-col gap-1.5 p-comfortable">
              <span className="relative flex h-4 items-center gap-tight text-xs font-medium text-muted">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ember-solid" />
                <span className={s.readyOut}>{t("ready")}</span>
                <span className={s.readyIn}>{t("checking")}</span>
              </span>
              <span className="text-md font-semibold">{t("typeOrScan")}</span>
              <span className="flex gap-1.5">
                <span className={cn(s.field, "relative flex h-10 min-w-0 flex-1 items-center rounded-inner bg-subtle px-2 font-mono text-xs")}>
                  <span className={s.ph}>CF-2026-…</span>
                  <span className={s.typed}>{CODE}</span>
                </span>
                <span className="relative flex h-10 shrink-0 items-center justify-center rounded-control px-comfortable text-sm font-semibold">
                  <span className="absolute inset-0 rounded-control bg-btn-secondary" />
                  <span className={cn(s.checkOn, "absolute inset-0 rounded-control bg-ember-solid")} />
                  <span className="relative text-fg">{t("check")}</span>
                </span>
              </span>
              <span className="text-xs text-muted">{t("fieldHint")}</span>
            </div>
            <div className="card-surface flex flex-col gap-1.5 p-comfortable">
              <span className="text-md font-semibold">{t("onDevice")}</span>
              <span className="relative block h-9">
                <span className={cn(s.readyOut, "absolute inset-0 text-sm text-muted")}>{t("nothingScanned")}</span>
                <span className={cn(s.logRow, "absolute inset-0 flex items-center gap-tight")}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-inverse text-inverse-fg">
                    <Check size={14} strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-mono text-xs font-semibold">{CODE}</span>
                    <span className="block truncate text-xs text-muted">Sculpture Garden Tour</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatClock("14:05")}</span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* the verdict, as the scan result draws it: paper on ink */}
      <div className={cn(s.verdict, "absolute inset-0 flex flex-col items-center justify-center gap-comfortable bg-ink text-paper")}>
        <AdmitMark />
        <span className="text-4xl font-bold uppercase leading-none tracking-title">{t("letIn")}</span>
        <span className="text-xl">Sculpture Garden Tour · {t("ticket")}</span>
        <span className="rounded-full border border-neutral-400 bg-neutral-900 px-comfortable py-inline text-base">{t("ticketFor", { date: "18 Jul" })}</span>
        <span className="text-sm text-neutral-400">{CODE}</span>
      </div>
    </Win>
  );
}

/* ── 3 · Know — the OS dashboard ──────────────────────────────────────── */

/* A smooth path through points (Catmull-Rom to cubic Bezier). */
function smooth(pts: [number, number][]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
/* "Sales over time", 30 days: a plot 240 wide and 92 tall, ৳0 at the bottom. */
const PW = 240, PH = 92;
const DAYS = [2, 14, 38, 24, 12, 18, 30, 22, 8, 16, 46, 82, 36, 20, 28, 40, 18, 12, 24, 34, 20, 14, 26, 30, 16, 10, 22, 18, 8, 6];
const toPt = (ys: number[]): [number, number][] => ys.map((y, i) => [Math.round((PW / (ys.length - 1)) * i), Math.round(PH - (y / 90) * PH)]);
const LINE = smooth(toPt(DAYS));
const AXIS_Y = [0, 1, 2, 3].map((i) => ({ y: PH - (i / 3) * PH, label: formatMoneyCompact(i * 1_500_000) }));

export function SceneKnow() {
  const t = useTranslations("auth.shell.story.mini");
  const nav = [
    { k: "dashboard", Icon: LayoutGrid, on: true },
    { k: "calendar", Icon: CalendarDays },
    { k: "orders", Icon: ReceiptText, badge: "4" },
    { k: "customers", Icon: Users },
    { k: "catalog", Icon: Tags },
    { k: "analytics", Icon: ChartNoAxesColumn },
    { k: "finances", Icon: Wallet },
  ] as const;
  const tiles = [
    { k: "salesToday", Icon: Ticket, pre: "৳", val: "48,200", post: ".00", ctx: t("vsLastWeek"), at: 200 },
    { k: "placesSold", Icon: Users, val: "312", post: " / 735", ctx: t("fullPct", { pct: 42 }), at: 320 },
    { k: "arrived", Icon: UserRoundCheck, val: "286", post: ` ${t("of")} 312`, ctx: t("noShows", { pct: 8 }), at: 440 },
  ] as const;
  const feed = [
    { Icon: CircleCheck, title: t("paid"), sub: "CF-2026-001078", at: t("justNow"), ember: false },
    { Icon: Ticket, title: t("ticketRefused"), sub: "CF-2026-001023-02", at: t("minAgo", { n: 55 }), ember: true },
    { Icon: LogIn, title: t("signedIn"), sub: "Farhana Yasmin", at: t("hrAgo", { n: 3 }), ember: false },
    { Icon: RotateCcw, title: t("refundAsked"), sub: "CF-2026-001074", at: t("hrAgo", { n: 21 }), ember: false },
  ];
  return (
    <Win>
      <aside className="flex w-37 shrink-0 flex-col border-r border-hairline bg-chrome">
        <div className="flex h-14 shrink-0 items-center px-comfortable"><Logo size={20} /></div>
        <nav className="flex flex-col gap-0.5 px-tight">
          {nav.map(({ k, Icon, ...r }) => (
            <span key={k} className={cn("flex h-9 items-center gap-tight rounded-control px-tight text-sm", "on" in r ? "bg-nav-selected font-semibold text-fg" : "text-muted")}>
              <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t(k)}</span>
              {"badge" in r && <span className="rounded-full bg-subtle px-1.5 text-2xs font-medium text-fg">{r.badge}</span>}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-tight p-comfortable pt-0">
        <div className="flex h-14 shrink-0 items-center justify-between">
          <span className="truncate text-md font-semibold">Lalbagh Heritage Attractions</span>
          <span className="flex h-7 items-center rounded-control border border-line bg-card px-2 text-xs font-medium">LA</span>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-tight">
          {tiles.map(({ k, Icon, ...x }) => (
            <div key={k} className={cn(s.rise, "card-surface flex min-w-0 flex-col p-comfortable")} style={v({ "--t": `${x.at}ms` })}>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
                <span className="truncate">{t(k)}</span>
              </span>
              <span className="mt-1 flex items-baseline whitespace-nowrap text-2xl font-semibold tracking-figure">
                {"pre" in x ? x.pre : null}
                <Odometer text={x.val} t0={x.at} />
                <span className={cn("text-md font-medium", "pre" in x ? "text-fg" : "text-muted")}>{x.post}</span>
              </span>
              <span className="mt-0.5 truncate text-xs text-muted">{x.ctx}</span>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-tight">
          <div className={cn(s.rise, "card-surface flex min-w-0 flex-1 flex-col p-comfortable")} style={v({ "--t": "420ms" })}>
            <div className="flex items-center justify-between gap-tight">
              <span className="text-base font-semibold">{t("salesOverTime")}</span>
              <span role="presentation" className="flex shrink-0 overflow-hidden rounded-control border border-line text-xs font-medium">
                <span className="px-1.5 py-0.5 text-muted">{t("days", { n: 7 })}</span>
                <span className="px-1.5 py-0.5 text-muted">{t("days", { n: 14 })}</span>
                <span className="bg-ember-solid px-1.5 py-0.5 text-on-solid">{t("days", { n: 30 })}</span>
              </span>
            </div>
            <span className="mt-1 text-xl font-semibold tracking-figure">{formatMoney(14843391)}</span>
            <div className="relative mt-1 min-h-0 flex-1">
              <svg viewBox={`-34 -6 ${PW + 40} ${PH + 24}`} width={PW + 40} height={PH + 24} className="absolute left-0 top-0 overflow-visible" aria-hidden>
                <defs>
                  <linearGradient id="authStageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--color-ember-solid)", stopOpacity: 0.28 }} />
                    <stop offset="1" style={{ stopColor: "var(--color-ember-solid)", stopOpacity: 0 }} />
                  </linearGradient>
                  <clipPath id="authStageReveal"><rect className={s.reveal} x="-2" y="-8" width={PW + 8} height={PH + 12} /></clipPath>
                </defs>
                {AXIS_Y.map(({ y, label }) => (
                  <g key={label}>
                    <line x1="0" x2={PW} y1={y} y2={y} className={s.gridLine} />
                    <text x="-6" y={y + 3} textAnchor="end" className="fill-muted text-2xs">{label}</text>
                  </g>
                ))}
                <g clipPath="url(#authStageReveal)">
                  <path d={`${LINE}L${PW} ${PH}L0 ${PH}Z`} fill="url(#authStageFill)" />
                  <path d={LINE} className={s.line} />
                </g>
                {[1, 8, 15, 22, 29].map((d) => (
                  <text key={d} x={Math.round((PW / 29) * (d - 1))} y={PH + 14} textAnchor="middle" className="fill-muted text-2xs">{d}</text>
                ))}
              </svg>
            </div>
          </div>

          <div className={cn(s.rise, "card-surface flex w-56 shrink-0 flex-col p-comfortable")} style={v({ "--t": "560ms" })}>
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">{t("activity")}</span>
              <span className="flex items-center gap-1 text-xs text-muted">{t("all")}<ChevronDown size={12} aria-hidden /></span>
            </div>
            <ul className="mt-1 flex min-h-0 flex-1 flex-col justify-between">
              {feed.map((r, i) => (
                <li key={i} className={cn(s.feedRow, "flex items-center gap-tight")} style={v({ "--t": `${900 + i * 320}ms` })}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", r.ember ? "bg-ember-wash text-ember" : "bg-subtle text-muted")}>
                    <r.Icon size={13} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-xs font-semibold">{r.title}</span>
                    <span className="block truncate text-2xs text-muted">{r.sub}</span>
                  </span>
                  <span className="shrink-0 text-2xs text-muted">{r.at}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Win>
  );
}

/* ── 4 · Fill — the Go schedule board ─────────────────────────────────── */

const HOURS = ["12:00", "13:00", "14:00", "15:00", "16:00"];
const LANES = ["Lane 1", "Lane 2", "Lane 3"];
const hourParts = (hhmm: string) => {
  const [a, b] = formatClock(hhmm, { short: true }).split(" ");
  return { a, b };
};
const priceOf = () => formatPriceShort(100000);

export function SceneFill() {
  const t = useTranslations("auth.shell.story.mini");
  const days = [["T", "28"], ["W", "29"], ["T", "30"], ["F", "31"], ["Aug", "1"], ["S", "2"], ["S", "3"]];
  return (
    <Win>
      <GoSidebar active="schedule" />
      <div className="flex min-w-0 flex-1 flex-col gap-tight p-tight">
        <div className="flex h-10 shrink-0 items-center gap-tight">
          <span className="text-md font-semibold">{t("schedule")}</span>
          <span className="flex items-center gap-1">
            <span className="flex size-7 items-center justify-center rounded-full ring-1 ring-inset ring-line"><ChevronLeft size={14} aria-hidden /></span>
            <span className="px-1 text-sm font-semibold">July 2026</span>
            <span className="flex size-7 items-center justify-center rounded-full ring-1 ring-inset ring-line"><ChevronRight size={14} aria-hidden /></span>
          </span>
          <span className="card-surface ml-auto flex h-9 shrink-0 items-center overflow-hidden rounded-control p-0.5 text-sm font-semibold">
            <span className="relative flex h-8 items-center rounded-control bg-ember-solid px-comfortable text-on-solid">{t("lanes")}</span>
            <span className="px-comfortable text-muted">{t("fields")}</span>
            <span className="px-comfortable text-muted">{t("courts")}</span>
          </span>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {days.map(([d, n], i) => (
            <span key={i} className={cn("flex h-12 w-10 flex-col items-center justify-center rounded-md text-xs font-medium", i === 1 ? "bg-ember-solid text-on-solid" : "bg-card text-muted ring-1 ring-inset ring-line")}>
              <span>{d}</span>
              <span className="text-md font-semibold leading-tight">{n}</span>
            </span>
          ))}
        </div>

        <div className="card-surface relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="grid shrink-0 grid-cols-[2.75rem_repeat(3,minmax(0,1fr))] border-b border-hairline text-sm font-medium">
            <span className="flex flex-col items-center justify-center py-1 text-2xs leading-tight text-muted"><span>Wed</span><span className="text-xs font-semibold text-fg">29</span></span>
            {LANES.map((l) => <span key={l} className="flex items-center justify-center border-l border-hairline py-2">{l}</span>)}
          </div>
          <div className="relative grid min-h-0 flex-1 grid-cols-[2.75rem_repeat(3,minmax(0,1fr))] grid-rows-5">
            {HOURS.map((h, r) => {
              const { a, b } = hourParts(h);
              return [
                <span key={`h${h}`} className="flex flex-col items-center justify-center border-t border-hairline text-xs font-semibold leading-tight first:border-t-0">
                  <span className="text-sm">{a}</span><span className="text-2xs text-muted">{b}</span>
                </span>,
                ...LANES.map((l, c) => {
                  const target = r === 2 && c === 0;
                  const done = r === 0 && c === 1;
                  return (
                    <span key={`${h}${l}`} className={cn("relative flex items-center justify-center border-l border-t border-hairline p-0.5", r === 0 && "border-t-0")}>
                      {done ? (
                        <span className="flex size-full flex-col justify-center rounded-inner border-l-2 border-success bg-success-wash px-1.5 leading-tight">
                          <span className="flex items-center gap-1 truncate text-xs font-semibold"><CircleCheck size={11} aria-hidden className="shrink-0 text-success" />Tanvir Rahman</span>
                          <span className="truncate text-2xs text-muted">Bowling Lane</span>
                        </span>
                      ) : (
                        <span className={cn("flex flex-col items-center leading-tight text-muted", target && s.freeOut)} style={target ? v({ "--t": "1500ms" }) : undefined}>
                          <Plus size={13} aria-hidden />
                          <span className="text-xs">{priceOf()}</span>
                        </span>
                      )}
                      {target && (
                        <>
                          <span className={cn(s.booked, "absolute inset-0.5 flex flex-col justify-center rounded-inner border-l-2 border-ember-solid bg-ember-wash px-1.5 leading-tight")} style={v({ "--t": "1500ms" })}>
                            <span className="truncate text-xs font-semibold">Farhana Haque</span>
                            <span className="truncate text-2xs text-muted">Bowling Lane</span>
                          </span>
                          <span aria-hidden className={s.ripple} style={v({ "--t": "1500ms" })} />
                        </>
                      )}
                    </span>
                  );
                }),
              ];
            })}
          </div>
          </div>
        <div className="flex h-8 shrink-0 items-center gap-major text-xs text-muted">
          <span className="flex items-center gap-1"><Plus size={12} aria-hidden />{t("free")}</span>
          <span className="flex items-center gap-1"><span aria-hidden className="h-3 w-1 rounded-xs bg-ember-solid" />{t("booked")}</span>
          <span className="flex items-center gap-1"><span aria-hidden className="h-3 w-1 rounded-xs bg-success" />{t("checkedIn")}</span>
          <span className={cn(s.toast, "ml-auto flex h-8 items-center gap-1.5 rounded-full border border-success-line bg-success-wash px-comfortable text-sm font-medium text-success")}>
            <Check size={14} strokeWidth={2.5} aria-hidden />{t("booked")} · {formatClock("14:00")}
          </span>
        </div>
      </div>
      <Pointer className={s.cursorFill} />
    </Win>
  );
}

export const SCENES = [SceneSell, SceneScan, SceneKnow, SceneFill] as const;
