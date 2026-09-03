import { getDailyRemaining, getResourceMatrix, getSlots } from "@/lib/api/slots";
import { isOwnerFree } from "@/lib/api/slots";
import { isResourceType, isSlotBased, needsSchedule, toMinutes } from "@/lib/schedule";
import type { Product, Resource, Staff } from "@/lib/api";

/** What the till can say about a product WITHOUT being tapped.
 *
 *  The counterfoil-pos reference does not show one product list per vertical —
 *  it lands each vertical on the operational state that vertical is actually
 *  run by. Bowling opens on lanes with their booking counts; laser tag on the
 *  next arena session and its spots; a batting facility on live cage occupancy;
 *  a water park on how many of today's 500 are left. Counterfoil showed the
 *  same generic name/subtitle/price row for all of them and put every one of
 *  those numbers behind a tap.
 *
 *  It never needed new data. getSlots, getDailyRemaining and getResourceMatrix
 *  already compute all of it — they were only being asked at sheet-open time.
 *  This asks them at list time and states the answer per booking type, which is
 *  the one change that lifts every vertical at once rather than fifteen
 *  bespoke screens.
 *
 *  `tone` is read off the RULE that produced the line, never guessed from its
 *  wording — the same discipline the dashboard's notices use. */
export type PosLiveState = {
  text: string;
  tone: "ok" | "low" | "none";
};

/** Words come from the caller so this stays translatable; it decides WHICH
 *  question to answer, not how to phrase it. */
export type PosStateWords = {
  soldOutToday: string;
  leftOfTotal: (left: number, total: number) => string;
  nextAt: (time: string, left: number) => string;
  noneLeftToday: string;
  freeOfTotal: (free: number, total: number) => string;
  busyNow: string;
  startsOn: (date: string) => string;
  providersFree: (free: number, total: number) => string;
};

/** Under a fifth of capacity is the app's existing low-availability threshold
 *  (Lovable findings, 2026-08-01) — reused rather than invented here. */
const LOW = (left: number, total: number) => total > 0 && left <= Math.max(1, Math.floor(total * 0.2));

export function posLiveState(
  product: Product,
  date: string,
  nowMinutes: number,
  w: PosStateWords,
  ctx: { resources?: Resource[]; team?: Staff[] } = {},
): PosLiveState | null {
  // A resource product is run by its resources: how many are free right now is
  // the question a counter asks, not how many places exist in the abstract.
  if (isResourceType(product.bookingType)) {
    const rows = getResourceMatrix(product, date);
    if (!rows.length) return null;
    // Free = has any bookable slot left from now on. A lane fully booked for
    // the rest of the day is not free even though it has slots.
    const free = rows.filter((r) => r.slots.some((s) => s.available && toMinutes(s.time) >= nowMinutes)).length;
    if (free === 0) return { text: w.busyNow, tone: "none" };
    return { text: w.freeOfTotal(free, rows.length), tone: LOW(free, rows.length) ? "low" : "ok" };
  }

  // A session product is run by its next departure. "12 left today" spread
  // across eight shows is not actionable; "next 14:00 · 12 left" is.
  if (isSlotBased(product.bookingType)) {
    const slots = getSlots(product, date).filter((s) => toMinutes(s.time) >= nowMinutes);
    const open = slots.filter((s) => s.remaining > 0);
    if (!slots.length) return null;
    if (!open.length) return { text: w.soldOutToday, tone: "none" };
    const next = open[0];
    return { text: w.nextAt(next.time, next.remaining), tone: LOW(next.remaining, next.capacity) ? "low" : "ok" };
  }

  // A capped product is run by the day's allowance.
  if (needsSchedule(product.bookingType) || product.schedule?.dailyCapacity) {
    const total = product.schedule?.dailyCapacity ?? 0;
    if (total > 0) {
      const left = getDailyRemaining(product, date);
      if (left <= 0) return { text: w.noneLeftToday, tone: "none" };
      return { text: w.leftOfTotal(left, total), tone: LOW(left, total) ? "low" : "ok" };
    }
  }

  // A provider product (a spa, a clinic) is run by who is free. The count is
  // taken at the next appointment slot rather than "now", because a therapist
  // mid-treatment is not bookable now but is the one you book next.
  const providerIds = product.providerIds ?? [];
  if (providerIds.length) {
    const minutes = product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60;
    const step = product.schedule?.slotMinutes || 30;
    const next = Math.ceil(nowMinutes / step) * step;
    const free = providerIds.filter((id) => isOwnerFree(id, date, `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`, minutes)).length;
    if (free === 0) return { text: w.busyNow, tone: "none" };
    return { text: w.providersFree(free, providerIds.length), tone: LOW(free, providerIds.length) ? "low" : "ok" };
  }

  // A course is run by when it starts.
  const first = product.courseDates?.length ? [...product.courseDates].sort()[0] : null;
  if (first) return { text: w.startsOn(first), tone: "ok" };

  // Open entry and date-range passes have no capacity to report, and inventing
  // one would be worse than the silence. The behaviour subtitle already says
  // what they are.
  //
  // Seat-mapped products (a cinema with a layout) are the one shape still
  // silent here. Their remaining seats come from availableSeats(), which is
  // ASYNC — it cannot be answered inside a render-time deriver, and firing one
  // request per tile to fill a subtitle would be the wrong trade. It wants the
  // POS page to prefetch layouts for the visible catalogue and pass the counts
  // in; that is a real piece of work, not a line, so it is named rather than
  // faked.
  return null;
}
