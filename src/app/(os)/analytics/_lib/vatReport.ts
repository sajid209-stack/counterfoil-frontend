/*
 * The VAT export: a working paper a return can be filed from.
 *
 *   Summary     taxable sales and output VAT by rate, exempt sales, the total,
 *               and what refunds already took back
 *   By day      the same, one row per day
 *   By invoice  one row per invoice and rate: reference, date, net, rate, VAT, gross
 *
 * The invoice rows are worked out here from the venue's settled orders with the
 * rule the VAT figure on the page uses (`getTaxReport`): tax comes off each LINE
 * at the rate it was sold at, and a refund takes the same share of net and tax
 * back. So the three sheets and the screen add up to the same totals; the build
 * says so in the About sheet.
 */
import { peekOrders, settled, type AnalyticsOverview, type Order, type TaxReportResponse } from "@/lib/api";
import type { Report, ReportColumn, ReportTable, Value } from "@/lib/report";
import type { T } from "@/lib/reports/context";

export interface VatInvoiceRow {
  reference: string;
  at: string;
  day: string;
  customer: string;
  taxClass: string;
  rate: number;
  net: number;
  tax: number;
  gross: number;
}

/** One row per (invoice, tax class and rate), after refunds. */
export function vatInvoiceRows(locationId: string, from: string, to: string): VatInvoiceRow[] {
  const out: VatInvoiceRow[] = [];
  const orders: Order[] = peekOrders().filter((o) => o.locationId === locationId && settled(o) && o.createdAt.slice(0, 10) >= from && o.createdAt.slice(0, 10) <= to);
  orders.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const o of orders) {
    const by = new Map<string, VatInvoiceRow>();
    for (const l of o.lines) {
      const grossFull = l.total ?? 0;
      if (grossFull <= 0) continue;
      const share = Math.min(1, Math.max(0, (l.refundedAmount ?? 0) / grossFull));
      const net = (l.taxableAmount ?? 0) - Math.round((l.taxableAmount ?? 0) * share);
      const tax = (l.taxAmount ?? 0) - Math.round((l.taxAmount ?? 0) * share);
      const key = `${l.taxClass}|${l.taxRate}`;
      const row = by.get(key) ?? { reference: o.reference, at: o.createdAt, day: o.createdAt.slice(0, 10), customer: o.customerName ?? "", taxClass: l.taxClass, rate: l.taxRate, net: 0, tax: 0, gross: 0 };
      row.net += net;
      row.tax += tax;
      row.gross += net + tax;
      by.set(key, row);
    }
    out.push(...[...by.values()].sort((a, b) => b.rate - a.rate));
  }
  return out;
}

const col = (header: string, type: ReportColumn["type"] = "text", total?: ReportColumn["total"]): ReportColumn => ({ header, type, ...(total ? { total } : {}) });

export interface VatReportInput {
  o: AnalyticsOverview;
  tax: TaxReportResponse;
  invoices: VatInvoiceRow[];
  /** The `analytics` namespace. */
  t: T;
  taxClass: (c: string) => string;
  labels: Report["labels"];
  meta: [string, string][];
  business: string;
  fileBase: string;
  currency: string;
}

