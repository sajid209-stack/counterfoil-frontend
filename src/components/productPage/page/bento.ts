import type { CSSProperties } from "react";

/**
 * Cards follow their count (docs/page-design.md "Round two"). One answer, used
 * by tickets, included, line-up, highlights and the gallery, so no section
 * invents its own grid and none can leave a hole.
 *
 * A 6-column grid. Every row of every result sums to exactly 6 by construction
 * (`rowsFill` checks it; it is a pure function, no test runner needed).
 *
 *   evenSpans   things of equal rank: column spans only, no row spans.
 *   bentoSpans  tiles with a lead: column and row spans.
 *
 * On a phone `evenSpans` is one column and `bentoSpans` two, the first (and,
 * when the count is even, the last) spanning both, so no card sits alone beside
 * a hole. Callers pass `ctx.layout`, never a media query: the designer's
 * preview lays out by its own width.
 */

export type Layout = "phone" | "tablet" | "desktop";

export interface Cell {
  /** Columns spanned out of `columns`. */
  col: number;
  /** Rows spanned. */
  row: number;
}

export interface Plan {
  /** Columns in the grid. */
  columns: number;
  cells: Cell[];
}

/** Equal rank, 6 columns: 1:[6] 2:[3,3] 3:[2,2,2] 4:[3,3,3,3] 5:[3,3,2,2,2] 6+:
 *  rows of three, the wider cards first so the last row is always full. */
export function evenSpans(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [6];
  if (n === 2) return [3, 3];
  if (n === 3) return [2, 2, 2];
  const wide = n % 3 === 0 ? 0 : n % 3 === 1 ? 4 : 2; // how many 3-spans lead
  return Array.from({ length: n }, (_, i) => (i < wide ? 3 : 2));
}

/** A lead and the rest. 3: the lead is 3x2 with two stacked beside it. 4:
 *  [4,2,2,4]. 5: [4,2,2,2,2]. 6+: a [4,2] first row, then the remainder as
 *  evenSpans, so every row fills. Returned as column and row spans. */
export function bentoSpans(n: number): Cell[] {
  if (n <= 0) return [];
  if (n === 1) return [{ col: 6, row: 1 }];
  if (n === 2) return [{ col: 3, row: 1 }, { col: 3, row: 1 }];
  if (n === 3) return [{ col: 3, row: 2 }, { col: 3, row: 1 }, { col: 3, row: 1 }];
  if (n === 4) return [4, 2, 2, 4].map((col) => ({ col, row: 1 }));
  return [4, 2, ...evenSpans(n - 2)].map((col) => ({ col, row: 1 }));
}

/** Equal rank, for this layout. */
export function evenPlan(n: number, layout: Layout): Plan {
  if (layout === "phone") return { columns: 1, cells: Array.from({ length: n }, () => ({ col: 1, row: 1 })) };
  return { columns: 6, cells: evenSpans(n).map((col) => ({ col, row: 1 })) };
}

/** With a lead, for this layout. Three tiles with no photo to fill a tall lead
 *  stack instead: a lead two rows high with only words in it is an empty box. */
export function bentoPlan(n: number, layout: Layout, { tallLead = true }: { tallLead?: boolean } = {}): Plan {
  if (layout !== "phone") {
    if (n === 3 && !tallLead) return { columns: 6, cells: [6, 3, 3].map((col) => ({ col, row: 1 })) };
    return { columns: 6, cells: bentoSpans(n) };
  }
  const even = n % 2 === 0;
  return {
    columns: 2,
    cells: Array.from({ length: n }, (_, i) => ({ col: i === 0 || (even && i === n - 1) ? 2 : 1, row: 1 })),
  };
}

/** The CSS for one cell. */
export const cellStyle = (c: Cell): CSSProperties => ({
  gridColumn: `span ${c.col}`,
  ...(c.row > 1 ? { gridRow: `span ${c.row}` } : null),
});

/** The CSS for the grid itself. */
export const gridStyle = (p: Plan): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${p.columns}, minmax(0, 1fr))`,
});

/** Sanity: do the cells, placed in order, fill every row of `columns` exactly?
 *  Row spans are honoured (a tall cell holds its columns on the next row). */
export function rowsFill(cells: Cell[], columns: number): boolean {
  const held: number[] = []; // columns still held by tall cells, per upcoming row
  let used = 0;
  let row = 0;
  for (const c of cells) {
    while (used + (held[row] ?? 0) + c.col > columns) {
      if (used + (held[row] ?? 0) !== columns) return false;
      row += 1;
      used = 0;
    }
    used += c.col;
    for (let r = 1; r < c.row; r += 1) held[row + r] = (held[row + r] ?? 0) + c.col;
  }
  return used + (held[row] ?? 0) === columns;
}
