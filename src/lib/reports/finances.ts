/*
 * The Finances page as a workbook: the balances at the time of the export, the
 * period's money in, fees, refunds and payouts, and every ledger line behind
 * them as a statement an accountant can reconcile against the bank.
 *
 * The balance and period figures are the ones the page's cards show (the same
 * `getFinanceSummary`); the sheet is the same lines the history table lists,
 * under the same filter, so its total is the net movement of what is on screen.
 */
import { formatMoney } from "@/lib/format";
import type { FinanceDay, FinanceLine, FinanceSummary } from "@/lib/api";
import type { Report, ReportColumn, ReportTable } from "@/lib/report";
import type { T } from "./context";

export interface FinancesReportInput {
  days: FinanceDay[];
  summary: FinanceSummary;
  /** The `finances` namespace. */
  t: T;
  /** A line in words ("Online payment"), without its reference. */
  describe: (l: FinanceLine) => string;
  method: (m: string) => string;
  labels: Report["labels"];
  meta: [string, string][];
  business: string;
  currency: string;
  fileBase: string;
}

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });
const KINDS = ["sale", "refund", "platform_fee", "processing_fee", "payout", "withdrawal", "deposit"] as const;
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function buildFinancesReport(i: FinancesReportInput): Report {
  const { days, summary: s, t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(`export.${k}`, v);
  const lines = days.flatMap((d) => d.lines);
  const methodOf = (l: FinanceLine) => (l.method ? (l.method === "bank_transfer" ? x("bankTransfer") : i.method(l.method)) : "");

  const data: ReportTable = {
    title: x("sheet.ledger"),
    note: x("note.ledger"),
    columns: [
      col(x("col.order"), "code"),
      col(x("col.reference"), "code"),
      col(x("col.date"), "date"),
      col(x("col.time"), "time"),
      col(x("col.type")),
      col(x("col.description")),
      col(x("col.method")),
      col(x("col.who")),
      col(x("col.feeBase"), "money", "none"),
      col(x("col.feeRate"), "pct", "none"),
      col(x("col.amount"), "money"),
      col(x("col.status")),
    ],
    rows: lines.map((l) => [
      l.orderReference ?? "",
      l.reference ?? "",
      dayOf(l.at),
      hm(l.at),
      x(`kind.${l.kind}`),
      i.describe(l),
      methodOf(l),
      l.destination ?? l.by ?? "",
      l.feeBase ?? null,
      l.rateBp != null ? l.rateBp / 10000 : null,
      l.amount,
      t(`status.${l.status}`),
    ]),
    totalLabel: x("netMovement"),
  };

  // What moved, by kind of line: the biggest first, in or out.
  const byKind = KINDS.map((k) => {
    const ls = lines.filter((l) => l.kind === k);
    return { k, count: ls.length, amount: ls.reduce((a, l) => a + l.amount, 0) };
  })
    .filter((g) => g.count > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const sales = lines.filter((l) => l.kind === "sale");
  const byMethod = [...new Set(sales.map(methodOf))]
    .map((m) => {
      const ls = sales.filter((l) => methodOf(l) === m);
      return { m, count: ls.length, amount: ls.reduce((a, l) => a + l.amount, 0) };
    })
    .sort((a, b) => b.amount - a.amount);

  const summary: ReportTable[] = [
    {
      title: x("table.byType"),
      note: x("note.byType"),
      columns: [col(x("col.type")), col(x("col.lines"), "int"), col(x("col.amount"), "money")],
      rows: byKind.map((g) => [x(`kind.${g.k}`), g.count, g.amount]),
      totalLabel: x("netMovement"),
    },
    {
      title: x("table.byDay"),
      note: x("note.byDay"),
      columns: [col(x("col.date"), "date"), col(x("col.moneyIn"), "money"), col(x("col.moneyOut"), "money"), col(x("col.net"), "money"), col(x("col.status"))],
      rows: [...days].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [d.date, d.moneyIn, d.moneyOut, d.net, t(d.status === "pending" ? "day.clearing" : "day.settled")]),
      totalLabel: x("total"),
    },
    {
      title: x("table.byMethod"),
      note: x("note.byMethod"),
      columns: [col(x("col.method")), col(x("col.payments"), "int"), col(x("col.amount"), "money")],
      rows: byMethod.map((g) => [g.m || "—", g.count, g.amount]),
      totalLabel: x("total"),
    },
  ].filter((tb) => tb.rows.length > 0);

  const p = s.period;
  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis: [
      { label: x("kpi.available"), value: s.available, type: "money", note: s.nextPayout ? x("kpi.availableNote", { amount: formatMoney(s.nextPayout.amount), date: s.nextPayout.date }) : x("kpi.availableNone") },
      { label: x("kpi.unsettled"), value: s.unsettled, type: "money", note: s.clearsBy ? x("kpi.unsettledNote", { date: s.clearsBy }) : x("kpi.unsettledNone") },
      { label: x("kpi.moneyIn"), value: p.moneyIn, type: "money", note: x("kpi.moneyInNote", { deposits: formatMoney(p.deposited) }) },
      { label: x("kpi.fees"), value: p.fees, type: "money", note: x("kpi.feesNote") },
      { label: x("kpi.refunds"), value: p.refunds, type: "money", note: x("kpi.refundsNote") },
      { label: x("kpi.paidOut"), value: p.paidOut, type: "money", note: x("kpi.paidOutNote", { payouts: p.payoutCount, withdrawals: p.withdrawals }) },
    ],
    summary,
    sheets: [{ name: x("sheet.ledger"), table: data }],
    glossary: [gl("available"), gl("unsettled"), gl("moneyIn"), gl("fees"), gl("refunds"), gl("paidOut"), gl("amount"), gl("status"), gl("filter")],
    labels: i.labels,
  };
}