export function buildVatReport(i: VatReportInput): Report {
  const { o, tax, t } = i;
  const x = (k: string, v?: Record<string, string | number>) => t(`export.vat.${k}`, v);
  const exempt = o.tax.rows.filter((r) => r.taxClass === "exempt" || r.rate === 0);
  const exemptNet = exempt.reduce((s, r) => s + r.net, 0);
  const taxable = o.tax.rows.filter((r) => !(r.taxClass === "exempt" || r.rate === 0));
  const taxableNet = taxable.reduce((s, r) => s + r.net, 0);
  const docs = new Set(i.invoices.map((r) => r.reference)).size;

  const rateRows = (rows: typeof o.tax.rows): Value[][] => rows.map((r) => [i.taxClass(r.taxClass), r.rate, r.net, r.tax, r.gross, r.lineCount]);
  const rateCols = [col(t("vat.class")), col(t("vat.rate"), "pct", "none"), col(x("col.net"), "money"), col(t("vat.vat"), "money"), col(t("vat.gross"), "money"), col(t("vat.lines"), "int")];

  const summary: ReportTable[] = [
    {
      title: x("table.taxable"),
      note: x("note.taxable"),
      columns: rateCols,
      rows: rateRows(taxable),
      totalLabel: x("table.taxableTotal"),
    },
    {
      title: x("table.exempt"),
      note: x("note.exempt"),
      columns: rateCols,
      rows: rateRows(exempt),
      totalLabel: x("table.exemptTotal"),
    },
    {
      title: x("table.returnTotal"),
      note: x("note.returnTotal"),
      columns: [col(x("col.measure")), col(x("col.net"), "money", "none"), col(t("vat.vat"), "money", "none"), col(t("vat.gross"), "money", "none")],
      rows: [
        [x("row.allSales"), o.tax.net, o.tax.tax, o.tax.gross],
        [x("row.refunded"), tax.refunded.net, tax.refunded.tax, tax.refunded.net + tax.refunded.tax],
      ],
    },
  ].filter((tb) => tb.rows.length > 0);

  // By day: the invoice rows folded by date.
  const days = new Map<string, { n: Set<string>; net: number; tax: number; gross: number }>();
  for (const r of i.invoices) {
    const d = days.get(r.day) ?? { n: new Set<string>(), net: 0, tax: 0, gross: 0 };
    d.n.add(r.reference);
    d.net += r.net;
    d.tax += r.tax;
    d.gross += r.gross;
    days.set(r.day, d);
  }
  const dayTable: ReportTable = {
    title: x("sheet.byDay"),
    columns: [col(x("col.date"), "date"), col(x("col.invoices"), "int"), col(x("col.net"), "money"), col(t("vat.vat"), "money"), col(t("vat.gross"), "money")],
    rows: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, d]) => [day, d.n.size, d.net, d.tax, d.gross]),
    totalLabel: x("total"),
  };
  const invoiceTable: ReportTable = {
    title: x("sheet.byInvoice"),
    note: x("note.invoice"),
    columns: [col(x("col.invoice"), "code"), col(x("col.date"), "datetime"), col(x("col.customer")), col(t("vat.class")), col(t("vat.rate"), "pct", "none"), col(x("col.net"), "money"), col(t("vat.vat"), "money"), col(t("vat.gross"), "money")],
    rows: i.invoices.map((r) => [r.reference, r.at, r.customer, i.taxClass(r.taxClass), r.rate, r.net, r.tax, r.gross]),
    totalLabel: x("total"),
  };

  const gl = (key: string): [string, string] => [x(`term.${key}`), x(`def.${key}`)];
  return {
    title: x("title"),
    business: i.business,
    fileBase: i.fileBase,
    currency: i.currency,
    meta: i.meta,
    kpis: [
      { label: x("kpi.outputVat"), value: o.tax.tax, type: "money", note: x("kpi.outputVatNote") },
      { label: x("kpi.taxable"), value: taxableNet, type: "money", note: x("kpi.taxableNote") },
      { label: x("kpi.exempt"), value: exemptNet, type: "money", note: x("kpi.exemptNote") },
      { label: x("kpi.gross"), value: o.tax.gross, type: "money", note: x("kpi.grossNote") },
      { label: x("kpi.invoices"), value: docs, type: "int", note: x("kpi.invoicesNote") },
      { label: x("kpi.refundedVat"), value: tax.refunded.tax, type: "money", note: x("kpi.refundedVatNote") },
    ],
    summary,
    // The invoice list is the first sheet, so a CSV of this report is the
    // thing a return is checked against.
    sheets: [
      { name: x("sheet.byDay"), table: dayTable },
      { name: x("sheet.byInvoice"), table: invoiceTable },
    ],
    glossary: [gl("outputVat"), gl("taxable"), gl("exempt"), gl("net"), gl("gross"), gl("refunds"), gl("invoice"), gl("reconcile")],
    labels: i.labels,
  };
}

/** The same report with the invoice list first: what the CSV carries. */
export const vatCsvReport = (r: Report): Report => ({ ...r, sheets: [...r.sheets].reverse() });
