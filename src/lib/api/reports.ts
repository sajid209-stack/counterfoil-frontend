import { ok } from "./client";
import { peekCategories } from "./categories";
import { peekCounters } from "./counters";
import { peekLocations } from "./locations";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import { peekStaff } from "./staff";
import type { ApiResult, ID, ISODate, Minor, Order } from "./types";

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

const settled = (o: Order) => o.status === "paid" || o.status === "partial";
const orderTickets = (o: Order) => o.lines.reduce((s, l) => s + l.quantity, 0);
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
    if (settled(o)) { gross += o.subtotal; ticketCount += orderTickets(o); }
    else if (o.status === "refunded") refunds += o.subtotal;
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
      for (const line of o.lines) {
        const amt = line.unitPrice * line.quantity;
        if (query.groupBy === "product") {
          // Custom-amount sales group under "Custom" (typed names stay on the
          // order lines for the drill-down); discounts under their own row.
          const key = line.productId === "custom" ? "custom" : line.productId === "discount" ? "discount" : line.productId;
          const label = key === "custom" ? "Custom" : key === "discount" ? "Discounts" : line.productName;
          add(key, label, isSettled ? amt : 0, isRefund ? amt : 0, isSettled && amt > 0 ? line.quantity : 0);
        } else {
          const cid = productCat.get(line.productId) ?? "none";
          add(cid, cid === "none" ? "Uncategorised" : (catName.get(cid) ?? "—"), isSettled ? amt : 0, isRefund ? amt : 0, isSettled ? line.quantity : 0);
        }
      }
      continue;
    }

    // Order-level groupings
    const g = isSettled ? o.subtotal : 0;
    const r = isRefund ? o.subtotal : 0;
    const tk = isSettled ? orderTickets(o) : 0;
    if (query.groupBy === "payment_method") {
      const m = o.payments[0]?.method ?? "cash";
      add(m, methodLabel[m] ?? m, g, r, tk);
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
