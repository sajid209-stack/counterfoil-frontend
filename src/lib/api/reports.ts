import { ok } from "./client";
import { peekBookings } from "./bookings";
import { peekCategories } from "./categories";
import { peekCounters } from "./counters";
import { peekLocations } from "./locations";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import { getResourceMatrix, getSlots } from "./slots";
import { peekStaff } from "./staff";
import { isResourceType, isSlotBased } from "@/lib/schedule";
import type { ApiResult, ID, ISODate, ISODateTime, Minor, Order, OrderLine, PaymentMethod } from "./types";

// The contract the backend builds to. Do not change shapes without updating both.
export type SalesGroupBy =
  | "product"
  | "category"
  | "payment_method"
  | "counter"
  | "location"
  | "staff"
  | "hour";

export interface SalesReportQuery {
  from: ISODate;
  to: ISODate;
  groupBy: SalesGroupBy;
  locationId?: ID;
}

export interface SalesReportRow {
  key: ID | string;
  label: string;
  ticketCount: number;
  gross: Minor;
  refunds: Minor;
  net: Minor;
  shareOfTotal: number; // 0..1
}

export interface SalesReportResponse {
  summary: {
    gross: Minor;
    refunds: Minor;
    net: Minor;
    ticketCount: number;
    prevGross: Minor;
    prevNet: Minor;
    prevTicketCount: number;
  };
  rows: SalesReportRow[];
}

// ── F7: the transaction + analytics contract — the backend builds to this ───
export type TxStatus = "completed" | "refunded" | "partly_refunded" | "void";

export interface TransactionQuery {
  from: ISODate;
  to: ISODate;
  locationIds?: ID[];
  counterIds?: ID[];
  staffIds?: ID[];
  productIds?: ID[];
  categoryIds?: ID[];
  paymentMethods?: PaymentMethod[];
  status?: TxStatus[];
  minAmount?: Minor;
  maxAmount?: Minor;
  customerId?: ID;
  channel?: "counter" | "online";
  search?: string;
  sort?: { field: "time" | "amount" | "status"; dir: "asc" | "desc" };
  cursor?: string;
  limit?: number;
}

export interface TransactionRow {
  id: ID;
  time: ISODateTime;
  reference: string;
  itemsLabel: string; // "General Admission and 2 more"
  customer: string | null;
  staffName: string | null;
  counterName: string | null;
  /** "mixed" = split tender — shown as its own visible bucket, never split
   *  across lines pro rata. */
  method: PaymentMethod | "mixed";
  net: Minor;
  status: TxStatus;
  lines: OrderLine[];
}

export interface TransactionResponse {
  rows: TransactionRow[];
  total: number;
  cursor: string | null;
}

export type AnalyticsSeries =
  | "revenue" | "hour_of_day" | "day_of_week" | "payment_mix"
  | "capacity_utilisation" | "no_show_rate" | "lead_time" | "top_products";

export interface AnalyticsQuery extends Omit<TransactionQuery, "sort" | "cursor" | "limit"> {
  series: AnalyticsSeries[];
  granularity?: "hour" | "day" | "week" | "month";
  compareToPrevious?: boolean;
}

export interface SeriesPoint {
  label: string;
  value: number;
  compare?: number;
}

export type AnalyticsResponse = Partial<Record<AnalyticsSeries, SeriesPoint[]>>;

const settled = (o: Order) => o.status === "paid" || o.status === "partial" || o.status === "partly_refunded";
const orderTickets = (o: Order) => o.lines.filter((l) => !l.parentLineId && l.admits > 0).reduce((s, l) => s + l.quantity, 0);
/** Net (pre-tax, post-discount) value of a line — the number reports attribute. */
const lineNet = (l: Order["lines"][number]) => l.taxableAmount ?? l.unitPrice * l.quantity;
/** Payment-method bucket for cross-tabs: several methods → an honest "Mixed"
 *  row, never a fictional pro-rata split of payments across lines. */
