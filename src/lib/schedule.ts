import type { BookingTypeCode, ProductSchedule } from "@/lib/api/types";

/** ISO for a slot start on a given local date + "HH:MM" (Dhaka offset). */
/* The demo's "today". Every seeded order, booking and hold is built around
   this date, so the whole app has to agree on it — two components each holding
   their own copy is how a hold ends up in a different month from the schedule
   it is meant to block. Replacing the mock with a real backend means deleting
   this and using the actual date. */
export const DEMO_TODAY = "2026-07-29";

/** N days from the demo's today, as an ISO date. */
export const demoDay = (offset: number): string => {
  const d = new Date(`${DEMO_TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

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
