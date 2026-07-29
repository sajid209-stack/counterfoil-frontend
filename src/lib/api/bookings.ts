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

/** All bookings, unpaginated — for the calendar view. */
export const peekBookings = (): Booking[] => resource.peek();
