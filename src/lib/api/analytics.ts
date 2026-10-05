/**
 * Analytics — the answers a venue manager asks of a period, in one call.
 *
 * Replaces the Reports page's four tabs (summary table, transaction ledger,
 * outstanding balances, a chart tab) with the handful of questions that drive
 * decisions at a venue: how much did we make and is it up, what sells, where do
 * sales come from, when are we busy, how full are we, how do people pay, how
 * far ahead do they book, who comes back. Transactions now live in Finances;
 * unpaid balances in Orders (Part paid).
 *
 * Everything is derived from orders, bookings and products for one venue (the
 * venue in the OS bar) and a date range; nothing is stored. Revenue is NET:
 * after discounts and refunds, before VAT — the figure a manager compares
 * month to month, untouched by a tax-rate change. Money is minor units.
 *
 * A comparison range is chosen by the caller (`compare`): the previous period
 * (same length, immediately before `from`), the same dates a year earlier, or
 * a custom range of any length. Whatever is chosen, the comparison is `null`
 * where the ledger does not reach back to its start — a +15663% delta against
 * an empty window is worse than no delta (see the Revenue chart entry in the
 * project log). `ledgerStart` says where the records begin, so a picker can
 * refuse a range before it instead of offering one that will come back empty.
 *
 * Breakdowns carry their comparison figure only while comparing, so a card can
 * say "▲ 12% vs 8–14 Jul" against each row without a second call.
 */
import { dowOf } from "@/lib/schedule";
import { delay, fail, getOperatorState, ok } from "./client";
import { peekBookings } from "./bookings";
import { peekLocations } from "./locations";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import { getTaxReport, lineNet, productCapacityOn, settled } from "./reports";
import type { TaxClassRow } from "./reports";
import type { ApiResult, Booking, ID, ISODate, Minor, Order, OrderLine, PaymentMethod } from "./types";

/** What a period is compared with. `custom` needs `compareFrom`/`compareTo`. */
export type CompareMode = "none" | "previous" | "year" | "custom";

export interface AnalyticsQuery {
  locationId: ID;
  from: ISODate;
  /** Inclusive. */
  to: ISODate;
  compare: CompareMode;
  /** Only for `compare: "custom"`. Inclusive. Any length; points align by position. */
  compareFrom?: ISODate;
  compareTo?: ISODate;
}

/** A headline figure and the same figure for the comparison range. */
export interface Kpi {
  value: number;
  previous: number | null;
}

export type Granularity = "hour" | "day" | "week";

export interface RevenuePoint {
  /** ISO date (day/week start) or "HH:00" for hourly. */
  key: string;
  value: Minor;
  /** The aligned point of the comparison range, when comparing. */
  previous?: Minor;
  /** That point's own key (a date, week start or "HH:00"), so a tooltip can
   *  say "Mon 21 Jul ৳4,200 vs Mon 14 Jul ৳3,100". Absent past the end of a
   *  shorter comparison range. */
  previousKey?: string;
}

export interface TopBooking {
  /** "other" folds everything past the top 7. */
  productId: ID | "other";
  name: string;
  revenue: Minor;
  /** 0..1 of the period's revenue. */
  share: number;
  orders: number;
  /** Revenue of the same booking in the comparison range, when comparing. */
  previousRevenue?: Minor;
}

export type SalesChannel = "counter" | "online" | "marketplace";

export interface ChannelSlice {
  channel: SalesChannel;
  revenue: Minor;
  orders: number;
  share: number;
  previousRevenue?: Minor;
}

/** One cell of the weekday × hour grid. Monday = 0. */
export interface HeatCell {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hour: number;
  /** Guests who were booked to come in that hour (bookings' party sizes). */
  guests: number;
}

export interface CapacityRow {
  productId: ID;
  name: string;
  /** Places sold in the period (for timed bookings and capped days). */
  sold: number;
  /** Places on offer in the period. */
  capacity: number;
  /** sold / capacity, 0..1. */
  filled: number;
  /** The same booking's fill in the comparison range, when comparing. */
  previousFilled?: number;
}

export interface PaymentSlice {
  method: PaymentMethod;
  amount: Minor;
  count: number;
  share: number;
  previousAmount?: Minor;
}

export type LeadBucket = "same_day" | "1_2_days" | "3_7_days" | "8_30_days" | "over_30_days";

