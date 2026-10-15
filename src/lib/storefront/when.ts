/**
 * A booking's "when" in words, for a page that has no date to state: "Open
 * daily 10:00 AM – 6:00 PM", "Every 45 min, 11:00 AM – 4:30 PM", or the days of
 * a course. Derived from the booking itself (and its venue's hours), so nothing
 * is typed twice. Pure: the caller hands in its translator.
 */
import { formatDuration } from "@/lib/duration";
import { formatClock, formatClockRange, formatDay } from "@/lib/format";
import { toMinutes } from "@/lib/schedule";
import type { Location, Product } from "@/lib/api/types";

type T = (key: string, values?: Record<string, string | number>) => string;

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const weekday = (dow: number) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(2024, 0, 7 + dow));

/** "Tue–Sun", "Mon, Wed" — runs of three or more days collapse. */
export function daysText(days: number[]): string {
  const set = new Set(days);
  const ordered = WEEK.filter((d) => set.has(d));
  const parts: string[] = [];
  for (let i = 0; i < ordered.length; ) {
    let j = i;
    while (j + 1 < ordered.length && WEEK.indexOf(ordered[j + 1]) === WEEK.indexOf(ordered[j]) + 1) j++;
    if (j - i >= 2) parts.push(`${weekday(ordered[i])}–${weekday(ordered[j])}`);
    else for (let k = i; k <= j; k++) parts.push(weekday(ordered[k]));
    i = j + 1;
  }
  return parts.join(", ");
}

/** Groups of days sharing the same hours, in week order. */
function openText(t: T, byDay: { dow: number; hours: string }[]): string {
  const groups: { hours: string; days: number[] }[] = [];
  for (const d of WEEK) {
    const row = byDay.find((x) => x.dow === d);
    if (!row) continue;
    const g = groups.find((x) => x.hours === row.hours);
    if (g) g.days.push(d);
    else groups.push({ hours: row.hours, days: [d] });
  }
  if (groups.length === 0) return "";
  if (groups.length === 1 && groups[0].days.length === 7) return t("when.openDaily", { hours: groups[0].hours });
  return t("when.open", { parts: groups.map((g) => `${daysText(g.days)} ${g.hours}`).join(" · ") });
}

export function whenInWords(p: Product, location: Location | undefined, t: T): string {
  if (p.bookingType === "BT-15") return "";
  const sch = p.schedule;
  const dates = (p.courseDates ?? []).filter(Boolean);
  if (dates.length > 0) {
    return dates.length <= 4
      ? t("when.classesOn", { dates: dates.map((d) => formatDay(d, { weekday: true })).join(", ") })
      : t("when.classes", { count: dates.length, first: formatDay(dates[0], { weekday: true }), last: formatDay(dates[dates.length - 1], { weekday: true }) });
  }
  if (sch && sch.slotMinutes > 0 && sch.dailyCapacity == null && toMinutes(sch.endTime) > toMinutes(sch.startTime)) {
    /* Sessions with gaps between them (a 90-minute class at 11 and at 4), or one
       a day: the start times themselves, not an interval nobody books by. */
    const starts: string[] = [];
    for (let m = toMinutes(sch.startTime); m + sch.sessionMinutes <= toMinutes(sch.endTime); m += sch.slotMinutes) {
      starts.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    const setTimes = starts.length > 0 && starts.length <= 3 && (sch.slotMinutes > sch.sessionMinutes || starts.length === 1);
    const every = setTimes
      ? t("when.at", { times: starts.map((x) => formatClock(x)).join(" & "), length: formatDuration(sch.sessionMinutes) })
      : t("when.every", { interval: formatDuration(sch.slotMinutes), hours: formatClockRange(sch.startTime, sch.endTime) });
    return sch.openDays.length > 0 && sch.openDays.length < 7 ? `${every} · ${daysText(sch.openDays)}` : every;
  }
  if (sch && sch.openDays.length > 0) {
    const hours = formatClockRange(sch.startTime, sch.endTime);
    return openText(t, sch.openDays.map((dow) => ({ dow, hours })));
  }
  const rows = (location?.openingHours ?? [])
    .filter((h) => h.intervals.length > 0)
    .map((h) => ({ dow: h.dayOfWeek, hours: h.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") }));
  return openText(t, rows);
}
