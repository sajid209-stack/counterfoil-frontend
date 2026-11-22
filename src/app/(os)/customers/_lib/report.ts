import { hasConsent, type CustomerWithStats } from "@/lib/api";
import type { Report, ReportLabels, ReportTable } from "@/lib/report";

/**
 * The customer list as a workbook. The group is whatever the page's search and
 * "reach" filter match, every page of it, and the Filters line in the header
 * says so — an export of "this group" must never read as everyone.
 *
 * Spend, owing and the counts are the row stats the screen already carries;
 * nothing is recomputed here, so the file and the list cannot disagree.
 */

type Tr = (key: string, values?: Record<string, string | number>) => string;

export function buildCustomersReport(
  group: CustomerWithStats[],
  c: { t: Tr; labels: ReportLabels; business: string; currency: string; fileBase: string; meta: [string, string][] },
): Report {
  const { t } = c;
  const r = (key: string, values?: Record<string, string | number>) => t(`report.${key}`, values);
  const n = group.length;
  const sum = (pick: (x: CustomerWithStats) => number) => group.reduce((a, x) => a + pick(x), 0);
  const pct = (k: number) => `${(n > 0 ? (k / n) * 100 : 0).toFixed(1)}%`;

  const email = group.filter((x) => hasConsent(x, "email")).length;
  const sms = group.filter((x) => hasConsent(x, "sms")).length;
  const both = group.filter((x) => hasConsent(x, "email") && hasConsent(x, "sms")).length;
  const spent = sum((x) => x.stats.spent);
  const owing = sum((x) => x.stats.outstanding);
  const orders = sum((x) => x.stats.orders);

  const kpis = [
    { label: r("kpiCustomers"), value: n, type: "int" as const, note: r("kpiCustomersNote") },
    { label: r("kpiEmail"), value: email, type: "int" as const, note: r("kpiEmailNote", { pct: pct(email) }) },
    { label: r("kpiSms"), value: sms, type: "int" as const, note: r("kpiSmsNote", { pct: pct(sms) }) },
    { label: r("kpiSpend"), value: spent, note: r("kpiSpendNote", { count: orders }) },
    { label: r("kpiAvg"), value: n > 0 ? Math.round(spent / n) : 0, note: r("kpiAvgNote") },
    { label: r("kpiOwing"), value: owing, note: r("kpiOwingNote", { count: group.filter((x) => x.stats.outstanding > 0).length }) },
    { label: r("kpiVisits"), value: sum((x) => x.stats.visits), type: "int" as const, note: r("kpiVisitsNote") },
    { label: r("kpiNoShows"), value: sum((x) => x.stats.noShows), type: "int" as const, note: r("kpiNoShowsNote") },
  ];

  const emailOnly = email - both;
  const smsOnly = sms - both;
  const none = n - both - emailOnly - smsOnly;
  const consent: ReportTable = {
    title: r("tableConsent"),
    columns: [{ header: r("colConsent") }, { header: r("colCustomers"), type: "int" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: ([
      [r("consentBoth"), both],
      [r("consentEmail"), emailOnly],
      [r("consentSms"), smsOnly],
      [r("consentNone"), none],
    ] as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([name, k]) => [name, k, n > 0 ? k / n : 0]),
    totalLabel: t("report.total"),
  };

  const top = [...group].filter((x) => x.stats.spent > 0).sort((a, b) => b.stats.spent - a.stats.spent).slice(0, 10);
  const topTable: ReportTable = {
    title: r("tableTop"),
    note: r("tableTopNote"),
    columns: [{ header: r("colName") }, { header: r("colOrders"), type: "int" }, { header: r("colSpend"), type: "money" }, { header: r("colShare"), type: "pct", total: "sum" }],
    rows: top.map((x) => [x.name, x.stats.orders, x.stats.spent, spent > 0 ? x.stats.spent / spent : 0]),
    totalLabel: t("report.total"),
  };

  const yn = (b: boolean) => (b ? r("yes") : r("no"));
  const day = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const table: ReportTable = {
    title: r("sheet"),
    totalLabel: t("report.total"),
    columns: [
      { header: r("colName") },
      { header: r("colPhone"), type: "code" },
      { header: r("colEmail") },
      { header: r("colTags") },
      { header: r("colEmailConsent") },
      { header: r("colSmsConsent") },
      { header: r("colOrders"), type: "int" },
      { header: r("colSpend"), type: "money" },
      { header: r("colVisits"), type: "int" },
      { header: r("colNoShows"), type: "int" },
      { header: r("colOwing"), type: "money" },
      { header: r("colFirst"), type: "date" },
      { header: r("colLast"), type: "date" },
    ],
    rows: group.map((x) => [
      x.name,
      x.phone ?? "",
      x.email ?? "",
      x.tags.join(", "),
      yn(hasConsent(x, "email")),
      yn(hasConsent(x, "sms")),
      x.stats.orders,
      x.stats.spent,
      x.stats.visits,
      x.stats.noShows,
      x.stats.outstanding,
      day(x.stats.firstSeen),
      day(x.stats.lastSeen),
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
    summary: [consent, topTable],
    sheets: [{ name: r("sheet"), table }],
    glossary: [g("spend"), g("owing"), g("visits"), g("noShows"), g("consent"), g("seen")],
    labels: c.labels,
  };
}