export interface LeadSlice {
  bucket: LeadBucket;
  orders: number;
  share: number;
  /** Share in the comparison range — shares, not counts, because two ranges of
   *  different length are compared by their mix. */
  previousShare?: number;
}

export interface GuestSummary {
  guests: number;
  arrived: number;
  noShows: number;
  /** Named customers whose first order falls in the period. */
  newCustomers: number;
  /** Named customers with an earlier order too. */
  returning: number;
}

export interface AnalyticsOverview {
  currency: string;
  from: ISODate;
  to: ISODate;
  /** The comparison range actually used, or null when not comparing or when
   *  the ledger does not reach its start. */
  previous: { from: ISODate; to: ISODate } | null;
  /** What was asked for, so the page can explain a null comparison. */
  compare: CompareMode;
  /** The first day this venue has any order, or null with no orders at all. */
  ledgerStart: ISODate | null;
  granularity: Granularity;
  kpis: {
    revenue: Kpi;
    orders: Kpi;
    averageOrder: Kpi;
    guests: Kpi;
    /** 0..1 */
    capacityFilled: Kpi;
    refunds: Kpi;
  };
  revenue: RevenuePoint[];
  topBookings: TopBooking[];
  channels: ChannelSlice[];
  heatmap: { hours: number[]; cells: HeatCell[] };
  capacity: CapacityRow[];
  payments: PaymentSlice[];
  leadTime: LeadSlice[];
  guests: GuestSummary;
  /** The same summary for the comparison range, when comparing. */
  guestsPrevious: GuestSummary | null;
  /** VAT by rate for the period — what the return is filed from. */
  tax: { rows: TaxClassRow[]; net: Minor; tax: Minor; gross: Minor };
}

// ── implementation ─────────────────────────────────────────────────────────
const DAY_MS = 86400000;
const shiftDay = (d: string, days: number) => new Date(Date.parse(d) + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
/** Monday-start week key for a date. */
const weekStart = (d: string) => shiftDay(d, -((dowOf(d) + 6) % 7));
const pad2 = (n: number) => String(n).padStart(2, "0");
const hourKey = (h: number) => `${pad2(h)}:00`;
/** An order's calendar day follows the rest of the reports (createdAt's date);
 *  its hour is the venue's local clock (Dhaka, UTC+6), like getAnalytics. */
const orderDay = (o: Order) => o.createdAt.slice(0, 10);
const orderHour = (iso: string) => new Date(Date.parse(iso) + 6 * 3600000).getUTCHours();
/** Booking slots are written in local time ("…T10:00:00+06:00"). */
const slotDay = (b: Booking) => b.slotStart.slice(0, 10);
const slotHour = (b: Booking) => parseInt(b.slotStart.slice(11, 13), 10) || 0;
const weekdayOf = (d: string) => ((dowOf(d) + 6) % 7) as HeatCell["weekday"];
const share = (part: number, total: number) => (total > 0 ? part / total : 0);

/** A line's net revenue: after discounts, before VAT, with the refunded share
 *  taken back — the same figure the tax report's `net` is made of, so Revenue
 *  and the tax table always agree. */
function lineRevenue(l: OrderLine): number {
  const net = lineNet(l);
  const gross = l.total ?? 0;
  if (gross <= 0 || !(l.refundedAmount > 0)) return net;
  return net - Math.round(net * Math.min(1, l.refundedAmount / gross));
}
const orderRevenue = (o: Order) => o.lines.reduce((s, l) => s + lineRevenue(l), 0);
/** Gross refunded on an order, positive. A fully refunded order may not carry
 *  per-line refund amounts, so its lines' totals stand in for them. */
const refundedIn = (o: Order) =>
  o.status === "refunded"
    ? o.lines.reduce((s, l) => s + (l.refundedAmount > 0 ? l.refundedAmount : (l.total ?? 0)), 0)
    : settled(o)
      ? o.lines.reduce((s, l) => s + (l.refundedAmount ?? 0), 0)
      : 0;
/** marketplace = Order.source present; online = online without a source. */
const channelOf = (o: Order): SalesChannel => (o.source ? "marketplace" : o.channel === "online" ? "online" : "counter");

/** Top bookings is bookings and event tickets only: shop items, add-ons and
 *  custom amounts fold into "other". */
const isBookingLine = (l: OrderLine) =>
  !l.parentLineId && l.productId !== "custom" && !l.productId.startsWith("addon_") && !l.productId.startsWith("inv_");

interface Measure {
  orders: Order[];
  /** Every order at the venue dated in range, whatever its status (refunds). */
  all: Order[];
  bookings: Booking[];
  revenue: number;
  refunds: number;
  guests: number;
  sold: number;
  capacity: number;
  capRows: CapacityRow[];
}

/**
 * Capacity definition: over the venue's active products that have a schedule,
 * `capacity` is the places on offer each day of the range (productCapacityOn —
 * the same per-day figure getAnalytics' capacity_utilisation uses) and `sold`
 * is the party size of confirmed bookings of those products whose slot falls in
 * the range. capacityFilled = sold / capacity, capped at 1.
 */
function measure(locationId: string, from: string, to: string): Measure {
  const all = peekOrders().filter((o) => o.locationId === locationId && orderDay(o) >= from && orderDay(o) <= to);
  const orders = all.filter(settled);
  const bookings = peekBookings().filter(
    (b) => b.locationId === locationId && b.status === "confirmed" && slotDay(b) >= from && slotDay(b) <= to,
  );
  const days: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) days.push(d);
  const capRows: CapacityRow[] = [];
  for (const p of peekProducts()) {
    if (p.status !== "active" || !p.schedule || !p.locationIds.includes(locationId)) continue;
    const capacity = days.reduce((s, d) => s + productCapacityOn(p, d), 0);
    if (capacity <= 0) continue;
    const sold = bookings.filter((b) => b.productId === p.id).reduce((s, b) => s + b.partySize, 0);
    capRows.push({ productId: p.id, name: p.name, sold, capacity, filled: Math.min(1, sold / capacity) });
  }
  capRows.sort((a, b) => b.filled - a.filled);
  return {
    orders,
    all,
    bookings,
    revenue: orders.reduce((s, o) => s + orderRevenue(o), 0),
    refunds: all.reduce((s, o) => s + refundedIn(o), 0),
    guests: bookings.reduce((s, b) => s + b.partySize, 0),
    sold: capRows.reduce((s, r) => s + r.sold, 0),
    capacity: capRows.reduce((s, r) => s + r.capacity, 0),
    capRows,
  };
}

