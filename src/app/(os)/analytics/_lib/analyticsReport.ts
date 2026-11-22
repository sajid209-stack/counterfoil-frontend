/*
 * The Analytics page as a workbook.
 *
 * Summary = the six figures on the page, each with the figure it is measured
 * against, then the small breakdowns (channels, payment methods, guests, VAT).
 * Then one sheet per card, one row per point or per row of the card, in the
 * numbers the screen shows — nothing here is recomputed, it all comes from the
 * same AnalyticsOverview the cards draw.
 */
import { formatMoney } from "@/lib/format";
import type { AnalyticsOverview, TimePoint } from "@/lib/api";
import type { Report, ReportColumn, ReportTable, Value } from "@/lib/report";
import { changeOf, changeText, type T } from "@/lib/reports/context";

export interface AnalyticsReportInput {
  o: AnalyticsOverview;
  /** The `analytics` namespace. */
  t: T;
  method: (m: string) => string;
  taxClass: (c: string) => string;
  labels: Report["labels"];
  meta: [string, string][];
  business: string;
  fileBase: string;
  currency: string;
  /** "7–13 Jul 2026" and the comparison's range, already formatted. */
  rangeText: string;
  previousText: string;
}

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });

export function buildAnalyticsReport(i: AnalyticsReportInput): Report {
  const { o, t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(`export.${k}`, v);
  const cmp = o.previous !== null;
  const k = o.kpis;
  const pointType = o.granularity === "hour" ? "time" : "date";

  /* ── Key figures: the page's six, with what each is measured against ── */
  const vs = (now: number, then: number | null, fmt: (n: number) => string) => {
    if (!cmp || then === null) return undefined;
    const ch = changeText(now, then);
    return `${t("vsValue", { value: fmt(then) })}${ch ? ` (${ch})` : ""}`;
  };
  const pts = (now: number, then: number | null) => {
    if (!cmp || then === null) return undefined;
    const d = Math.round((now - then) * 1000) / 10;
    return `${t("vsValue", { value: `${Math.round(then * 1000) / 10}%` })}${d === 0 ? "" : ` (${d > 0 ? "+" : "−"}${Math.abs(d)} ${x("points")})`}`;
  };
  const int = (n: number) => String(n);
  const kpis: Report["kpis"] = [
    { label: t("kpi.revenue"), value: k.revenue.value, type: "money", note: vs(k.revenue.value, k.revenue.previous, formatMoney) ?? t("kpi.revenueNote") },
    { label: t("kpi.orders"), value: k.orders.value, type: "int", note: vs(k.orders.value, k.orders.previous, int) ?? x("note.orders") },
    { label: t("kpi.average"), value: k.averageOrder.value, type: "money", note: vs(k.averageOrder.value, k.averageOrder.previous, formatMoney) ?? x("note.average") },
    { label: t("kpi.guests"), value: k.guests.value, type: "int", note: vs(k.guests.value, k.guests.previous, int) ?? x("note.guests") },
    { label: t("kpi.capacity"), value: k.capacityFilled.value, type: "pct", note: pts(k.capacityFilled.value, k.capacityFilled.previous) ?? x("note.capacity") },
    { label: t("kpi.refunds"), value: k.refunds.value, type: "money", note: vs(k.refunds.value, k.refunds.previous, formatMoney) ?? x("note.refunds") },
  ];

  /* Optional comparison columns, appended only while comparing. */
  const withPrev = (cols: ReportColumn[], ...prev: ReportColumn[]) => (cmp ? [...cols, ...prev] : cols);

  /* ── Summary breakdowns ── */
  const channelRows = [...o.channels].sort((a, b) => b.revenue - a.revenue);
  const summary: ReportTable[] = [
    {
      title: t("channels.title"),
      note: x("note.channels"),
      columns: withPrev([col(x("col.channel")), col(x("col.revenue"), "money"), col(x("col.share"), "pct", "sum"), col(x("col.orders"), "int")], col(x("col.previousRevenue"), "money"), col(x("col.change"), "pct")),
      rows: channelRows.map((c) => [t(`channels.${c.channel}`), c.revenue, c.share, c.orders, ...(cmp ? [c.previousRevenue ?? 0, changeOf(c.revenue, c.previousRevenue)] : [])]),
      totalLabel: x("total"),
    },
    {
      title: t("pay.title"),
      note: x("note.payments"),
      columns: withPrev([col(x("col.method")), col(x("col.amount"), "money"), col(x("col.share"), "pct", "sum"), col(x("col.payments"), "int")], col(x("col.previousAmount"), "money"), col(x("col.change"), "pct")),
      rows: o.payments.map((p) => [i.method(p.method), p.amount, p.share, p.count, ...(cmp ? [p.previousAmount ?? 0, changeOf(p.amount, p.previousAmount)] : [])]),
      totalLabel: x("total"),
    },
    {
      title: t("guests.title"),
      columns: withPrev([col(x("col.measure")), col(x("col.thisPeriod"), "int", "none")], col(x("col.previous"), "int", "none")),
      rows: [
        [x("guests.booked"), o.guests.guests, ...(cmp ? [o.guestsPrevious?.guests ?? null] : [])],
        [t("guests.arrived"), o.guests.arrived, ...(cmp ? [o.guestsPrevious?.arrived ?? null] : [])],
        [t("guests.noShows"), o.guests.noShows, ...(cmp ? [o.guestsPrevious?.noShows ?? null] : [])],
        [x("guests.new"), o.guests.newCustomers, ...(cmp ? [o.guestsPrevious?.newCustomers ?? null] : [])],
        [x("guests.returning"), o.guests.returning, ...(cmp ? [o.guestsPrevious?.returning ?? null] : [])],
      ],
    },
    {
      title: t("vat.title"),
      note: t("vat.note"),
      columns: [col(t("vat.class")), col(t("vat.rate"), "pct", "none"), col(t("vat.net"), "money"), col(t("vat.vat"), "money"), col(t("vat.gross"), "money"), col(t("vat.lines"), "int")],
      rows: o.tax.rows.map((r) => [i.taxClass(r.taxClass), r.rate, r.net, r.tax, r.gross, r.lineCount]),
      totalLabel: x("total"),
    },
  ].filter((tb) => tb.rows.length > 0);

  /* ── Data sheets ── */
  const sheets: Report["sheets"] = [];
  const sheetName = o.granularity === "hour" ? x("sheet.hourly") : o.granularity === "week" ? x("sheet.weekly") : x("sheet.daily");

  // The time series, point by point: revenue, guests booked, checked in, customers.
  const byKey = <R extends { key: string }>(rows: R[]) => new Map(rows.map((r) => [r.key, r]));
  const visitors = byKey(o.visitors.series.map((p) => ({ key: p.key, v: p.value })));
  const checkins = byKey(o.checkins.series.map((p) => ({ key: p.key, v: p.value })));
  const customers = byKey(o.customers);
  sheets.push({
    name: sheetName,
    table: {
      title: sheetName,
      note: x("note.series"),
      columns: withPrev(
        [col(x("col.when"), pointType), col(x("col.revenue"), "money"), col(x("col.guestsBooked"), "int"), col(x("col.checkedIn"), "int"), col(x("col.newCustomers"), "int"), col(x("col.returningCustomers"), "int")],
        col(x("col.previousWhen"), pointType),
        col(x("col.previousRevenue"), "money"),
        col(x("col.change"), "pct"),
      ),
      rows: o.revenue.map((p) => [
        p.key,
        p.value,
        visitors.get(p.key)?.v ?? 0,
        checkins.get(p.key)?.v ?? 0,
        customers.get(p.key)?.newCustomers ?? 0,
        customers.get(p.key)?.returning ?? 0,
        ...(cmp ? [p.previousKey ?? null, p.previous ?? null, p.previous === undefined ? null : changeOf(p.value, p.previous)] : []),
      ]),
      totalLabel: x("total"),
    },
  });

  sheets.push({
    name: x("sheet.topBookings"),
    table: {
      title: t("sells.title"),
      note: t("info.sells"),
      columns: withPrev([col(x("col.booking")), col(x("col.revenue"), "money"), col(x("col.share"), "pct", "sum"), col(x("col.orders"), "int", "none")], col(x("col.previousRevenue"), "money"), col(x("col.change"), "pct")),
      rows: o.topBookings.map((b) => [b.productId === "other" ? t("sells.other") : b.name, b.revenue, b.share, b.orders, ...(cmp ? [b.previousRevenue ?? 0, changeOf(b.revenue, b.previousRevenue)] : [])]),
      totalLabel: x("total"),
    },
  });

  sheets.push({
    name: x("sheet.ticketTypes"),
    table: {
      title: t("tickets.title"),
      note: t("info.tickets"),
      columns: withPrev(
        [col(x("col.booking")), col(x("col.ticketType")), col(x("col.revenue"), "money"), col(x("col.share"), "pct", "sum"), col(x("col.quantity"), "int")],
        col(x("col.previousRevenue"), "money"),
        col(x("col.previousQuantity"), "int"),
      ),
      rows: o.ticketTypes.map((r) => [r.productId === "other" ? t("sells.other") : r.name, r.tier, r.revenue, r.share, r.quantity, ...(cmp ? [r.previousRevenue ?? 0, r.previousQuantity ?? 0] : [])]),
      totalLabel: x("total"),
    },
  });

  // Each channel's own rows: counters, the online storefront's top bookings, marketplaces.
  const bd = o.channelBreakdown;
  const detail: Value[][] = [];
  const addDetail = (label: string, c: AnalyticsOverview["channelBreakdown"]["counters"]) => {
    for (const r of c.rows) {
      detail.push([
        label,
        r.kind === "unassigned" ? t("counters.unassigned") : r.name,
        r.revenue,
        r.orders,
        r.share,
        r.commission ?? null,
        r.kept ?? null,
        ...(cmp ? [r.previousRevenue ?? 0, changeOf(r.revenue, r.previousRevenue)] : []),
      ]);
    }
    if (c.moreRevenue) detail.push([label, x("moreRows"), c.moreRevenue, null, null, null, null, ...(cmp ? [null, null] : [])]);
  };
  addDetail(t("split.counters"), bd.counters);
  addDetail(t("split.online"), bd.storefront);
  addDetail(t("split.market"), bd.marketplaces);
  sheets.push({
    name: x("sheet.channelDetail"),
    table: {
      title: x("sheet.channelDetail"),
      note: x("note.channelDetail"),
      columns: withPrev(
        [col(x("col.channel")), col(x("col.source")), col(x("col.revenue"), "money"), col(x("col.orders"), "int"), col(x("col.shareOfChannel"), "pct", "none"), col(x("col.commission"), "money"), col(x("col.venueKeeps"), "money")],
        col(x("col.previousRevenue"), "money"),
        col(x("col.change"), "pct"),
      ),
      rows: detail,
    },
  });

  // Sales and payments by point, one row per point per channel/method.
  const longSeries = (rows: { label: string; series: TimePoint[] }[]): Value[][] =>
    rows.flatMap((r) => r.series.map((p) => [p.key, r.label, p.value, ...(cmp ? [p.previousKey ?? null, p.previous ?? null] : [])]));
  sheets.push({
    name: x("sheet.salesByChannel"),
    table: {
      title: t("channels.title"),
      columns: withPrev([col(x("col.when"), pointType), col(x("col.channel")), col(x("col.revenue"), "money")], col(x("col.previousWhen"), pointType), col(x("col.previousRevenue"), "money")),
      rows: longSeries(o.channelSeries.map((c) => ({ label: t(`channels.${c.channel}`), series: c.series }))),
      totalLabel: x("total"),
    },
  });
  sheets.push({
    name: x("sheet.paymentsByDay"),
    table: {
      title: t("pay.title"),
      columns: withPrev([col(x("col.when"), pointType), col(x("col.method")), col(x("col.amount"), "money")], col(x("col.previousWhen"), pointType), col(x("col.previousAmount"), "money")),
      rows: longSeries(o.paymentSeries.map((m) => ({ label: i.method(m.method), series: m.series }))),
      totalLabel: x("total"),
    },
  });

  sheets.push({
    name: x("sheet.busyTimes"),
    table: {
      title: t("heat.title"),
      note: t("heat.caption"),
      columns: [col(x("col.weekday")), col(x("col.hour"), "time"), col(x("col.guests"), "int")],
      rows: o.heatmap.cells.map((c) => [x(`weekday.${c.weekday}`), `${String(c.hour).padStart(2, "0")}:00`, c.guests]),
      totalLabel: x("total"),
    },
  });

  const ts = o.timeslots;
  sheets.push({
    name: x("sheet.timeSlots"),
    table: {
      title: t("slots.title"),
      note: t("slots.caption"),
      columns: [col(x("col.booking")), col(x("col.startTime"), "time"), col(x("col.guests"), "int"), col(x("col.bookings"), "int"), col(x("col.placesOffered"), "int"), col(x("col.filled"), "pct", "none")],
      rows: ts.cells.map((c) => [ts.rows[c.row].name, ts.times[c.col], c.guests, c.bookings, c.capacity, c.fill]),
      totalLabel: x("total"),
    },
  });

  sheets.push({
    name: x("sheet.capacity"),
    table: {
      title: t("full.title"),
      note: t("info.full"),
      columns: withPrev([col(x("col.booking")), col(x("col.sold"), "int"), col(x("col.places"), "int"), col(x("col.filled"), "pct", "none")], col(x("col.previousFilled"), "pct", "none")),
      rows: o.capacity.map((c) => [c.name, c.sold, c.capacity, c.filled, ...(cmp ? [c.previousFilled ?? null] : [])]),
      totalLabel: x("total"),
    },
  });

  sheets.push({
    name: x("sheet.leadTime"),
    table: {
      title: t("lead.title"),
      note: t("info.lead"),
      columns: withPrev([col(x("col.leadTime")), col(x("col.orders"), "int"), col(x("col.share"), "pct", "sum")], col(x("col.previousShare"), "pct", "none")),
      rows: o.leadTime.map((l) => [t(`lead.${l.bucket}`), l.orders, l.share, ...(cmp ? [l.previousShare ?? null] : [])]),
      totalLabel: x("total"),
    },
  });

  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis,
    summary,
    sheets: sheets.filter((s) => s.table.rows.length > 0 || s === sheets[0]),
    glossary: [gl("revenue"), gl("orders"), gl("average"), gl("guests"), gl("capacity"), gl("refunds"), gl("share"), gl("change"), gl("previous"), gl("checkedIn"), gl("customers"), gl("channels"), gl("vat"), gl("series")],
    labels: i.labels,
  };
}
