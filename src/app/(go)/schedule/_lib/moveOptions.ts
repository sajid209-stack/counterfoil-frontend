import { getSlots, isOpenOn, isResourceFreeFor } from "@/lib/api/slots";
import { slotTimesOn } from "@/lib/schedule";
import type { Product } from "@/lib/api";

export interface MoveTime {
  time: string;
  /** Free to move into. */
  free: boolean;
  /** Where the booking already is — shown, never chosen. */
  isNow: boolean;
}

/** Times a resource booking (a field, a lane, a court) could move to on this
 *  date, on the SAME place it is already on. The booking being moved is left
 *  out of its own reckoning, or every time it already fills would read as
 *  taken. */
export function resourceMoveTimes(args: {
  product: Product;
  resourceId: string;
  date: string;
  durationMinutes: number;
  bufferMinutes: number;
  excludeBookingId: string;
  nowDate: string;
  nowTime: string;
}): MoveTime[] {
  const { product, resourceId, date, durationMinutes, bufferMinutes, excludeBookingId, nowDate, nowTime } = args;
  if (!product.schedule || !isOpenOn(product, date)) return [];
  return slotTimesOn(product.schedule, date).map((time) => ({
    time,
    isNow: date === nowDate && time === nowTime,
    free:
      (date === nowDate && time === nowTime) ||
      isResourceFreeFor(resourceId, date, time, durationMinutes, bufferMinutes, excludeBookingId),
  }));
}

/** Times a slot-based booking (a tour, a show) could move to on this date —
 *  any departure with room for the same party size. */
export function sessionMoveTimes(args: {
  product: Product;
  date: string;
  partySize: number;
  nowDate: string;
  nowTime: string;
}): MoveTime[] {
  const { product, date, partySize, nowDate, nowTime } = args;
  return getSlots(product, date).map((s) => ({
    time: s.time,
    isNow: date === nowDate && s.time === nowTime,
    free: (date === nowDate && s.time === nowTime) || s.remaining >= partySize,
  }));
}