/** The venue's trading window as hours, clamped to 6..23; 9..18 when unknown. */
function tradingHours(locationId: string): [number, number] {
  const loc = peekLocations().find((l) => l.id === locationId);
  let lo = 24;
  let hi = -1;
  for (const d of loc?.openingHours ?? []) {
    for (const i of d.intervals) {
      const [oh] = i.opensAt.split(":").map(Number);
      const [ch, cm] = i.closesAt.split(":").map(Number);
      lo = Math.min(lo, oh);
      hi = Math.max(hi, cm > 0 ? ch : ch - 1);
    }
  }
  if (hi < lo) return [9, 18];
  return [Math.max(6, Math.min(23, lo)), Math.max(6, Math.min(23, hi))];
}

/** The trading window widened to include any hour that actually has data, so a
 *  total can never lose a late order; always contiguous. */
const hourRange = (window: [number, number], extra: number[]) => {
  const lo = Math.min(window[0], ...extra);
  const hi = Math.max(window[1], ...extra);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
};

const LEAD_BUCKETS: LeadBucket[] = ["same_day", "1_2_days", "3_7_days", "8_30_days", "over_30_days"];
const leadBucket = (days: number): LeadBucket =>
  days <= 0 ? "same_day" : days <= 2 ? "1_2_days" : days <= 7 ? "3_7_days" : days <= 30 ? "8_30_days" : "over_30_days";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (d: string | undefined): d is string =>
  !!d && ISO_RE.test(d) && !Number.isNaN(Date.parse(d)) && new Date(Date.parse(d)).toISOString().slice(0, 10) === d;
/** The same calendar date one year earlier; 29 Feb clamps to 28 Feb. */
const yearBack = (d: string) => {
  const y = parseInt(d.slice(0, 4), 10) - 1;
  const md = d.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return `${String(y).padStart(4, "0")}-${md === "02-29" && !leap ? "02-28" : md}`;
};

