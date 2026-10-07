/* Small pure helpers the Analytics page and its cards share. */

export const num = (n: number) => n.toLocaleString("en-US");

/** Whole percent from 10% up; one decimal below it, so a small share is not
 *  rounded to a "0%" that reads as nothing at all. */
export const percent = (f: number) => {
  if (f <= 0) return "0%";
  if (f < 0.001) return "<0.1%";
  if (f < 0.1) return `${Math.round(f * 1000) / 10}%`;
  return `${Math.round(f * 100)}%`;
};

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
export const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const major = (minor: number) => (minor / 100).toFixed(2);

export function saveCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The relative change between two figures, whole percent; null where there is
 *  nothing to say (no earlier figure, or it did not move). */
export const changePct = (now: number, then: number | undefined): number | null => {
  if (then === undefined || then <= 0) return null;
  const p = Math.round(((now - then) / then) * 100);
  return p === 0 ? null : p;
};
