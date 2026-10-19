/* Refund requests — a counter asks, a manager decides.

   A cashier at the till can see the guest in front of them and the booking
   they want their money back for; they usually cannot give money back on
   their own say-so. So a refund from the counter is a REQUEST: it names the
   sale, what is being refunded, the amount and why, and it waits. A manager
   approves it — which gives the money back through the one refund path the
   rest of the product uses — or declines it with a reason the counter can read
   back to the guest. See docs/refunds.md.

   Three kinds (`scope`), because the counter meets three situations:
   - `booking`  cancel a booked slot: its lines are refunded in full, the
                booking is cancelled (its place goes back on sale) and its
                tickets are voided;
   - `tickets`  give back some tickets on an order (2 of 4 entry tickets):
                each ticket's share of its line, those tickets voided;
   - `goodwill` make up for something without cancelling anything: an amount,
                tickets stay valid.

   Rules:
   1. **One open request per booking** (and per order for goodwill/tickets on
      an order with no booking). Asking twice pays out twice.
   2. **The amount for `booking` and `tickets` is worked out, never typed** —
      what was paid for those lines or tickets, less earlier refunds. Only
      `goodwill` takes a typed amount, capped at what the sale still holds, and
      only goodwill may be approved for less.
   3. **Timing comes from Settings → Refunds & write-offs** (refundPolicy):
      the counter's window to ask, the respond-by time, and an optional
      auto-close (`expired`, derived on read — never stored).

   Contract for the backend lane: RefundRequest, RefundScope, RefundReason,
   RefundRequestStatus, and the calls below. */
import { useSyncExternalStore } from "react";
import { createResource, fail, ok, validationError } from "./client";
import { cancelBooking, peekBookings } from "./bookings";
import { orderNetPaid, peekOrders, refundOrderAmount, refundOrderLines, refundOrderTickets, ticketShares } from "./orders";
import { peekTickets } from "./tickets";
import { dueAtFor, isExpiredAt, peekRefundPolicy, type RefundMethod } from "./refundPolicy";
import { DEMO_NOW_MINUTES, DEMO_TODAY, toTime } from "@/lib/schedule";
import type { ApiResult, Booking, ID, ISODateTime, Minor, Order, OrderLine, PaymentMethod, Ticket } from "./types";

export type RefundReason = "customer_cancelled" | "weather" | "venue_problem" | "double_booked" | "other";
export const REFUND_REASONS: RefundReason[] = ["customer_cancelled", "weather", "venue_problem", "double_booked", "other"];
export type RefundScope = "booking" | "tickets" | "goodwill";
export const REFUND_SCOPES: RefundScope[] = ["booking", "tickets", "goodwill"];
/** Stored states. `expired` is derived on read — see `refundStatusOf`. */
export type RefundRequestStatus = "pending" | "approved" | "declined" | "withdrawn";
/** What a screen shows: the stored state, or `expired` for a pending request
 *  past the auto-close time. */
export type RefundDisplayStatus = RefundRequestStatus | "expired";

