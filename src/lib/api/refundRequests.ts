/* Refund requests — a counter asks, a manager decides.

   A cashier at the till can see the guest in front of them and the booking
   they want their money back for; they usually cannot give money back on
   their own say-so. So a refund from the counter is a REQUEST: it names the
   booking, the amount (what was paid for that booking's lines) and why, and it
   waits. A manager approves it — which refunds those order lines through the
   one refund path the rest of the product uses, and cancels the booking so its
   place goes back on sale — or declines it with a reason the counter can read
   back to the guest.

   Two rules:
   1. **One open request per booking.** Asking twice for the same booking is a
      queue that pays out twice once somebody approves both.
   2. **The amount is worked out, never typed.** It is what the booking's own
      order lines still hold after any earlier refund, so a request can never
      ask for more than was paid for that booking.

   Contract for the backend lane: RefundRequest, RefundReason, and the five
   calls below. */
import { createResource, fail, ok, validationError } from "./client";
import { cancelBooking, peekBookings } from "./bookings";
import { peekOrders, refundOrderLines } from "./orders";
import type { ApiResult, Booking, ID, ISODateTime, Minor, Order, OrderLine } from "./types";

export type RefundReason = "customer_cancelled" | "weather" | "venue_problem" | "double_booked" | "other";
export const REFUND_REASONS: RefundReason[] = ["customer_cancelled", "weather", "venue_problem", "double_booked", "other"];
export type RefundRequestStatus = "pending" | "approved" | "declined";

export interface RefundRequest {
  id: ID;
  orderId: ID;
  orderReference: string;
  bookingId: ID;
  /** The order lines this refund gives back — the booking's own lines and
   *  any extras sold on them. */
  lineIds: ID[];
  productName: string;
  /** The field, lane or court, when the booking has one. */
  place?: string | null;
  /** When the booking is for — "2026-07-29T19:00:00+06:00". */
  slotStart: ISODateTime;
  slotEnd?: ISODateTime | null;
  customerName?: string | null;
  amount: Minor;
  reason: RefundReason;
  note?: string | null;
  requestedBy: string;
  requestedAt: ISODateTime;
  status: RefundRequestStatus;
  decidedBy?: string | null;
  decidedAt?: ISODateTime | null;
  decisionNote?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const requests = createResource<RefundRequest>("refundRequests", "Refund request", {});

const dateOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => iso.slice(11, 16);

/** The lines a booking was sold on: same booking, same day, same start, same
 *  place — and every extra hung off those lines. */
export function linesForBooking(order: Order, booking: Booking): OrderLine[] {
  const date = dateOf(booking.slotStart);
  const time = timeOf(booking.slotStart);
  const own = order.lines.filter(
    (l) =>
      !l.parentLineId &&
      l.productId === booking.productId &&
      (!l.booking ||
        (l.booking.date === date &&
          (!l.booking.startTime || l.booking.startTime === time) &&
          (!booking.resourceId || !l.booking.resourceId || l.booking.resourceId === booking.resourceId))),
  );
  const ids = new Set(own.map((l) => l.id));
  const extras = order.lines.filter((l) => l.parentLineId && ids.has(l.parentLineId));
  return [...own, ...extras];
}

const stillHeld = (lines: OrderLine[]) => lines.reduce((s, l) => s + Math.max(0, l.total - l.refundedAmount), 0);

/** What a refund of this booking would give back right now. */
export function refundableFor(bookingId: string): { order: Order; lines: OrderLine[]; amount: Minor } | null {
  const booking = peekBookings().find((b) => b.id === bookingId);
  if (!booking) return null;
  const order = peekOrders().find((o) => o.id === booking.orderId);
  if (!order) return null;
  const lines = linesForBooking(order, booking);
  return { order, lines, amount: stillHeld(lines) };
}

/** The open request for a booking, if there is one. */
export const pendingRefundFor = (bookingId: string): RefundRequest | null =>
  requests.peek().find((r) => r.bookingId === bookingId && r.status === "pending") ?? null;

/** Every request on an order, newest first. */
export const refundRequestsForOrder = (orderId: string): RefundRequest[] =>
  requests
    .peek()
    .filter((r) => r.orderId === orderId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

/** Every request still waiting for a manager, oldest first — the queue. */
export const pendingRefundRequests = (): RefundRequest[] =>
  requests
    .peek()
    .filter((r) => r.status === "pending")
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));

