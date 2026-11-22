/*
 * What every exported report shares: who the business is, which currency its
 * figures are in, and who pressed Export. Read when the file is made (not while
 * rendering), so a business switched in a demo, or a renamed one, is current.
 */
import { getOperatorState, peekStaff } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";

/** A translator for a namespace, loosened so a builder can take any key. */
export type T = (key: string, values?: Record<string, string | number>) => string;

export function reportContext(): { business: string; currency: string; preparedBy: string } {
  const op = getOperatorState();
  const me = peekStaff().find((s) => s.id === DEMO_STAFF_ID);
  return { business: op.name, currency: op.currency || "BDT", preparedBy: me?.name ?? "" };
}

/** Change from `then` to `now` as a fraction (0.12 = +12%); null when there is no earlier figure to measure against. */
export const changeOf = (now: number, then: number | null | undefined): number | null =>
  then === null || then === undefined || then <= 0 ? null : (now - then) / then;

/** "+12%" / "−8%" for a note; empty when nothing moved or nothing to compare. */
export function changeText(now: number, then: number | null | undefined): string {
  const c = changeOf(now, then);
  if (c === null) return "";
  const p = Math.round(c * 100);
  return p === 0 ? "" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`;
}
