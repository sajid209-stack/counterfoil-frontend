/* Reschedule requests — a counter asks to move a booking, a manager decides.

   Moving a booked slot used to be done on the spot by anyone at the till. For a
   cashier that is the wrong amount of power: the guest in front of them wants
   Saturday instead of Friday, but the lane or field they are asking for may be
   promised to somebody else, or the venue may not move bookings that close to
   the day. So a role set to "request" (see `counterAction` in lib/permissions)
   sends the move to a manager, who sees where it is going, checks the place is
   still free, and answers.

   Modelled on refundRequests.ts, and meant to be read beside it:
   1. **One open request per booking.** Two pending moves for one booking is a
      queue where the second approval undoes the first.
   2. **Availability is checked twice** — when the counter asks, and again when
      the manager approves, because the hour that was free at nine can be sold by
      noon. Both ask `moveAvailability`, the one question, and it is built on the
      same engine the direct move uses (`isResourceFreeFor` for a lane, field or
      court; `getSlots` for a show or tour).
   3. **Nothing moves until it is approved.** The booking keeps its place on the
      board, marked as having a move asked.

   Contract for the backend lane: RescheduleRequest, RescheduleReason, and the
   calls below. */
import { useSyncExternalStore } from "react";
import { createResource, fail, ok, validationError } from "./client";
import { peekBookings, rescheduleBooking } from "./bookings";
import { bookingEditable } from "./holds";
import { logOrderAction, peekOrders } from "./orders";
import { peekProducts } from "./products";
import { pendingRefundFor } from "./refundRequests";
import { getSlots, isOpenOn, isResourceFreeFor } from "./slots";
import { DEMO_NOW_MINUTES, DEMO_TODAY, toMinutes } from "@/lib/schedule";
import type { ApiResult, Booking, ID, ISODateTime } from "./types";

export type RescheduleReason = "customer_asked" | "weather" | "venue_problem" | "double_booked" | "other";
export const RESCHEDULE_REASONS: RescheduleReason[] = ["customer_asked", "weather", "venue_problem", "double_booked", "other"];
export type RescheduleRequestStatus = "pending" | "approved" | "declined";