const methodBucket = (o: Order): PaymentMethod | "mixed" => {
  const methods = [...new Set(o.payments.filter((p) => p.amount > 0 && p.status !== "failed").map((p) => p.method))];
  return methods.length > 1 ? "mixed" : (methods[0] ?? "cash");
};
const dayCount = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10);

function inRange(orders: Order[], from: string, to: string, locationId?: string) {
  return orders.filter((o) => {
    const d = o.createdAt.slice(0, 10);
    if (d < from || d > to) return false;
    if (locationId && o.locationId !== locationId) return false;
    return true;
  });
}

function summarise(orders: Order[]) {
  let gross = 0, refunds = 0, ticketCount = 0;
  for (const o of orders) {
    if (settled(o)) {
      gross += o.subtotal - (o.discountTotal ?? 0);
      refunds += o.lines.reduce((s, l) => s + l.refundedAmount, 0);
      ticketCount += orderTickets(o);
    } else if (o.status === "refunded") refunds += o.subtotal - (o.discountTotal ?? 0);
  }
  return { gross, refunds, net: gross - refunds, ticketCount };
}

export async function getSalesReport(query: SalesReportQuery): Promise<ApiResult<SalesReportResponse>> {
  const orders = peekOrders();
  const rows = inRange(orders, query.from, query.to, query.locationId);
  const summary = summarise(rows);

  const len = dayCount(query.from, query.to);
  const prevTo = shift(query.from, -1);
  const prevFrom = shift(prevTo, -(len - 1));
  const prev = summarise(inRange(orders, prevFrom, prevTo, query.locationId));

  // Lookups for labels
  const productCat = new Map(peekProducts().map((p) => [p.id, p.categoryId]));
  const catName = new Map(peekCategories().map((c) => [c.id, c.name]));
  const locName = new Map(peekLocations().map((l) => [l.id, l.name]));
  const cntName = new Map(peekCounters().map((c) => [c.id, c.name]));
  const stfName = new Map(peekStaff().map((s) => [s.id, s.name]));
  const methodLabel: Record<string, string> = { cash: "Cash", card_terminal: "Card terminal", bkash: "bKash", bangla_qr: "Bangla QR", voucher: "Voucher", credit: "Credit" };

  const buckets = new Map<string, { label: string; gross: number; refunds: number; tickets: number }>();
  const add = (key: string, label: string, gross: number, refunds: number, tickets: number) => {
    const b = buckets.get(key) ?? { label, gross: 0, refunds: 0, tickets: 0 };
    b.gross += gross; b.refunds += refunds; b.tickets += tickets;
    buckets.set(key, b);
  };

  for (const o of rows) {
    const isSettled = settled(o);
    const isRefund = o.status === "refunded";
    if (!isSettled && !isRefund) continue;

    if (query.groupBy === "product" || query.groupBy === "category") {
      // F11: revenue attributes PER LINE at its net (post-discount) value.
      // Add-on child lines are products in their own right (bib hire ≠ turf).
      for (const line of o.lines) {
        const amt = lineNet(line);
        const lineRefund = line.refundedAmount > 0 ? line.taxableAmount ?? amt : 0;
        if (query.groupBy === "product") {
          // Custom-amount sales group under "Custom" (typed names stay on the
          // order lines for the drill-down).
          const key = line.productId === "custom" ? "custom" : line.productId;
          const label = key === "custom" ? "Custom" : line.productName;
          add(key, label, isSettled ? amt : 0, isRefund ? amt : isSettled ? lineRefund : 0, isSettled && line.admits > 0 && !line.parentLineId ? line.quantity : 0);
        } else {
          const cid = line.productId.startsWith("addon_") ? "addons" : (productCat.get(line.productId) ?? "none");
          add(cid, cid === "addons" ? "Add-ons" : cid === "none" ? "Uncategorised" : (catName.get(cid) ?? "—"), isSettled ? amt : 0, isRefund ? amt : 0, isSettled ? line.quantity : 0);
        }
      }
      continue;
    }

    // Order-level groupings — net of discounts, from line values.
    const orderNet = o.lines.reduce((s, l) => s + lineNet(l), 0);
    const g = isSettled ? orderNet : 0;
    const r = isRefund ? orderNet : 0;
    const tk = isSettled ? orderTickets(o) : 0;
    if (query.groupBy === "payment_method") {
      const m = methodBucket(o);
      add(m, m === "mixed" ? "Mixed" : (methodLabel[m] ?? m), g, r, tk);
    } else if (query.groupBy === "counter") {
      add(o.counterId ?? "none", o.counterId ? (cntName.get(o.counterId) ?? "—") : "No counter", g, r, tk);
    } else if (query.groupBy === "location") {
      add(o.locationId, locName.get(o.locationId) ?? "—", g, r, tk);
    } else if (query.groupBy === "staff") {
      add(o.staffId ?? "none", o.staffId ? (stfName.get(o.staffId) ?? "—") : "Online / self-service", g, r, tk);
    } else if (query.groupBy === "hour") {
      const hour = new Date(Date.parse(o.createdAt) + 6 * 3600000).getUTCHours();
      add(String(hour), `${String(hour).padStart(2, "0")}:00`, g, r, tk);
    }
  }

  const outRows: SalesReportRow[] = [...buckets.entries()].map(([key, b]) => ({
    key,
    label: b.label,
    ticketCount: b.tickets,
    gross: b.gross,
    refunds: b.refunds,
    net: b.gross - b.refunds,
    shareOfTotal: summary.net > 0 ? (b.gross - b.refunds) / summary.net : 0,
  }));
  outRows.sort((a, b) => b.net - a.net);

  return ok<SalesReportResponse>({
    summary: {
      gross: summary.gross, refunds: summary.refunds, net: summary.net, ticketCount: summary.ticketCount,
      prevGross: prev.gross, prevNet: prev.net, prevTicketCount: prev.ticketCount,
    },
    rows: outRows,
  });
}

