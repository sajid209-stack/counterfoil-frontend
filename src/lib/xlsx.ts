/*
 * A real Excel workbook (.xlsx), written in the browser with no dependency.
 *
 * A CSV cannot carry what makes a report readable in Excel: a typed money
 * column that adds up and shows ৳, dates that sort as dates, a frozen header,
 * a filter on every column, totals that follow the filter, several sheets, and
 * a page set up to print. An .xlsx is a zip of XML parts; this writes the
 * smallest valid set of them, stored (not deflated) — the files are small and
 * every spreadsheet program reads a stored zip.
 *
 * The style table is fixed (`S` below), so every report in the product looks
 * like one family: same title, same header band, same totals row.
 */

/* ── Styles ──────────────────────────────────────────────────────────────── */

/** Every cell style a report can use. The numbers are cellXfs indices. */
export const S = {
  plain: 0,
  title: 1,
  subtitle: 2,
  metaLabel: 3,
  metaValue: 4,
  section: 5,
  header: 6,
  headerRight: 7,
  text: 8,
  code: 9,
  int: 10,
  money: 11,
  pct: 12,
  date: 13,
  datetime: 14,
  time: 15,
  totalText: 16,
  totalInt: 17,
  totalMoney: 18,
  totalPct: 19,
  kpiLabel: 20,
  kpiMoney: 21,
  kpiInt: 22,
  kpiPct: 23,
  note: 24,
  kpiText: 25,
  glossTerm: 26,
  glossBody: 27,
  kpiNote: 28,
  decimal: 29,
  totalDecimal: 30,
} as const;
export type StyleId = (typeof S)[keyof typeof S];

const INK = "FF1F2328";
const MUTED = "FF6B6760";
const BRAND = "FFAA3000"; // brand-700: the brand step that reads as text
const LINE = "FFE4E0D9";
const HEADER_FILL = "FFF3F1EC";
const TOTAL_FILL = "FFF8F7F4";
const KPI_FILL = "FFFFF4EE";