export interface RescheduleRequest {
  id: ID;
  orderId: ID;
  orderReference: string;
  bookingId: ID;
  productName: string;
  /** The field, lane or court, when the booking has one. */
  place?: string | null;
  /** Where the booking is now. */
  fromStart: ISODateTime;
  fromEnd?: ISODateTime | null;
  /** Where the counter wants it to go. */
  toStart: ISODateTime;
  toEnd?: ISODateTime | null;
  customerName?: string | null;
  partySize?: number;
  /** Optional: a counter in a queue should not have to explain a plain move. */
  reason?: RescheduleReason | null;
  note?: string | null;
  requestedBy: string;
  requestedAt: ISODateTime;
  status: RescheduleRequestStatus;
  decidedBy?: string | null;
  decidedAt?: ISODateTime | null;
  decisionNote?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const requests = createResource<RescheduleRequest>("rescheduleRequests", "Move request", {});

/* A request changes what several screens that never talk to each other show —
   the board’s "Move asked" mark, the booked-slot sheet, Check-in’s row, the
   manager’s queue — so they subscribe here rather than each being handed a
   reload by whoever happened to make the change. */
let version = 0;
const listeners = new Set<() => void>();
const touch = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
/** Re-renders the caller whenever any move request is made or answered. */
export const useRescheduleVersion = (): number => useSyncExternalStore(subscribe, () => version, () => 0);

const dateOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => iso.slice(11, 16);
const minutesBetween = (a: string, b: string) => Math.max(15, toMinutes(timeOf(b)) - toMinutes(timeOf(a)));

const bookingOf = (bookingId: string): Booking | undefined => peekBookings().find((b) => b.id === bookingId);
const alreadyDecided = () => fail<RescheduleRequest>(validationError({ status: "This request has already been decided." }, "This request has already been decided."));

/**
 * Is this booking free to go to this day and time?
 *
 * The one availability question a move asks — by the counter when it asks, by
 * the manager when they answer. It is the same engine the Schedule's direct
 * move reads: a lane, field or court has to be free for the WHOLE span (with
 * its changeover gap, leaving the booking itself out of its own reckoning), and
 * a show or tour needs a departure at that time with room for the party.
 * Returns the reason in words when it is not.
 */
export function moveAvailability(bookingId: string, toStart: ISODateTime, toEnd?: ISODateTime | null): { ok: true } | { ok: false; reason: string } {
  const booking = bookingOf(bookingId);
  if (!booking || booking.status !== "confirmed") return { ok: false, reason: "This booking is not active, so it cannot be moved." };
  const product = peekProducts().find((p) => p.id === booking.productId);
  if (!product || !product.schedule) return { ok: false, reason: "This booking has no times to move between." };
  const date = dateOf(toStart);
  const time = timeOf(toStart);
  if (date === dateOf(booking.slotStart) && time === timeOf(booking.slotStart)) {
    return { ok: false, reason: "That is the time it already has. Pick another." };
  }
  // A booking cannot be moved to an hour that has already started.
  if (date < DEMO_TODAY || (date === DEMO_TODAY && toMinutes(time) < DEMO_NOW_MINUTES)) {
    return { ok: false, reason: "That time has already passed. Pick a later one." };
  }
  if (!isOpenOn(product, date)) return { ok: false, reason: "Closed that day. Pick another." };
  if (booking.resourceId) {
    const minutes = toEnd ? minutesBetween(toStart, toEnd) : booking.slotEnd ? minutesBetween(booking.slotStart, booking.slotEnd) : 60;
    if (!isResourceFreeFor(booking.resourceId, date, time, minutes, product.bufferMinutes ?? 0, booking.id)) {
      return { ok: false, reason: "That place is taken at that time. Pick another." };
    }
    return { ok: true };
  }
  const slot = getSlots(product, date).find((s) => s.time === time);
  if (!slot) return { ok: false, reason: "There is no departure at that time." };
  if (slot.remaining < booking.partySize) return { ok: false, reason: "There is not enough room at that time." };
  return { ok: true };
}

/** The open request for a booking, if there is one. */
export const pendingRescheduleFor = (bookingId: string): RescheduleRequest | null =>
  requests.peek().find((r) => r.bookingId === bookingId && r.status === "pending") ?? null;

/** Every request on an order, newest first. */
export const rescheduleRequestsForOrder = (orderId: string): RescheduleRequest[] =>
  requests
    .peek()
    .filter((r) => r.orderId === orderId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

/** Every request still waiting for a manager, oldest first — the queue. A
 *  request for a booking that has since gone (a refund cancelled it) is not a
 *  question anyone can answer any more, so it is not listed. */
export const pendingRescheduleRequests = (): RescheduleRequest[] => {
  const live = new Set(peekBookings().filter((b) => b.status === "confirmed").map((b) => b.id));
  return requests
    .peek()
    .filter((r) => r.status === "pending" && live.has(r.bookingId))
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
};

export async function requestReschedule(input: {
  bookingId: string;
  /** Where it should go. `toEnd` keeps the length the booking has. */
  toStart: ISODateTime;
  toEnd?: ISODateTime | null;
  reason?: RescheduleReason | null;
  note?: string;
  requestedBy: string;
  place?: string | null;
}): Promise<ApiResult<RescheduleRequest>> {
  const booking = bookingOf(input.bookingId);
  if (!booking || booking.status !== "confirmed") {
    return fail(validationError({ booking: "This booking is not active, so it cannot be moved." }, "This booking is not active, so it cannot be moved."));
  }
  if (pendingRescheduleFor(booking.id)) {
    return fail(validationError({ booking: "A move for this booking is already waiting for a manager." }, "A move for this booking is already waiting for a manager."));
  }
  if (pendingRefundFor(booking.id)) {
    return fail(validationError({ booking: "A refund for this booking is waiting for a manager. Wait for the answer first." }, "A refund for this booking is waiting for a manager. Wait for the answer first."));
  }
  if (input.reason === "other" && !input.note?.trim()) {
    return fail(validationError({ note: "Say why, so the manager can decide." }, "Say why, so the manager can decide."));
  }
  const free = moveAvailability(booking.id, input.toStart, input.toEnd);
  if (!free.ok) return fail(validationError({ toStart: free.reason }, free.reason));
  const order = peekOrders().find((o) => o.id === booking.orderId);
  const product = peekProducts().find((p) => p.id === booking.productId);
  const now = new Date().toISOString();
  const created = requests.insert({
    orderId: booking.orderId,
    orderReference: order?.reference ?? booking.orderId,
    bookingId: booking.id,
    productName: product?.name ?? "Booking",
    place: input.place ?? null,
    fromStart: booking.slotStart,
    fromEnd: booking.slotEnd ?? null,
    toStart: input.toStart,
    toEnd: input.toEnd ?? null,
    customerName: order?.customerName ?? null,
    partySize: booking.partySize,
    reason: input.reason ?? null,
    note: input.note?.trim() || null,
    requestedBy: input.requestedBy,
    requestedAt: now,
    status: "pending",
  } as Omit<RescheduleRequest, "id">);
  touch();
  return ok(created);
}

/** Approve: check the place is still free, then move the booking. */
export async function approveRescheduleRequest(id: string, who: string): Promise<ApiResult<RescheduleRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") return alreadyDecided();
  const edit = bookingEditable(req.bookingId, who);
  if (!edit.editable) return fail(validationError({ booking: edit.reason }, edit.reason));
  // Re-checked now: the hour that was free when the counter asked may not be.
  const free = moveAvailability(req.bookingId, req.toStart, req.toEnd);
  if (!free.ok) return fail(validationError({ toStart: free.reason }, free.reason));
  const moved = await rescheduleBooking(req.bookingId, req.toStart, req.toEnd ?? undefined);
  if (!moved.ok) return moved as unknown as ApiResult<RescheduleRequest>;
  await logOrderAction(
    req.orderId,
    `Moved ${req.productName} from ${dateOf(req.fromStart)} ${timeOf(req.fromStart)} to ${dateOf(req.toStart)} ${timeOf(req.toStart)} (asked by ${req.requestedBy})`,
    who,
  );
  const done = await requests.update(id, { status: "approved", decidedBy: who, decidedAt: new Date().toISOString() });
  touch();
  return done;
}

/** Decline, with a reason the counter can read back to the guest. */
export async function declineRescheduleRequest(id: string, who: string, note: string): Promise<ApiResult<RescheduleRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") return alreadyDecided();
  if (!note.trim()) return fail(validationError({ note: "Say why, so the counter can tell the guest." }, "Say why, so the counter can tell the guest."));
  const done = await requests.update(id, { status: "declined", decidedBy: who, decidedAt: new Date().toISOString(), decisionNote: note.trim() });
  touch();
  return done;
}

/** Take back a request that has not been decided yet. */
export async function withdrawRescheduleRequest(id: string): Promise<ApiResult<RescheduleRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") return alreadyDecided();
  const done = await requests.update(id, { status: "declined", decidedBy: req.requestedBy, decidedAt: new Date().toISOString(), decisionNote: "Withdrawn by the counter" });
  touch();
  return done;
}