/** The range a mode compares with, before any ledger check; null for "none"
 *  (and for "custom" without both ends). Shared with the page, so the picker
 *  can show each option's dates before any data has loaded. */
export function comparisonRange(
  mode: CompareMode,
  from: ISODate,
  to: ISODate,
  customFrom?: ISODate,
  customTo?: ISODate,
): { from: ISODate; to: ISODate } | null {
  if (mode === "previous") return { from: shiftDay(from, -daysBetween(from, to)), to: shiftDay(from, -1) };
  if (mode === "year") return { from: yearBack(from), to: yearBack(to) };
  if (mode === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  return null;
}

export async function getAnalyticsOverview(q: AnalyticsQuery): Promise<ApiResult<AnalyticsOverview>> {
  await delay();
  if (!q.locationId || q.from > q.to) {
    return fail<AnalyticsOverview>({ code: "validation", message: "Choose a venue and a valid date range." });
  }
  if (q.compare === "custom" && !(isIso(q.compareFrom) && isIso(q.compareTo) && q.compareFrom <= q.compareTo)) {
    return fail<AnalyticsOverview>({ code: "validation", message: "Choose a valid range to compare with." });
  }
  const len = daysBetween(q.from, q.to);
  const granularity: Granularity = len <= 2 ? "hour" : len <= 62 ? "day" : "week";

  const cur = measure(q.locationId, q.from, q.to);

  // The comparison range asked for (null for "none"), then only where the ledger reaches back to its start.
  const asked = comparisonRange(q.compare, q.from, q.to, q.compareFrom, q.compareTo);
  const ledgerStart = peekOrders()
    .filter((o) => o.locationId === q.locationId)
    .reduce<string | null>((m, o) => (m === null || orderDay(o) < m ? orderDay(o) : m), null);
  const range = asked && ledgerStart !== null && ledgerStart <= asked.from ? asked : null;
  const prev = range ? measure(q.locationId, range.from, range.to) : null;

  const kpi = (f: (m: Measure) => number): Kpi => ({ value: f(cur), previous: prev ? f(prev) : null });
  const avg = (m: Measure) => (m.orders.length ? m.revenue / m.orders.length : 0);
  const filled = (m: Measure) => (m.capacity > 0 ? Math.min(1, m.sold / m.capacity) : 0);

  // Revenue series ----------------------------------------------------------
  const window = tradingHours(q.locationId);
  const bookingHours = cur.bookings.map(slotHour);
  const orderHours = [...cur.orders, ...(prev?.orders ?? [])].map((o) => orderHour(o.createdAt));
  let revenue: RevenuePoint[];
  if (granularity === "hour") {
    const hours = hourRange(window, orderHours);
    const sum = (orders: Order[], h: number) =>
      orders.filter((o) => orderHour(o.createdAt) === h).reduce((s, o) => s + orderRevenue(o), 0);
    revenue = hours.map((h) => ({
      key: hourKey(h),
      value: sum(cur.orders, h),
      ...(prev ? { previous: sum(prev.orders, h), previousKey: hourKey(h) } : {}),
    }));
  } else {
    const keyOf = granularity === "week" ? weekStart : (d: string) => d;
    const keysFor = (from: string, to: string) => {
      const ks: string[] = [];
      for (let d = from; d <= to; d = shiftDay(d, 1)) {
        const k = keyOf(d);
        if (ks[ks.length - 1] !== k) ks.push(k);
      }
      return ks;
    };
    const bucketSums = (orders: Order[]) => {
      const m = new Map<string, number>();
      for (const o of orders) {
        const k = keyOf(orderDay(o));
        m.set(k, (m.get(k) ?? 0) + orderRevenue(o));
      }
      return m;
    };
    const keys = keysFor(q.from, q.to);
    const sums = bucketSums(cur.orders);
    const prevKeys = range ? keysFor(range.from, range.to) : [];
    const prevSums = prev ? bucketSums(prev.orders) : null;
    // By position: point i against comparison point i; none past a shorter comparison's end.
    revenue = keys.map((k, i) => ({
      key: k,
      value: sums.get(k) ?? 0,
      ...(prevSums && prevKeys[i] ? { previous: prevSums.get(prevKeys[i]) ?? 0, previousKey: prevKeys[i] } : {}),
    }));
  }

  // Top bookings ------------------------------------------------------------
  const productRevenue = (m: Measure) => {
    const byProduct = new Map<string, { name: string; at: string; revenue: number; orders: Set<string> }>();
    const otherOrders = new Set<string>();
    for (const o of m.orders) {
      for (const l of o.lines) {
        if (!isBookingLine(l)) {
          otherOrders.add(o.id);
          continue;
        }
        const e = byProduct.get(l.productId) ?? { name: l.productName, at: o.createdAt, revenue: 0, orders: new Set<string>() };
        e.revenue += lineRevenue(l);
        e.orders.add(o.id);
        if (o.createdAt > e.at) {
          e.at = o.createdAt;
          e.name = l.productName; // the name the line was last sold under
        }
        byProduct.set(l.productId, e);
      }
    }
    return { byProduct, otherOrders };
  };
  const { byProduct, otherOrders } = productRevenue(cur);
  const prevProducts = prev ? productRevenue(prev).byProduct : null;
  const ranked = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const top = ranked.slice(0, 7);
  const topBookings: TopBooking[] = top.map(([id, e]) => ({
    productId: id,
    name: e.name,
    revenue: e.revenue,
    share: share(e.revenue, cur.revenue),
    orders: e.orders.size,
    ...(prevProducts ? { previousRevenue: prevProducts.get(id)?.revenue ?? 0 } : {}),
  }));
  const topRevenue = top.reduce((s, [, e]) => s + e.revenue, 0);
  const rest = cur.revenue - topRevenue;
  if (rest !== 0 || ranked.length > 7) {
    for (const [, e] of ranked.slice(7)) e.orders.forEach((id) => otherOrders.add(id));
    topBookings.push({
      productId: "other",
      name: "Other",
      revenue: rest,
      share: share(rest, cur.revenue),
      orders: otherOrders.size,
      // Everything the comparison range sold that is not one of this period's listed bookings.
      ...(prev && prevProducts
        ? { previousRevenue: prev.revenue - top.reduce((s, [id]) => s + (prevProducts.get(id)?.revenue ?? 0), 0) }
        : {}),
    });
  }

  // Channels ----------------------------------------------------------------
  const channelRevenue = (m: Measure, channel: SalesChannel) =>
    m.orders.filter((o) => channelOf(o) === channel).reduce((s, o) => s + orderRevenue(o), 0);
  const channels: ChannelSlice[] = (["counter", "online", "marketplace"] as SalesChannel[]).map((channel) => {
    const os = cur.orders.filter((o) => channelOf(o) === channel);
    const rev = os.reduce((s, o) => s + orderRevenue(o), 0);
    return {
      channel,
      revenue: rev,
      orders: os.length,
      share: share(rev, cur.revenue),
      ...(prev ? { previousRevenue: channelRevenue(prev, channel) } : {}),
    };
  });

  // Heatmap -----------------------------------------------------------------
  const cellMap = new Map<string, HeatCell>();
  for (const b of cur.bookings) {
    const weekday = weekdayOf(slotDay(b));
    const hour = slotHour(b);
    const k = `${weekday}-${hour}`;
    const c = cellMap.get(k) ?? { weekday, hour, guests: 0 };
    c.guests += b.partySize;
    cellMap.set(k, c);
  }
  const cells = [...cellMap.values()].sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
  const heatHours = hourRange(window, bookingHours);

  // Payments ----------------------------------------------------------------
  const paymentsIn = (from: string, to: string) => {
    const payMap = new Map<PaymentMethod, { amount: number; count: number }>();
    for (const o of peekOrders()) {
      if (o.locationId !== q.locationId) continue;
      for (const p of o.payments) {
        const d = p.createdAt.slice(0, 10);
        if (p.status !== "confirmed" || p.amount <= 0 || d < from || d > to) continue;
        const e = payMap.get(p.method) ?? { amount: 0, count: 0 };
        e.amount += p.amount;
        e.count += 1;
        payMap.set(p.method, e);
      }
    }
    return payMap;
  };
  const payMap = paymentsIn(q.from, q.to);
  const prevPay = range ? paymentsIn(range.from, range.to) : null;
  const payTotal = [...payMap.values()].reduce((s, e) => s + e.amount, 0);
  const payments: PaymentSlice[] = [...payMap.entries()]
    .map(([method, e]) => ({
      method,
      amount: e.amount,
      count: e.count,
      share: share(e.amount, payTotal),
      ...(prevPay ? { previousAmount: prevPay.get(method)?.amount ?? 0 } : {}),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Lead time ---------------------------------------------------------------
  const slotsByOrder = new Map<string, string>();
  for (const b of peekBookings()) {
    if (b.status !== "confirmed") continue;
    const d = slotDay(b);
    const had = slotsByOrder.get(b.orderId);
    if (had === undefined || d < had) slotsByOrder.set(b.orderId, d);
  }
  const leadShares = (m: Measure) => {
    const counts = new Map<LeadBucket, number>(LEAD_BUCKETS.map((b) => [b, 0]));
    let total = 0;
    for (const o of m.orders) {
      const slot = slotsByOrder.get(o.id);
      if (slot === undefined) continue;
      const bucket = leadBucket(Math.round((Date.parse(slot) - Date.parse(orderDay(o))) / DAY_MS));
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      total += 1;
    }
    return { counts, total };
  };
  const leadCur = leadShares(cur);
  const leadPrev = prev ? leadShares(prev) : null;
  const leadTime: LeadSlice[] = LEAD_BUCKETS.map((bucket) => ({
    bucket,
    orders: leadCur.counts.get(bucket) ?? 0,
    share: share(leadCur.counts.get(bucket) ?? 0, leadCur.total),
    ...(leadPrev ? { previousShare: share(leadPrev.counts.get(bucket) ?? 0, leadPrev.total) } : {}),
  }));

  // Guests ------------------------------------------------------------------
  const firstSeen = new Map<string, string>();
  for (const o of peekOrders()) {
    if (o.locationId !== q.locationId || !settled(o)) continue;
    const who = o.customerId ?? o.customerName;
    if (!who) continue;
    const d = orderDay(o);
    const had = firstSeen.get(who);
    if (had === undefined || d < had) firstSeen.set(who, d);
  }
  const guestSummary = (m: Measure, from: string): GuestSummary => {
    const inPeriod = new Set<string>();
    for (const o of m.orders) {
      const who = o.customerId ?? o.customerName;
      if (who) inPeriod.add(who);
    }
    let newCustomers = 0;
    for (const who of inPeriod) if ((firstSeen.get(who) ?? "") >= from) newCustomers += 1;
    return {
      guests: m.guests,
      arrived: m.bookings.reduce((s, b) => s + (b.checkedIn ?? 0), 0),
      noShows: m.bookings.filter((b) => b.noShow).reduce((s, b) => s + Math.max(0, b.partySize - (b.checkedIn ?? 0)), 0),
      newCustomers,
      returning: inPeriod.size - newCustomers,
    };
  };
  const guests = guestSummary(cur, q.from);
  const guestsPrevious = prev && range ? guestSummary(prev, range.from) : null;

  // Capacity ----------------------------------------------------------------
  const prevCap = prev ? new Map(prev.capRows.map((r) => [r.productId, r.filled])) : null;
  const capacity: CapacityRow[] = cur.capRows.map((r) => {
    const f = prevCap?.get(r.productId);
    return f === undefined ? r : { ...r, previousFilled: f };
  });

  // Tax ---------------------------------------------------------------------
  const taxRes = await getTaxReport({ from: q.from, to: q.to, locationIds: [q.locationId] });
  const tax = taxRes.ok ? taxRes.data.totals : { net: 0, tax: 0, gross: 0 };
  const taxRows = taxRes.ok ? taxRes.data.rows : [];

  return ok<AnalyticsOverview>({
    currency: getOperatorState().currency,
    from: q.from,
    to: q.to,
    previous: range,
    compare: q.compare,
    ledgerStart,
    granularity,
    kpis: {
      revenue: kpi((m) => m.revenue),
      orders: kpi((m) => m.orders.length),
      averageOrder: kpi(avg),
      guests: kpi((m) => m.guests),
      capacityFilled: kpi(filled),
      refunds: kpi((m) => m.refunds),
    },
    revenue,
    topBookings,
    channels,
    heatmap: { hours: heatHours, cells },
    capacity,
    payments,
    leadTime,
    guests,
    guestsPrevious,
    tax: { rows: taxRows, ...tax },
  });
}

// ── CSV ────────────────────────────────────────────────────────────────────
const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (m: number) => (m / 100).toFixed(2);
const pct = (f: number) => (f * 100).toFixed(1);

/** The page's data as CSV sections (one per chart), for Download. Money is in
 *  major units; a BOM leads so Excel reads Bangla names as UTF-8. */
export function analyticsCsv(o: AnalyticsOverview): string {
  const sections: string[][][] = [];
  const kp = o.kpis;
  const prevMoney = (k: Kpi) => (k.previous === null ? "" : money(k.previous));
  const prevInt = (k: Kpi) => (k.previous === null ? "" : String(k.previous));
  const opt = (v: number | undefined, f: (n: number) => string) => (v === undefined ? "" : f(v));
  const cmp = (o.previous ? `Compared with ${o.previous.from} to ${o.previous.to}` : "No comparison");
  sections.push([
    [`Analytics ${o.from} to ${o.to}`, cmp],
    ["KPI", "Value", "Comparison"],
    [`Revenue (${o.currency})`, money(kp.revenue.value), prevMoney(kp.revenue)],
    ["Orders", String(kp.orders.value), prevInt(kp.orders)],
    [`Average order (${o.currency})`, money(kp.averageOrder.value), prevMoney(kp.averageOrder)],
    ["Guests", String(kp.guests.value), prevInt(kp.guests)],
    ["Capacity filled %", pct(kp.capacityFilled.value), kp.capacityFilled.previous === null ? "" : pct(kp.capacityFilled.previous)],
    [`Refunds (${o.currency})`, money(kp.refunds.value), prevMoney(kp.refunds)],
  ]);
  sections.push([
    ["Revenue by " + o.granularity, "Revenue", "Comparison point", "Comparison revenue"],
    ...o.revenue.map((p) => [p.key, money(p.value), p.previousKey ?? "", opt(p.previous, money)]),
  ]);
  sections.push([
    ["Top bookings", "Revenue", "Share %", "Orders", "Comparison revenue"],
    ...o.topBookings.map((t) => [t.name, money(t.revenue), pct(t.share), String(t.orders), opt(t.previousRevenue, money)]),
  ]);
  sections.push([
    ["Channel", "Revenue", "Share %", "Orders", "Comparison revenue"],
    ...o.channels.map((c) => [c.channel, money(c.revenue), pct(c.share), String(c.orders), opt(c.previousRevenue, money)]),
  ]);
  sections.push([
    ["Payment method", "Amount", "Share %", "Payments", "Comparison amount"],
    ...o.payments.map((p) => [p.method, money(p.amount), pct(p.share), String(p.count), opt(p.previousAmount, money)]),
  ]);
  sections.push([
    ["Booking lead time", "Orders", "Share %", "Comparison share %"],
    ...o.leadTime.map((l) => [l.bucket, String(l.orders), pct(l.share), opt(l.previousShare, pct)]),
  ]);
  const gp = o.guestsPrevious;
  const g = (n: number | undefined) => (n === undefined ? "" : String(n));
  sections.push([
    ["Guests", "Count", "Comparison"],
    ["Guests booked", String(o.guests.guests), g(gp?.guests)],
    ["Arrived", String(o.guests.arrived), g(gp?.arrived)],
    ["No-shows", String(o.guests.noShows), g(gp?.noShows)],
    ["New customers", String(o.guests.newCustomers), g(gp?.newCustomers)],
    ["Returning customers", String(o.guests.returning), g(gp?.returning)],
  ]);
  sections.push([
    ["Capacity", "Sold", "Capacity", "Filled %", "Comparison filled %"],
    ...o.capacity.map((c) => [c.name, String(c.sold), String(c.capacity), pct(c.filled), opt(c.previousFilled, pct)]),
  ]);
  sections.push([
    ["Tax rate %", "Class", "Net", "Tax", "Gross"],
    ...o.tax.rows.map((r) => [pct(r.rate), r.taxClass, money(r.net), money(r.tax), money(r.gross)]),
    ["Total", "", money(o.tax.net), money(o.tax.tax), money(o.tax.gross)],
  ]);
  return "﻿" + sections.map((s) => s.map((r) => r.map(cell).join(",")).join("\r\n")).join("\r\n\r\n") + "\r\n";
}
