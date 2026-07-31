import { slotISO, slotTimesOn, toMinutes } from "@/lib/schedule";
import { peekBookings } from "./bookings";
import { peekResources } from "./resources";
import type { Product, Resource } from "./types";

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
  return slotTimesOn(sch, date).map((time) => {
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

export interface ResourceSlotCell {
  time: string;
  available: boolean;
  remaining: number; // seats (shared) or 0/1 (exclusive)
}
export interface ResourceRow {
  resource: Resource;
  slots: ResourceSlotCell[];
}

/** The fields × times matrix for a resource product on a date.
 *  Availability is computed PER RESOURCE across EVERY product attached to it —
 *  a booking on Field 1 at 18:00 (from any product) blocks Field 1 at 18:00
 *  here too. Buffer time is respected for exclusive resources. */
export function getResourceMatrix(product: Product, date: string): ResourceRow[] {
  const sch = product.schedule;
  if (!sch) return [];
  const ids = product.resourceIds ?? [];
  const resources = peekResources().filter((r) => ids.includes(r.id) && r.status !== "archived");
  const times = slotTimesOn(sch, date);
  const exclusive = product.resourceExclusive !== false;
  const capPerSlot = exclusive ? 1 : sch.capacityPerSession || 1;
  const session = sch.sessionMinutes || sch.slotMinutes || 60;
  const buffer = product.bufferMinutes ?? 0;

  // All confirmed resource bookings on this date, across all products.
  const dayBookings = peekBookings().filter(
    (b) => b.status === "confirmed" && b.resourceId && b.slotStart.slice(0, 10) === date,
  );

  return resources.map((r) => ({
    resource: r,
    slots: times.map((time) => {
      if (r.outOfService) return { time, available: false, remaining: 0 };
      const slotMin = toMinutes(time);
      const onResource = dayBookings.filter((b) => b.resourceId === r.id);
      if (exclusive) {
        // Blocked if any booking's [start, start+session+buffer) overlaps this slot's span.
        const blocked = onResource.some((b) => {
          const bStart = toMinutes(b.slotStart.slice(11, 16));
          return slotMin < bStart + session + buffer && bStart < slotMin + session + buffer;
        });
        return { time, available: !blocked, remaining: blocked ? 0 : 1 };
      }
      const booked = onResource
        .filter((b) => b.slotStart === slotISO(date, time))
        .reduce((s, b) => s + b.partySize, 0);
      const remaining = Math.max(0, capPerSlot - booked);
      return { time, available: remaining > 0, remaining };
    }),
  }));
}

/* ── Capacity owners — ONE conflict mechanism for fields, lanes, guides and
   providers. A booking's `resourceId` names whichever owner it occupies (a
   Resource id OR a Staff id); busy spans are computed across every product. */

export interface BusySpan {
  start: number; // minutes from midnight
  end: number;
}

/** All confirmed busy spans for a capacity owner on a date, across products. */
export function ownerBusy(ownerId: string, date: string): BusySpan[] {
  return peekBookings()
    .filter((b) => b.status === "confirmed" && b.resourceId === ownerId && b.slotStart.slice(0, 10) === date)
    .map((b) => {
      const start = toMinutes(b.slotStart.slice(11, 16));
      const end = b.slotEnd ? toMinutes(b.slotEnd.slice(11, 16)) : start + 60;
      return { start, end };
    });
}

/** Is this owner free for [time, time + minutes) on the date? */
export function isOwnerFree(ownerId: string, date: string, time: string, minutes: number): boolean {
  const start = toMinutes(time);
  const end = start + minutes;
  return !ownerBusy(ownerId, date).some((b) => start < b.end && b.start < end);
}

/** Guides free to lead a product's session at this slot (BT-09). A guide on
 *  the 10:00 walking tour is unavailable to every other 10:00 departure. */
export function freeGuides(product: Product, date: string, time: string): string[] {
  const sch = product.schedule;
  if (!sch || sch.guideIds.length === 0) return [];
  const minutes = sch.sessionMinutes || sch.slotMinutes || 60;
  return sch.guideIds.filter((g) => isOwnerFree(g, date, time, minutes));
}

/** Is the product open on this date (open day, not a closed exception)? */
export function isOpenOn(product: Product, date: string): boolean {
  const sch = product.schedule;
  if (!sch) return true;
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return sch.openDays.includes(dow) && !sch.exceptions.some((e) => e.date === date && e.kind === "closed");
}
