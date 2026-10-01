import type { OpeningHours } from "@/lib/api";
import { toMinutes } from "@/lib/schedule";
import { formatClockRange } from "@/lib/format";

type Day = OpeningHours["dayOfWeek"];
type Interval = OpeningHours["intervals"][number];

/** Monday first — the order the rest of the app draws a week in. */
export const WEEK: Day[] = [1, 2, 3, 4, 5, 6, 0];

/** Message keys for the short day names, indexed by dayOfWeek. */
export const DAY_KEY = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"] as const;

/** All seven days, in dayOfWeek order, each with its intervals sorted by opening. */
export function normalizeHours(hours: OpeningHours[]): OpeningHours[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Day[]).map((d) => ({
    dayOfWeek: d,
    intervals: [...(hours.find((h) => h.dayOfWeek === d)?.intervals ?? [])].sort(
      (a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt),
    ),
  }));
}

export const openDays = (hours: OpeningHours[]): number => hours.filter((h) => h.intervals.length > 0).length;

/** "10:00 AM – 6:00 PM" or "10:00 AM – 1:00 PM, 2:00 – 6:00 PM". Drawn
 *  12-hour; the intervals themselves stay 24-hour "HH:MM". */
export const spans = (intervals: Interval[]): string => intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ");

/**
 * What is wrong with a day's hours, if anything.
 *
 * Only two things can be: a closing time at or before its opening, or two
 * spans that overlap. Hours running past midnight are not modelled — an
 * interval belongs to one day — so they read as backwards, which is the honest
 * answer for this model rather than a guess at the next day.
 */
export function dayProblem(intervals: Interval[]): "backwards" | "overlap" | null {
  const sorted = [...intervals].sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt));
  for (let i = 0; i < sorted.length; i++) {
    if (toMinutes(sorted[i].closesAt) <= toMinutes(sorted[i].opensAt)) return "backwards";
    if (i > 0 && toMinutes(sorted[i].opensAt) < toMinutes(sorted[i - 1].closesAt)) return "overlap";
  }
  return null;
}

/** The weekday of a yyyy-mm-dd date, read at local noon so no zone shifts it a day. */
export const weekdayOf = (ymd: string): Day => new Date(`${ymd}T12:00:00`).getDay() as Day;
