import { slotISO, slotTimes } from "@/lib/schedule";
import { peekBookings } from "./bookings";
import type { Product } from "./types";

export interface SlotAvailability {
  time: string;
  capacity: number;
  sold: number;
  remaining: number;
}

const confirmedFor = (productId: string, date: string) =>
  peekBookings().filter((b) => b.productId === productId && b.status === "confirmed" && b.slotStart.slice(0, 10) === date);

/** Per-slot availability for a slot-based product on a date. Empty for
 *  products without slot capacity (open, date-range, daily-capped). */
export function getSlots(product: Product, date: string): SlotAvailability[] {
  const sch = product.schedule;
  if (!sch || sch.capacityPerSession <= 0) return [];
  const booked = confirmedFor(product.id, date);
  return slotTimes(sch).map((time) => {
    const iso = slotISO(date, time);
    const sold = booked.filter((b) => b.slotStart === iso).reduce((s, b) => s + b.partySize, 0);
    return { time, capacity: sch.capacityPerSession, sold, remaining: Math.max(0, sch.capacityPerSession - sold) };
  });
}

/** Remaining for a daily-capped product on a date (Infinity if uncapped). */
export function getDailyRemaining(product: Product, date: string): number {
  const sch = product.schedule;
  if (!sch || sch.dailyCapacity == null) return Infinity;
  const sold = confirmedFor(product.id, date).reduce((s, b) => s + b.partySize, 0);
  return Math.max(0, sch.dailyCapacity - sold);
}

/** Is the product open on this date (open day, not a closed exception)? */
export function isOpenOn(product: Product, date: string): boolean {
  const sch = product.schedule;
  if (!sch) return true;
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return sch.openDays.includes(dow) && !sch.exceptions.some((e) => e.date === date && e.kind === "closed");
}
