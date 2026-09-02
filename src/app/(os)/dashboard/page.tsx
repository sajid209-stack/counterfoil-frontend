"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarClock, Check, ChevronDown, ChevronRight, CircleCheck, ListFilter, Package, Receipt, RotateCcw, TrendingUp, UserCheck, UserRoundPlus, Users, Banknote, CalendarOff, Clock, WifiOff, Wrench, type LucideIcon } from "lucide-react";
import { AreaChart, Button, Modal, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  cancelSessionBookings,
  getOperator,
  getResourceMatrix,
  getSlots,
  listBookings,
  listCounters,
  listCustomers,
  listDevices,
  listLocations,
  listOrders,
  listProducts,
  listResources,
  listStaff,
  peekWaitlist,
  updateProduct,
  type Booking,
  type Order,
  type Product,
} from "@/lib/api";
import { isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";

const TODAY = "2026-07-29";
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

/** One row of the live-activity feed. `kind` is the row's own fact — the badge,
 *  its colour and the filter all read off it, so none of them has to infer a
 *  category from the rendered text. */
type ActivityKind = "paid" | "sale" | "refund" | "customer";
type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  subject: string;
  amount: number | null;
  at: string;
};
type ActivityFilter = "all" | "sales" | "refunds" | "customers";
/** Filter → the kinds it admits. Sales keeps paid and unfinished sales
 *  together because both are the same event to someone scanning the feed:
 *  money came in, or was meant to. */
const ACTIVITY_KINDS: Record<ActivityFilter, readonly ActivityKind[]> = {
  all: ["paid", "sale", "refund", "customer"],
  sales: ["paid", "sale"],
  refunds: ["refund"],
  customers: ["customer"],
};
/** Glyph and colour per kind. Money out is danger and money in is success —
 *  the semantics this codebase already uses — while an unfinished sale stays
 *  muted because it has not happened yet, and a new customer takes the brand
 *  ember. Four distinct glyphs, so the row never depends on colour alone. */
const ACTIVITY_BADGE: Record<ActivityKind, { Icon: LucideIcon; className: string }> = {
  paid: { Icon: CircleCheck, className: "text-success" },
  sale: { Icon: Receipt, className: "text-muted" },
  refund: { Icon: RotateCcw, className: "text-danger" },
  customer: { Icon: UserRoundPlus, className: "text-ember" },
};

/** A rail notice, with the anatomy the reference draws: a glyph, a bold title,
 *  a description, an optional timestamp and an optional action. `at` is set
 *  ONLY where the underlying record carries a real moment — a device's last
 *  contact, a resource's last edit. A waitlist depth and an unpaid balance are
 *  live derivations, not events, so they get no timestamp rather than a
 *  fabricated one. */
type Notice = {
  tone: "warning" | "info";
  Icon: LucideIcon;
  title: string;
  body: string;
  at?: string;
  action?: { label: string; href: string };
};

