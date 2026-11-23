import { QUARTER, runAt, snapDown, type Column } from "./board";

/** The span the cashier drew on one column: what the "New booking" list is a
 *  question about. A null column is the header's "+ New booking": a time, but
 *  no place yet. */
export interface DraftSel {
  columnId: string | null;
  start: number;
  end: number;
}

/** What the board draws as the solid draft block. It starts as the span itself
 *  and, once something is chosen in the sheet, follows that choice (length,
 *  lane, appointment) so the board and the price never disagree. */
export interface Ghost {
  columnId: string | null;
  start: number;
  end: number;
  title: string | null;
  hold?: boolean;
}

export const selKey = (s: DraftSel) => `${s.columnId ?? "-"}|${s.start}|${s.end}`;

/** The span a tap or a click selects: the column's natural length from the
 *  start of the slot grid the tap fell on, kept inside the free run. */
export function naturalSel(column: Column, run: [number, number], minute: number): DraftSel {
  const natural = column.natural ?? 60;
  const snap = column.snap ?? QUARTER;
  let start = Math.max(run[0], snapDown(minute, snap));
  // A run that starts off the grid (just after a booking) starts the selection
  // where the free time starts, not on a time nobody can sell from.
  if (start < run[0]) start = run[0];
  let end = start + natural;
  if (end > run[1]) {
    end = run[1];
    // Pull the start back when the tap fell near the end of the run, so a
    // natural length is kept where there is room for it.
    start = Math.max(run[0], end - natural);
  }
  return { columnId: column.id, start, end };
}

/** A drawn range, clamped to the run it began in. */
export function drawnSel(column: Column, run: [number, number], anchor: number, current: number): DraftSel {
  const lo = Math.min(anchor, current);
  const hi = Math.max(anchor, current) + QUARTER;
  return { columnId: column.id, start: Math.max(run[0], lo), end: Math.min(run[1], hi) };
}

export { runAt };
