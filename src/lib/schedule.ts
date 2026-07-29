import type { BookingTypeCode, ProductSchedule } from "@/lib/api/types";

/** ISO for a slot start on a given local date + "HH:MM" (Dhaka offset). */
export const slotISO = (date: string, time: string) => `${date}T${time}:00+06:00`;

// Which booking types carry a schedule, and of which kind.
export const isSlotBased = (bt: BookingTypeCode) => bt === "BT-03" || bt === "BT-09";
export const isDailyCapped = (bt: BookingTypeCode) => bt === "BT-06";
export const needsSchedule = (bt: BookingTypeCode) => isSlotBased(bt) || isDailyCapped(bt);
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

export function defaultSchedule(bt: BookingTypeCode): ProductSchedule {
  return {
    slotMinutes: 30,
    sessionMinutes: 45,
    startTime: "10:00",
    endTime: "17:00",
    capacityPerSession: isSlotBased(bt) ? 20 : 0,
    dailyCapacity: isDailyCapped(bt) ? 200 : null,
    openDays: [2, 3, 4, 5, 6, 0], // Tue–Sun
    guideIds: [],
    exceptions: [],
  };
}
