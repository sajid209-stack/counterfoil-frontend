/*
 * One shape for every report the product exports.
 *
 * A screen describes WHAT it is exporting — a title, the context it was taken
 * in, the headline figures, the breakdowns, the rows — and this file decides
 * HOW, the same way for every report:
 *
 *   Excel (.xlsx), the file a manager opens:
 *     1. "Summary"  — title, where/when/which filters, key figures as cards,
 *                     then each breakdown as a small table with its total.
 *     2. Data sheet(s) — one row per record, typed columns (money adds up,
 *                     dates sort), frozen header, a filter on every column,
 *                     and a totals row that follows the filter (SUBTOTAL).
 *     3. "About"    — what every column and figure means, for the accountant
 *                     who was not in the room.
 *   CSV, the file another program reads:
 *     the first data sheet only — one header row, one row per record, money as
 *     plain decimals, ISO dates, no preamble or totals to trip an import.
 *
 * Money in rows is integer MINOR units, as everywhere else in the app.
 */

import { S, buildXlsx, excelDate, ref, saveBytes, XLSX_TYPE, type StyleId, type XCell, type XRow, type XSheet } from "./xlsx";

export type ColType = "text" | "code" | "int" | "decimal" | "money" | "pct" | "date" | "datetime" | "time";
export type Value = string | number | null | undefined;

export interface ReportColumn {
  header: string;
  /** Default "text". `money` takes minor units; `pct` takes a fraction (0.15). */
  type?: ColType;
  /** Width in characters; measured from the content when absent. */
  width?: number;
  /** What the totals row shows under this column. Default: "sum" for int,
   *  decimal and money, nothing for the rest. */
  total?: "sum" | "avg" | "none";
}

export interface ReportTable {
  /** The table's heading on the Summary sheet; the sheet title on a data sheet. */
  title?: string;
  /** One line under the title: what the table counts. */
  note?: string;
  columns: ReportColumn[];
  rows: Value[][];
  /** The first cell of the totals row. Absent = no totals row. */
  totalLabel?: string;
}

export interface ReportKpi {
  label: string;
  value: number | string;
  /** Default "money" for numbers. */
  type?: "money" | "int" | "pct" | "text";
  /** A line under the figure: "vs ৳41,200 last period", "12 refunds". */
  note?: string;
}

export interface Report {
  /** "Sales report". */
  title: string;
  /** The business the report belongs to. */
  business: string;
  /** The file name without its extension: "sales-lalbagh-2026-07-01_2026-07-29". */
  fileBase: string;
  /** ISO code; the money format shows its symbol. */
  currency: string;
  /** Context, in reading order: Venue, Period, Filters, Prepared by, Generated. */
  meta: [string, string][];
  kpis?: ReportKpi[];
  /** Breakdowns drawn on the Summary sheet, in order. */
  summary?: ReportTable[];
  /** The record-level data, one sheet each. The first is what the CSV holds. */
  sheets: { name: string; table: ReportTable }[];
  /** [term, meaning] for the About sheet. */
  glossary?: [string, string][];
  labels: ReportLabels;
}

/** The words the report frame itself needs, from the `export` messages. */
export interface ReportLabels {
  summarySheet: string; // "Summary"
  aboutSheet: string; // "About"
  keyFigures: string; // "Key figures"
  breakdowns: string; // "Breakdowns"
  definitions: string; // "What the figures mean"
  /** Excel page footer, with &P and &N: "Page &P of &N". */
  page: string;
  /** Under each data sheet's totals: "Totals follow the filter." */
  totalsFollowFilter: string;
  /** "{n} rows" */
  rows: (n: number) => string;
  /** Shown when a data sheet has nothing in it. */
  noRows: string;
}

/* ── Helpers callers use ─────────────────────────────────────────────────── */

/** The narrow symbol for a currency: BDT → ৳, USD → $. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** A file-name-safe slug: "Lalbagh Fort" → "lalbagh-fort". */
export const slugify = (s: string): string =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";