const esc = (s: string) =>
  s
    // Characters XML 1.0 cannot carry at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function stylesXml(currencySymbol: string): string {
  const sym = currencySymbol.replace(/"/g, "");
  const money = `&quot;${esc(sym)}&quot;#,##0.00;[Red]-&quot;${esc(sym)}&quot;#,##0.00;&quot;${esc(sym)}&quot;0.00`;
  const fmts = [
    [164, money],
    [165, "#,##0"],
    [166, "0.0%"],
    [167, "d mmm yyyy"],
    [168, "d mmm yyyy hh:mm"],
    [169, "hh:mm"],
    [170, "#,##0.00"],
  ];
  const font = (sz: number, color: string, bold = false, name = "Calibri") =>
    `<font>${bold ? "<b/>" : ""}<sz val="${sz}"/><color rgb="${color}"/><name val="${name}"/><family val="2"/></font>`;
  const fonts = [
    font(11, INK), //            0 body
    font(11, INK, true), //      1 bold
    font(18, INK, true), //      2 title
    font(10, MUTED), //          3 muted
    font(11, INK, true), //      4 header
    font(12, BRAND, true), //    5 section
    font(18, INK, true), //      6 kpi value
    font(9, MUTED), //           7 note
    font(10, INK, false, "Consolas"), // 8 code
  ];
  const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`, fill(HEADER_FILL), fill(TOTAL_FILL), fill(KPI_FILL)];
  const borders = [
    `<border><left/><right/><top/><bottom/><diagonal/></border>`,
    `<border><left/><right/><top/><bottom style="thin"><color rgb="${LINE}"/></bottom><diagonal/></border>`,
    `<border><left/><right/><top style="thin"><color rgb="${INK}"/></top><bottom style="double"><color rgb="${INK}"/></bottom><diagonal/></border>`,
    `<border><left/><right/><top/><bottom style="medium"><color rgb="${INK}"/></bottom><diagonal/></border>`,
  ];
  // [numFmt, font, fill, border, align]
  type Xf = [number, number, number, number, string?];
  const L = `<alignment vertical="center"/>`;
  const R = `<alignment horizontal="right" vertical="center"/>`;
  const W = `<alignment vertical="top" wrapText="1"/>`;
  const xfs: Xf[] = [
    [0, 0, 0, 0], //                   plain
    [0, 2, 0, 0, L], //                title
    [0, 3, 0, 0, L], //                subtitle
    [0, 3, 0, 0, `<alignment vertical="top"/>`], // metaLabel
    [0, 0, 0, 0, `<alignment vertical="top" wrapText="1"/>`], // metaValue
    [0, 5, 0, 0, L], //                section
    [0, 4, 2, 3, `<alignment vertical="center" wrapText="1"/>`], // header
    [0, 4, 2, 3, `<alignment horizontal="right" vertical="center" wrapText="1"/>`], // headerRight
    [0, 0, 0, 1, L], //                text
    [0, 8, 0, 1, L], //                code
    [165, 0, 0, 1, R], //              int
    [164, 0, 0, 1, R], //              money
    [166, 0, 0, 1, R], //              pct
    [167, 0, 0, 1, `<alignment horizontal="left" vertical="center"/>`], // date
    [168, 0, 0, 1, `<alignment horizontal="left" vertical="center"/>`], // datetime
    [169, 0, 0, 1, `<alignment horizontal="left" vertical="center"/>`], // time
    [0, 1, 3, 2, L], //                totalText
    [165, 1, 3, 2, R], //              totalInt
    [164, 1, 3, 2, R], //              totalMoney
    [166, 1, 3, 2, R], //              totalPct
    [0, 3, 4, 0, `<alignment vertical="bottom" wrapText="1"/>`], // kpiLabel
    [164, 6, 4, 0, `<alignment horizontal="left" vertical="center"/>`], // kpiMoney
    [165, 6, 4, 0, `<alignment horizontal="left" vertical="center"/>`], // kpiInt
    [166, 6, 4, 0, `<alignment horizontal="left" vertical="center"/>`], // kpiPct
    [0, 7, 0, 0, W], //                note
    [0, 6, 4, 0, L], //                kpiText
    [0, 1, 0, 1, `<alignment vertical="top"/>`], // glossTerm
    [0, 0, 0, 1, W], //                glossBody
    [0, 7, 4, 0, `<alignment vertical="top" wrapText="1"/>`], // kpiNote
    [170, 0, 0, 1, R], //              decimal
    [170, 1, 3, 2, R], //              totalDecimal
  ];
  const xf = ([n, f, fi, b, a]: Xf) =>
    `<xf numFmtId="${n}" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0"${n ? ' applyNumberFormat="1"' : ""} applyFont="1"${fi ? ' applyFill="1"' : ""}${b ? ' applyBorder="1"' : ""}${a ? ` applyAlignment="1">${a}</xf>` : "/>"}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="${fmts.length}">${fmts.map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${code}"/>`).join("")}</numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="${borders.length}">${borders.join("")}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.map(xf).join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

/* ── Cells and sheets ────────────────────────────────────────────────────── */

export interface XCell {
  /** A string, a number, or nothing. Dates are numbers: see `excelDate`. */
  v?: string | number | null;
  s?: StyleId;
  /** A formula without the leading "=". `v` is then its cached result, which
   *  is what previews and programs that never recalculate will show. */
  f?: string;
}
export type XRow = { cells: (XCell | null)[]; height?: number };

export interface XSheet {
  name: string;
  /** Column widths in characters. */
  widths: number[];
  rows: XRow[];
  /** Freeze everything above this row (1-based count) and left of this column. */
  freeze?: { rows: number; cols?: number };
  /** "A5:H120" — a filter button on every header. */
  autoFilter?: string;
  merges?: string[];
  gridLines?: boolean;
  landscape?: boolean;
  /** Repeat these rows at the top of every printed page: [first, last], 1-based. */
  printTitleRows?: [number, number];
  /** Footer, Excel codes allowed ("&P of &N"). */
  footer?: string;
  tabColor?: string;
}

export const colName = (i: number): string => {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
export const ref = (col: number, row: number) => `${colName(col)}${row}`;

/** An instant or a calendar day as an Excel serial date, in local time — the
 *  clock the venue read it on. "2026-07-29" is that day at midnight. */
export function excelDate(value: string | Date): number | null {
  let d: Date;
  if (value instanceof Date) d = value;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, dd] = value.split("-").map(Number);
    d = new Date(y, m - 1, dd);
  } else d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

function cellXml(c: XCell, r: string): string {
  const s = c.s ? ` s="${c.s}"` : "";
  if (c.f) {
    const cached = typeof c.v === "number" && Number.isFinite(c.v) ? `<v>${c.v}</v>` : "";
    return `<c r="${r}"${s}><f>${esc(c.f)}</f>${cached}</c>`;
  }
  if (c.v == null || c.v === "") return c.s ? `<c r="${r}"${s}/>` : "";
  if (typeof c.v === "number") return Number.isFinite(c.v) ? `<c r="${r}"${s}><v>${c.v}</v></c>` : `<c r="${r}"${s}/>`;
  const text = esc(c.v);
  const space = /^\s|\s$|\n/.test(c.v) ? ' xml:space="preserve"' : "";
  return `<c r="${r}"${s} t="inlineStr"><is><t${space}>${text}</t></is></c>`;
}

function sheetXml(sh: XSheet): string {
  const freeze = sh.freeze && (sh.freeze.rows > 0 || (sh.freeze.cols ?? 0) > 0)
    ? (() => {
        const rows = sh.freeze!.rows;
        const cols = sh.freeze!.cols ?? 0;
        const pane = rows && cols ? "bottomRight" : rows ? "bottomLeft" : "topRight";
        return `<pane${cols ? ` xSplit="${cols}"` : ""}${rows ? ` ySplit="${rows}"` : ""} topLeftCell="${ref(cols, rows + 1)}" activePane="${pane}" state="frozen"/><selection pane="${pane}" activeCell="${ref(cols, rows + 1)}" sqref="${ref(cols, rows + 1)}"/>`;
      })()
    : "";
  const rows = sh.rows
    .map((row, i) => {
      const r = i + 1;
      const cells = row.cells.map((c, ci) => (c ? cellXml(c, ref(ci, r)) : "")).join("");
      const ht = row.height ? ` ht="${row.height}" customHeight="1"` : "";
      return cells || ht ? `<row r="${r}"${ht}>${cells}</row>` : "";
    })
    .join("");
  const cols = sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const merges = sh.merges?.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const tab = sh.tabColor ? `<tabColor rgb="${sh.tabColor}"/>` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetPr>${tab}<pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0"${sh.gridLines === false ? ' showGridLines="0"' : ""}>${freeze}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rows}</sheetData>` +
    (sh.autoFilter ? `<autoFilter ref="${sh.autoFilter}"/>` : "") +
    merges +
    `<printOptions horizontalCentered="0"/>` +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="${sh.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>` +
    (sh.footer ? `<headerFooter><oddFooter>${esc(sh.footer)}</oddFooter></headerFooter>` : "") +
    `</worksheet>`
  );
}

