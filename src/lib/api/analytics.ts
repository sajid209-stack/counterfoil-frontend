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
 * The previous period is the same length immediately before `from`; `null`
 * where the ledger does not reach back that far (a +15663% delta against an
 * empty window is worse than no delta — see the Revenue chart entry in the
 * project log).
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

export interface AnalyticsQuery {
  locationId: ID;
  from: ISODate;
  /** Inclusive. */
  to: ISODate;
  compare: boolean;
}

/** A headline figure and the same figure for the previous period. */
export interface Kpi {
  value: number;
  previous: number | null;
}

export type Granularity = "hour" | "day" | "week";

export interface RevenuePoint {
  /** ISO date (day/week start) or "HH:00" for hourly. */
  key: string;
  value: Minor;
  /** The aligned point of the previous period, when comparing. */
  previous?: Minor;
}

export interface TopBooking {
  /** "other" folds everything past the top 7. */
  productId: ID | "other";
  name: string;
  revenue: Minor;
  /** 0..1 of the period's revenue. */
  share: number;
  orders: number;
}

export type SalesChannel = "counter" | "online" | "marketplace";

export interface ChannelSlice {
  channel: SalesChannel;
  revenue: Minor;
  orders: number;
  share: number;
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
}

export interface PaymentSlice {
  method: PaymentMethod;
  amount: Minor;
  count: number;
  share: number;
}

export type LeadBucket = "same_day" | "1_2_days" | "3_7_days" | "8_30_days" | "over_30_days";

export interface LeadSlice {
  bucket: LeadBucket;
  orders: number;
  share: number;
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
  /** The previous period's range, or null when the ledger does not reach it. */
  previous: { from: ISODate; to: ISODate } | null;
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

export async function getAnalyticsOverview(q: AnalyticsQuery): Promise<ApiResult<AnalyticsOverview>> {
  await delay();
  if (!q.locationId || q.from > q.to) {
    return fail<AnalyticsOverview>({ code: "validation", message: "Choose a venue and a valid date range." });
  }
  const len = daysBetween(q.from, q.to);
  const granularity: Granularity = len <= 2 ? "hour" : len <= 62 ? "day" : "week";

  const cur = measure(q.locationId, q.from, q.to);

  // Previous period — only where the ledger reaches back that far.
  const prevTo = shiftDay(q.from, -1);
  const prevFrom = shiftDay(q.from, -len);
  const earliest = peekOrders()
    .filter((o) => o.locationId === q.locationId)
    .reduce<string | null>((m, o) => (m === null || orderDay(o) < m ? orderDay(o) : m), null);
  const hasPrev = q.compare && earliest !== null && earliest <= prevFrom;
  const prev = hasPrev ? measure(q.locationId, prevFrom, prevTo) : null;

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
      ...(prev ? { previous: sum(prev.orders, h) } : {}),
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
    const prevKeys = prev ? keysFor(prevFrom, prevTo) : [];
    const prevSums = prev ? bucketSums(prev.orders) : null;
    revenue = keys.map((k, i) => ({
      key: k,
      value: sums.get(k) ?? 0,
      ...(prevSums ? { previous: prevKeys[i] ? (prevSums.get(prevKeys[i]) ?? 0) : 0 } : {}),
    }));
  }

