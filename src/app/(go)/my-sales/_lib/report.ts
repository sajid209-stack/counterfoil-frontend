import type { Order } from "@/lib/api";
import type { Report, ReportLabels, ReportTable } from "@/lib/report";
import { itemsShort, byMethod } from "../_components/SaleList";
import { orderDay, type SaleRow, type Summary } from "./summary";

/**
 * "My sales" as a workbook: a cashier's shift or week, ready to hand to a
 * supervisor. The Summary sheet answers "how did I do" with the page's own
 * figures (and its own "more than yesterday" wording); the Sales sheet is one
 * row per sale of the list that was open; Items is one row per ticket line.
 */

type Tr = (key: string, values?: Record<string, string | number>) => string;

export interface MySalesReportInput {
  t: Tr;
  methodName: (m: string) => string;
  statusName: (s: string) => string;
  money: (minor: number) => string;
  labels: ReportLabels;
  business: string;
  currency: string;
  fileBase: string;
  meta: [string, string][];
  cur: Summary;
  prev: Summary;
  hasPrev: boolean;
  refName: string;
  /** Every sale in the range, and the lists the tabs show. */
  all: SaleRow[];
  dueCollected: SaleRow[];
  owed: SaleRow[];
  /** The rows of the list that was open, after search: what the Sales sheet holds. */
  found: SaleRow[];
  who: (o: Order) => { name: string; phone: string | null };
}

const voided = (o: Order) => o.status === "cancelled" || o.status === "refunded";
const share = (n: number, whole: number) => (whole > 0 ? n / whole : 0);