/** Excel's own rules for a tab name: 31 characters, none of []:*?/\, unique. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    const base = (n.replace(/[[\]:*?/\\]/g, " ").trim() || "Sheet").slice(0, 31);
    let name = base;
    let k = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${k++})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/* ── The zip ─────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, f.data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, time, true);
    cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, f.data.length, true);
    cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of all) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/* ── The workbook ────────────────────────────────────────────────────────── */

export interface XWorkbook {
  sheets: XSheet[];
  title?: string;
  author?: string;
  currencySymbol: string;
}

/** The workbook as .xlsx bytes. */
export function buildXlsx(wb: XWorkbook): Uint8Array {
  const enc = new TextEncoder();
  const names = sheetNames(wb.sheets.map((s) => s.name));
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files: { name: string; data: Uint8Array }[] = [];
  const put = (name: string, xml: string) => files.push({ name, data: enc.encode(xml) });

  put(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      wb.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  put(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  put(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${esc(wb.title ?? "")}</dc:title><dc:creator>${esc(wb.author ?? "Counterfoil")}</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
  );
  put(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Counterfoil</Application></Properties>`,
  );
  const defined = wb.sheets
    .map((s, i) => (s.printTitleRows ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${names[i].replace(/'/g, "''")}'!$${s.printTitleRows[0]}:$${s.printTitleRows[1]}</definedName>` : ""))
    .concat(wb.sheets.map((s, i) => (s.autoFilter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i].replace(/'/g, "''")}'!${s.autoFilter.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}</definedName>` : "")))
    .join("");
  put(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
      names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ""}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  );
  put(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      wb.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${wb.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  put("xl/styles.xml", stylesXml(wb.currencySymbol));
  wb.sheets.forEach((s, i) => put(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip(files);
}

/** Hands bytes to the browser as a download. */
export function saveBytes(name: string, bytes: Uint8Array | string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
