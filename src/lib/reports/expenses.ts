/*
 * The Expenses page as a workbook: what was spent, on what, how it was paid and
 * when — every row the filters match, every page, so the total on the Summary
 * is the total on the screen.
 */
import type { Expense } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Report, ReportColumn, ReportTable } from "@/lib/report";
import type { T } from "./context";

export interface ExpensesReportInput {
  rows: Expense[];
  /** The `expenses` namespace. */
  t: T;
  category: (c: string) => string;
  paidFrom: (p: string) => string;
  /** "2026-07" → "July 2026", in the reader's language. */
  month: (ym: string) => string;
  labels: Report["labels"];
  meta: [string, string][];
  business: string;
  currency: string;
  fileBase: string;
}

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });
const pctOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** Sum rows into groups, biggest first. */
function group<K extends string>(rows: Expense[], keyOf: (e: Expense) => K) {
  const by = new Map<K, { total: number; count: number }>();
  for (const e of rows) {
    const g = by.get(keyOf(e)) ?? { total: 0, count: 0 };
    g.total += e.total;
    g.count += 1;
    by.set(keyOf(e), g);
  }
  return [...by.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => b.total - a.total || b.count - a.count);
}

export function buildExpensesReport(i: ExpensesReportInput): Report {
  const { rows, t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(`export.${k}`, v);
  const total = rows.reduce((s, e) => s + e.total, 0);
  const items = rows.reduce((s, e) => s + e.lineCount, 0);
  const cats = group(rows, (e) => e.category);
  const paid = group(rows, (e) => e.paidFrom);
  const months = group(rows, (e) => e.date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
  const payees = group(
    rows.filter((e) => e.payee?.trim()),
    (e) => (e.payee ?? "").trim(),
  ).slice(0, 8);
  const biggest = rows.reduce<Expense | null>((m, e) => (m === null || e.total > m.total ? e : m), null);

  const share = (g: { total: number }) => pctOf(g.total, total);
  const groupTable = (title: string, head: string, label: (k: string) => string, gs: { key: string; total: number; count: number }[], note?: string): ReportTable => ({
    title,
    note,
    columns: [col(head), col(x("col.spent"), "money"), col(x("col.share"), "pct", "sum"), col(x("col.expenses"), "int")],
    rows: gs.map((g) => [label(g.key), g.total, share(g), g.count]),
    totalLabel: x("total"),
  });

  const summary: ReportTable[] = [
    groupTable(x("table.byCategory"), x("col.category"), i.category, cats, x("note.byCategory")),
    groupTable(x("table.byMonth"), x("col.month"), i.month, months, x("note.byMonth")),
    groupTable(x("table.byPaidFrom"), x("col.paidFrom"), i.paidFrom, paid, x("note.byPaidFrom")),
    ...(payees.length ? [groupTable(x("table.topPayees"), x("col.payee"), (k) => k, payees, x("note.topPayees"))] : []),
  ];

  const data: ReportTable = {
    title: x("sheet.expenses"),
    columns: [
      col(x("col.ref"), "code"),
      col(x("col.date"), "date"),
      col(x("col.title")),
      col(x("col.payee")),
      col(x("col.addedBy")),
      col(x("col.category")),
      col(x("col.paidFrom")),
      col(x("col.counter")),
      col(x("col.items"), "int"),
      col(x("col.total"), "money"),
      col(x("col.receipt")),
      col(x("col.note")),
    ],
    rows: rows.map((e) => [
      e.ref,
      e.date,
      e.title,
      e.payee ?? "",
      e.recordedByName,
      i.category(e.category),
      i.paidFrom(e.paidFrom),
      e.counterName ?? "",
      e.lineCount,
      e.total,
      e.receiptUrl ? x("yes") : x("no"),
      e.note ?? "",
    ]),
    totalLabel: x("total"),
  };

  // One row per item on an itemised expense. An expense written down as a
  // single amount has no items, so it has no rows here.
  const lines: ReportTable = {
    title: x("sheet.lines"),
    note: x("note.lines"),
    columns: [col(x("col.ref"), "code"), col(x("col.date"), "date"), col(x("col.title")), col(x("col.item")), col(x("col.qty"), "decimal", "none"), col(x("col.unit")), col(x("col.unitPrice"), "money", "none"), col(x("col.lineTotal"), "money")],
    rows: rows.flatMap((e) =>
      e.itemised ? e.lines.map((l) => [e.ref, e.date, e.title, l.description, l.qty, l.unit, l.unitPrice, Math.round(l.qty * l.unitPrice)]) : [],
    ),
    totalLabel: x("total"),
  };

  const top = cats[0];
  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis: [
      { label: x("kpi.total"), value: total, type: "money", note: rows.length ? x("kpi.totalNote", { avg: formatMoney(Math.round(total / rows.length)) }) : undefined },
      { label: x("kpi.count"), value: rows.length, type: "int", note: x("kpi.countNote", { items }) },
      { label: x("kpi.topCategory"), value: top ? i.category(top.key) : "—", type: "text", note: top ? x("kpi.topCategoryNote", { share: Math.round(share(top) * 100), amount: formatMoney(top.total) }) : undefined },
      { label: x("kpi.biggest"), value: biggest?.total ?? 0, type: "money", note: biggest ? `${biggest.title} · ${biggest.date}` : undefined },
    ],
    summary,
    sheets: [
      { name: x("sheet.expenses"), table: data },
      ...(lines.rows.length ? [{ name: x("sheet.lines"), table: lines }] : []),
    ],
    glossary: [gl("total"), gl("expense"), gl("category"), gl("paidFrom"), gl("items"), gl("share"), gl("receipt")],
    labels: i.labels,
  };
}
