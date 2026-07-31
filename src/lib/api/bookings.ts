import { createResource } from "./client";
import type { ApiResult, Booking, ListParams, ListResponse } from "./types";

const resource = createResource<Booking>("bookings", "Booking", {
  filter: (b, f) => {
    if (f.status && b.status !== f.status) return false;
    if (f.locationId && b.locationId !== f.locationId) return false;
    if (f.productId && b.productId !== f.productId) return false;
    return true;
  },
  sort: { slotStart: (a, b) => a.slotStart.localeCompare(b.slotStart) },
  defaultSort: "slotStart",
});

export const listBookings = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Booking>>> => resource.list(params);

/** All bookings, unpaginated — for the calendar view and slot availability. */
export const peekBookings = (): Booking[] => resource.peek();

/** Record a (possibly partial) group check-in at the gate. */
export const checkInBooking = (id: string, count: number): Promise<ApiResult<Booking>> =>
  resource.update(id, { checkedIn: count });

/** Extend a resource booking in place (the lane behind must be free). */
export const extendBooking = (id: string, slotEnd: string): Promise<ApiResult<Booking>> =>
  resource.update(id, { slotEnd });

/** Create a confirmed booking (used by POS checkout to hold slot capacity). */
export function createBooking(input: {
  orderId: string;
  productId: string;
  locationId: string;
  resourceId?: string | null;
  slotStart: string;
  slotEnd?: string;
  partySize: number;
}): Promise<ApiResult<Booking>> {
  return resource.create({ ...input, status: "confirmed" });
}
