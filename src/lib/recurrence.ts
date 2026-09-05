/* Repeat bookings — "the next 7 Wednesdays at 6".
 *
 * A standing weekly slot is the single most common thing a turf, a court or a
 * coach sells, and until now the only way to take one was to walk the whole
 * sheet seven times. The hard part is not generating the dates; it is that
 * some of them will already be taken, and a cashier standing in front of a
 * customer needs to know WHICH before money changes hands — not after.
 *
 * So planning is separated from checking: this module generates the dates and
 * asks a caller-supplied question about each one. The caller owns availability
 * (it differs per booking type), and this stays pure and testable.
 */

/** Why one date of a series cannot be sold. `null` means it can. */
export type OccurrenceBlock = "closed" | "taken" | "full" | "past";

export interface Occurrence {
  date: string;
  ok: boolean;
  reason: OccurrenceBlock | null;
}

/** Same weekday, every `everyWeeks` weeks, `count` of them, the first being
 *  `startDate` itself — "the next 7 Wednesdays" includes the one being booked. */
export function weeklyDates(startDate: string, count: number, everyWeeks = 1): string[] {
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return [];
  const out: string[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    // UTC arithmetic: a local Date would shift the day across a DST boundary,
    // and "every Wednesday" that lands on a Tuesday is worse than useless.
    const x = new Date(Date.UTC(y, m - 1, d));
    x.setUTCDate(x.getUTCDate() + i * 7 * everyWeeks);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export function planWeekly(
  startDate: string,
  count: number,
  check: (date: string) => OccurrenceBlock | null,
  everyWeeks = 1,
): Occurrence[] {
  return weeklyDates(startDate, count, everyWeeks).map((date) => {
    const reason = check(date);
    return { date, ok: reason === null, reason };
  });
}

export const bookableOf = (plan: Occurrence[]): string[] => plan.filter((o) => o.ok).map((o) => o.date);
