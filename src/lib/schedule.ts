import type { BookingTypeCode, ProductSchedule } from "@/lib/api/types";

/** ISO for a slot start on a given local date + "HH:MM" (Dhaka offset). */
/** Dhaka's wall clock, wherever the browser or server happens to be: the seed
 *  and every slot in the app are written at +06:00. */
const dhaka = (at: Date): { date: string; minutes: number } => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
};

/* Today, the real one, as of this page load. The whole app reads it from here so
   it has to agree: two components each holding their own copy is how a hold ends
   up in a different month from the schedule it is meant to block. A tab left open
   past midnight keeps its day until it is reloaded, because the store's "today"
   was built for that day. Replacing the mock with a real backend leaves this. */
export const DEMO_TODAY = dhaka(new Date()).date;

/** The time now, in minutes past midnight. A live binding: it keeps moving while the page is open. */
export let DEMO_NOW_MINUTES = dhaka(new Date()).minutes;
if (typeof window !== "undefined") {
  setInterval(() => {
    DEMO_NOW_MINUTES = dhaka(new Date()).minutes;
  }, 30_000);
}
export const demoNow = (): Date => new Date();

/* The day the seed was written around. Its orders, bookings and holds are all
   dated relative to this, and are moved to the real today as they load (see
   `rebaseSeed`), so the demo never goes stale: there are always sales today. */
const SEED_TODAY = "2026-07-29";
const addDays = (date: string, offset: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const SEED_SHIFT_DAYS = Math.round((Date.parse(`${DEMO_TODAY}T00:00:00Z`) - Date.parse(`${SEED_TODAY}T00:00:00Z`)) / 86_400_000);

/** N days from the seed's today. For the seed only: it is moved afterwards, with everything else. */
export const seedDay = (offset: number): string => addDays(SEED_TODAY, offset);

const DATED = /^\d{4}-\d{2}-\d{2}(?=$|T)/;
/** One date or timestamp written against the seed's today, moved to the real one. Its time of day stays. */
export const fromSeedDate = (value: string): string => value.replace(DATED, (d) => addDays(d, SEED_SHIFT_DAYS));

const latestDate = (value: unknown): string => {
  if (typeof value === "string") return DATED.test(value) ? value.slice(0, 10) : "";
  if (!value || typeof value !== "object") return "";
  return Object.values(value).reduce<string>((best, v) => {
    const d = latestDate(v);
    return d > best ? d : best;
  }, "");
};
const moved = (value: unknown): unknown => {
  if (typeof value === "string") return fromSeedDate(value);
  if (Array.isArray(value)) return value.map(moved);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, moved(v)]));
  return value;
};
/** A record is moved whole so its dates stay in order. One still ahead of today (an
 *  event in December, a season that has not begun) already makes sense, and stays. */
const rebaseRecord = (row: unknown): unknown => (latestDate(row) > DEMO_TODAY ? row : moved(row));

/** Every record in a seed module (or a generated batch), moved to the real today. */
export function rebaseSeed<T extends object>(seed: T): T {
  return Object.fromEntries(
    Object.entries(seed).map(([k, v]) => [k, Array.isArray(v) ? v.map(rebaseRecord) : v && typeof v === "object" ? rebaseRecord(v) : v]),
  ) as T;
}

/** N days from today, as an ISO date. */
export const demoDay = (offset: number): string => addDays(DEMO_TODAY, offset);

export const slotISO = (date: string, time: string) => `${date}T${time}:00+06:00`;

// Which booking types carry a schedule, and of which kind.
export const isResourceType = (bt: BookingTypeCode) => bt === "BT-04" || bt === "BT-05";
export const isFlexibleResource = (bt: BookingTypeCode) => bt === "BT-05";
// Fixed-slot timing: standard slots (03/09) and exclusive resource slots (04).
export const isSlotBased = (bt: BookingTypeCode) => bt === "BT-03" || bt === "BT-09" || bt === "BT-04";
export const isDailyCapped = (bt: BookingTypeCode) => bt === "BT-06";
export const needsSchedule = (bt: BookingTypeCode) =>
  isSlotBased(bt) || isDailyCapped(bt) || isFlexibleResource(bt);
export const isGuided = (bt: BookingTypeCode) => bt === "BT-09";

/** Every kind sold as a time slot against something that has to be made
 *  ready again before the next booking — a field, court or lane; a timed
 *  session or show; a guided tour; an appointment with a person. NOT open
 *  entry, a date pass, a daily cap, a course, a bundle or a credits pack —
 *  none of those hold a span of time against one thing that needs clearing. */
export const usesBuffer = (bt: BookingTypeCode) => isSlotBased(bt) || isFlexibleResource(bt) || bt === "BT-10";

const pad = (n: number) => String(n).padStart(2, "0");
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** All session start times for a slot-based schedule (start → end inclusive). */
export function slotTimes(schedule: ProductSchedule): string[] {
  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);
  const step = schedule.slotMinutes || 30;
  if (end < start || step <= 0) return [];
  const out: string[] = [];
  for (let m = start; m <= end; m += step) out.push(toTime(m));
  return out;
}

export const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Session start times on a CONCRETE date — applies that weekday's hours
 *  override (Fri 14:00–23:00 while other days run the base hours). */
export function slotTimesOn(schedule: ProductSchedule, date: string): string[] {
  const o = schedule.dayOverrides?.[dowOf(date)];
  return slotTimes(o ? { ...schedule, startTime: o.startTime, endTime: o.endTime } : schedule);
}

export function defaultSchedule(bt: BookingTypeCode): ProductSchedule {
  const resource = isResourceType(bt);
  return {
    slotMinutes: resource ? 60 : 30,
    sessionMinutes: resource ? 60 : 45,
    startTime: resource ? "06:00" : "10:00",
    endTime: resource ? "23:00" : "17:00",
    // For exclusive resource slots capacity is 1 per resource; shared/other set below.
    capacityPerSession: bt === "BT-04" ? 1 : isSlotBased(bt) ? 20 : 0,
    dailyCapacity: isDailyCapped(bt) ? 200 : null,
    openDays: resource ? [0, 1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 0],
    guideIds: [],
    exceptions: [],
  };
}

/** How hard a session is selling. Absolute thresholds, not a percentage: four
 *  seats left is four seats left whether the room holds fifteen or four
 *  hundred, and it is the count a counter decides on. The 20% clause keeps a
 *  small room warning in time.
 *
 *  Lived in SessionList until the Go Schedule needed the same answer. A second
 *  copy is how two screens start disagreeing about what "low" means. */
export type SessionPressure = "gone" | "critical" | "low" | "fine";
export function sessionPressure(left: number, capacity: number): SessionPressure {
  if (left <= 0) return "gone";
  if (left <= 4) return "critical";
  if (left <= 10 || left <= Math.max(1, Math.floor(capacity * 0.2))) return "low";
  return "fine";
}
