import {
  orderChannelOf,
  orderDue,
  orderItemCount,
  orderMethodOf,
  orderNetPaid,
  orderRefundedOut,
  orderWrittenOff,
  type Order,
  type SalesSummary,
} from "@/lib/api";
import { formatClockOf } from "@/lib/format";
import type { SalesFilters } from "./filters";
import type { Directory } from "./useReport";
import type { SalesLabels } from "./labels";

/**
 * The sales report as a file.
 *
 * Two things a spreadsheet user needs that a screen does not: money as plain
 * numbers (`3075.00`, not `৳3,075.00`, so a column adds up), and a byte-order
 * mark, so Excel reads the Bangla names as UTF-8 instead of as noise. Every
 * matching order is written, not the page on screen, with the summary block
 * beneath — the totals a person would otherwise have to add up by hand.
 */

export type Tr = (key: string, values?: Record<string, string | number>) => string;

const BOM = "﻿";
type Cell = string | number;

/** A cell, quoted when it holds a comma, a quote or a line break. A text that
 *  begins like a formula is defused — a customer called `=cmd|…` is not
 *  something a venue wants executing on their accountant's machine. */
export function csvCell(v: Cell): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+@\t\r]|^-(?![\d.])/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (cells: Cell[]) => cells.map(csvCell).join(",");

/** Minor units as a plain decimal. */
export const plain = (minor: number): string => (minor / 100).toFixed(2);

const pad = (n: number) => String(n).padStart(2, "0");
/** The local calendar day an instant falls on: "2026-07-29". */
export const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The totals and breakdowns, as rows of [label, orders, amount]. */
export function summaryRows(s: SalesSummary, t: Tr, L: SalesLabels): Cell[][] {
  const rows: Cell[][] = [];
  const total = (key: string, amount: number) => rows.push([t(`summary.${key}`), "", plain(amount)]);
  rows.push([t("summary.totals")]);
  rows.push([t("summary.orders"), s.orders, ""]);
  rows.push([t("summary.items"), s.items, ""]);
  total("gross", s.gross);
  total("discounts", -s.discounts);
  total("net", s.net);
  total("vat", s.vat);
  total("total", s.total);
  if (s.partRefunds > 0) total("partRefunds", -s.partRefunds);
  total("sales", s.sales);
  total("paid", s.paid);
  total("refunds", s.refunds);
  total("owed", s.owed);
  total("writtenOff", s.writtenOff);

  rows.push([]);
  rows.push([t("summary.byMethod")]);
  for (const m of s.methods) rows.push([L.method(m.key), "", plain(m.amount)]);
  if (s.owed > 0) rows.push([t("summary.owed"), "", plain(s.owed)]);
  if (s.writtenOff > 0) rows.push([t("summary.writtenOff"), "", plain(s.writtenOff)]);
  rows.push([t("summary.sales"), "", plain(s.sales)]);

  const group = (title: string, list: { key: string; orders: number; amount: number }[], name: (k: string) => string) => {
    rows.push([]);
    rows.push([title, t("summary.colOrders"), t("summary.colAmount")]);
    for (const r of list) rows.push([name(r.key), r.orders, plain(r.amount)]);
    rows.push([t("summary.total"), s.orders, plain(s.sales)]);
  };
  group(t("summary.byChannel"), s.channels, (k) => L.channel(k as never));
  group(t("summary.byCounter"), s.counters, (k) => L.counter(k));
  group(t("summary.byStaff"), s.staff, (k) => L.staff(k));
  group(t("summary.byStatus"), s.statuses, (k) => L.status(k));

  rows.push([]);
  rows.push([t("summary.topItems"), t("summary.colQty"), t("summary.colAmount")]);
  for (const i of s.topItems) rows.push([i.name, i.qty, plain(i.amount)]);
  if (s.otherItems.count > 0) rows.push([t("summary.otherItems", { count: s.otherItems.count }), s.otherItems.qty, plain(s.otherItems.amount)]);
  return rows;
}

interface Context {
  t: Tr;
  L: SalesLabels;
  dir: Directory;
  venueName: string;
  /** What the filters say, as one line. */
  filterText: string;
  /** When the file was made, already formatted. */
  generated: string;
}

/** The header lines every file starts with: what it is, where, which filters, when. */
const preamble = (c: Context, title: string): Cell[][] => [
  [title],
  [c.t("csv.venue"), c.venueName],
  [c.t("csv.filters"), c.filterText],
  [c.t("csv.generated"), c.generated],
];

/** Every matching order, one row each, with the summary block after them. */
export function salesCsv(rows: Order[], summary: SalesSummary, c: Context): string {
  const { t, L, dir } = c;
  const head = [
    "order", "date", "time", "customer", "channel", "counter", "staff", "total", "tax", "paid", "discount", "method", "status", "items", "refunded", "owed", "writtenOff",
  ].map((k) => t(`csv.${k}`));
  const body = rows.map((o) => {
    const marketplace = o.source ? `${L.channel(orderChannelOf(o))} (${o.source.marketplaceName})` : L.channel(orderChannelOf(o));
    return [
      o.reference,
      localDay(o.createdAt),
      formatClockOf(o.createdAt),
      o.customerName ?? t("walkIn"),
      marketplace,
      o.counterId ? dir.counterName(o.counterId) : "",
      o.staffId ? dir.staffName(o.staffId) : "",
      plain(o.total),
      plain(o.taxTotal ?? 0),
      plain(orderNetPaid(o)),
      plain(o.discountTotal ?? 0),
      L.method(orderMethodOf(o)),
      L.status(o.status),
      orderItemCount(o),
      plain(orderRefundedOut(o)),
      plain(orderDue(o)),
      plain(orderWrittenOff(o)),
    ] as Cell[];
  });
  const out = [line(head), ...body.map(line), "", ...preamble(c, t("csv.summaryTitle")).map(line), "", ...summaryRows(summary, t, L).map(line)];
  return out.join("\r\n") + "\r\n";
}

/** Just the summary: the sheet's Download button. */
export function summaryCsv(summary: SalesSummary, c: Context): string {
  const out = [...preamble(c, c.t("csv.summaryTitle")).map(line), "", ...summaryRows(summary, c.t, c.L).map(line)];
  return out.join("\r\n") + "\r\n";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venue";

/** `sales-<venue>-<from>_<to>.csv` — the range the filters name, or, with none,
 *  the span the orders themselves cover. */
export function reportFileName(kind: "sales" | "sales-summary", venueName: string, f: Pick<SalesFilters, "from" | "to">, rows: Order[]): string {
  let from = f.from;
  let to = f.to;
  if (!from || !to) {
    const days = rows.map((o) => localDay(o.createdAt)).sort();
    from = days[0] ?? "all";
    to = days[days.length - 1] ?? "all";
  }
  return `${kind}-${slug(venueName)}-${from}_${to}.csv`;
}

export function downloadCsv(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([BOM + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
