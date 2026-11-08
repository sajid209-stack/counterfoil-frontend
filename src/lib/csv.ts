/* A CSV file, written and handed to the browser to save. */

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
export const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows to CSV text, with a byte-order mark so Excel reads Bangla and ৳ as UTF-8. */
export const toCsv = (rows: (string | number)[][]): string => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** Hands a CSV to the browser as a download. */
export function saveCsv(name: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
