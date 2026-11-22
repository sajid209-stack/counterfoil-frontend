import type { IssuedState, IssuedTicket } from "@/lib/api";
import type { Report, ReportLabels, ReportTable } from "@/lib/report";

/**
 * The issued-tickets list as a workbook: what is out there, and has it been
 * used. Every ticket the filters match is a row; the Summary answers "how many
 * came through the gate" before anyone has to count.
 */

type Tr = (key: string, values?: Record<string, string | number>) => string;

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localClock = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function buildIssuedReport(
  rows: IssuedTicket[],
  c: { t: Tr; stateName: (s: IssuedState) => string; walkIn: string; labels: ReportLabels; business: string; currency: string; fileBase: string; meta: [string, string][] },
): Report {
  const { t } = c;
  const r = (key: string, values?: Record<string, string | number>) => t(`report.${key}`, values);
  const n = rows.length;
  const count = (s: IssuedState) => rows.filter((x) => x.state === s).length;
  const used = count("used");
  const part = count("part");
  const unused = count("unused");
  const voidN = count("void");
  const live = n - voidN;
  const people = rows.filter((x) => x.state !== "void").reduce((a, x) => a + x.used, 0);
  const capacity = rows.filter((x) => x.state !== "void").reduce((a, x) => a + x.admits, 0);
  const orders = new Set(rows.map((x) => x.orderId)).size;

  const kpis = [
    { label: r("kpiIssued"), value: n, type: "int" as const, note: r("kpiIssuedNote") },
    { label: r("kpiUsed"), value: used, type: "int" as const, note: r("kpiUsedNote") },
    { label: r("kpiPart"), value: part, type: "int" as const, note: r("kpiPartNote") },
    { label: r("kpiUnused"), value: unused, type: "int" as const, note: r("kpiUnusedNote") },
    { label: r("kpiVoid"), value: voidN, type: "int" as const, note: r("kpiVoidNote") },
    { label: r("kpiRate"), value: live > 0 ? (used + part) / live : 0, type: "pct" as const, note: r("kpiRateNote") },
    { label: r("kpiPeople"), value: people, type: "int" as const, note: r("kpiPeopleNote", { total: capacity }) },
    { label: r("kpiOrders"), value: orders, type: "int" as const, note: r("kpiOrdersNote") },
  ];

  const share = (k: number) => (n > 0 ? k / n : 0);
  const byState: ReportTable = {
    title: r("tableState"),
    columns: [{ header: r("colState") }, { header: r("colTickets"), type: "int" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: (["used", "part", "unused", "void"] as IssuedState[])
      .map((s) => [c.stateName(s), count(s)] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .map(([name, k]) => [name, k, share(k)]),
    totalLabel: t("report.total"),
  };

  const bookings = new Map<string, { n: number; used: number }>();
  for (const x of rows) {
    const b = bookings.get(x.bookingName) ?? { n: 0, used: 0 };
    b.n += 1;
    if (x.state === "used" || x.state === "part") b.used += 1;
    bookings.set(x.bookingName, b);
  }
  const byBooking: ReportTable = {
    title: r("tableBooking"),
    columns: [{ header: r("colBooking") }, { header: r("colTickets"), type: "int" }, { header: r("colUsed"), type: "int" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: [...bookings.entries()].sort((a, b) => b[1].n - a[1].n).map(([name, v]) => [name, v.n, v.used, share(v.n)]),
    totalLabel: t("report.total"),
  };

  const days = new Map<string, number>();
  for (const x of rows) days.set(localDay(x.issuedAt), (days.get(localDay(x.issuedAt)) ?? 0) + 1);
  const byDay: ReportTable = {
    title: r("tableDay"),
    columns: [{ header: r("colDay"), type: "date" }, { header: r("colTickets"), type: "int" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, k]) => [d, k, share(k)]),
    totalLabel: t("report.total"),
  };

  const table: ReportTable = {
    title: r("sheet"),
    totalLabel: t("report.total"),
    columns: [
      { header: r("colCode"), type: "code" },
      { header: r("colOrder"), type: "code" },
      { header: r("colIssuedDate"), type: "date" },
      { header: r("colIssuedTime"), type: "time" },
      { header: r("colCustomer") },
      { header: r("colBooking") },
      { header: r("colVariant") },
      { header: r("colVisitDate"), type: "date" },
      { header: r("colVisitTime"), type: "time" },
      { header: r("colAdmits"), type: "int" },
      { header: r("colIn"), type: "int" },
      { header: r("colStatus") },
    ],
    rows: rows.map((x) => [
      x.code,
      x.orderReference,
      localDay(x.issuedAt),
      localClock(x.issuedAt),
      x.customerName ?? c.walkIn,
      x.bookingName,
      x.variantName,
      x.startDate,
      x.startTime ?? "",
      x.admits,
      x.used,
      c.stateName(x.state),
    ]),
  };

  const g = (k: string): [string, string] => [r(`gloss.${k}.t`), r(`gloss.${k}.d`)];
  return {
    title: r("title"),
    business: c.business,
    fileBase: c.fileBase,
    currency: c.currency,
    meta: c.meta,
    kpis,
    summary: [byState, byBooking, byDay],
    sheets: [{ name: r("sheet"), table }],
    glossary: [g("unused"), g("part"), g("used"), g("void"), g("rate"), g("admits")],
    labels: c.labels,
  };
}