export interface RefundRequest {
  id: ID;
  /** What is being refunded. Absent on requests made before scopes existed:
   *  read as `booking`. */
  scope?: RefundScope;
  orderId: ID;
  orderReference: string;
  /** The venue of the sale — the list pages filter by it. */
  locationId?: ID;
  /** The booking, for `booking` (always) and for `tickets`/`goodwill` when the
   *  request was made from a booking. */
  bookingId?: ID | null;
  /** The order lines this refund gives back (`booking`): the booking's own
   *  lines and any extras sold on them. */
  lineIds: ID[];
  /** The tickets (`tickets`). */
  ticketIds?: ID[];
  productName: string;
  /** The field, lane or court, when the booking has one. */
  place?: string | null;
  /** When the booking is for — "2026-07-29T19:00:00+06:00". */
  slotStart?: ISODateTime | null;
  slotEnd?: ISODateTime | null;
  customerName?: string | null;
  /** What was asked for. */
  amount: Minor;
  /** What was approved — equals `amount` except for a goodwill refund a
   *  manager approved for less. */
  approvedAmount?: Minor | null;
  /** Where the money went back to, once approved. */
  refundMethod?: RefundMethod | null;
  reason: RefundReason;
  note?: string | null;
  requestedBy: string;
  requestedAt: ISODateTime;
  /** When a manager should have answered by (Settings → Refunds & write-offs). */
  dueAt?: ISODateTime | null;
  status: RefundRequestStatus;
  decidedBy?: string | null;
  decidedAt?: ISODateTime | null;
  decisionNote?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const requests = createResource<RefundRequest>("refundRequests", "Refund request", {});

/* Several screens that never talk to each other show a request — the board's
   "Refund asked" mark, the booked-slot sheet, Check-in's row, the manager's
   list and the menu badge — so they subscribe here. */
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
/** Re-renders the caller whenever any refund request is made or answered. */
export const useRefundVersion = (): number => useSyncExternalStore(subscribe, () => version, () => 0);

const dateOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => iso.slice(11, 16);
const decided = () => fail<RefundRequest>(validationError({ status: "This request has already been decided." }, "This request has already been decided."));
const refuse = <T,>(field: string, message: string) => fail<T>(validationError({ [field]: message }, message));

/** The scope of a stored request — older rows have none and are bookings. */
export const scopeOf = (r: Pick<RefundRequest, "scope">): RefundScope => r.scope ?? "booking";

/** The state a screen should show: pending past the auto-close time reads as
 *  `expired` (nothing is written — the rule can change and the read follows). */
export function refundStatusOf(r: RefundRequest, now = Date.now()): RefundDisplayStatus {
  if (r.status === "pending" && isExpiredAt(r.requestedAt, now)) return "expired";
  return r.status;
}

/** When the request should be answered by — stored, or worked out from the
 *  current policy for older rows. */
export const dueAtOf = (r: RefundRequest): ISODateTime => r.dueAt ?? dueAtFor(r.requestedAt);

/** Pending and past its respond-by time. */
export const isOverdue = (r: RefundRequest, now = Date.now()): boolean =>
  refundStatusOf(r, now) === "pending" && now > Date.parse(dueAtOf(r));

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
  // Capped at what the sale still holds: a part-paid booking gives back what was paid.
  return { order, lines, amount: Math.min(stillHeld(lines), Math.max(0, orderNetPaid(order))) };
}

/** The tickets on a booking's lines that could still be refunded (not used,
 *  not cancelled), each with what it would give back. */
export function refundableTickets(bookingId: string): { ticket: Ticket; amount: Minor }[] {
  const found = refundableFor(bookingId);
  if (!found) return [];
  const lineIds = new Set(found.lines.filter((l) => !l.parentLineId).map((l) => l.id));
  const productIds = new Set(found.lines.filter((l) => !l.parentLineId).map((l) => l.productId));
  const live = peekTickets().filter(
    (t) => t.orderId === found.order.id && t.status === "issued" && (t.lineId ? lineIds.has(t.lineId) : productIds.has(t.productId)),
  );
  const shares = new Map(ticketShares(found.order, live.map((t) => t.id)).map((s) => [s.ticketId, s.amount]));
  return live.filter((t) => shares.has(t.id)).map((t) => ({ ticket: t, amount: shares.get(t.id)! }));
}

/** The most a goodwill refund on this order may give back: what is held. */
export const goodwillMaxFor = (orderId: string): Minor => {
  const o = peekOrders().find((x) => x.id === orderId);
  return o ? Math.max(0, orderNetPaid(o)) : 0;
};

/** Everything the counter can offer on this booking, in one read. */
export function refundOptions(bookingId: string): {
  order: Order;
  booking: Booking;
  bookingAmount: Minor;
  tickets: { ticket: Ticket; amount: Minor }[];
  goodwillMax: Minor;
} | null {
  const booking = peekBookings().find((b) => b.id === bookingId);
  const found = refundableFor(bookingId);
  if (!booking || !found) return null;
  return {
    order: found.order,
    booking,
    bookingAmount: found.amount,
    tickets: refundableTickets(bookingId),
    goodwillMax: goodwillMaxFor(found.order.id),
  };
}