// ── F7 implementations against the mock store ───────────────────────────────
const txStatus = (o: Order): TxStatus =>
  o.status === "refunded" ? "refunded" : o.status === "partly_refunded" ? "partly_refunded" : o.status === "cancelled" ? "void" : o.status === "pending" ? "void" : "completed";

function matches(o: Order, q: Omit<TransactionQuery, "sort" | "cursor" | "limit">): boolean {
  const d = o.createdAt.slice(0, 10);
  if (d < q.from || d > q.to) return false;
  if (q.locationIds?.length && !q.locationIds.includes(o.locationId)) return false;
  if (q.counterIds?.length && !q.counterIds.includes(o.counterId ?? "")) return false;
  if (q.staffIds?.length && !q.staffIds.includes(o.staffId ?? "")) return false;
  if (q.productIds?.length && !o.lines.some((l) => q.productIds!.includes(l.productId))) return false;
  if (q.categoryIds?.length) {
    const cats = new Map(peekProducts().map((p) => [p.id, p.categoryId]));
    if (!o.lines.some((l) => q.categoryIds!.includes(cats.get(l.productId) ?? ""))) return false;
  }
  if (q.paymentMethods?.length) {
    const b = methodBucket(o);
    if (b === "mixed" || !q.paymentMethods.includes(b)) return false;
  }
  if (q.status?.length && !q.status.includes(txStatus(o))) return false;
  if (q.minAmount != null && o.total < q.minAmount) return false;
  if (q.maxAmount != null && o.total > q.maxAmount) return false;
  if (q.customerId && o.customerName !== q.customerId) return false;
  if (q.channel && o.channel !== q.channel) return false;
  if (q.search) {
    const s = q.search.toLowerCase();
    const hit =
      o.reference.toLowerCase().includes(s) ||
      (o.customerName?.toLowerCase().includes(s) ?? false) ||
      o.lines.some((l) => l.productName.toLowerCase().includes(s));
    if (!hit) return false;
  }
  return true;
}