export function buildMySalesReport(i: MySalesReportInput): Report {
  const { t, cur, prev } = i;
  const r = (key: string, values?: Record<string, string | number>) => t(`report.${key}`, values);
  const compare = (now: number, before: number, fmt: (n: number) => string): string | undefined => {
    if (!i.hasPrev) return undefined;
    const diff = now - before;
    return diff === 0 ? t("cmpSame", { name: i.refName }) : t(diff > 0 ? "cmpUp" : "cmpDown", { amount: fmt(Math.abs(diff)), name: i.refName });
  };
  const avg = cur.orders > 0 ? Math.round(cur.total / cur.orders) : 0;
  const prevAvg = prev.orders > 0 ? Math.round(prev.total / prev.orders) : 0;
  const duePaid = i.dueCollected.reduce((n, x) => n + x.amount, 0);
  const owedSum = i.owed.reduce((n, x) => n + x.amount, 0);

  const kpis = [
    { label: r("kpiSales"), value: cur.total, note: compare(cur.total, prev.total, i.money) },
    { label: r("kpiCount"), value: cur.orders, type: "int" as const, note: compare(cur.orders, prev.orders, String) },
    { label: r("kpiAvg"), value: avg, note: cur.orders > 0 ? compare(avg, prevAvg, i.money) : undefined },
    { label: r("kpiItems"), value: cur.items, type: "int" as const, note: compare(cur.items, prev.items, String) },
    { label: r("kpiRefunds"), value: cur.refunds, note: t("refundCount", { count: cur.refundCount }) },
    { label: r("kpiCash"), value: cur.cashTaken, note: r("kpiCashNote", { amount: i.money(cur.cashRefunds) }) },
    { label: r("kpiDue"), value: duePaid, note: r("kpiDueNote", { count: i.dueCollected.length }) },
    { label: r("kpiOwed"), value: owedSum, note: r("kpiOwedNote", { count: i.owed.length }) },
  ];

  const methodTotal = cur.byMethod.reduce((n, m) => n + m.amount, 0);
  const byMethod_: ReportTable = {
    title: r("byMethod"),
    columns: [{ header: r("colMethod") }, { header: r("colSales"), type: "int" }, { header: r("colAmount"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: cur.byMethod
      .filter((m) => m.amount !== 0 || m.count > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((m) => [i.methodName(m.method), m.count, m.amount, share(m.amount, methodTotal)]),
    totalLabel: t("report.total"),
  };

  const days = new Map<string, { n: number; amount: number }>();
  for (const x of i.all) {
    if (voided(x.order)) continue;
    const d = orderDay(x.order);
    const c = days.get(d) ?? { n: 0, amount: 0 };
    c.n += 1;
    c.amount += x.amount;
    days.set(d, c);
  }
  const byDay: ReportTable = {
    title: r("byDay"),
    columns: [{ header: r("colDay"), type: "date" }, { header: r("colSales"), type: "int" }, { header: r("colAmount"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => [d, v.n, v.amount, share(v.amount, cur.total)]),
    totalLabel: t("report.total"),
  };

  const dueMap = new Map<string, { n: number; amount: number }>();
  for (const x of i.dueCollected) for (const p of x.payments) {
    const c = dueMap.get(p.method) ?? { n: 0, amount: 0 };
    c.n += 1;
    c.amount += p.amount;
    dueMap.set(p.method, c);
  }
  const dueTotal = [...dueMap.values()].reduce((n, v) => n + v.amount, 0);
  const dueTable: ReportTable = {
    title: r("dueByMethod"),
    columns: [{ header: r("colMethod") }, { header: r("colPayments"), type: "int" }, { header: r("colAmount"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: [...dueMap.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([m, v]) => [i.methodName(m), v.n, v.amount, share(v.amount, dueTotal)]),
    totalLabel: t("report.total"),
  };

  const sales: ReportTable = {
    title: r("sheetSales"),
    totalLabel: t("report.total"),
    columns: [
      { header: t("csv.code"), type: "code" },
      { header: t("csv.date"), type: "date" },
      { header: t("csv.time"), type: "time" },
      { header: t("csv.customer") },
      { header: t("csv.phone"), type: "code" },
      { header: t("csv.method") },
      { header: t("csv.items") },
      { header: t("csv.amount"), type: "money" },
      { header: t("csv.refunded"), type: "money" },
      { header: t("csv.due"), type: "money" },
      { header: t("csv.status") },
    ],
    rows: i.found.map((x) => {
      const o = x.order;
      const back = o.payments.filter((p) => p.status === "confirmed" && p.amount < 0).reduce((n, p) => n - p.amount, 0);
      const w = i.who(o);
      return [o.reference, orderDay(o), clock(x.at), w.name, w.phone ?? "", byMethod(x).map((p) => i.methodName(p.method)).join(" + "), itemsShort(o), x.amount, back, x.due, i.statusName(o.status)];
    }),
  };

  const items: ReportTable = {
    title: r("sheetItems"),
    totalLabel: t("report.total"),
    columns: [
      { header: t("csv.code"), type: "code" },
      { header: t("csv.date"), type: "date" },
      { header: r("colBooking") },
      { header: r("colTier") },
      { header: r("colQty"), type: "int" },
      { header: r("colUnit"), type: "money", total: "none" },
      { header: r("colDiscount"), type: "money" },
      { header: r("colVat"), type: "money" },
      { header: r("colLineTotal"), type: "money" },
      { header: t("csv.refunded"), type: "money" },
      { header: t("csv.status") },
    ],
    rows: i.found.flatMap((x) =>
      x.order.lines.map((l) => [
        x.order.reference,
        orderDay(x.order),
        l.parentLineId ? `↳ ${l.productName}` : l.productName,
        l.tierName,
        l.quantity,
        l.unitPrice,
        (l.lineDiscount ?? 0) + (l.allocatedOrderDiscount ?? 0),
        l.taxAmount,
        l.total,
        l.refundedAmount ?? 0,
        i.statusName(x.order.status),
      ]),
    ),
  };

  const g = (k: string): [string, string] => [r(`gloss.${k}.t`), r(`gloss.${k}.d`)];
  const summary = [byDay, byMethod_];
  if (i.dueCollected.length) summary.push(dueTable);
  return {
    title: r("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis,
    summary,
    sheets: [{ name: r("sheetSales"), table: sales }, { name: r("sheetItems"), table: items }],
    glossary: [g("sales"), g("amount"), g("refunded"), g("due"), g("cash"), g("dueCollected"), g("avg"), g("share")],
    labels: i.labels,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
