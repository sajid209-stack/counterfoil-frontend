"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, ListFilter } from "lucide-react";
import { AreaChart, Button, DeltaPill, Select, StatStrip, StatusPill, type StatItem } from "@/components/ui";
import { PageShell } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import {
  getOperator,
  getResourceMatrix,
  getSlots,
  listBookings,
  listCounters,
  listActivity,
  ACTIVITY_GROUPS,
  type ActivityEvent,
  type ActivityGroup,
  listDevices,
  listLocations,
  listOrders,
  listProducts,
  listStaff,
  orderOutstanding,
  isVoidedOrder,
  type Order,
} from "@/lib/api";
import { DEMO_TODAY, demoNow, isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import { formatClock, formatDateTime, formatDay, formatMoney, formatMoneyCompact, formatRelative } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { useActiveLocation } from "@/lib/activeLocation";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { ACTIVITY_ICON, SEVERITY_ICON_CLASS, useActivityText } from "../activity/_components/parts";
import { MetricStrip, type Metric } from "./_components/MetricStrip";
import { Segmented } from "./_components/Segmented";

// The demo clock is shared, never copied: DEMO_TODAY's own comment warns
// that two components each holding their own date is the bug.
const TODAY = DEMO_TODAY;
const NOW_MIN = 12 * 60; // mock clock: noon
const dayShift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Count-up over 320ms for the hero figures. */
function useCountUp(target: number, ms = 320) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const paidish = (o: Order) => o.status === "paid" || o.status === "partial";

/** The card's filter: every group of the activity log, or all of it. The
 *  groups are the log's own (sign-ins, gate, sales, bookings, devices,
 *  settings), so the card and the /activity page cannot name them differently. */
type ActivityFilter = "all" | ActivityGroup;
/** How many events the card shows on a desktop. It exists to balance the rail
 *  against the column beside it - the reference's two columns finish level,
 *  which is most of why its page reads as settled rather than ragged. An event
 *  is a sentence that often wraps to two lines, so it is taller than the old
 *  one-line order rows. Re-measure if this card's anatomy changes. A phone has
 *  no column beside it and shows five: it is a glance, and the full log is one
 *  press away. */
const ACTIVITY_ROWS = 11;
const ACTIVITY_ROWS_PHONE = 5;
/** Recent orders on a phone: a short list, not a table. */
const ORDER_ROWS_PHONE = 5;

/** The soft disc an activity row leads with. One glyph per kind, so a row never
 *  depends on colour alone — but no outline: the disc is a tint, not a box. */
function Marker({ kind, severity }: { kind: ActivityEvent["kind"]; severity: ActivityEvent["severity"] }) {
  const Icon = ACTIVITY_ICON[kind];
  return (
    <span aria-hidden className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted-wash", SEVERITY_ICON_CLASS[severity])}>
      <Icon size={15} strokeWidth={1.5} />
    </span>
  );
}

/** "Warning" in words, for an event somebody should look at. Quiet otherwise. */
function Importance({ severity, label }: { severity: ActivityEvent["severity"]; label: string }) {
  if (severity === "info") return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-tight py-px text-[12px] font-medium", severity === "critical" ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning")}>
      {label}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  // Column names live in the orders namespace already; duplicating them
  // here would be two places for one word to drift.
  const to = useTranslations("orders");
  const enumL = useEnumLabels();
  const ax = useActivityText();
  /* Which shape of the page is drawn, rather than both with one hidden: a
     hidden copy is a real node that comes first in document order, and this app
     has been caught by that more than once. The phone gets a different PAGE,
     not a squeezed desktop. */
  const wide = useMediaQuery(MD);
  const op = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100, filters: { status: "active" } }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 1 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 1 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);

  /* Read, not chosen here: the bar owns it. */
  const { id: locationId } = useActiveLocation(locationsQ.data?.data ?? []);
  const [scope, setScope] = useState<"today" | "week">("today");
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(30);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [more, setMore] = useState(false);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const skip = (key: string) => setSkipped((s) => ({ ...s, [key]: true }));
  const has = (q: { data?: { page: { total: number } } }) => (q.data?.page.total ?? 0) > 0;

  const loading = ordersQ.loading || bookingsQ.loading || productsQ.loading;
  const locations = locationsQ.data?.data ?? [];
  const allOrders = ordersQ.data?.data ?? [];
  const orders = locationId ? allOrders.filter((o) => o.locationId === locationId) : allOrders;
  const bookings = bookingsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];

  const scopeDays = useMemo(() => (scope === "today" ? [TODAY] : Array.from({ length: 7 }, (_, i) => dayShift(TODAY, i - 6))), [scope]);

  // ── Recent orders ─────────────────────────────────────────────────────────
  // A dashboard orders table is NOT the orders index in miniature, and it is
  // not the activity feed either. Live activity answers "what just happened"
  // as a stream of mixed events; /orders answers "find me an order" with
  // search, filters and pagination. This answers the third question a manager
  // opens the page with — "what has sold, and is any of it unpaid" — which is
  // why it obeys the page's OWN controls (the Today/This-week scope and the
  // location filter) rather than carrying a second set. A table here that
  // ignored them would contradict every other card on the page.
  const now = useMemo(() => demoNow(), []);
  const scopeOrders = useMemo(
    () =>
      orders
        .filter((o) => scopeDays.includes(o.createdAt.slice(0, 10)))
        // Date.parse, not localeCompare: the seed spells timestamps two ways
        // (generated records are Z, hand-authored ones carry +06:00), so a
        // string sort puts a 12-minute-old order below a 55-minute-old one.
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders, scopeDays],
  );
  const recentOrders = scopeOrders.slice(0, wide ? 8 : ORDER_ROWS_PHONE);
  // Cancelled and refunded orders are listed — they are part of what happened —
  // but they can never be owed.
  const owedOrders = scopeOrders.filter((o) => !isVoidedOrder(o) && orderOutstanding(o) > 0);
  const scopeOwedCount = owedOrders.length;
  const scopeOwed = owedOrders.reduce((sum, o) => sum + orderOutstanding(o), 0);
  /* This card deliberately does NOT print a revenue total.
     It did at first — "24 orders · ৳110,082.50 collected" — and the hero two
     screens up read ৳111,620.00 for the same window. Both were right and they
     measure different things: the hero counts an order's full total once it is
     paid or part-paid, this counted the cash actually taken across every order
     including pending ones. But two money figures of the same window, differing
     by an amount nothing on screen accounts for, is how a dashboard loses
     trust — and the gap is not even a single subtraction, because the hero
     excludes pending orders entirely while an outstanding balance includes
     them. So the page keeps ONE revenue figure, the hero's, and this card
     contributes the thing the hero cannot say: what is still owed. */
  const prevDays = useMemo(() => scopeDays.map((d) => dayShift(d, -7)), [scopeDays]);

  // ── Hero: revenue ─────────────────────────────────────────────────────────
  const revenueIn = (days: string[]) => orders.filter((o) => paidish(o) && days.includes(o.createdAt.slice(0, 10))).reduce((s, o) => s + o.total, 0);
  const revenue = revenueIn(scopeDays);
  const revenuePrev = revenueIn(prevDays);
  const revenueAnimated = useCountUp(revenue);

  // ── Revenue trend ────────────────────────────────────────────────────────
  // The ranges stop at 30 days because that is how much history exists: the
  // seed writes orders across the last 30 days only (generate.ts), so a 3M or
  // 1Y range would draw a flat line through months that never had a sale. The
  // day is the unit here, not the month, for the same reason.
  //
  // The comparison series has to earn its place too. Comparing 30 days against
  // the 30 before them needs SIXTY days of history; with thirty, the previous
  // window is empty except for its last day or two, which does not read as
  // "we grew" — it reads as +15663%. So the comparison is drawn only when the
  // ledger actually covers the window behind, and is otherwise absent rather
  // than wrong. Real order history will switch it on by itself.
  const earliestOrder = useMemo(
    () => orders.filter(paidish).reduce<string | null>((min, o) => {
      const d = o.createdAt.slice(0, 10);
      return min === null || d < min ? d : min;
    }, null),
    [orders],
  );
  const comparable = earliestOrder != null && dayShift(TODAY, -(2 * trendDays - 1)) >= earliestOrder;

  const trend = useMemo(() => {
    const days = trendDays;
    return Array.from({ length: days }, (_, i) => {
      const date = dayShift(TODAY, i - (days - 1));
      const d = new Date(`${date}T12:00:00Z`);
      return {
        label: d.getUTCDate().toString(),
        title: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
        value: revenueIn([date]),
        ...(comparable ? { compare: revenueIn([dayShift(date, -days)]) } : {}),
      };
    });
  }, [orders, trendDays, comparable]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendTotal = trend.reduce((s, p) => s + p.value, 0);
  const trendPrev = trend.reduce((s, p) => s + (p.compare ?? 0), 0);

  // ── Hero: capacity — the number no other system can show ─────────────────
  const capacityFor = (days: string[]) => {
    let cap = 0;
    for (const d of days) {
      for (const p of products) {
        if (!p.schedule) continue;
        if (p.schedule.dailyCapacity) cap += p.schedule.dailyCapacity;
        else if (isResourceType(p.bookingType)) cap += getResourceMatrix(p, d).reduce((s, r) => s + r.slots.length, 0);
        else if (isSlotBased(p.bookingType)) cap += getSlots(p, d).reduce((s, x) => s + x.capacity, 0);
      }
    }
    return cap;
  };
  const soldFor = (days: string[]) => bookings.filter((b) => b.status === "confirmed" && days.includes(b.slotStart.slice(0, 10))).reduce((s, b) => s + b.partySize, 0);
  const capacity = useMemo(() => capacityFor(scopeDays), [scopeDays, products]); // eslint-disable-line react-hooks/exhaustive-deps
  const sold = soldFor(scopeDays);
  const soldPrev = soldFor(prevDays);
  const soldPct = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;

  // ── Hero: arrived / no-show ───────────────────────────────────────────────
  const scoped = bookings.filter((b) => b.status === "confirmed" && scopeDays.includes(b.slotStart.slice(0, 10)));
  const arrived = scoped.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
  const noShowPct = sold > 0 ? Math.round(((sold - arrived) / sold) * 100) : 0;

  // ── Hero: booked ahead — committed revenue, next 7 days ──────────────────
  const bookedAhead = (from: number, to: number) => {
    const ids = new Set(
      bookings
        .filter((b) => { const d = b.slotStart.slice(0, 10); return b.status === "confirmed" && d >= dayShift(TODAY, from) && d <= dayShift(TODAY, to); })
        .map((b) => b.orderId),
    );
    return orders.filter((o) => ids.has(o.id) && paidish(o)).reduce((s, o) => s + o.total, 0);
  };
  const ahead = bookedAhead(1, 7);
  const aheadPrev = bookedAhead(8, 14);

  // ── Unbooked hours today ──────────────────────────────────────────────────
  // What survives of the Today's-sessions derivation. The card is gone, but
  // Operations at a glance still states how many resource hours nobody has
  // taken, and this is where that figure came from. Only the free-hour count
  // is computed now: the session list, its ordering and its "+N hidden" tail
  // existed solely to fill the card.
  const freeSlots = useMemo(() => {
    let free = 0;
    for (const p of products) {
      if (!isResourceType(p.bookingType) || p.flexibleDurations) continue;
      for (const r of getResourceMatrix(p, TODAY)) {
        if (r.resource.outOfService) continue;
        for (const slot of r.slots) {
          if (toMinutes(slot.time) < NOW_MIN) continue;
          if (slot.available) free++;
        }
      }
    }
    return free;
  }, [products]);

  // ── Activity ─────────────────────────────────────────────────────────────
  // The card is the activity LOG, not a sales feed: who did what, where, when -
  // a staff member signing in on a counter, a second scan refused at the gate,
  // a refund asked for, a device paired. The log (lib/api/activity) merges what
  // the records already say with what the tills write down live, and the card
  // shows its latest few for the venue in the bar. Loaded in the browser, so
  // the clock times it prints are the reader's and never the server's.
  const activityRows = wide ? ACTIVITY_ROWS : ACTIVITY_ROWS_PHONE;
  const activityQ = useApiQuery(
    () => listActivity({ locationId, groups: activityFilter === "all" ? undefined : [activityFilter], pageSize: activityRows }),
    [locationId, activityFilter, activityRows],
  );
  const activity = activityQ.data?.data ?? [];

  // Idle capacity — unsold places in the next 48h, priced.
  const idle = useMemo(() => {
    // The whole list, not the top few: the card now states what idle capacity
    // is WORTH across the window, and a total taken after slice(0, 4) would
    // have been the total of four rows pretending to be the total of all.
    const out: { text: string; value: number; href: string }[] = [];
    for (const d of [TODAY, dayShift(TODAY, 1)]) {
      for (const p of products) {
        if (!isSlotBased(p.bookingType) || isResourceType(p.bookingType)) continue;
        for (const s of getSlots(p, d)) {
          if (d === TODAY && toMinutes(s.time) < NOW_MIN) continue;
          if (s.capacity > 1 && s.sold / s.capacity < 0.3) {
            const price = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
            out.push({ text: `${d === TODAY ? "" : t("tomorrow")}${formatClock(s.time)} ${p.name} · ${s.sold}/${s.capacity}`, value: s.remaining * price, href: `/catalog/bookings/${p.id}` });
          }
        }
      }
    }
    return out.sort((a, b) => b.value - a.value);
  }, [products, t]);

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.payments.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount)));
    return [...m.entries()].map(([k, v]) => ({ label: enumL.method(k), amount: v })).sort((a, b) => b.amount - a.amount);
  }, [orders, enumL]);
  const mixTotal = mix.reduce((a, m) => a + m.amount, 0);
  const idleTotal = idle.reduce((a, x) => a + x.value, 0);

  /** The four headline figures, stated once. A desktop draws them as the
   *  shared tiles; a phone as a row of compact cards that scroll sideways.
   *  They carry no icons: a tinted glyph above every figure said nothing the
   *  label beside it did not, and four of them were the loudest thing on the
   *  page after the chart. */
  const figures: Metric[] = [
    {
      key: "revenue",
      label: scope === "today" ? t("revenueToday") : t("revenueThisWeek"),
      value: formatMoney(revenueAnimated),
      // Says what the delta beside it is measured against, which depends on
      // the scope: a week is compared with the week before, not with a day.
      context: scope === "today" ? t("vsLastWeek") : t("vsWeekBefore"),
      delta: <DeltaPill now={revenue} then={revenuePrev} />,
    },
    {
      key: "sold",
      label: t("capacitySold"),
      value: <>{sold} <span className="text-lg text-muted">/ {capacity}</span></>,
      // "5 / 772" already IS the ratio, so the line states it as a share of
      // the whole rather than repeating the label ("of places sold").
      context: t("pctSold", { pct: soldPct }),
      delta: <DeltaPill now={sold} then={soldPrev} />,
    },
    {
      key: "arrived",
      label: t("arrived"),
      value: <>{arrived} <span className="text-lg text-muted">{t("arrivedOf", { total: sold })}</span></>,
      context: t("noShow", { pct: noShowPct }),
      contextTone: noShowPct >= 30 ? "text-danger" : undefined,
    },
    {
      key: "ahead",
      label: t("bookedAhead"),
      value: formatMoney(ahead),
      context: t("next7Days"),
      delta: <DeltaPill now={ahead} then={aheadPrev} />,
    },
  ];
  /* The shared tiles take their own shape of item; `danger` and the strip's
     action slot are not part of it. */
  const stats: StatItem[] = figures.map((m) => ({ key: m.key, label: m.label, value: m.value, context: m.context, contextTone: m.contextTone, delta: m.delta, tone: m.tone === "warning" ? "warning" : undefined }));

  const ops = useMemo(() => [
    {
      key: "shifts",
      label: t("openShifts"),
      // Mock shift record — the Shift entity is a backend-lane item.
      value: "1",
      // Name only: at a quarter of 757px the location pushed this into an
      // ellipsis, and it was the one truncated string in the card.
      sub: "Nadia Islam",
      href: undefined,
    },
    {
      key: "mix",
      label: t("paymentMix"),
      // The leading method's share leads, because "which way is the money
      // coming in" is the question; the bar under it carries the rest.
      value: mixTotal > 0 ? `${mix[0].label} ${Math.round((mix[0].amount / mixTotal) * 100)}%` : "—",
      sub: null,
      href: "/analytics",
    },
    {
      key: "idle",
      label: t("idleCapacity"),
      value: formatMoneyCompact(idleTotal),
      sub: t("idleSessions", { count: idle.length }),
      href: "/calendar",
    },
    {
      key: "free",
      label: t("unbookedHours"),
      value: String(freeSlots),
      sub: t("todayLower"),
      href: "/calendar",
    },
  ], [mix, mixTotal, idle, idleTotal, freeSlots, t]);

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number }>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.lines.forEach((l) => {
      if (l.unitPrice <= 0) return;
      const cur = m.get(l.productName) ?? { qty: 0, rev: 0 };
      // F11: line NET totals — add-on child lines count as their own product.
      m.set(l.productName, { qty: cur.qty + l.quantity, rev: cur.rev + (l.taxableAmount ?? l.unitPrice * l.quantity) });
    }));
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 6);
  }, [orders]);
  // Bars are scaled to the best seller, not to the total — the question the
  // list answers is "how do these compare with each other".
  const topMax = Math.max(...top.map(([, r]) => r.rev), 1);

  // ── Setup checklist (replaces the hero until finished) ───────────────────
  const steps = [
    { key: "business", label: t("stepBusiness"), done: !!op.data?.name, href: "/settings/business" },
    { key: "location", label: t("stepLocation"), done: locations.length > 0, href: "/settings/locations/new" },
    { key: "counter", label: t("stepCounter"), done: has(counters), href: "/settings/counters/new" },
    { key: "team", label: t("stepTeam"), done: has(staffQ), href: "/settings/team/new" },
    { key: "product", label: t("stepProduct"), done: products.length > 0, href: "/catalog/new" },
    { key: "device", label: t("stepDevice"), done: (devicesQ.data?.page.total ?? 0) > 0, href: "/settings/devices/new" },
  ];
  const complete = steps.filter((s) => s.done || skipped[s.key]).length;
  const allDone = complete === steps.length;

  const card = "card-surface";
  const heading = "min-w-0 truncate text-base font-semibold tracking-[-0.4px]";
  /** A quiet link row that ends a card: text, an arrow, no box. */
  const linkRow =
    "flex min-h-11 w-full items-center gap-tight px-card text-left text-[13px] font-medium text-muted transition-colors duration-quick hover:text-fg";

  // ── The cards, each drawn once and placed by the layout below ────────────
  const trendCard = (
    <div className={`${card} p-card`}>
      <div className="flex flex-wrap items-start justify-between gap-tight">
        <div className="min-w-0">
          <h2 className={heading}>{t("revenueTrend")}</h2>
          <div className="mt-tight flex flex-wrap items-baseline gap-tight">
            <span className="whitespace-nowrap text-[28px] font-semibold">{formatMoney(trendTotal)}</span>
            <DeltaPill now={trendTotal} then={trendPrev} />
          </div>
          {/* What the delta is measured against - and nothing when there is no
              delta: "Last 30 days" restated the range control beside it. */}
          {comparable && <p className="mt-inline text-[12px] text-muted">{t("vsPreviousDays", { count: trendDays })}</p>}
        </div>
        {/* Ranges the seed can actually fill — see the trend memo. */}
        {wide && (
          <Segmented
            value={String(trendDays)}
            onChange={(v) => setTrendDays(Number(v) as 7 | 14 | 30)}
            label={t("revenueTrend")}
            options={([7, 14, 30] as const).map((d) => ({ value: String(d), label: t("lastDays", { count: d }) }))}
          />
        )}
      </div>
      {!wide && (
        <Segmented
          fill
          className="mt-comfortable"
          value={String(trendDays)}
          onChange={(v) => setTrendDays(Number(v) as 7 | 14 | 30)}
          label={t("revenueTrend")}
          options={([7, 14, 30] as const).map((d) => ({ value: String(d), label: t("lastDays", { count: d }) }))}
        />
      )}
      <div className="mt-section">
        <AreaChart
          points={trend}
          fmt={(v) => formatMoney(v)}
          fmtAxis={(v) => formatMoneyCompact(v)}
          /* 210 on a desktop, 150 on a phone with three axis figures instead of
             five. The figure is stated above in full, so the line is there to
             show the direction rather than to be read off. */
          height={wide ? 210 : 150}
          ticks={wide ? 4 : 2}
          valueLabel={comparable ? t("thisPeriod") : t("revenueTrend")}
          compareLabel={t("previousPeriod")}
        />
      </div>
    </div>
  );

  const glanceCard = (
    <div className={`${card} p-card`}>
      <h2 className={cn(heading, "mb-section")}>{t("operations")}</h2>
      {/* One shape, four times — label, figure, sub-line — with the sub-lines
          pushed to the bottom of their cell so the base of the card is
          straight however tall the figures run. Labels are sentence case: an
          uppercase tracked label is the one thing a calm admin does not do. */}
      <div className="grid gap-major sm:grid-cols-2 lg:grid-cols-4">
        {ops.map((o) => {
          const body = (
            <>
              <p className="text-[13px] font-medium text-muted">{o.label}</p>
              <p className="mt-tight truncate text-[20px] font-semibold tracking-[-0.5px]">{o.value}</p>
              <div className="mt-auto pt-tight">
                {o.key === "mix" ? (
                  // The mix is a proportion, so it keeps a picture of one.
                  mixTotal > 0 ? (
                    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={mix.map((m) => `${m.label} ${formatMoney(m.amount)}`).join(", ")}>
                      {mix.map((m, i) => (
                        <span key={m.label} className="h-full bg-ember" style={{ width: `${(m.amount / mixTotal) * 100}%`, opacity: 1 - i * 0.35 }} />
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">{t("noPayments")}</span>
                  )
                ) : (
                  <span className="block text-[12px] text-muted">{o.sub}</span>
                )}
              </div>
            </>
          );
          return o.href ? (
            <button key={o.key} type="button" onClick={() => router.push(o.href!)} className="group flex min-h-[84px] min-w-0 flex-col text-left">
              {body}
            </button>
          ) : (
            <div key={o.key} className="flex min-h-[84px] min-w-0 flex-col">{body}</div>
          );
        })}
      </div>
    </div>
  );

  const bestCard = (
    <div className={`${card} p-card`}>
      <div className="mb-comfortable flex items-baseline justify-between gap-tight">
        <h2 className={heading}>{t("topProducts")}</h2>
        <button type="button" onClick={() => router.push("/analytics")} className="-my-tight flex min-h-11 shrink-0 items-center whitespace-nowrap px-tight text-[12px] text-muted transition-colors duration-quick hover:text-fg sm:min-h-0 sm:px-0">{t("viewAll")}</button>
      </div>
      {/* Name and money on the first line, then a full-width bar. The bar is
          the point — a ranked list of numbers makes you compare digits; a bar
          makes the ranking visible without reading any of them. No icon per
          row: the same glyph on every line said nothing. */}
      {top.length === 0 ? <p className="text-[13px] text-muted">{t("nothingSold")}</p> : (
        <div className="flex flex-col gap-comfortable">
          {top.map(([name, row]) => (
            <div key={name} className="min-w-0">
              <div className="flex items-baseline justify-between gap-tight text-[13px]">
                <span className="min-w-0 truncate">{name}</span>
                <span className="shrink-0 whitespace-nowrap text-[12px]">{formatMoney(row.rev)}</span>
              </div>
              <div className="mt-inline flex items-center gap-tight">
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full bg-ember" style={{ width: `${topMax > 0 ? Math.max(4, (row.rev / topMax) * 100) : 0}%` }} />
                </span>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{t("qtyTimes", { qty: row.qty })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const activityCard = (
    <div className={card}>
      <div className="flex items-baseline justify-between gap-tight px-card pb-tight pt-card">
        <h2 className={heading}>{t("activityTitle")}</h2>
        {/* One compact control: the filter glyph is the Select's own icon slot,
            so glyph and label share a flex row with a real gap and cannot
            overlap. `bare` draws no box, and the popover is a card of our own. */}
        <div className="flex shrink-0 items-center text-muted focus-within:text-fg hover:text-fg">
          <Select
            bare
            icon={<ListFilter size={13} strokeWidth={1.5} aria-hidden />}
            aria-label={t("filterActivity")}
            value={activityFilter}
            onChange={(v) => setActivityFilter(v as ActivityFilter)}
            align="end"
            triggerClassName="text-[12px] font-normal text-current"
            options={[
              { value: "all", label: t("filterAll") },
              ...ACTIVITY_GROUPS.map((g) => ({ value: g, label: ax.groupLabel(g) })),
            ]}
          />
        </div>
      </div>
      {/* Each event: a soft glyph disc, the sentence, the time. An ordinary
          event is one sentence; a warning or a serious one adds its importance
          in words - the colour is never the only thing saying so, and there is
          no tinted row behind it. */}
      {activityQ.loading && activity.length === 0 ? (
        <div aria-busy="true">
          {Array.from({ length: wide ? 5 : 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-section px-card py-comfortable">
              <div className="h-8 w-8 animate-pulse rounded-full bg-subtle" />
              <div className="h-4 flex-1 animate-pulse rounded-sm bg-subtle" />
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="px-card pb-comfortable text-[13px] text-muted">{t("noActivity")}</p>
      ) : activity.map((a) => (
        <div key={a.id} className="flex items-start gap-section px-card py-comfortable">
          <Marker kind={a.kind} severity={a.severity} />
          <div className="min-w-0 flex-1">
            <p className={cn("break-words text-[13px] leading-snug", !wide && "line-clamp-2")}>{ax.sentence(a)}</p>
            {/* Time beside the sentence on a desktop, under it on a phone,
                where a right-hand column would take a third of the width. */}
            {(!wide || a.severity !== "info") && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-tight gap-y-0.5 text-[12px] text-muted">
                {!wide && <span className="whitespace-nowrap">{ax.ago(a.at)}</span>}
                <Importance severity={a.severity} label={ax.severityLabel(a.severity)} />
              </p>
            )}
          </div>
          {wide && <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-muted">{ax.ago(a.at)}</span>}
        </div>
      ))}
      <button type="button" onClick={() => router.push("/activity")} className={linkRow}>
        <span className="min-w-0 flex-1 truncate">{t("viewAllActivity")}</span>
        <ArrowRight size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
      </button>
    </div>
  );

  const ordersCard = (
    /* Built in the dashboard's own table anatomy — header, hairline rows, a
       footer link — rather than with the shared DataTable, which draws its own
       frame and would sit as a card inside a card. What DataTable gives for
       free is carried over explicitly: rows are a keyboard tab stop with
       Enter/Space, the phone gets a purpose-built list rather than five
       labelled pairs, and the empty state says which window it is empty for. */
    <div className={card}>
      <div className="flex items-baseline justify-between gap-tight px-card pb-tight pt-card">
        <h2 className={heading}>{t("recentOrders")}</h2>
        {/* The count is the scope's, not the rows' — otherwise the header would
            describe the slice rather than the day. */}
        <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{t("orderCount", { count: scopeOrders.length })}</span>
      </div>

      {scopeOrders.length === 0 ? (
        <p className="px-card pb-comfortable pt-tight text-[13px] text-muted">
          {scope === "today" ? t("noOrdersToday") : t("noOrdersThisWeek")}
        </p>
      ) : wide ? (
        /* A real table element, so each header cell is announced with its
           column and the figures line up. It scrolls inside its own card rather
           than out of the page: at 768, where `md` turns the table on and the
           rail is also on, `main` is 528px and five columns need 724. */
        <div className="scroll-x-hint min-w-0 overflow-x-auto">
          <table className="table-inset w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th scope="col" className="px-major py-tight text-[12px] font-medium text-muted">{to("colDate")}</th>
                <th scope="col" className="px-major py-tight text-[12px] font-medium text-muted">{to("colReference")}</th>
                <th scope="col" className="px-major py-tight text-center text-[12px] font-medium text-muted">{to("colItems")}</th>
                <th scope="col" className="px-major py-tight text-right text-[12px] font-medium text-muted">{to("colTotal")}</th>
                <th scope="col" className="px-major py-tight text-right text-[12px] font-medium text-muted">{to("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => {
                const due = isVoidedOrder(o) ? 0 : orderOutstanding(o);
                return (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={() => router.push("/orders/" + o.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/orders/" + o.id); } }}
                    className="cursor-pointer border-b border-hairline transition-colors duration-quick last:border-0 hover:bg-muted-wash focus-visible:bg-muted-wash"
                  >
                    <td className="whitespace-nowrap px-major py-tight text-[13px] text-muted" title={formatDateTime(o.createdAt)}>
                      {formatRelative(o.createdAt, now)}
                    </td>
                    {/* Reference and buyer are ONE column here. The index can
                        afford them apart; a cockpit table cannot, and they are
                        read together anyway. */}
                    <td className="px-major py-tight">
                      <span className="block whitespace-nowrap font-mono text-[13px]">{o.reference}</span>
                      <span className="block max-w-[16rem] truncate text-[12px] text-muted" title={o.customerName ?? undefined}>
                        {o.customerName ?? to("walkIn")}
                      </span>
                    </td>
                    <td className="px-major py-tight text-center text-[13px] tabular-nums">
                      {o.lines.reduce((n, l) => n + l.quantity, 0)}
                    </td>
                    <td className="px-major py-tight text-right">
                      <span className="block whitespace-nowrap text-[13px] tabular-nums">{formatMoney(o.total)}</span>
                      {/* Only when something is owed — a count of nothing goes
                          quiet, and this is the one number on the row a manager
                          can act on. */}
                      {due > 0 && (
                        <span className="block whitespace-nowrap text-[12px] tabular-nums text-warning">
                          {t("orderDue", { amount: formatMoney(due) })}
                        </span>
                      )}
                    </td>
                    <td className="px-major py-tight text-right"><StatusPill status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* A phone: two lines a row. Who and how much, then which order, when
           and its state. */
        <div>
          {recentOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => router.push("/orders/" + o.id)}
              className="flex min-h-[64px] w-full flex-col justify-center gap-0.5 border-b border-hairline px-card py-comfortable text-left last:border-0 active:bg-muted-wash"
            >
              <span className="flex items-baseline justify-between gap-tight">
                <span className="min-w-0 truncate text-[14px] font-medium">{o.customerName ?? to("walkIn")}</span>
                <span className="shrink-0 whitespace-nowrap text-[14px] font-medium tabular-nums">{formatMoney(o.total)}</span>
              </span>
              <span className="flex items-center justify-between gap-tight">
                <span className="min-w-0 truncate text-[12px] text-muted">
                  <span className="font-mono">{o.reference}</span> · {formatRelative(o.createdAt, now)}
                </span>
                <StatusPill status={o.status} />
              </span>
            </button>
          ))}
        </div>
      )}

      <button type="button" data-type-role="button" onClick={() => router.push("/orders")} className={cn(linkRow, scopeOrders.length === 0 && "pt-tight")}>
        <span className="min-w-0 flex-1 truncate">
          {/* The footer states what the rows do NOT: how many are left, and how
              many of the window's orders are still owed. */}
          {scopeOrders.length > recentOrders.length ? t("ordersMore", { count: scopeOrders.length - recentOrders.length }) : null}
          {scopeOrders.length > recentOrders.length && scopeOwedCount > 0 ? " · " : null}
          {scopeOwedCount > 0 ? t("ordersAwaitingPayment", { count: scopeOwedCount, amount: formatMoney(scopeOwed) }) : null}
        </span>
        <span className="shrink-0 whitespace-nowrap">{t("viewAllOrders")}</span>
        <ArrowRight size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
      </button>
    </div>
  );

  const setupCard = (
    <div className={`${card} p-card`}>
      <div className="mb-section flex items-center justify-between">
        <h2 className="type-h2 text-base">{t("finishSetup")}</h2>
        <span className="text-[12px] text-muted">{t("stepProgress", { complete, total: steps.length })}</span>
      </div>
      <div className="mb-comfortable h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-ember transition-all" style={{ width: `${(complete / steps.length) * 100}%` }} />
      </div>
      {/* Rows divided by a hairline, not six boxed cards: the card around them
          is already the box. */}
      <div className="flex flex-col">
        {steps.map((s, i) => {
          const done = s.done || skipped[s.key];
          return (
            <div key={s.key} className="flex items-center gap-section border-b border-hairline py-comfortable last:border-0">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] ${done ? "bg-success text-white" : "bg-muted-wash text-muted"}`}>
                {done ? <Check size={16} strokeWidth={2} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
              {done ? (
                <span className="text-[12px] text-muted">{s.done ? t("stepDone") : t("stepSkipped")}</span>
              ) : (
                <div className="flex items-center gap-tight">
                  <button type="button" aria-label={t("skipStep", { step: s.label })} onClick={() => skip(s.key)} className="min-h-11 px-tight text-[12px] text-muted hover:text-fg sm:min-h-0">{t("skip")}</button>
                  <Button size="sm" icon={<ArrowRight size={14} strokeWidth={1.5} />} onClick={() => router.push(s.href)}>{t("start")}</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <PageShell title={wide ? op.data?.name || t("title") : t("title")}>
      {/* The page's one control: which days it is showing. A desktop states the
          days beside it, in words, on the row it shares with the control. "Today
          · Wed 29 Jul" said Today twice, a word apart from the toggle's own
          label, so the caption is only the date. The venue chooser lives in the
          bar and governs the whole console. */}
      <div className="mb-section flex items-center justify-between gap-section">
        {wide && (
          <p aria-live="polite" className="min-w-0 truncate text-[13px] text-muted">
            {scope === "today"
              ? formatDay(TODAY, { weekday: true })
              : `${formatDay(dayShift(TODAY, -6), { weekday: true })} – ${formatDay(TODAY, { weekday: true })}`}
          </p>
        )}
        {/* Scope, not actions — a dashboard is a place to look. */}
        <Segmented
          fill={!wide}
          className={wide ? "w-60 [&>button]:flex-1" : undefined}
          value={scope}
          onChange={setScope}
          label={t("scopeLabel")}
          options={[
            { value: "today", label: t("today") },
            { value: "week", label: t("thisWeek") },
          ]}
        />
      </div>

      {loading ? (
        /* The labels are known before the figures are, so the strip states
           what it is about to say and pulses only the numbers. */
        <div aria-busy="true">
          {wide ? <StatStrip items={stats} loading variant="tiles" /> : <MetricStrip items={figures} loading label={t("metrics")} />}
        </div>
      ) : !allDone ? (
        setupCard
      ) : wide ? (
        <StatStrip items={stats} variant="tiles" />
      ) : (
        <MetricStrip items={figures} label={t("metrics")} />
      )}

      {!loading && wide && (
        /* 16px between every card — one gap, the same as every other page. */
        <>
          <div className="mt-section grid gap-section min-[1360px]:grid-cols-3">
            {/* Left ⅔ — the trend, then the operational strip, then the ranked
                list: big picture → today's state → detail, top to bottom. */}
            <div className="flex min-w-0 flex-col gap-section min-[1360px]:col-span-2">
              {trendCard}
              {glanceCard}
              {bestCard}
            </div>
            {/* Right ⅓ — what just happened, and nothing else. */}
            <div className="flex min-w-0 flex-col gap-section">{activityCard}</div>
          </div>
          <div className="mt-section">{ordersCard}</div>
        </>
      )}

      {!loading && !wide && (
        /* A phone, in the order it is read: how sales are going, what just
           happened, what sold. The two cards that are about the day's shape
           rather than its news fold behind one button. */
        <div className="mt-section flex flex-col gap-section">
          {trendCard}
          {activityCard}
          {ordersCard}
          <Button variant="secondary" aria-expanded={more} aria-controls="dash-more" onClick={() => setMore((m) => !m)} className="w-full">
            {more ? t("showLess") : t("showMore")}
          </Button>
          {more && (
            <div id="dash-more" className="flex flex-col gap-section">
              {glanceCard}
              {bestCard}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