export async function getTransactions(q: TransactionQuery): Promise<ApiResult<TransactionResponse>> {
  const cntName = new Map(peekCounters().map((c) => [c.id, c.name]));
  const stfName = new Map(peekStaff().map((s) => [s.id, s.name]));
  let rows = peekOrders().filter((o) => matches(o, q));
  const dir = q.sort?.dir === "asc" ? 1 : -1;
  const field = q.sort?.field ?? "time";
  rows = rows.sort((a, b) => {
    if (field === "amount") return (a.total - b.total) * dir;
    if (field === "status") return txStatus(a).localeCompare(txStatus(b)) * dir;
    return a.createdAt.localeCompare(b.createdAt) * dir;
  });
  const total = rows.length;
  const offset = q.cursor ? parseInt(q.cursor, 10) || 0 : 0;
  const limit = q.limit ?? 50;
  const page = rows.slice(offset, offset + limit);
  return ok<TransactionResponse>({
    rows: page.map((o) => {
      const real = o.lines.filter((l) => l.unitPrice > 0);
      return {
        id: o.id,
        time: o.createdAt,
        reference: o.reference,
        itemsLabel: real.length ? `${real[0].productName}${real.length > 1 ? ` and ${real.length - 1} more` : ""}` : "—",
        customer: o.customerName,
        staffName: o.staffId ? (stfName.get(o.staffId) ?? null) : null,
        counterName: o.counterId ? (cntName.get(o.counterId) ?? null) : null,
        method: methodBucket(o),
        net: o.total,
        status: txStatus(o),
        lines: o.lines,
      };
    }),
    total,
    cursor: offset + limit < total ? String(offset + limit) : null,
  });
}