/** The demo's "now" at the counter — the clock the bookings are on. */
const counterNow = (): string => `${DEMO_TODAY}T${toTime(DEMO_NOW_MINUTES)}:00+06:00`;

/** May the counter still ask for a refund on this booking, under the policy?
 *  Returns the reason in words when it may not. */
export function canAskNow(bookingId: string, now: string = counterNow()): { ok: true } | { ok: false; reason: string } {
  const booking = peekBookings().find((b) => b.id === bookingId);
  if (!booking) return { ok: false, reason: "This booking cannot be found." };
  const window = peekRefundPolicy().counterWindow;
  if (window === "any_time") return { ok: true };
  const nowMs = Date.parse(now);
  if (window === "before_start" && nowMs >= Date.parse(booking.slotStart)) {
    return { ok: false, reason: "Refunds can only be asked for before the booking starts. A manager can still refund it from Orders." };
  }
  const end = booking.slotEnd ?? booking.slotStart;
  if (window === "until_end" && nowMs >= Date.parse(end)) {
    return { ok: false, reason: "Refunds can only be asked for until the booking ends. A manager can still refund it from Orders." };
  }
  return { ok: true };
}

const isOpen = (r: RefundRequest) => refundStatusOf(r) === "pending";

/** The stored rows, after the demo's requests have been made (once). */
const rows = (): RefundRequest[] => {
  seedDemoRefundRequests();
  return requests.peek();
};

/** The open request for a booking, if there is one. */
export const pendingRefundFor = (bookingId: string): RefundRequest | null =>
  rows().find((r) => r.bookingId === bookingId && isOpen(r)) ?? null;

/** The open request on an order, if there is one. */
export const pendingRefundForOrder = (orderId: string): RefundRequest | null =>
  rows().find((r) => r.orderId === orderId && isOpen(r)) ?? null;

/** Every request on an order, newest first. */
export const refundRequestsForOrder = (orderId: string): RefundRequest[] =>
  rows()
    .filter((r) => r.orderId === orderId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

/** Every request still waiting for a manager, oldest first — the queue. */
export const pendingRefundRequests = (locationId?: string): RefundRequest[] =>
  rows()
    .filter((r) => isOpen(r) && (!locationId || !r.locationId || r.locationId === locationId))
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));

export function getRefundRequest(id: string): RefundRequest | null {
  return rows().find((r) => r.id === id) ?? null;
}

/** The tabs on the Refunds page. `waiting` includes nothing expired. */
export type RefundListTab = "waiting" | "approved" | "declined" | "all";

export interface RefundListQuery {
  tab?: RefundListTab;
  q?: string;
  locationId?: string;
  reason?: RefundReason;
  scope?: RefundScope;
  requestedBy?: string;
}

/** The Refunds page's list. Waiting is oldest first (who has waited longest);
 *  every other tab newest first. Declined includes withdrawn and expired. */
