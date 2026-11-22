import {
  orderChannelOf,
  orderDue,
  orderItemCount,
  orderMethodOf,
  orderNetPaid,
  orderRefundedOut,
  orderSales,
  orderWrittenOff,
  type Order,
  type SalesRow,
  type SalesSummary,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { slugify, type Report, type ReportLabels, type ReportTable } from "@/lib/report";
import type { SalesFilters } from "./filters";
import type { SalesLabels } from "./labels";
import type { Directory } from "./useReport";

/**
 * The sales report as a workbook.
 *
 * One builder for the Orders list's Excel and CSV and for the summary-only
 * download, so the file a manager opens says the same numbers as the panel and
 * the printout: they all come from `summariseSales`. The Summary sheet is the
 * "how did we do" page; the Orders sheet is one row per order; the Items sheet
 * is one row per order line, for "what did we sell".
 */

export type Tr = (key: string, values?: Record<string, string | number>) => string;

const pad = (n: number) => String(n).padStart(2, "0");
/** The local calendar day an instant falls on: "2026-07-29". */
export const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** The local clock time an instant falls on: "14:05". */
const localClock = (iso: string): string => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** `sales-<venue>-<from>_<to>` — the range the filters name, or, with none,
 *  the span the orders themselves cover. */
export function reportFileBase(kind: "sales" | "sales-summary", venueName: string, f: Pick<SalesFilters, "from" | "to">, rows: Order[]): string {
  let from = f.from;
  let to = f.to;
  if (!from || !to) {
    const days = rows.map((o) => localDay(o.createdAt)).sort();
    from = days[0] ?? "all";
    to = days[days.length - 1] ?? "all";
  }
  return `${kind}-${slugify(venueName || "venue")}-${from}_${to}`;
}

export interface SalesReportContext {
  t: Tr;
  L: SalesLabels;
  dir: Directory;
  labels: ReportLabels;
  business: string;
  venueName: string;
  currency: string;
  fileBase: string;
  meta: [string, string][];
  /** A customer's phone by record id, when the customer has one. */
  phoneOf: (customerId: string | null | undefined) => string;
}

const share = (amount: number, whole: number) => (whole > 0 ? amount / whole : 0);

export function buildSalesReport(rows: Order[], s: SalesSummary, c: SalesReportContext, opts: { summaryOnly?: boolean } = {}): Report {
  const { t, L, dir } = c;
  const r = (key: string, values?: Record<string, string | number>) => t(`report.${key}`, values);
  const money = (n: number) => formatMoney(n, c.currency);

  /* ── Key figures ─────────────────────────────────────────────────────── */
  const voidedCount = s.orders - s.counted;
  const refundedOrders = rows.filter((o) => orderRefundedOut(o) > 0).length;
  const owingOrders = rows.filter((o) => orderDue(o) > 0).length;
  const aov = s.counted > 0 ? Math.round(s.sales / s.counted) : 0;
  const kpis = [
    { label: r("kpiSales"), value: s.sales, note: r("kpiSalesNote", { count: s.counted }) },
    { label: r("kpiOrders"), value: s.counted, type: "int" as const, note: voidedCount > 0 ? r("kpiOrdersNote", { count: voidedCount }) : r("kpiOrdersNone") },
    { label: r("kpiAov"), value: aov, note: r("kpiAovNote") },
    { label: r("kpiItems"), value: s.items, type: "int" as const, note: r("kpiItemsNote") },
    { label: r("kpiRefunds"), value: s.refunds, note: r("kpiRefundsNote", { count: refundedOrders }) },
    { label: r("kpiOwed"), value: s.owed, note: s.writtenOff > 0 ? r("kpiOwedWrittenOff", { count: owingOrders, amount: money(s.writtenOff) }) : r("kpiOwedNote", { count: owingOrders }) },
    { label: r("kpiDiscounts"), value: s.discounts, note: r("kpiDiscountsNote", { pct: `${(share(s.discounts, s.gross) * 100).toFixed(1)}%` }) },
    { label: r("kpiVat"), value: s.vat, note: r("kpiVatNote") },
  ];

  /* ── Breakdowns, each biggest first and adding up to the same Sales ──── */
  const amountCols = (first: string) => [
    { header: first },
    { header: t("summary.colOrders"), type: "int" as const },
    { header: r("colSales"), type: "money" as const },
    { header: r("colShare"), type: "pct" as const, total: "sum" as const },
  ];
  const group = (title: string, first: string, list: SalesRow[], name: (k: string) => string): ReportTable => {
    const sorted = [...list].sort((a, b) => b.amount - a.amount || b.orders - a.orders);
    return {
      title,
      columns: amountCols(first),
      rows: sorted.map((x) => [name(x.key), x.orders, x.amount, share(x.amount, s.sales)]),
      totalLabel: t("summary.total"),
    };
  };

  const byDayMap = new Map<string, { orders: number; amount: number }>();
  for (const o of rows) {
    const d = localDay(o.createdAt);
    const cur = byDayMap.get(d) ?? { orders: 0, amount: 0 };
    cur.orders += 1;
    cur.amount += orderSales(o);
    byDayMap.set(d, cur);
  }
  // A trend reads in calendar order, so the one breakdown that is not biggest-first is the days.
  const byDay: ReportTable = {
    title: r("tableByDay"),
    columns: [{ header: r("colDay"), type: "date" }, ...amountCols("").slice(1)],
    rows: [...byDayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => [d, v.orders, v.amount, share(v.amount, s.sales)]),
    totalLabel: t("summary.total"),
  };

  const methodRows: [string, number][] = [...s.methods].sort((a, b) => b.amount - a.amount).map((m) => [L.method(m.key), m.amount]);
  if (s.owed > 0) methodRows.push([t("summary.owed"), s.owed]);
  if (s.writtenOff > 0) methodRows.push([t("summary.writtenOff"), s.writtenOff]);
  const byMethod: ReportTable = {
    title: t("summary.byMethod"),
    columns: [{ header: t("summary.colMethod") }, { header: r("colSales"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: methodRows.map(([name, amount]) => [name, amount, share(amount, s.sales)]),
    totalLabel: t("summary.total"),
  };

  const items = [...s.topItems];
  const topItems: ReportTable = {
    title: t("summary.topItems"),
    columns: [{ header: t("summary.colItem") }, { header: t("summary.colQty"), type: "int" }, { header: r("colSales"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: [
      ...items.map((i) => [i.name, i.qty, i.amount, share(i.amount, s.sales)]),
      ...(s.otherItems.count > 0 ? [[t("summary.otherItems", { count: s.otherItems.count }), s.otherItems.qty, s.otherItems.amount, share(s.otherItems.amount, s.sales)]] : []),
    ],
    totalLabel: t("summary.total"),
  };

  const summary: ReportTable[] = [
    byDay,
    byMethod,
    group(t("summary.byChannel"), t("colChannel"), s.channels, (k) => L.channel(k as never)),
    group(t("summary.byCounter"), t("colCounter"), s.counters, (k) => L.counter(k)),
    group(t("summary.byStaff"), t("colStaff"), s.staff, (k) => L.staff(k)),
    group(t("summary.byStatus"), t("colStatus"), s.statuses, (k) => L.status(k)),
    topItems,
  ];

  /* ── Records ─────────────────────────────────────────────────────────── */
  const ordersTable: ReportTable = {
    title: r("sheetOrders"),
    totalLabel: t("summary.total"),
    columns: [
      { header: t("colReference"), type: "code" },
      { header: t("colDate"), type: "date" },
      { header: r("colTime"), type: "time" },
      { header: t("colCustomer") },
      { header: r("colPhone"), type: "code" },
      { header: t("colChannel") },
      { header: t("colCounter") },
      { header: t("colStaff") },
      { header: t("colMethod") },
      { header: t("colItems"), type: "int" },
      { header: r("colGross"), type: "money" },
      { header: t("colDiscount"), type: "money" },
      { header: t("colTax"), type: "money" },
      { header: t("colTotal"), type: "money" },
      { header: r("colSales"), type: "money" },
      { header: t("colPaid"), type: "money" },
      { header: r("colRefunded"), type: "money" },
      { header: r("colDue"), type: "money" },
      { header: r("colWrittenOff"), type: "money" },
      { header: t("colStatus") },
    ],
    rows: rows.map((o) => [
      o.reference,
      localDay(o.createdAt),
      localClock(o.createdAt),
      o.customerName ?? t("walkIn"),
      c.phoneOf(o.customerId),
      o.source ? `${L.channel(orderChannelOf(o))} (${o.source.marketplaceName})` : L.channel(orderChannelOf(o)),
      o.counterId ? dir.counterName(o.counterId) : "",
      o.staffId ? dir.staffName(o.staffId) : "",
      L.method(orderMethodOf(o)),
      orderItemCount(o),
      o.subtotal,
      o.discountTotal ?? 0,
      o.taxTotal ?? 0,
      o.total,
      orderSales(o),
      orderNetPaid(o),
      orderRefundedOut(o),
      orderDue(o),
      orderWrittenOff(o),
      L.status(o.status),
    ]),
  };

  const itemsTable: ReportTable = {
    title: r("sheetItems"),
    totalLabel: t("summary.total"),
    columns: [
      { header: t("colReference"), type: "code" },
      { header: t("colDate"), type: "date" },
      { header: r("colBooking") },
      { header: r("colTier") },
      { header: r("colVisit"), type: "date" },
      { header: t("summary.colQty"), type: "int" },
      { header: r("colUnit"), type: "money", total: "none" },
      { header: t("colDiscount"), type: "money" },
      { header: t("colTax"), type: "money" },
      { header: r("colLineTotal"), type: "money" },
      { header: r("colRefunded"), type: "money" },
      { header: t("colStatus") },
    ],
    rows: rows.flatMap((o) =>
      o.lines.map((l) => [
        o.reference,
        localDay(o.createdAt),
        l.parentLineId ? `↳ ${l.productName}` : l.productName,
        l.tierName,
        l.booking?.date ?? "",
        l.quantity,
        l.unitPrice,
        (l.lineDiscount ?? 0) + (l.allocatedOrderDiscount ?? 0),
        l.taxAmount,
        l.total,
        l.refundedAmount ?? 0,
        L.status(o.status),
      ]),
    ),
  };

  const g = (k: string): [string, string] => [r(`gloss.${k}.t`), r(`gloss.${k}.d`)];
  return {
    title: opts.summaryOnly ? t("summary.title") : r("title"),
    business: c.business,
    fileBase: c.fileBase,
    currency: c.currency,
    meta: c.meta,
    kpis,
    summary,
    sheets: opts.summaryOnly ? [] : [{ name: r("sheetOrders"), table: ordersTable }, { name: r("sheetItems"), table: itemsTable }],
    glossary: [g("sales"), g("gross"), g("discounts"), g("net"), g("vat"), g("total"), g("paid"), g("refunded"), g("owed"), g("writtenOff"), g("aov"), g("items"), g("counted"), g("share")],
    labels: c.labels,
  };
}