export async function requestRefund(input: {
  bookingId: string;
  reason: RefundReason;
  note?: string;
  requestedBy: string;
  place?: string | null;
}): Promise<ApiResult<RefundRequest>> {
  const booking = peekBookings().find((b) => b.id === input.bookingId);
  if (!booking || booking.status !== "confirmed") {
    return fail(validationError({ booking: "This booking is not active, so there is nothing to refund." }, "This booking is not active, so there is nothing to refund."));
  }
  if (pendingRefundFor(booking.id)) {
    return fail(validationError({ booking: "A refund for this booking is already waiting for a manager." }, "A refund for this booking is already waiting for a manager."));
  }
  if (input.reason === "other" && !input.note?.trim()) {
    return fail(validationError({ note: "Say why, so the manager can decide." }, "Say why, so the manager can decide."));
  }
  const found = refundableFor(booking.id);
  if (!found || found.amount <= 0 || found.lines.length === 0) {
    return fail(validationError({ booking: "Nothing is left to refund on this booking." }, "Nothing is left to refund on this booking."));
  }
  const now = new Date().toISOString();
  const created = requests.insert({
    orderId: found.order.id,
    orderReference: found.order.reference,
    bookingId: booking.id,
    lineIds: found.lines.map((l) => l.id),
    productName: found.lines.find((l) => !l.parentLineId)?.productName ?? found.lines[0].productName,
    place: input.place ?? found.lines.find((l) => l.booking?.resourceName)?.booking?.resourceName ?? null,
    slotStart: booking.slotStart,
    slotEnd: booking.slotEnd ?? null,
    customerName: found.order.customerName ?? null,
    amount: found.amount,
    reason: input.reason,
    note: input.note?.trim() || null,
    requestedBy: input.requestedBy,
    requestedAt: now,
    status: "pending",
  } as Omit<RefundRequest, "id">);
  return ok(created);
}

/** Approve: give the money back on those lines and free the booking's place. */
export async function approveRefundRequest(id: string, who: string): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") {
    return fail(validationError({ status: "This request has already been decided." }, "This request has already been decided."));
  }
  const refunded = await refundOrderLines(req.orderId, req.lineIds, `Refund request from the counter (${req.reason.replace(/_/g, " ")})`, who);
  if (!refunded.ok) return refunded as unknown as ApiResult<RefundRequest>;
  await cancelBooking(req.bookingId);
  return requests.update(id, { status: "approved", decidedBy: who, decidedAt: new Date().toISOString() });
}

/** Decline, with a reason the counter can read back to the guest. */
export async function declineRefundRequest(id: string, who: string, note: string): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") {
    return fail(validationError({ status: "This request has already been decided." }, "This request has already been decided."));
  }
  if (!note.trim()) return fail(validationError({ note: "Say why, so the counter can tell the guest." }, "Say why, so the counter can tell the guest."));
  return requests.update(id, { status: "declined", decidedBy: who, decidedAt: new Date().toISOString(), decisionNote: note.trim() });
}

/** Take back a request that has not been decided yet. */
export async function withdrawRefundRequest(id: string): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (req.status !== "pending") return fail(validationError({ status: "This request has already been decided." }, "This request has already been decided."));
  return requests.update(id, { status: "declined", decidedBy: req.requestedBy, decidedAt: new Date().toISOString(), decisionNote: "Withdrawn by the counter" });
}