export function listRefundRequests(query: RefundListQuery = {}): RefundRequest[] {
  const { tab = "all", q, locationId, reason, scope, requestedBy } = query;
  const needle = q?.trim().toLowerCase();
  const now = Date.now();
  const out = rows().filter((r) => {
    if (locationId && r.locationId && r.locationId !== locationId) return false;
    const st = refundStatusOf(r, now);
    if (tab === "waiting" && st !== "pending") return false;
    if (tab === "approved" && st !== "approved") return false;
    if (tab === "declined" && !(st === "declined" || st === "withdrawn" || st === "expired")) return false;
    if (reason && r.reason !== reason) return false;
    if (scope && scopeOf(r) !== scope) return false;
    if (requestedBy && r.requestedBy !== requestedBy) return false;
    if (needle) {
      const hay = [r.orderReference, r.customerName, r.productName, r.place, r.note, r.requestedBy, r.reason.replace(/_/g, " ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  return out.sort((a, b) =>
    tab === "waiting" ? Date.parse(a.requestedAt) - Date.parse(b.requestedAt) : Date.parse(b.requestedAt) - Date.parse(a.requestedAt),
  );
}

export interface RefundSummary {
  waiting: number;
  waitingAmount: Minor;
  overdue: number;
  approved: number;
  declined: number;
  all: number;
  /** Money given back through approved requests. */
  refundedAmount: Minor;
}

/** The figures the Refunds page and the menu badge read. */
export function refundSummary(locationId?: string): RefundSummary {
  const now = Date.now();
  const s: RefundSummary = { waiting: 0, waitingAmount: 0, overdue: 0, approved: 0, declined: 0, all: 0, refundedAmount: 0 };
  for (const r of rows()) {
    if (locationId && r.locationId && r.locationId !== locationId) continue;
    s.all += 1;
    const st = refundStatusOf(r, now);
    if (st === "pending") {
      s.waiting += 1;
      s.waitingAmount += r.amount;
      if (now > Date.parse(dueAtOf(r))) s.overdue += 1;
    } else if (st === "approved") {
      s.approved += 1;
      s.refundedAmount += r.approvedAmount ?? r.amount;
    } else s.declined += 1;
  }
  return s;
}

export interface RefundRequestInput {
  scope?: RefundScope;
  /** Required for `booking`; optional for the others (it names the slot). */
  bookingId?: string;
  /** Required when there is no booking (`tickets`/`goodwill` on an order). */
  orderId?: string;
  /** `tickets`: which tickets. */
  ticketIds?: string[];
  /** `goodwill`: how much. */
  amount?: Minor;
  reason: RefundReason;
  note?: string;
  requestedBy: string;
  place?: string | null;
  /** Skip the counter's time window — a manager asking from OS. */
  ignoreWindow?: boolean;
}

export async function requestRefund(input: RefundRequestInput): Promise<ApiResult<RefundRequest>> {
  const scope = input.scope ?? "booking";
  const booking = input.bookingId ? peekBookings().find((b) => b.id === input.bookingId) : undefined;
  if (scope === "booking" && (!booking || booking.status !== "confirmed")) {
    return refuse("booking", "This booking is not active, so there is nothing to refund.");
  }
  const orderId = booking?.orderId ?? input.orderId;
  const order = orderId ? peekOrders().find((o) => o.id === orderId) : undefined;
  if (!order) return refuse("order", "No payment is recorded for this booking, so there is nothing to refund.");
  if (booking && pendingRefundFor(booking.id)) return refuse("booking", "A refund for this booking is already waiting for a manager.");
  if (!booking && pendingRefundForOrder(order.id)) return refuse("order", "A refund for this sale is already waiting for a manager.");
  if (input.reason === "other" && !input.note?.trim()) return refuse("note", "Say why, so the manager can decide.");
  if (booking && !input.ignoreWindow) {
    const allowed = canAskNow(booking.id);
    if (!allowed.ok) return refuse("booking", allowed.reason);
  }

  let amount: Minor = 0;
  let lineIds: string[] = [];
  let ticketIds: string[] | undefined;
  let productName = order.lines.find((l) => !l.parentLineId)?.productName ?? order.lines[0]?.productName ?? "";
  if (scope === "booking") {
    const found = refundableFor(booking!.id);
    if (!found || found.amount <= 0 || found.lines.length === 0) return refuse("booking", "Nothing is left to refund on this booking.");
    amount = found.amount;
    lineIds = found.lines.map((l) => l.id);
    productName = found.lines.find((l) => !l.parentLineId)?.productName ?? productName;
  } else if (scope === "tickets") {
    const ids = input.ticketIds ?? [];
    if (ids.length === 0) return refuse("tickets", "Choose the tickets to refund.");
    const shares = ticketShares(order, peekTickets().filter((t) => ids.includes(t.id) && t.status === "issued").map((t) => t.id));
    if (shares.length === 0) return refuse("tickets", "These tickets have been used or cancelled already.");
    amount = shares.reduce((s, x) => s + x.amount, 0);
    ticketIds = shares.map((s) => s.ticketId);
    const firstLine = order.lines.find((l) => l.id === shares[0].lineId);
    if (firstLine) productName = firstLine.productName;
  } else {
    const max = goodwillMaxFor(order.id);
    const want = Math.round(input.amount ?? 0);
    if (!(want > 0)) return refuse("amount", "Enter how much to give back.");
    if (want > max) return refuse("amount", "That is more than this sale still holds.");
    amount = want;
  }

  const now = new Date().toISOString();
  const bookingLines = booking ? linesForBooking(order, booking) : [];
  const created = requests.insert({
    scope,
    orderId: order.id,
    orderReference: order.reference,
    locationId: order.locationId,
    bookingId: booking?.id ?? null,
    lineIds,
    ticketIds,
    productName,
    place: input.place ?? bookingLines.find((l) => l.booking?.resourceName)?.booking?.resourceName ?? null,
    slotStart: booking?.slotStart ?? null,
    slotEnd: booking?.slotEnd ?? null,
    customerName: order.customerName ?? null,
    amount,
    reason: input.reason,
    note: input.note?.trim() || null,
    requestedBy: input.requestedBy,
    requestedAt: now,
    dueAt: dueAtFor(now),
    status: "pending",
  } as Omit<RefundRequest, "id">);
  touch();
  return ok(created);
}

export interface ApproveRefundOptions {
  /** Goodwill only: approve for less than was asked (never more). */
  amount?: Minor;
  /** Where the money goes back to; defaults to the policy. */
  method?: RefundMethod;
  note?: string;
}

/** Approve: give the money back, and — for a booking — free its place. */
export async function approveRefundRequest(id: string, who: string, opts: ApproveRefundOptions = {}): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (refundStatusOf(req) !== "pending") return decided();
  const scope = scopeOf(req);
  const method = opts.method ?? peekRefundPolicy().refundTo;
  const payMethod: PaymentMethod | undefined = method === "cash" ? "cash" : undefined;
  const why = `Refund request from the counter (${req.reason.replace(/_/g, " ")})`;
  let amount = req.amount;
  if (opts.amount != null && opts.amount !== req.amount) {
    if (scope !== "goodwill") return refuse("amount", "A booking or ticket refund is approved whole or declined.");
    if (!(opts.amount > 0)) return refuse("amount", "Enter an amount above zero.");
    if (opts.amount > req.amount) return refuse("amount", "A refund cannot be approved for more than was asked.");
    amount = Math.round(opts.amount);
  }
  if (scope === "booking") {
    const res = await refundOrderLines(req.orderId, req.lineIds, why, who);
    if (!res.ok) return res as unknown as ApiResult<RefundRequest>;
    if (req.bookingId) await cancelBooking(req.bookingId);
  } else if (scope === "tickets") {
    const res = await refundOrderTickets(req.orderId, req.ticketIds ?? [], why, who, payMethod);
    if (!res.ok) return res as unknown as ApiResult<RefundRequest>;
  } else {
    const res = await refundOrderAmount(req.orderId, amount, req.note?.trim() || why, who, payMethod);
    if (!res.ok) return res as unknown as ApiResult<RefundRequest>;
  }
  const out = await requests.update(id, {
    status: "approved",
    approvedAmount: amount,
    refundMethod: method,
    decidedBy: who,
    decidedAt: new Date().toISOString(),
    decisionNote: opts.note?.trim() || null,
  });
  touch();
  return out;
}

/** Decline, with a reason the counter can read back to the guest. */
export async function declineRefundRequest(id: string, who: string, note: string): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (refundStatusOf(req) !== "pending") return decided();
  if (!note.trim()) return refuse("note", "Say why, so the counter can tell the guest.");
  const out = await requests.update(id, { status: "declined", decidedBy: who, decidedAt: new Date().toISOString(), decisionNote: note.trim() });
  touch();
  return out;
}

/** Take back a request that has not been decided yet. */
export async function withdrawRefundRequest(id: string): Promise<ApiResult<RefundRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (refundStatusOf(req) !== "pending") return decided();
  const out = await requests.update(id, { status: "withdrawn", decidedBy: req.requestedBy, decidedAt: new Date().toISOString(), decisionNote: null });
  touch();
  return out;
}

/** Requests one person asked for, newest first — the till's "My requests". */
export const refundRequestsBy = (who: string): RefundRequest[] =>
  rows()
    .filter((r) => r.requestedBy === who)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

/* ── Demo requests ────────────────────────────────────────────────────────
   A manager opening Refunds on a fresh demo should see the page working, so a
   few requests are made from the seeded bookings: one overdue, one waiting,
   one goodwill and one declined. None is approved: an approved refund moves
   money, and a seed that only said so would disagree with the order. Picked by
   sorted id — never by rand(), which would move every generated figure. Made
   once per store (a business swap or Start fresh empties the list, and the
   next read makes them again). */
const seeded = new WeakSet<object>();
const HOUR = 3600_000;

export function seedDemoRefundRequests(): void {
  const list = requests.peek();
  if (seeded.has(list) || list.length > 0) return;
  seeded.add(list);
  const orders = new Map(peekOrders().map((o) => [o.id, o]));
  const all = peekBookings()
    .filter((b) => b.status === "confirmed" && orders.has(b.orderId) && orders.get(b.orderId)!.status === "paid")
    .filter((b) => (refundableFor(b.id)?.amount ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  // Upcoming bookings first — a refund asked for something already played is
  // the unusual case — but fall back to any if the demo has too few.
  const upcoming = all.filter((b) => dateOf(b.slotStart) >= DEMO_TODAY);
  const candidates = upcoming.length >= 4 ? upcoming : all;
  if (candidates.length < 4) return;
  const now = Date.now();
  const make = (b: Booking, ago: number, extra: Partial<RefundRequest>) => {
    const found = refundableFor(b.id)!;
    const o = found.order;
    const at = new Date(now - ago * HOUR).toISOString();
    return requests.insert({
      scope: "booking",
      orderId: o.id,
      orderReference: o.reference,
      locationId: o.locationId,
      bookingId: b.id,
      lineIds: found.lines.map((l) => l.id),
      productName: found.lines.find((l) => !l.parentLineId)?.productName ?? found.lines[0].productName,
      place: found.lines.find((l) => l.booking?.resourceName)?.booking?.resourceName ?? null,
      slotStart: b.slotStart,
      slotEnd: b.slotEnd ?? null,
      customerName: o.customerName ?? null,
      amount: found.amount,
      reason: "customer_cancelled",
      note: null,
      requestedBy: "Nadia Islam",
      requestedAt: at,
      dueAt: new Date(Date.parse(at) + 24 * HOUR).toISOString(),
      status: "pending",
      createdAt: at,
      updatedAt: at,
      ...extra,
    } as Omit<RefundRequest, "id">);
  };
  const pick = (i: number) => candidates[Math.floor((i * candidates.length) / 4) % candidates.length];
  make(pick(0), 30, { reason: "weather", note: "Heavy rain — the guest could not travel." });
  make(pick(1), 3, { reason: "customer_cancelled", requestedBy: "Rahim Uddin" });
  const goodwill = pick(2);
  const gwOrder = refundableFor(goodwill.id)!.order;
  make(goodwill, 6, {
    scope: "goodwill",
    lineIds: [],
    amount: Math.min(Math.round(gwOrder.total * 0.2), Math.max(0, orderNetPaid(gwOrder))),
    reason: "venue_problem",
    note: "Part of the venue was closed for an hour during their visit.",
  });
  make(pick(3), 48, {
    status: "declined",
    decidedBy: "Tanvir Ahmed",
    decidedAt: new Date(now - 20 * HOUR).toISOString(),
    decisionNote: "The guest came and used the booking.",
  });
}