/* ── Excel ───────────────────────────────────────────────────────────────── */

const NUMERIC: ColType[] = ["int", "decimal", "money", "pct"];
const isNumeric = (t: ColType) => NUMERIC.includes(t);

const bodyStyle = (t: ColType): StyleId =>
  ({ text: S.text, code: S.code, int: S.int, decimal: S.decimal, money: S.money, pct: S.pct, date: S.date, datetime: S.datetime, time: S.time })[t];
const totalStyle = (t: ColType): StyleId =>
  t === "money" ? S.totalMoney : t === "int" ? S.totalInt : t === "pct" ? S.totalPct : t === "decimal" ? S.totalDecimal : S.totalText;

/** One value as a typed cell. */
function cellOf(v: Value, t: ColType): XCell {
  if (v == null || v === "") return { s: bodyStyle(t) };
  switch (t) {
    case "money":
      return typeof v === "number" ? { v: Math.round(v) / 100, s: S.money } : { v: String(v), s: S.text };
    case "int":
    case "decimal":
    case "pct":
      return typeof v === "number" ? { v, s: bodyStyle(t) } : { v: String(v), s: S.text };
    case "date":
    case "datetime": {
      const n = typeof v === "number" ? v : excelDate(String(v));
      return n == null ? { v: String(v), s: S.text } : { v: t === "date" ? Math.floor(n) : n, s: bodyStyle(t) };
    }
    case "time": {
      if (typeof v === "number") return { v, s: S.time };
      const hm = /^(\d{1,2}):(\d{2})$/.exec(String(v));
      if (hm) return { v: (Number(hm[1]) * 60 + Number(hm[2])) / 1440, s: S.time };
      const n = excelDate(String(v));
      return n == null ? { v: String(v), s: S.text } : { v: n - Math.floor(n), s: S.time };
    }
    default:
      return { v: String(v), s: bodyStyle(t) };
  }
}

/** The number a cell holds once written — used for formulas' cached results. */
const numberOf = (v: Value, t: ColType): number | null => {
  if (typeof v !== "number") return null;
  return t === "money" ? Math.round(v) / 100 : v;
};

/** Content-measured widths, within sensible bounds per type. */
function widthsOf(table: ReportTable): number[] {
  return table.columns.map((c, i) => {
    if (c.width) return c.width;
    const t = c.type ?? "text";
    const min = t === "money" ? 14 : t === "datetime" ? 18 : t === "date" ? 13 : t === "time" ? 8 : t === "pct" ? 9 : 8;
    let longest = Math.min(30, c.header.length + 2);
    for (const r of table.rows.slice(0, 400)) {
      const v = r[i];
      const len = v == null ? 0 : t === "money" && typeof v === "number" ? (Math.abs(v) / 100).toFixed(2).length + 5 : String(v).length;
      if (len > longest) longest = len;
    }
    return Math.max(min, Math.min(t === "text" ? 48 : 24, longest + 2));
  });
}

const blank = (): XRow => ({ cells: [] });

