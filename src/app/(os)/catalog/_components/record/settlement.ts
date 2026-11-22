/*
 * The sales summary an on-a-date booking can be downloaded as — its settlement:
 * what was taken, what went back and what is left to sell, by ticket type, by
 * day and by where it was bought. It is the one piece of the old event record
 * that is meaningful for events only (capacity, unsold, face value), so it is a
 * download in the menu, never a different layout.
 *
 * Summary = the four figures a promoter asks first, then where it was bought and
 * the days. "Tickets" = one row per ticket type (the CSV). Every figure comes
 * from `eventSettlement`, the same numbers the Overview shows.
 */
import { formatDayRange, formatMoney } from "@/lib/format";
import type { EventRecord, EventSettlement } from "@/lib/api";
import type { Report, ReportColumn, ReportTable } from "@/lib/report";
import type { T } from "@/lib/reports/context";

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });

export interface SettlementReportInput {
  /** The `catalog.settleReport` namespace. */
  t: T;
  /** "At the counter", "Online", "Before Counterfoil". */
  channel: (c: string) => string;
  labels: Report["labels"];
  /** Venue, period, prepared by, currency and generated, from `useReportMeta`. */
  meta: (m: { venue?: string; period?: string; extra?: [string, string][] }) => [string, string][];
  business: string;
  currency: string;
  fileBase: string;
}

export function buildSettlementReport(e: EventRecord, s: EventSettlement, i: SettlementReportInput): Report {
  const { t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(k, v);
  const tot = s.totals;
  const unsoldValue = s.tiers.reduce((a, r) => a + r.unsold * r.price, 0);
  const period = s.days.length ? formatDayRange(s.days.map((d) => d.date), { year: true }) : "";

  const tickets: ReportTable = {
    title: x("sheet.tickets"),
    note: x("note.tickets"),
    columns: [
      col(x("col.ticket")),
      col(x("col.price"), "money", "none"),
      col(x("col.capacity"), "int"),
      col(x("col.sold"), "int"),
      col(x("col.unsold"), "int"),
      col(x("col.faceValue"), "money"),
      col(x("col.gross"), "money"),
      col(x("col.refunded"), "money"),
      col(x("col.taken"), "money"),
    ],
    rows: s.tiers.map((r) => [r.name, r.price, r.capacity, r.sold, r.unsold, r.faceValue, r.net + r.refundedAmount, r.refundedAmount, r.net]),
    totalLabel: x("total"),
  };

  const byChannel: ReportTable = {
    title: x("table.byChannel"),
    note: x("note.byChannel"),
    columns: [col(x("col.channel")), col(x("col.sold"), "int"), col(x("col.taken"), "money"), col(x("col.share"), "pct", "sum")],
    rows: [...s.byChannel].sort((a, b) => b.net - a.net || b.sold - a.sold).map((c) => [i.channel(c.channel), c.sold, c.net, tot.net > 0 ? c.net / tot.net : 0]),
    totalLabel: x("total"),
  };

  const days: ReportTable = {
    title: x("sheet.days"),
    note: x("note.days"),
    columns: [col(x("col.day")), col(x("col.date"), "date"), col(x("col.capacity"), "int"), col(x("col.sold"), "int"), col(x("col.unsold"), "int"), col(x("col.filled"), "pct", "none")],
    rows: s.days.map((d) => [d.name, d.date, d.capacity, d.sold, d.unsold, d.capacity > 0 ? d.sold / d.capacity : null]),
    totalLabel: x("total"),
  };

  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta({ venue: e.venueName, period, extra: [[x("metaEvent"), e.title]] }),
    kpis: [
      { label: x("kpi.sold"), value: tot.sold, type: "int", note: x("kpi.soldNote", { capacity: tot.capacity }) },
      { label: x("kpi.taken"), value: tot.net, type: "money", note: x("kpi.takenNote") },
      { label: x("kpi.refunded"), value: tot.refundedAmount, type: "money", note: x("kpi.refundedNote", { gross: formatMoney(tot.gross) }) },
      { label: x("kpi.unsold"), value: tot.unsold, type: "int", note: x("kpi.unsoldNote", { value: formatMoney(unsoldValue) }) },
    ],
    summary: [byChannel, ...(s.days.length > 1 ? [days] : [])].filter((tb) => tb.rows.length > 0),
    sheets: [
      { name: x("sheet.tickets"), table: tickets },
      ...(s.days.length > 1 ? [{ name: x("sheet.days"), table: days }] : []),
    ],
    glossary: [gl("sold"), gl("taken"), gl("refunded"), gl("unsold"), gl("faceValue"), gl("gross"), gl("channel"), gl("opening")],
    labels: i.labels,
  };
}
