import type { EventDay } from "@/lib/api";

/**
 * The days of a multi-day event, kept in step with the dates that bound it.
 *
 * An operator says when it starts and when it finishes; the days between are
 * arithmetic, and making somebody add "Day 2" by hand after typing an end date
 * two days later is asking them to state the same fact twice. So the range
 * generates the days — and regenerating **keeps what was already said about a
 * date that survives**, because a day's name and hours are the operator's work
 * and nudging an end date must not throw them away.
 */

/** One day on, in local dates. `Date.UTC` so the arithmetic cannot be moved by
 *  the +06:00 offset the rest of the seed is written in. */
export function nextDay(date: string, by = 1): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + by));
  return t.toISOString().slice(0, 10);
}

/** How many days a range covers, inclusive of both ends. */
export function dayCount(from: string, to: string): number {
  if (!from || !to) return 1;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * The days a range implies, carrying over anything already said about each
 * date. Capped, because a range typed by accident — a year out instead of a
 * day — should not mint three hundred rows before anyone notices.
 */
export const MAX_DAYS = 30;

export function daysForRange(from: string, to: string, existing: EventDay[] = []): EventDay[] {
  if (!from) return [];
  const n = Math.min(dayCount(from, to || from), MAX_DAYS);
  const byDate = new Map(existing.map((d) => [d.date, d]));
  const out: EventDay[] = [];
  for (let i = 0; i < n; i++) {
    const date = nextDay(from, i);
    const was = byDate.get(date);
    out.push(was ? { ...was, date } : { id: `day_${Date.now().toString(36)}_${i}`, date });
  }
  return out;
}

/** What to call a day when the operator has not named it. Positional, because
 *  "Day 2" is what a programme and a ticket both say, and it is right whatever
 *  the dates are. */
export const dayOrdinal = (index: number) => index + 1;

/** The operator's name for a day, or its position. Never blank: a chip with no
 *  label is a chip nobody can choose. */
export const dayName = (day: EventDay, index: number, fallback: (n: number) => string) =>
  day.name?.trim() || fallback(dayOrdinal(index));