export async function getAnalytics(q: AnalyticsQuery): Promise<ApiResult<AnalyticsResponse>> {
  const orders = peekOrders().filter((o) => matches(o, q) && settled(o));
  const len = dayCount(q.from, q.to);
  const prevOrders = q.compareToPrevious
    ? peekOrders().filter((o) => matches(o, { ...q, from: shift(q.from, -len), to: shift(q.from, -1) }) && settled(o))
    : [];
  const days: string[] = [];
  for (let i = 0; i < len; i++) days.push(shift(q.from, i));
  const out: AnalyticsResponse = {};

  if (q.series.includes("revenue")) {
    const gran = q.granularity ?? (len <= 1 ? "hour" : len <= 45 ? "day" : "week");
    if (gran === "hour") {
      out.revenue = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, "0")}:00`,
        value: orders.filter((o) => new Date(Date.parse(o.createdAt) + 6 * 3600000).getUTCHours() === h).reduce((s, o) => s + o.total, 0),
        compare: q.compareToPrevious ? prevOrders.filter((o) => new Date(Date.parse(o.createdAt) + 6 * 3600000).getUTCHours() === h).reduce((s, o) => s + o.total, 0) : undefined,
      }));
    } else {
      const bucket = (d: string) => (gran === "week" ? shift(d, -(new Date(`${d}T12:00:00Z`).getUTCDay())) : gran === "month" ? d.slice(0, 7) : d);
      const buckets = [...new Set(days.map(bucket))];
      out.revenue = buckets.map((b, i) => ({
        label: gran === "day" ? b.slice(5) : b,
        value: orders.filter((o) => bucket(o.createdAt.slice(0, 10)) === b).reduce((s, o) => s + o.total, 0),
        compare: q.compareToPrevious
          ? prevOrders.filter((o) => { const pb = [...new Set(days.map((d) => bucket(shift(d, -len))))][i]; return bucket(o.createdAt.slice(0, 10)) === pb; }).reduce((s, o) => s + o.total, 0)
          : undefined,
      }));
    }
  }
  if (q.series.includes("hour_of_day")) {
    out.hour_of_day = Array.from({ length: 24 }, (_, h) => ({
      label: `${String(h).padStart(2, "0")}`,
      value: orders.filter((o) => new Date(Date.parse(o.createdAt) + 6 * 3600000).getUTCHours() === h).reduce((s, o) => s + o.total, 0),
    })).filter((p) => p.value > 0 || true);
  }
  if (q.series.includes("day_of_week")) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    out.day_of_week = names.map((n, d) => ({
      label: n,
      value: orders.filter((o) => new Date(`${o.createdAt.slice(0, 10)}T12:00:00Z`).getUTCDay() === d).reduce((s, o) => s + o.total, 0),
    }));
  }
  if (q.series.includes("payment_mix")) {
    const label: Record<string, string> = { cash: "Cash", card_terminal: "Card", bkash: "bKash", bangla_qr: "QR", voucher: "Voucher", credit: "Credit" };
    const m = new Map<string, number>();
    orders.forEach((o) => o.payments.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + p.amount)));
    out.payment_mix = [...m.entries()].map(([k, v]) => ({ label: label[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  }
  if (q.series.includes("capacity_utilisation") || q.series.includes("no_show_rate")) {
    const products = peekProducts().filter((p) => p.status === "active");
    const bookings = peekBookings().filter((b) => b.status === "confirmed");
    const util: SeriesPoint[] = [];
    const noShow: SeriesPoint[] = [];
    for (const d of days) {
      let cap = 0;
      for (const p of products) {
        if (!p.schedule) continue;
        if (p.schedule.dailyCapacity) cap += p.schedule.dailyCapacity;
        else if (isResourceType(p.bookingType)) cap += getResourceMatrix(p, d).reduce((s, r) => s + r.slots.length, 0);
        else if (isSlotBased(p.bookingType)) cap += getSlots(p, d).reduce((s, x) => s + x.capacity, 0);
      }
      const day = bookings.filter((b) => b.slotStart.slice(0, 10) === d);
      const sold = day.reduce((s, b) => s + b.partySize, 0);
      const inCount = day.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
      util.push({ label: d.slice(5), value: cap > 0 ? Math.round((sold / cap) * 100) : 0 });
      noShow.push({ label: d.slice(5), value: sold > 0 ? Math.round(((sold - inCount) / sold) * 100) : 0 });
    }
    if (q.series.includes("capacity_utilisation")) out.capacity_utilisation = util;
    if (q.series.includes("no_show_rate")) out.no_show_rate = noShow;
  }
  if (q.series.includes("lead_time")) {
    const buckets = [0, 1, 2, 3, 7, 14, 30];
    const labels = ["Same day", "1d", "2d", "3–6d", "1–2w", "2–4w", "1m+"];
    const counts = new Array(labels.length).fill(0);
    const orderIds = new Set(orders.map((o) => o.id));
    peekBookings().filter((b) => b.status === "confirmed" && orderIds.has(b.orderId)).forEach((b) => {
      const o = orders.find((x) => x.id === b.orderId)!;
      const lead = Math.max(0, Math.round((Date.parse(b.slotStart.slice(0, 10)) - Date.parse(o.createdAt.slice(0, 10))) / 86400000));
      let i = buckets.findIndex((x, j) => lead >= x && (j === buckets.length - 1 || lead < buckets[j + 1]));
      if (i < 0) i = labels.length - 1;
      counts[i] += 1;
    });
    out.lead_time = labels.map((l, i) => ({ label: l, value: counts[i] }));
  }
  if (q.series.includes("top_products")) {
    // From line NET values — add-ons count as their own products.
    const m = new Map<string, number>();
    orders.forEach((o) => o.lines.forEach((l) => { if (l.unitPrice > 0) m.set(l.productName, (m.get(l.productName) ?? 0) + lineNet(l)); }));
    out.top_products = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));
  }
  return ok(out);
}