function DeltaPill({ now, then }: { now: number; then: number }) {
  if (then <= 0) return null;
  const pct = Math.round(((now - then) / then) * 100);
  const up = pct >= 0;
  return (
    // Fully-rounded with a diagonal arrow, as the reference draws it — the
    // triangle read as a status marker, the arrow reads as direction.
    <span className={`inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-[11px] ${up ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
      {up ? "↗" : "↘"} {Math.abs(pct)}%
    </span>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const w = 140, h = 28;
  const path = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="mt-tight text-ember" aria-hidden>
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const enumL = useEnumLabels();
  const toast = useToast();
  const op = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100, filters: { status: "active" } }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 1 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 1 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  // Sorted newest-first at the source: the feed only ever shows a handful of
  // rows, so there is no reason to pull the whole roster to find them.
  const customersQ = useApiQuery(() => listCustomers({ pageSize: 50, sort: "createdAt", order: "desc" }), []);

  const [locationId, setLocationId] = useState<string>("all");
  const [scope, setScope] = useState<"today" | "week">("today");
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(30);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [openSession, setOpenSession] = useState<string | null>(null); // inline bookings
  const [capModal, setCapModal] = useState<{ product: Product; value: number } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ product: Product; time: string; slotISO: string; affected: number } | null>(null);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const skip = (key: string) => setSkipped((s) => ({ ...s, [key]: true }));
  const has = (q: { data?: { page: { total: number } } }) => (q.data?.page.total ?? 0) > 0;

  const loading = ordersQ.loading || bookingsQ.loading || productsQ.loading;
  const locations = locationsQ.data?.data ?? [];
  const allOrders = ordersQ.data?.data ?? [];
  const orders = locationId === "all" ? allOrders : allOrders.filter((o) => o.locationId === locationId);
  const bookings = bookingsQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];
  // Memoised, unlike its neighbours above: the activity feed depends on it,
  // and a fresh array each render would rebuild and re-sort the whole feed
  // on every keystroke elsewhere on the page.
  const customers = useMemo(() => customersQ.data?.data ?? [], [customersQ.data]);

  const scopeDays = useMemo(() => (scope === "today" ? [TODAY] : Array.from({ length: 7 }, (_, i) => dayShift(TODAY, i - 6))), [scope]);
  const prevDays = useMemo(() => scopeDays.map((d) => dayShift(d, -7)), [scopeDays]);

  // ── Hero: revenue ─────────────────────────────────────────────────────────
  const revenueIn = (days: string[]) => orders.filter((o) => paidish(o) && days.includes(o.createdAt.slice(0, 10))).reduce((s, o) => s + o.total, 0);
  const revenue = revenueIn(scopeDays);
  const revenuePrev = revenueIn(prevDays);
  const revenueAnimated = useCountUp(revenue);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => revenueIn([dayShift(TODAY, i - 6)])), [orders]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Today's sessions — management, never selling ─────────────────────────
  // A scheduled session and an unbooked resource hour are not the same thing.
  // A planetarium show at 0/40 runs whether or not anyone bought a seat, so it
  // is always the manager's business. A free turf hour is not a session at all
  // — it is capacity nobody has taken yet, and there is a row of it for every
  // field × every hour. Listing both together (and then taking the nine
  // EARLIEST) filled this panel with empty turf slots, each offering to cancel
  // bookings that did not exist, and buried the one session with real numbers.
  //
  // So: scheduled sessions always appear; a resource hour appears only once
  // somebody has booked it. The free hours are counted into one honest line
  // rather than dropped silently. Out-of-service resources are deliberately
  // absent — Needs attention already names them, once, instead of once an hour.
  interface Session { key: string; time: string; slotISO: string; label: string; who?: string; sold: number; cap: number; state: "OPEN" | "FULL"; product: Product; adjustable: boolean; booked: boolean }
  const { sessions, freeSlots, hiddenCount } = useMemo(() => {
    const out: Session[] = [];
    let free = 0;
    for (const p of products) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, TODAY)) {
          if (r.resource.outOfService) continue;
          for (const s of r.slots) {
            if (toMinutes(s.time) < NOW_MIN) continue;
            if (s.available) { free++; continue; }
            out.push({ key: `${p.id}|${r.resource.id}|${s.time}`, time: s.time, slotISO: `${TODAY}T${s.time}:00+06:00`, label: p.name, who: r.resource.name, sold: 1, cap: 1, state: "FULL", product: p, adjustable: false, booked: true });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, TODAY)) {
          if (toMinutes(s.time) < NOW_MIN) continue;
          out.push({ key: `${p.id}|${s.time}`, time: s.time, slotISO: `${TODAY}T${s.time}:00+06:00`, label: p.name, who: p.schedule?.guideIds.length ? t("guided") : undefined, sold: s.sold, cap: s.capacity, state: s.remaining <= 0 ? "FULL" : "OPEN", product: p, adjustable: true, booked: s.sold > 0 });
        }
      }
    }
    // Busiest first among equals at a time, so the ones carrying people lead.
    out.sort((a, b) => a.time.localeCompare(b.time) || b.sold - a.sold);
    return { sessions: out.slice(0, 9), freeSlots: free, hiddenCount: Math.max(0, out.length - 9) };
  }, [products, t]);

  const sessionBookings = (s: Session): Booking[] =>
    bookings.filter((b) => b.productId === s.product.id && b.slotStart === s.slotISO && b.status === "confirmed");

  const saveCapacity = async () => {
    if (!capModal) return;
    const p = capModal.product;
    const sch = p.schedule!;
    const patch = sch.dailyCapacity ? { schedule: { ...sch, dailyCapacity: capModal.value } } : { schedule: { ...sch, capacityPerSession: capModal.value } };
    const res = await updateProduct(p.id, patch as never);
    if (res.ok) { toast.success(t("capacitySetTo", { value: capModal.value })); productsQ.reload(); }
    else toast.error(res.error.message);
    setCapModal(null);
  };

  const doCancelSession = async () => {
    if (!cancelModal) return;
    const res = await cancelSessionBookings(cancelModal.product.id, cancelModal.slotISO);
    if (res.ok) { toast.success(res.data.cancelled === 1 ? t("sessionCancelled", { count: res.data.cancelled }) : t("sessionCancelledPlural", { count: res.data.cancelled })); bookingsQ.reload(); productsQ.reload(); }
    setCancelModal(null);
  };

  /** "12 min ago" / "3 hr ago" / "2 d ago", measured from the demo clock.
   *  Shared by the activity feed and the rail so one notion of "ago" governs
   *  the page. Parses the instant rather than comparing the string — the seed
   *  spells timestamps two ways. */
  const relTime = useCallback((iso: string) => {
    const mins = Math.max(0, Math.round((Date.parse(`${TODAY}T12:00:00+06:00`) - Date.parse(iso)) / 60000));
    return mins < 60 ? t("minAgo", { count: mins }) : mins < 1440 ? t("hrAgo", { count: Math.round(mins / 60) }) : t("dAgo", { count: Math.round(mins / 1440) });
  }, [t]);

  // ── Live activity ────────────────────────────────────────────────────────
  // The feed is not an order log. What a manager wants from it is "what has
  // happened here lately", and a customer record appearing is one of those
  // things — so orders and customers are merged into one time-ordered stream
  // rather than the card being a second, smaller Orders table. Each row
  // carries its own kind, which is what the badge and the filter read off;
  // nothing here guesses tone from wording.
  const activity = useMemo(() => {
    const events: ActivityItem[] = [];

    for (const o of orders) {
      const refunded = o.status === "refunded" || o.status === "partly_refunded";
      // A partial refund's headline figure is what went back, not what the
      // order was worth — reading o.total there would overstate it, often by
      // an order of magnitude.
      const amount = o.status === "partly_refunded"
        ? o.lines.reduce((s, l) => s + l.refundedAmount, 0)
        : o.total;
      const kind: ActivityKind = refunded ? "refund" : o.status === "paid" ? "paid" : "sale";
      const title = o.status === "refunded" ? t("refundIssued")
        : o.status === "partly_refunded" ? t("refundPartial")
        : o.status === "paid" ? t("orderPaid", { ref: o.reference })
        : o.status === "partial" ? t("orderPartPaid", { ref: o.reference })
        : o.status === "cancelled" ? t("orderCancelled", { ref: o.reference })
        : t("orderPending", { ref: o.reference });
      events.push({
        id: `o:${o.id}`, kind, title, at: o.createdAt,
        // The buyer leads the subtitle where there is one; a walk-up has no
        // name, and the product it bought says more than "—".
        subject: o.customerName ?? o.lines[0]?.productName ?? "—",
        amount,
      });
    }

    for (const c of customers) {
      // A merge tombstone and an erased record are not people who joined —
      // one is a pointer at the survivor, the other has no identity left to
      // name. Both stay in the ledger; neither is an event.
      if (c.mergedIntoId || c.erasedAt) continue;
      events.push({
        id: `c:${c.id}`, kind: "customer", title: t("customerAdded"), at: c.createdAt,
        subject: t("customerJoined", { name: c.name }), amount: null,
      });
    }

    return events
      .filter((e) => ACTIVITY_KINDS[activityFilter].includes(e.kind))
      // Sorted on the parsed instant, NOT on the string. The two sources do
      // not agree on how they spell a timestamp — generated records are
      // .toISOString() ("…T05:05:00.000Z"), hand-authored seed records carry a
      // local offset ("…T11:05:00+06:00") — and comparing those as text puts a
      // 12-minute-old event below a 55-minute-old one. Ordering orders among
      // themselves hid this; merging two sources exposes it.
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      // Six. This count exists to balance the rail against the column beside
      // it — the reference's two columns finish level, which is most of why
      // its page reads as settled rather than ragged. It was eight while
      // Notices was a one-line-per-item card; giving each notice a title, a
      // description and an action grew that card by 215px, and the feed gives
      // the same back. Re-measure this if either card's anatomy changes again.
      .slice(0, 6)
      .map((e) => ({ ...e, rel: relTime(e.at) }));
  }, [orders, customers, activityFilter, relTime, t]);

  // ── Right rail ───────────────────────────────────────────────────────────
  // Tone is read off WHICH RULE FIRED, never guessed from the wording: money
  // discrepancies and things about to stop selling are warnings; a waitlist or
  // a quiet device is information. The reference tints its notices by severity
  // and this is the only honest way to supply one — the items carry no
  // severity field of their own.
  const attention = useMemo(() => {
    const items: Notice[] = [];
    // Cash variance on a closed shift — derived from the mock shift record.
    // Its moment is real: a shift closes at a time, and that is yesterday.
    items.push({
      tone: "warning", Icon: Banknote,
      title: t("noticeCashTitle"),
      body: t("cashShort", { location: "Fort Main Gate", amount: "৳2,000" }),
      at: `${dayShift(TODAY, -1)}T22:00:00+06:00`,
      action: { label: t("noticeReviewTakings"), href: "/reports/sales" },
    });
    resources.filter((r) => r.outOfService).forEach((r) => items.push({
      tone: "warning", Icon: Wrench,
      title: t("noticeOutOfServiceTitle", { name: r.name }),
      // The reason IS the description. Where none was recorded, say so — an
      // empty line would read as a rendering fault.
      body: r.outOfServiceReason ?? t("noticeNoReason"),
      at: r.updatedAt,
      action: { label: t("noticeManage"), href: "/settings/resources" },
    }));
    // The silent failure: nothing bookable beyond a date.
    for (const p of products) {
      if (p.courseDates?.length) {
        const last = [...p.courseDates].sort().at(-1)!;
        if (last <= dayShift(TODAY, 30)) items.push({
          tone: "warning", Icon: CalendarOff,
          title: t("noticeNoSessionsTitle"),
          body: t("noSessionsAfter", { name: p.name, date: last }),
          action: { label: t("noticeAddDates"), href: `/products/${p.id}` },
        });
      }
      if (p.windowMode === "fixed" && p.windowEnd && p.windowEnd <= dayShift(TODAY, 30)) {
        items.push({
          tone: "warning", Icon: Clock,
          title: t("noticeStopsSellingTitle"),
          body: t("stopsSelling", { name: p.name, date: p.windowEnd }),
          action: { label: t("noticeOpenProduct"), href: `/products/${p.id}` },
        });
      }
    }
    const wl = peekWaitlist().length;
    if (wl > 0) items.push({
      tone: "info", Icon: Users,
      title: t("noticeWaitlistTitle"),
      body: wl === 1 ? t("waitlistWaiting", { count: wl }) : t("waitlistWaitingPlural", { count: wl }),
      action: { label: t("noticeMakeOffer"), href: "/schedule" },
    });
    // Arrivals today still owing a balance.
    const owing = bookings
      .filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === TODAY)
      .map((b) => orders.find((o) => o.id === b.orderId))
      .filter((o): o is Order => !!o && o.status === "partial");
    if (owing.length) {
      const due = owing.reduce((s, o) => s + (o.total - o.payments.reduce((x, p) => x + p.amount, 0)), 0);
      items.push({
        tone: "warning", Icon: Receipt,
        title: t("noticeOwingTitle"),
        body: owing.length === 1 ? t("arrivalsOwe", { count: owing.length, amount: formatMoney(due) }) : t("arrivalsOwePlural", { count: owing.length, amount: formatMoney(due) }),
        action: { label: t("noticeTakePayment"), href: "/checkin" },
      });
    }
    (devicesQ.data?.data ?? []).forEach((d) => {
      if (!d.lastSeenAt || d.lastSeenAt.slice(0, 10) <= dayShift(TODAY, -7)) items.push({
        tone: "info", Icon: WifiOff,
        title: t("noticeDeviceTitle"),
        body: t("deviceNotSeen", { name: d.name }),
        // Only if the device has ever checked in. "Never seen" has no moment.
        at: d.lastSeenAt ?? undefined,
        action: { label: t("noticeManage"), href: "/settings/devices" },
      });
    });
    return items;
  }, [resources, products, bookings, orders, devicesQ.data, t]);

  // Idle capacity — unsold places in the next 48h, priced.
  const idle = useMemo(() => {
    const out: { text: string; value: number; href: string }[] = [];
    for (const d of [TODAY, dayShift(TODAY, 1)]) {
      for (const p of products) {
        if (!isSlotBased(p.bookingType) || isResourceType(p.bookingType)) continue;
        for (const s of getSlots(p, d)) {
          if (d === TODAY && toMinutes(s.time) < NOW_MIN) continue;
          if (s.capacity > 1 && s.sold / s.capacity < 0.3) {
            const price = Math.min(...p.tiers.filter((t) => t.active).map((t) => t.price));
            out.push({ text: `${d === TODAY ? "" : t("tomorrow")}${s.time} ${p.name} · ${s.sold}/${s.capacity}`, value: s.remaining * price, href: `/products/${p.id}` });
          }
        }
      }
    }
    return out.sort((a, b) => b.value - a.value).slice(0, 4);
  }, [products, t]);

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.payments.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount)));
    return [...m.entries()].map(([k, v]) => ({ label: enumL.method(k), amount: v })).sort((a, b) => b.amount - a.amount);
  }, [orders, enumL]);
  const mixMax = Math.max(...mix.map((m) => m.amount), 1);

  const top = useMemo(() => {
    const m = new Map<string, { qty: number; rev: number }>();
    orders.filter((o) => paidish(o) && o.createdAt.slice(0, 10) === TODAY).forEach((o) => o.lines.forEach((l) => {
      if (l.unitPrice <= 0) return;
      const cur = m.get(l.productName) ?? { qty: 0, rev: 0 };
      // F11: line NET totals — add-on child lines count as their own product.
      m.set(l.productName, { qty: cur.qty + l.quantity, rev: cur.rev + (l.taxableAmount ?? l.unitPrice * l.quantity) });
    }));
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
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
    { key: "product", label: t("stepProduct"), done: products.length > 0, href: "/products/new" },
    { key: "device", label: t("stepDevice"), done: (devicesQ.data?.page.total ?? 0) > 0, href: "/settings/devices/new" },
  ];
  const complete = steps.filter((s) => s.done || skipped[s.key]).length;
  const allDone = complete === steps.length;

  const dateLabel = new Date(`${TODAY}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const card = "card-surface";

  return (
    <PageShell
      title={op.data?.name || t("title")}
      description={dateLabel}
      actions={
        <div className="flex items-center gap-tight">
          {locations.length > 1 && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">{t("allLocations")}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {/* Scope, not actions — a dashboard is a place to look. */}
          <div className="relative grid h-11 grid-cols-2 rounded-sm bg-line/60 p-inline">
            <span aria-hidden className="absolute inset-y-inline rounded-xs bg-ember transition-[left] duration-quick ease-counterfoil" style={{ width: "calc(50% - 8px)", left: scope === "today" ? 4 : "calc(50% + 4px)" }} />
            {(["today", "week"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={`relative z-10 px-comfortable text-[13px] font-medium transition-colors duration-quick ${scope === s ? "text-ink" : "text-muted"}`}>{s === "today" ? t("today") : t("thisWeek")}</button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-major min-[420px]:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse p-section`}><div className="h-3 w-1/2 rounded-xs bg-line" /><div className="mt-tight h-8 w-2/3 rounded-xs bg-line" /></div>
          ))}
        </div>
      ) : !allDone ? (
        <div className={`${card} mb-major p-major`}>
          <div className="mb-section flex items-center justify-between">
            <h2 className="type-h2 text-base">{t("finishSetup")}</h2>
            <span className="text-[12px] text-muted">{t("stepProgress", { complete, total: steps.length })}</span>
          </div>
          <div className="mb-major h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-ember transition-all" style={{ width: `${(complete / steps.length) * 100}%` }} />
          </div>
          <div className="flex flex-col gap-tight">
            {steps.map((s, i) => {
              const done = s.done || skipped[s.key];
              return (
                <div key={s.key} className="flex items-center gap-section rounded-sm border border-line p-comfortable">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] ${done ? "bg-success text-white" : "bg-line text-muted"}`}>
                    {done ? <Check size={16} strokeWidth={2} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
                  {done ? (
                    <span className="text-[11px] text-muted">{s.done ? t("stepDone") : t("stepSkipped")}</span>
                  ) : (
                    <div className="flex items-center gap-tight">
                      <button type="button" onClick={() => skip(s.key)} className="text-[12px] text-muted hover:text-fg">{t("skip")}</button>
                      <Button size="sm" icon={<ArrowRight size={14} strokeWidth={1.5} />} onClick={() => router.push(s.href)}>{t("start")}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-major min-[420px]:grid-cols-2 xl:grid-cols-4">
          {/* Aura stat-tile anatomy, measured off the reference: the tinted
              icon square and the delta pill share the top row (pill hard
              right), the label sits under them, then the figure, then one
              line of context. We had the label beside the icon and the delta
              stranded below the number, which buried the comparison and left
              the top-right corner empty on every tile. */}
          <div className={`${card} p-major`}>
            <div className="flex items-start justify-between gap-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ember/10 text-ember"><TrendingUp size={18} strokeWidth={1.5} /></span>
              <DeltaPill now={revenue} then={revenuePrev} />
            </div>
            <p className="mt-comfortable type-label text-[12px] text-muted">{scope === "today" ? t("revenueToday") : t("revenueThisWeek")}</p>
            <p className="type-figure mt-inline whitespace-nowrap text-[28px] font-semibold sm:text-[32px]">{formatMoney(revenueAnimated)}</p>
            <Sparkline points={week} />
          </div>
          <div className={`${card} p-major`}>
            <div className="flex items-start justify-between gap-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ember/10 text-ember"><Users size={18} strokeWidth={1.5} /></span>
              <DeltaPill now={sold} then={soldPrev} />
            </div>
            <p className="mt-comfortable type-label text-[12px] text-muted">{t("capacitySold")}</p>
            <p className="type-figure mt-inline whitespace-nowrap text-[28px] font-semibold sm:text-[32px]">{sold} <span className="text-lg text-muted">/ {capacity}</span></p>
            <div className="mt-tight flex items-center gap-tight">
              <span className="text-[12px] text-muted">{soldPct}%</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className={`block h-full ${soldPct >= 80 ? "bg-ember" : "bg-strong"}`} style={{ width: `${Math.min(100, soldPct)}%` }} /></span>
            </div>
          </div>
          <div className={`${card} p-major`}>
            <div className="flex items-start justify-between gap-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ember/10 text-ember"><UserCheck size={18} strokeWidth={1.5} /></span>
            </div>
            <p className="mt-comfortable type-label text-[12px] text-muted">{t("arrived")}</p>
            <p className="type-figure mt-inline whitespace-nowrap text-[28px] font-semibold sm:text-[32px]">{arrived} <span className="text-lg text-muted">{t("arrivedOf", { total: sold })}</span></p>
            <p className={`mt-tight text-[12px] ${noShowPct >= 30 ? "text-danger" : "text-muted"}`}>{t("noShow", { pct: noShowPct })}</p>
          </div>
          <div className={`${card} p-major`}>
            <div className="flex items-start justify-between gap-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ember/10 text-ember"><CalendarClock size={18} strokeWidth={1.5} /></span>
              <DeltaPill now={ahead} then={aheadPrev} />
            </div>
            <p className="mt-comfortable type-label text-[12px] text-muted">{t("bookedAhead")}</p>
            <p className="type-figure mt-inline whitespace-nowrap text-[28px] font-semibold sm:text-[32px]">{formatMoney(ahead)}</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
        <div className="mt-wide grid gap-wide lg:grid-cols-3">
          {/* Left ⅔ — the trend, then the operational strip, then the ranked
              list. The reference's left column reads big picture → today's
              state → detail, top to bottom. */}
          <div className="flex min-w-0 flex-col gap-wide lg:col-span-2">
            <div className={`${card} p-major`}>
              <div className="flex flex-wrap items-start justify-between gap-tight">
                <div className="min-w-0">
                  {/* A real heading, as every other card on the page now has —
                      this was the last small-caps field label pretending to be
                      a card title, which left the widest card as the only one
                      without a title at reading size. */}
                  <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("revenueTrend")}</h2>
                  <div className="mt-tight flex flex-wrap items-baseline gap-tight">
                    <span className="whitespace-nowrap text-[28px] font-semibold">{formatMoney(trendTotal)}</span>
                    <DeltaPill now={trendTotal} then={trendPrev} />
                  </div>
                  <p className="mt-inline text-[12px] text-muted">
                    {comparable ? t("vsPreviousDays", { count: trendDays }) : t("lastDaysLong", { count: trendDays })}
                  </p>
                </div>
                {/* Ranges the seed can actually fill — see the trend memo. */}
                <div className="flex shrink-0 gap-inline rounded-sm bg-subtle p-0.5">
                  {([7, 14, 30] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrendDays(d)}
                      aria-pressed={trendDays === d}
                      // Ember marks the selection, matching the page header's
                      // scope toggle — one selected-state treatment across the
                      // dashboard rather than two. Ink text on ember, which is
                      // the pairing the colour system fixes as literal in both
                      // themes; measured at 5.3:1 light and 7.1:1 dark.
                      className={`min-h-8 rounded-xs px-tight text-[13px] font-medium transition-colors duration-quick ${
                        trendDays === d ? "bg-ember text-ink" : "text-muted hover:text-fg"
                      }`}
                    >
                      {t("lastDays", { count: d })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-section">
                <AreaChart
                  points={trend}
                  fmt={(v) => formatMoney(v)}
                  fmtAxis={(v) => formatMoneyCompact(v)}
                  height={240}
                  valueLabel={comparable ? t("thisPeriod") : t("revenueTrend")}
                  compareLabel={t("previousPeriod")}
                />
              </div>
            </div>
            {/* The reference groups the small operational readouts into one
                strip in the wide column rather than stacking them down the
                narrow rail. Same three readouts, same numbers — Open shifts,
                Payment mix, Idle capacity — but at two-thirds width they get
                room to be read side by side, and the rail is freed for the two
                panels a manager dwells on. Nothing was dropped to achieve it. */}
            <div className={`${card} p-major`}>
              <div className="mb-section flex items-baseline justify-between gap-tight">
                <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("operations")}</h2>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{t("today")}</span>
              </div>
              {/* The three panels do not want equal widths. A shift is a name and
                  a clock, the mix is four short bars, but an idle row carries a
                  product name — and products here are called things like "Grand
                  Heritage Architectural Walking Tour of Old Dhaka". Splitting the
                  strip in equal thirds truncated those to "17:00 Gra…", which is
                  not a session anyone can identify. Weighting the columns gives
                  the one column with prose the room prose needs. */}
              <div className="grid gap-major md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="min-w-0">
                  <p className="type-label mb-tight text-[12px] text-muted">{t("openShifts")}</p>
                  {/* Mock shift record — the Shift entity is a backend-lane item. */}
                  {/* Stacked, not a justified row: at this width the name and the
                      figures collided and "Gate" wrapped onto a line by itself. */}
                  <p className="truncate text-[13px]">Nadia Islam · Fort Main Gate</p>
                  <p className="mt-0.5 text-[12px] text-muted">3:24 · ৳47,850</p>
                </div>
                <div className="min-w-0 md:border-l md:border-line md:pl-major">
                  <p className="type-label mb-tight text-[12px] text-muted">{t("paymentMix")}</p>
                  {mix.length === 0 ? <p className="text-[13px] text-muted">{t("noPayments")}</p> : mix.map((m) => (
                    <div key={m.label} className="mb-tight last:mb-0">
                      <div className="flex justify-between gap-tight text-[12px]"><span className="min-w-0 truncate">{m.label}</span><span className="shrink-0 whitespace-nowrap">{formatMoney(m.amount)}</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-ember" style={{ width: `${(m.amount / mixMax) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="min-w-0 md:border-l md:border-line md:pl-major">
                  <p className="type-label mb-tight text-[12px] text-muted">{t("idleCapacity")}</p>
                  {idle.length === 0 ? (
                    <p className="text-[13px] text-muted">{t("nothingUnderFill")}</p>
                  ) : (
                    idle.map((x, i) => (
                      // "৳32,400.00 unsold" on all four rows spent a third of the
                      // column repeating a word the panel label already says. The
                      // figure alone reads the same to the eye; the full phrasing
                      // moves to the accessible name, where it is not redundant.
                      <button key={i} type="button" onClick={() => router.push(x.href)} aria-label={`${x.text} — ${t("unsold", { amount: formatMoney(x.value) })}`} className="flex w-full items-baseline justify-between gap-tight border-b border-line py-tight text-left text-[13px] last:border-0 hover:text-ember">
                        <span className="min-w-0 truncate">{x.text}</span>
                        <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{formatMoney(x.value)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className={`${card} p-major`}>
              <div className="mb-comfortable flex items-baseline justify-between gap-tight">
                <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("topProducts")}</h2>
                <button type="button" onClick={() => router.push("/reports/sales")} className="shrink-0 whitespace-nowrap text-[12px] text-muted transition-colors duration-quick hover:text-fg">{t("viewAll")}</button>
              </div>
              {/* The reference's "Top verticals" row: icon square, name and
                  money on the first line, then a full-width bar with the
                  trailing figure at its end. The bar is the point — a ranked
                  list of numbers makes you compare digits; a bar makes the
                  ranking visible without reading any of them. */}
              {top.length === 0 ? <p className="text-[13px] text-muted">{t("nothingSold")}</p> : (
                <div className="flex flex-col gap-comfortable">
                  {top.map(([name, row]) => (
                    <div key={name} className="flex items-center gap-tight">
                      {/* 1px line, not just a fill: --color-subtle and
                          --color-card are the SAME value in dark, so a bare
                          tinted square has no edge there and the glyph floats.
                          Same fix ProductThumb needed. */}
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-line bg-subtle text-muted">
                        <Package size={16} strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-tight text-[13px]">
                          <span className="min-w-0 truncate">{name}</span>
                          <span className="shrink-0 whitespace-nowrap text-[12px]">{formatMoney(row.rev)}</span>
                        </div>
                        <div className="mt-inline flex items-center gap-tight">
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
                            <span className="block h-full bg-ember" style={{ width: `${topMax > 0 ? Math.max(4, (row.rev / topMax) * 100) : 0}%` }} />
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">{t("qtyTimes", { qty: row.qty })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right ⅓ — exactly two panels, as the reference has it: what
              needs a decision, and what just happened. Five stacked cards
              made the rail a dumping ground, and nothing in it read as
              important because everything was the same size. */}
          <div className="flex min-w-0 flex-col gap-wide">
            <div className={`${card} p-major`}>
              {/* Title and count, no leading icon. Every notice already carries
                  its own glyph, so a second one on the header was a decoration
                  competing with the ones that mean something — and it left this
                  card the only one on the page whose title did not start at the
                  same x as its neighbours'. */}
              <div className="mb-comfortable flex items-center gap-tight">
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.4px]">{t("needsAttention")}</h2>
                {attention.length > 0 && (
                  <span className="shrink-0 rounded-full bg-subtle px-tight py-0.5 text-[11px] text-muted">
                    {attention.length}
                  </span>
                )}
              </div>
              {/* The reference's notice anatomy, now that the items can carry
                  it: a glyph, a bold title with the moment beside it, the
                  description under, and the action as a link at the bottom.
                  The glyph is picked per RULE, not per tone — a cash variance,
                  a dead device and a closing sales window are different kinds
                  of problem and the icon is the cheapest way to say which
                  before anyone reads a word. Tone still comes off severity.
                  The timestamp appears only where the record has one; a
                  waitlist depth is a live count, not an event. */}
              {attention.length === 0 ? (
                <p className="text-sm text-success">{t("allClear")}</p>
              ) : (
                <div className="flex flex-col gap-tight">
                  {attention.map((a, i) => {
                    const warn = a.tone === "warning";
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-md border p-comfortable transition-colors duration-quick",
                          warn ? "border-warning/25 bg-warning/5" : "border-line bg-subtle/40",
                        )}
                      >
                        <div className="flex items-start gap-tight">
                          <a.Icon size={16} strokeWidth={1.5} className={cn("mt-0.5 shrink-0", warn ? "text-warning" : "text-muted")} />
                          <div className="min-w-0 flex-1">
                            {/* Title and moment share a baseline and wrap
                                together — at 363px a long resource name has to
                                be able to take the line without shoving the
                                timestamp out of the card. */}
                            <p className="flex flex-wrap items-baseline gap-x-tight gap-y-0">
                              <span className="min-w-0 text-sm font-semibold">{a.title}</span>
                              {a.at && <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{relTime(a.at)}</span>}
                            </p>
                            <p className="mt-inline text-sm text-muted">{a.body}</p>
                            {a.action && (
                              <button
                                type="button"
                                onClick={() => router.push(a.action!.href)}
                                // Neutral, as the reference draws it: the tint
                                // and the border already carry the severity, and
                                // amber-on-amber is both a second shout and the
                                // weaker contrast of the two.
                                className="mt-tight inline-flex items-center gap-inline text-sm font-medium text-fg transition-colors duration-quick hover:text-ember"
                              >
                                {a.action.label}
                                <ArrowRight size={13} strokeWidth={1.75} className="shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className={card}>
              {/* Header at reading size, as the reference sets it — this and
                  Notices are the two panels a manager actually reads, so they
                  get a heading rather than a small-caps field label. The filter
                  sits on the heading row, where the reference puts it. */}
              <div className="flex items-baseline justify-between gap-tight px-major pb-tight pt-major">
                <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("liveActivity")}</h2>
                {/* A native select, not a bespoke popover: it is one control,
                    it names the active filter instead of hiding it behind the
                    word "Filter", and it arrives keyboard- and screen-reader-
                    correct on a touch device without a line of focus-trap
                    code. The control is transparent and the BACKGROUND SITS ON
                    THE OPTIONS: card-surface is white at 72%, so an opaque
                    bg-card control read as a white box floating in the header,
                    while a transparent one would drop the popup to
                    dark-on-dark. Painting the options directly satisfies both —
                    the control disappears into the card, the list stays
                    legible in either theme. */}
                <div className="relative flex shrink-0 items-center text-muted focus-within:text-fg hover:text-fg">
                  <ListFilter size={13} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-0" />
                  <select
                    aria-label={t("filterActivity")}
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                    className="cursor-pointer appearance-none rounded-xs bg-transparent py-inline pl-[19px] pr-0 text-[12px] text-current outline-none transition-colors duration-quick [&>option]:bg-card [&>option]:text-fg"
                  >
                    <option value="all">{t("filterAll")}</option>
                    <option value="sales">{t("filterSales")}</option>
                    <option value="refunds">{t("filterRefunds")}</option>
                    <option value="customers">{t("filterCustomers")}</option>
                  </select>
                </div>
              </div>
              {/* The reference's activity row: an icon badge, then two stacked
                  lines, with the timestamp held right. The badge is outlined,
                  not filled — measured on the reference: 32px, 6px radius, card
                  background, 1px hairline, with the colour in the glyph. A
                  filled tint block per row reads as four coloured chips
                  stacked up; an outlined badge stays quiet and lets the text
                  lead. Colour is read off the row's own kind, never guessed
                  from the wording, and it is never the only carrier: the glyph
                  differs per kind and the title says which event it was. */}
              {activity.length === 0 ? (
                <p className="px-major pb-comfortable text-[13px] text-muted">{t("noActivity")}</p>
              ) : activity.map((a) => {
                const badge = ACTIVITY_BADGE[a.kind];
                return (
                  <div key={a.id} className="flex items-start gap-section px-major py-comfortable">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line bg-card ${badge.className}`}>
                      <badge.Icon size={15} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] break-words">{a.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-inline text-[12px] text-muted">
                        <span className="min-w-0 truncate">{a.subject}</span>
                        {/* A customer row has no money on it, and a zero would
                            be a fact the event does not carry. */}
                        {a.amount !== null && <span className="shrink-0 whitespace-nowrap">· {formatMoney(a.amount)}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted">{a.rel}</span>
                  </div>
                );
              })}
              {/* The reference closes this card with a full-width outlined
                  button. Where it goes follows the filter, because that is the
                  page the rows on screen actually came from — sending someone
                  looking at customer events to Orders would be a dead end. */}
              <div className="px-major pb-major pt-tight">
                <button
                  type="button"
                  onClick={() => router.push(activityFilter === "customers" ? "/customers" : "/orders")}
                  className="min-h-9 w-full rounded-sm border border-line bg-card/60 text-sm font-medium transition-colors duration-quick hover:border-strong hover:bg-card"
                >
                  {t("viewAllActivity")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width closer, where the reference puts its table: the session
            list is the widest thing on the page and was being squeezed into
            two thirds of it. */}
        <div className="mt-wide">
              <div className={card}>
                <div className="flex items-baseline justify-between gap-tight border-b border-line px-major py-comfortable">
                <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("todaysSessions")}</h2>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">{dateLabel}</span>
              </div>
                {sessions.length === 0 ? (
                  <p className="px-section py-major text-[13px] text-muted">{t("noMoreSessions")}</p>
                ) : (
                  sessions.map((u) => {
                    const open = openSession === u.key;
                    const list = sessionBookings(u);
                    return (
                      <div key={u.key} className="border-b border-line last:border-0">
                        {/* Wraps rather than crushes. The row carries a time, a
                            name, an occupancy and two actions; at 320px those
                            fixed widths leave the name nothing, and a session
                            row without the session is not a row. The name keeps
                            a floor and the meta drops to a second line. */}
                        <div className="flex min-h-12 flex-wrap items-center gap-x-section gap-y-inline px-section py-tight">
                          <button type="button" aria-label={t("bookings")} onClick={() => setOpenSession(open ? null : u.key)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted hover:text-fg">
                            {open ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} />}
                          </button>
                          <span className="w-12 shrink-0 text-sm">{u.time}</span>
                          <span className="min-w-[9rem] flex-1 truncate text-sm">{u.label}{u.who ? <span className="text-muted"> · {u.who}</span> : null}</span>
                          {u.cap > 1 && (
                            <span className="flex shrink-0 items-center gap-tight">
                              <span className="whitespace-nowrap text-[12px] text-muted">{u.sold}/{u.cap}</span>
                              <span className="h-0.5 w-16 overflow-hidden rounded-full bg-line"><span className={`block h-full ${u.sold / u.cap >= 0.8 ? "bg-ember" : "bg-strong"}`} style={{ width: `${(u.sold / u.cap) * 100}%` }} /></span>
                            </span>
                          )}
                          {u.state !== "OPEN" && (
                            <span className="shrink-0 rounded-xs bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_5px)] px-tight text-[10px] text-muted dark:bg-[repeating-linear-gradient(45deg,#3a3a36,#3a3a36_2px,transparent_2px,transparent_5px)]">{t("full")}</span>
                          )}
                          {u.adjustable && (
                            <button type="button" onClick={() => setCapModal({ product: u.product, value: u.product.schedule?.dailyCapacity ?? u.product.schedule?.capacityPerSession ?? 0 })} className="shrink-0 text-[13px] font-medium text-muted hover:text-fg">{t("adjust")}</button>
                          )}
                          {/* Cancelling closes a scheduled session; a booked resource
                              hour is cancelled by releasing its booking, not here. */}
                          {u.adjustable && (
                            <button type="button" onClick={() => setCancelModal({ product: u.product, time: u.time, slotISO: u.slotISO, affected: list.length })} className="shrink-0 text-[13px] font-medium text-danger hover:opacity-80">{t("cancel")}</button>
                          )}
                        </div>
                        {open && (
                          <div className="border-t border-line bg-subtle px-section py-tight">
                            {list.length === 0 ? (
                              <p className="text-[12px] text-muted">{t("noBookingsOnSession")}</p>
                            ) : (
                              list.map((b) => (
                                <div key={b.id} className="flex h-9 items-center gap-section text-[13px]">
                                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{b.orderId}</span>
                                  <span className="text-[12px]">{t("partyLine", { size: b.partySize })}</span>
                                  <span className="text-[12px] text-muted">{t("checkedInLine", { count: b.checkedIn ?? 0 })}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {/* The hours that did not earn a row still exist — say so, and
                    send the manager where they can actually be seen. */}
                {(freeSlots > 0 || hiddenCount > 0) && (
                  <button
                    type="button"
                    data-type-role="button"
                    onClick={() => router.push("/calendar")}
                    className="flex min-h-11 w-full items-center gap-tight border-t border-line px-section text-left text-[13px] font-medium text-muted hover:text-ember"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {hiddenCount > 0 ? t("andMoreSessions", { count: hiddenCount }) : null}
                      {hiddenCount > 0 && freeSlots > 0 ? " · " : null}
                      {freeSlots > 0 ? (freeSlots === 1 ? t("freeSlot", { count: freeSlots }) : t("freeSlots", { count: freeSlots })) : null}
                    </span>
                    <span className="shrink-0 whitespace-nowrap">{t("viewCalendar")} →</span>
                  </button>
                )}
              </div>
        </div>
        </>
      )}

      {/* Adjust capacity — the decision a manager makes when a session is full. */}
      <Modal
        open={!!capModal}
        onClose={() => setCapModal(null)}
        title={capModal ? t("capacityModalTitle", { product: capModal.product.name }) : ""}
        footer={<><Button variant="secondary" onClick={() => setCapModal(null)}>{t("cancel")}</Button><Button onClick={saveCapacity}>{t("save")}</Button></>}
      >
        {capModal && (
          <div className="flex flex-col gap-tight">
            <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
              <span className="text-sm">{capModal.product.schedule?.dailyCapacity ? t("placesPerDay") : t("placesPerSession")}</span>
              <div className="flex items-center gap-tight">
                <button type="button" aria-label={t("fewer")} onClick={() => setCapModal((m) => m && { ...m, value: Math.max(1, m.value - 1) })} className="h-11 w-11 rounded-sm border border-line text-lg">−</button>
                <span className="w-10 text-center">{capModal.value}</span>
                <button type="button" aria-label={t("more")} onClick={() => setCapModal((m) => m && { ...m, value: m.value + 1 })} className="h-11 w-11 rounded-sm border border-line text-lg">+</button>
              </div>
            </div>
            <p className="text-[12px] text-muted">{t("capacityNote")}</p>
          </div>
        )}
      </Modal>

      {/* Cancel session — the warning names how many bookings are affected. */}
      <Modal
        open={!!cancelModal}
        onClose={() => setCancelModal(null)}
        title={cancelModal ? t("cancelSessionTitle", { time: cancelModal.time, product: cancelModal.product.name }) : ""}
        footer={<><Button variant="secondary" onClick={() => setCancelModal(null)}>{t("keepSession")}</Button><Button variant="destructive" onClick={doCancelSession}>{t("cancelSession")}</Button></>}
      >
        {cancelModal && (
          <p className="text-sm text-muted">
            {cancelModal.affected === 0
              ? t("noBookingsYet")
              : cancelModal.affected === 1
                ? t("cancelWarning", { count: cancelModal.affected })
                : t("cancelWarningPlural", { count: cancelModal.affected })}
          </p>
        )}
      </Modal>
    </PageShell>
  );
}