/** The Summary sheet. */
function summarySheet(r: Report): XSheet {
  const rows: XRow[] = [];
  const merges: string[] = [];
  const tables = r.summary ?? [];
  const span = Math.max(4, ...tables.map((t) => t.columns.length));
  const widths: number[] = Array.from({ length: span }, (_, i) => (i === 0 ? 34 : 20));
  // Breakdown first columns can be long names; give them the room.
  for (const t of tables) {
    const w = widthsOf(t);
    w.forEach((x, i) => (widths[i] = Math.max(widths[i], Math.min(i === 0 ? 44 : 24, x))));
  }

  rows.push({ cells: [{ v: r.title, s: S.title }], height: 28 });
  rows.push({ cells: [{ v: r.business, s: S.subtitle }] });
  rows.push(blank());
  for (const [label, value] of r.meta) {
    const at = rows.length + 1;
    rows.push({ cells: [{ v: label, s: S.metaLabel }, { v: value, s: S.metaValue }] });
    if (span > 2) merges.push(`${ref(1, at)}:${ref(span - 1, at)}`);
  }

  if (r.kpis?.length) {
    rows.push(blank());
    rows.push({ cells: [{ v: r.labels.keyFigures, s: S.section }], height: 20 });
    const perRow = Math.min(4, span);
    for (let i = 0; i < r.kpis.length; i += perRow) {
      const group = r.kpis.slice(i, i + perRow);
      const labels: XCell[] = [];
      const values: XCell[] = [];
      const notes: XCell[] = [];
      group.forEach((k) => {
        const type = k.type ?? (typeof k.value === "number" ? "money" : "text");
        labels.push({ v: k.label, s: S.kpiLabel });
        if (typeof k.value === "string" || type === "text") values.push({ v: String(k.value), s: S.kpiText });
        else values.push({ v: type === "money" ? Math.round(k.value) / 100 : k.value, s: type === "money" ? S.kpiMoney : type === "pct" ? S.kpiPct : S.kpiInt });
        notes.push({ v: k.note ?? "", s: S.kpiNote });
      });
      rows.push({ cells: labels, height: 22 });
      rows.push({ cells: values, height: 30 });
      rows.push({ cells: notes, height: group.some((k) => k.note) ? 18 : 6 });
      rows.push({ cells: [], height: 8 });
    }
  }

  for (const t of tables) {
    rows.push(blank());
    rows.push({ cells: [{ v: t.title ?? "", s: S.section }], height: 20 });
    if (t.note) rows.push({ cells: [{ v: t.note, s: S.note }] });
    tableRows(t, rows, false);
  }

  return {
    name: r.labels.summarySheet,
    widths,
    rows,
    merges,
    gridLines: false,
    footer: `&L${r.business} — ${r.title}&R${r.labels.page}`,
    tabColor: "FFF94A00",
  };
}

/** A header row, the body and (if asked) a totals row, appended to `rows`.
 *  `filterable` totals use SUBTOTAL so they follow Excel's filter. Returns the
 *  1-based header row. */
function tableRows(t: ReportTable, rows: XRow[], filterable: boolean): { header: number; last: number } {
  const types = t.columns.map((c) => c.type ?? "text");
  const header = rows.length + 1;
  rows.push({
    cells: t.columns.map((c, i) => ({ v: c.header, s: isNumeric(types[i]) ? S.headerRight : S.header })),
    height: 22,
  });
  const first = rows.length + 1;
  for (const r of t.rows) rows.push({ cells: t.columns.map((_, i) => cellOf(r[i], types[i])) });
  const last = rows.length;
  if (t.totalLabel != null) {
    const cells: XCell[] = t.columns.map((c, i) => {
      const type = types[i];
      const mode = c.total ?? (type === "int" || type === "decimal" || type === "money" ? "sum" : "none");
      if (i === 0) return { v: t.totalLabel, s: S.totalText };
      if (mode === "none" || t.rows.length === 0) return { s: totalStyle(type) };
      const nums = t.rows.map((r) => numberOf(r[i], type)).filter((n): n is number => n != null);
      const sum = nums.reduce((a, b) => a + b, 0);
      const cached = mode === "avg" ? (nums.length ? sum / nums.length : 0) : sum;
      const range = `${ref(i, first)}:${ref(i, last)}`;
      const f = filterable ? `SUBTOTAL(${mode === "avg" ? 101 : 109},${range})` : `${mode === "avg" ? "AVERAGE" : "SUM"}(${range})`;
      return { f, v: Math.round(cached * 100) / 100, s: totalStyle(type) };
    });
    rows.push({ cells, height: 20 });
  }
  return { header, last };
}