  // Top bookings ------------------------------------------------------------
  const byProduct = new Map<string, { name: string; at: string; revenue: number; orders: Set<string> }>();
  const otherOrders = new Set<string>();
  for (const o of cur.orders) {
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
  const ranked = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const top = ranked.slice(0, 7);
  const topBookings: TopBooking[] = top.map(([id, e]) => ({
    productId: id,
    name: e.name,
    revenue: e.revenue,
    share: share(e.revenue, cur.revenue),
    orders: e.orders.size,
  }));
  const topRevenue = top.reduce((s, [, e]) => s + e.revenue, 0);
  const rest = cur.revenue - topRevenue;
  if (rest !== 0 || ranked.length > 7) {
    for (const [, e] of ranked.slice(7)) e.orders.forEach((id) => otherOrders.add(id));
    topBookings.push({ productId: "other", name: "Other", revenue: rest, share: share(rest, cur.revenue), orders: otherOrders.size });
  }

  // Channels ----------------------------------------------------------------
  const channels: ChannelSlice[] = (["counter", "online", "marketplace"] as SalesChannel[]).map((channel) => {
    const os = cur.orders.filter((o) => channelOf(o) === channel);
    const rev = os.reduce((s, o) => s + orderRevenue(o), 0);
    return { channel, revenue: rev, orders: os.length, share: share(rev, cur.revenue) };
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
  const payMap = new Map<PaymentMethod, { amount: number; count: number }>();
  for (const o of peekOrders()) {
    if (o.locationId !== q.locationId) continue;
    for (const p of o.payments) {
      const d = p.createdAt.slice(0, 10);
      if (p.status !== "confirmed" || p.amount <= 0 || d < q.from || d > q.to) continue;
      const e = payMap.get(p.method) ?? { amount: 0, count: 0 };
      e.amount += p.amount;
      e.count += 1;
      payMap.set(p.method, e);
    }
  }
  const payTotal = [...payMap.values()].reduce((s, e) => s + e.amount, 0);
  const payments: PaymentSlice[] = [...payMap.entries()]
    .map(([method, e]) => ({ method, amount: e.amount, count: e.count, share: share(e.amount, payTotal) }))
    .sort((a, b) => b.amount - a.amount);

  // Lead time ---------------------------------------------------------------
  const leadCounts = new Map<LeadBucket, number>(LEAD_BUCKETS.map((b) => [b, 0]));
  const slotsByOrder = new Map<string, string>();
  for (const b of peekBookings()) {
    if (b.status !== "confirmed") continue;
    const d = slotDay(b);
    const had = slotsByOrder.get(b.orderId);
    if (had === undefined || d < had) slotsByOrder.set(b.orderId, d);
  }
  let leadTotal = 0;
  for (const o of cur.orders) {
    const slot = slotsByOrder.get(o.id);
    if (slot === undefined) continue;
    const bucket = leadBucket(Math.round((Date.parse(slot) - Date.parse(orderDay(o))) / DAY_MS));
    leadCounts.set(bucket, (leadCounts.get(bucket) ?? 0) + 1);
    leadTotal += 1;
  }
  const leadTime: LeadSlice[] = LEAD_BUCKETS.map((bucket) => ({
    bucket,
    orders: leadCounts.get(bucket) ?? 0,
    share: share(leadCounts.get(bucket) ?? 0, leadTotal),
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
  const inPeriod = new Set<string>();
  for (const o of cur.orders) {
    const who = o.customerId ?? o.customerName;
    if (who) inPeriod.add(who);
  }
  let newCustomers = 0;
  for (const who of inPeriod) if ((firstSeen.get(who) ?? "") >= q.from) newCustomers += 1;
  const guests: GuestSummary = {
    guests: cur.guests,
    arrived: cur.bookings.reduce((s, b) => s + (b.checkedIn ?? 0), 0),
    noShows: cur.bookings.filter((b) => b.noShow).reduce((s, b) => s + Math.max(0, b.partySize - (b.checkedIn ?? 0)), 0),
    newCustomers,
    returning: inPeriod.size - newCustomers,
  };

  // Tax ---------------------------------------------------------------------
  const taxRes = await getTaxReport({ from: q.from, to: q.to, locationIds: [q.locationId] });
  const tax = taxRes.ok ? taxRes.data.totals : { net: 0, tax: 0, gross: 0 };
  const taxRows = taxRes.ok ? taxRes.data.rows : [];

  return ok<AnalyticsOverview>({
    currency: getOperatorState().currency,
    from: q.from,
    to: q.to,
    previous: prev ? { from: prevFrom, to: prevTo } : null,
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
    capacity: cur.capRows,
    payments,
    leadTime,
    guests,
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
  sections.push([
    [`Analytics ${o.from} to ${o.to}`, o.previous ? `Previous ${o.previous.from} to ${o.previous.to}` : "No previous period"],
    ["KPI", "Value", "Previous"],
    [`Revenue (${o.currency})`, money(kp.revenue.value), prevMoney(kp.revenue)],
    ["Orders", String(kp.orders.value), prevInt(kp.orders)],
    [`Average order (${o.currency})`, money(kp.averageOrder.value), prevMoney(kp.averageOrder)],
    ["Guests", String(kp.guests.value), prevInt(kp.guests)],
    ["Capacity filled %", pct(kp.capacityFilled.value), kp.capacityFilled.previous === null ? "" : pct(kp.capacityFilled.previous)],
    [`Refunds (${o.currency})`, money(kp.refunds.value), prevMoney(kp.refunds)],
  ]);
  sections.push([
    ["Revenue by " + o.granularity, "Revenue", "Previous"],
    ...o.revenue.map((p) => [p.key, money(p.value), p.previous === undefined ? "" : money(p.previous)]),
  ]);
  sections.push([
    ["Top bookings", "Revenue", "Share %", "Orders"],
    ...o.topBookings.map((t) => [t.name, money(t.revenue), pct(t.share), String(t.orders)]),
  ]);
  sections.push([
    ["Channel", "Revenue", "Share %", "Orders"],
    ...o.channels.map((c) => [c.channel, money(c.revenue), pct(c.share), String(c.orders)]),
  ]);
  sections.push([
    ["Payment method", "Amount", "Share %", "Payments"],
    ...o.payments.map((p) => [p.method, money(p.amount), pct(p.share), String(p.count)]),
  ]);
  sections.push([
    ["Booking lead time", "Orders", "Share %"],
    ...o.leadTime.map((l) => [l.bucket, String(l.orders), pct(l.share)]),
  ]);
  sections.push([
    ["Guests", "Count"],
    ["Guests booked", String(o.guests.guests)],
    ["Arrived", String(o.guests.arrived)],
    ["No-shows", String(o.guests.noShows)],
    ["New customers", String(o.guests.newCustomers)],
    ["Returning customers", String(o.guests.returning)],
  ]);
  sections.push([
    ["Capacity", "Sold", "Capacity", "Filled %"],
    ...o.capacity.map((c) => [c.name, String(c.sold), String(c.capacity), pct(c.filled)]),
  ]);
  sections.push([
    ["Tax rate %", "Class", "Net", "Tax", "Gross"],
    ...o.tax.rows.map((r) => [pct(r.rate), r.taxClass, money(r.net), money(r.tax), money(r.gross)]),
    ["Total", "", money(o.tax.net), money(o.tax.tax), money(o.tax.gross)],
  ]);
  return "﻿" + sections.map((s) => s.map((r) => r.map(cell).join(",")).join("\r\n")).join("\r\n\r\n") + "\r\n";
}