/** One record-level sheet. */
function dataSheet(r: Report, name: string, t: ReportTable): XSheet {
  const rows: XRow[] = [];
  const widths = widthsOf(t);
  rows.push({ cells: [{ v: t.title ?? name, s: S.title }], height: 28 });
  const context = r.meta.map(([k, v]) => `${k}: ${v}`).join("   ·   ");
  rows.push({ cells: [{ v: `${r.business}   ·   ${context}`, s: S.subtitle }] });
  rows.push({ cells: [{ v: t.note ?? (t.rows.length ? `${r.labels.rows(t.rows.length)}${t.totalLabel != null ? `   ·   ${r.labels.totalsFollowFilter}` : ""}` : r.labels.noRows), s: S.note }] });
  const { header, last } = tableRows(t, rows, true);
  const cols = t.columns.length;
  return {
    name,
    widths,
    rows,
    freeze: { rows: header, cols: 1 },
    autoFilter: t.rows.length ? `${ref(0, header)}:${ref(cols - 1, last)}` : undefined,
    gridLines: false,
    landscape: cols > 6,
    printTitleRows: [header, header],
    footer: `&L${r.business} — ${t.title ?? name}&R${r.labels.page}`,
  };
}

function aboutSheet(r: Report): XSheet {
  const rows: XRow[] = [{ cells: [{ v: r.labels.definitions, s: S.title }], height: 28 }, { cells: [{ v: `${r.business} — ${r.title}`, s: S.subtitle }] }, blank()];
  for (const [term, meaning] of r.glossary ?? []) rows.push({ cells: [{ v: term, s: S.glossTerm }, { v: meaning, s: S.glossBody }] });
  return { name: r.labels.aboutSheet, widths: [28, 96], rows, gridLines: false, footer: `&L${r.business}&R${r.labels.page}` };
}

/** The report as .xlsx bytes. */
export function buildReportXlsx(r: Report): Uint8Array {
  const sheets: XSheet[] = [];
  if (r.kpis?.length || r.summary?.length) sheets.push(summarySheet(r));
  for (const s of r.sheets) sheets.push(dataSheet(r, s.name, s.table));
  if (r.glossary?.length) sheets.push(aboutSheet(r));
  return buildXlsx({ sheets, title: `${r.business} — ${r.title}`, author: r.business, currencySymbol: currencySymbol(r.currency) });
}

/** The report as an .xlsx file, downloaded. */
export function downloadXlsx(r: Report): void {
  saveBytes(`${r.fileBase}.xlsx`, buildReportXlsx(r), XLSX_TYPE);
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (v: string, withTime: boolean): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
};

/** One value as CSV text: money as a plain decimal, dates as ISO, and a text
 *  that begins like a formula defused — a customer named `=cmd|…` must not run
 *  on an accountant's machine. */
export function csvValue(v: Value, t: ColType = "text"): string {
  if (v == null) return "";
  let s: string;
  if (typeof v === "number") {
    s = t === "money" ? (v / 100).toFixed(2) : t === "pct" ? (v * 100).toFixed(1) : String(v);
  } else if (t === "date" || t === "datetime") s = isoLocal(v, t === "datetime");
  else if (t === "time" && !/^\d{1,2}:\d{2}$/.test(v)) {
    const d = new Date(v);
    s = Number.isNaN(d.getTime()) ? v : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } else s = v;
  if (typeof v === "string" && /^[=+@\t\r]|^-(?![\d.])/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A table as CSV text, with a byte-order mark so Excel reads Bangla and ৳. */
export function tableCsv(t: ReportTable): string {
  const types = t.columns.map((c) => c.type ?? "text");
  // A percentage is written 0–100 in CSV; the header says so, or "12.5" could be read as a fraction.
  const head = t.columns.map((c) => csvValue(c.type === "pct" ? `${c.header} (%)` : c.header)).join(",");
  const body = t.rows.map((r) => t.columns.map((_, i) => csvValue(r[i], types[i])).join(","));
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

/** The report's first data sheet as a .csv file, downloaded. */
export function downloadReportCsv(r: Report, sheet = 0): void {
  const s = r.sheets[sheet];
  if (!s) return;
  const suffix = sheet > 0 ? `-${slugify(s.name)}` : "";
  saveBytes(`${r.fileBase}${suffix}.csv`, tableCsv(s.table), "text/csv;charset=utf-8");
}
