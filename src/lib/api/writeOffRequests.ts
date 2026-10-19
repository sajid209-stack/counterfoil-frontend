/* Write-off requests — stop chasing a balance, with a manager's say-so.

   A write-off is not a refund: no money moves. It clears what a guest still
   owes on a sale and records why (`writeOffOrder` on the order). At the
   counter that is a decision the cashier usually should not make alone — so
   it is asked for, like a refund, and a manager approves it (possibly for
   less) or rejects it with a reason. A role set to "direct" (Settings → Roles
   → At the counter) may write off on the spot up to the amount in Settings →
   Refunds & write-offs; anything larger still goes to a manager.

   Rules:
   1. **One open request per sale.**
   2. **The amount is at most what is owed**, defaulting to all of it.
   3. **A category and a note are required** — the four categories the order
      already records (uncollectible, customer dispute, business decision,
      administrative), and a sentence a manager can decide on.
   4. Timing (respond-by, auto-close) comes from the same policy as refunds.

   Contract for the backend lane: WriteOffRequest, WriteOffRequestStatus, and
   the calls below. See docs/refunds.md. */
import { useSyncExternalStore } from "react";
import { createResource, fail, ok, validationError } from "./client";
import { orderDue, peekOrders, writeOffOrder } from "./orders";
import { peekBookings } from "./bookings";
import { dueAtFor, isExpiredAt, peekRefundPolicy } from "./refundPolicy";
import type { ApiResult, CounterActionMode, ID, ISODateTime, Minor, WriteOffCategory } from "./types";

export const WRITE_OFF_CATEGORIES: WriteOffCategory[] = ["uncollectible", "customer_dispute", "business_decision", "administrative"];
/** Stored states. `expired` is derived on read. */
export type WriteOffRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type WriteOffDisplayStatus = WriteOffRequestStatus | "expired";

export interface WriteOffRequest {
  id: ID;
  orderId: ID;
  orderReference: string;
  locationId?: ID;
  /** The booking it was asked from, when it was. */
  bookingId?: ID | null;
  productName?: string | null;
  slotStart?: ISODateTime | null;
  customerName?: string | null;
  /** What the guest owed when it was asked for. */
  owedAtRequest: Minor;
  /** What was asked to be written off. */
  amount: Minor;
  /** What was approved — at most `amount`. */
  approvedAmount?: Minor | null;
  category: WriteOffCategory;
  note: string;
  requestedBy: string;
  requestedAt: ISODateTime;
  dueAt?: ISODateTime | null;
  status: WriteOffRequestStatus;
  decidedBy?: string | null;
  decidedAt?: ISODateTime | null;
  decisionNote?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const requests = createResource<WriteOffRequest>("writeOffRequests", "Write-off request", {});

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
/** Re-renders the caller whenever any write-off request is made or answered. */
export const useWriteOffVersion = (): number => useSyncExternalStore(subscribe, () => version, () => 0);

const refuse = <T,>(field: string, message: string) => fail<T>(validationError({ [field]: message }, message));
const decided = () => refuse<WriteOffRequest>("status", "This request has already been decided.");

export function writeOffStatusOf(r: WriteOffRequest, now = Date.now()): WriteOffDisplayStatus {
  if (r.status === "pending" && isExpiredAt(r.requestedAt, now)) return "expired";
  return r.status;
}
export const writeOffDueAtOf = (r: WriteOffRequest): ISODateTime => r.dueAt ?? dueAtFor(r.requestedAt);
export const isWriteOffOverdue = (r: WriteOffRequest, now = Date.now()): boolean =>
  writeOffStatusOf(r, now) === "pending" && now > Date.parse(writeOffDueAtOf(r));

const isOpen = (r: WriteOffRequest) => writeOffStatusOf(r) === "pending";
const rows = (): WriteOffRequest[] => {
  seedDemoWriteOffRequests();
  return requests.peek();
};

/** What is still owed on a sale — the most a write-off can clear. */
export const owedOn = (orderId: string): Minor => {
  const o = peekOrders().find((x) => x.id === orderId);
  return o ? orderDue(o) : 0;
};

/** May the counter write this off without a manager? Only when its role is
 *  "direct" and the amount is within the policy's limit. */
export function writeOffNeedsApproval(amount: Minor, mode: CounterActionMode): boolean {
  if (mode !== "direct") return true;
  return amount > peekRefundPolicy().writeOffApproveAbove;
}

export const pendingWriteOffFor = (orderId: string): WriteOffRequest | null =>
  rows().find((r) => r.orderId === orderId && isOpen(r)) ?? null;

export const writeOffRequestsForOrder = (orderId: string): WriteOffRequest[] =>
  rows()
    .filter((r) => r.orderId === orderId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

export const pendingWriteOffRequests = (locationId?: string): WriteOffRequest[] =>
  rows()
    .filter((r) => isOpen(r) && (!locationId || !r.locationId || r.locationId === locationId))
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));

export const writeOffRequestsBy = (who: string): WriteOffRequest[] =>
  rows()
    .filter((r) => r.requestedBy === who)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

export function getWriteOffRequest(id: string): WriteOffRequest | null {
  return rows().find((r) => r.id === id) ?? null;
}

/** The tabs on the Write-offs page. Rejected includes withdrawn and expired. */
export type WriteOffListTab = "waiting" | "approved" | "rejected" | "all";

export interface WriteOffListQuery {
  tab?: WriteOffListTab;
  q?: string;
  locationId?: string;
  category?: WriteOffCategory;
  requestedBy?: string;
}

export function listWriteOffRequests(query: WriteOffListQuery = {}): WriteOffRequest[] {
  const { tab = "all", q, locationId, category, requestedBy } = query;
  const needle = q?.trim().toLowerCase();
  const now = Date.now();
  const out = rows().filter((r) => {
    if (locationId && r.locationId && r.locationId !== locationId) return false;
    const st = writeOffStatusOf(r, now);
    if (tab === "waiting" && st !== "pending") return false;
    if (tab === "approved" && st !== "approved") return false;
    if (tab === "rejected" && !(st === "rejected" || st === "withdrawn" || st === "expired")) return false;
    if (category && r.category !== category) return false;
    if (requestedBy && r.requestedBy !== requestedBy) return false;
    if (needle) {
      const hay = [r.orderReference, r.customerName, r.productName, r.note, r.requestedBy, r.category.replace(/_/g, " ")]
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

export interface WriteOffSummary {
  waiting: number;
  waitingAmount: Minor;
  overdue: number;
  approved: number;
  rejected: number;
  all: number;
  writtenOffAmount: Minor;
}

export function writeOffSummary(locationId?: string): WriteOffSummary {
  const now = Date.now();
  const s: WriteOffSummary = { waiting: 0, waitingAmount: 0, overdue: 0, approved: 0, rejected: 0, all: 0, writtenOffAmount: 0 };
  for (const r of rows()) {
    if (locationId && r.locationId && r.locationId !== locationId) continue;
    s.all += 1;
    const st = writeOffStatusOf(r, now);
    if (st === "pending") {
      s.waiting += 1;
      s.waitingAmount += r.amount;
      if (now > Date.parse(writeOffDueAtOf(r))) s.overdue += 1;
    } else if (st === "approved") {
      s.approved += 1;
      s.writtenOffAmount += r.approvedAmount ?? r.amount;
    } else s.rejected += 1;
  }
  return s;
}

export interface WriteOffRequestInput {
  orderId: string;
  bookingId?: string;
  /** Defaults to everything still owed. */
  amount?: Minor;
  category: WriteOffCategory;
  note: string;
  requestedBy: string;
}

export async function requestWriteOff(input: WriteOffRequestInput): Promise<ApiResult<WriteOffRequest>> {
  const order = peekOrders().find((o) => o.id === input.orderId);
  if (!order) return refuse("order", "This sale cannot be found.");
  const owed = orderDue(order);
  if (owed <= 0) return refuse("amount", "Nothing is owed on this sale, so there is nothing to write off.");
  if (pendingWriteOffFor(order.id)) return refuse("order", "A write-off for this sale is already waiting for a manager.");
  const amount = Math.round(input.amount ?? owed);
  if (!(amount > 0)) return refuse("amount", "Enter an amount above zero.");
  if (amount > owed) return refuse("amount", "A write-off cannot be more than what is owed.");
  if (!WRITE_OFF_CATEGORIES.includes(input.category)) return refuse("category", "Choose why it is being written off.");
  if (!input.note.trim()) return refuse("note", "Say what happened, so the manager can decide.");
  const booking = input.bookingId ? peekBookings().find((b) => b.id === input.bookingId) : undefined;
  const now = new Date().toISOString();
  const created = requests.insert({
    orderId: order.id,
    orderReference: order.reference,
    locationId: order.locationId,
    bookingId: booking?.id ?? null,
    productName: order.lines.find((l) => !l.parentLineId && (!booking || l.productId === booking.productId))?.productName ?? null,
    slotStart: booking?.slotStart ?? null,
    customerName: order.customerName ?? null,
    owedAtRequest: owed,
    amount,
    category: input.category,
    note: input.note.trim(),
    requestedBy: input.requestedBy,
    requestedAt: now,
    dueAt: dueAtFor(now),
    status: "pending",
  } as Omit<WriteOffRequest, "id">);
  touch();
  return ok(created);
}

/** Approve, optionally for less. Capped at what is owed at the moment of
 *  approval — the guest may have paid some of it since. */
export async function approveWriteOff(id: string, who: string, opts: { amount?: Minor; note?: string } = {}): Promise<ApiResult<WriteOffRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (writeOffStatusOf(req) !== "pending") return decided();
  const owed = owedOn(req.orderId);
  if (owed <= 0) return refuse("amount", "Nothing is owed on this sale any more.");
  const amount = Math.round(opts.amount ?? Math.min(req.amount, owed));
  if (!(amount > 0)) return refuse("amount", "Enter an amount above zero.");
  if (amount > req.amount) return refuse("amount", "A write-off cannot be approved for more than was asked.");
  if (amount > owed) return refuse("amount", "That is more than is owed now.");
  const res = await writeOffOrder(req.orderId, amount, req.category, req.note, who);
  if (!res.ok) return res as unknown as ApiResult<WriteOffRequest>;
  const out = await requests.update(id, {
    status: "approved",
    approvedAmount: amount,
    decidedBy: who,
    decidedAt: new Date().toISOString(),
    decisionNote: opts.note?.trim() || null,
  });
  touch();
  return out;
}

export async function rejectWriteOff(id: string, who: string, note: string): Promise<ApiResult<WriteOffRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (writeOffStatusOf(req) !== "pending") return decided();
  if (!note.trim()) return refuse("note", "Say why, so the counter knows to collect it.");
  const out = await requests.update(id, { status: "rejected", decidedBy: who, decidedAt: new Date().toISOString(), decisionNote: note.trim() });
  touch();
  return out;
}

export async function withdrawWriteOff(id: string): Promise<ApiResult<WriteOffRequest>> {
  const req = requests.peek().find((r) => r.id === id);
  if (!req) return requests.get(id);
  if (writeOffStatusOf(req) !== "pending") return decided();
  const out = await requests.update(id, { status: "withdrawn", decidedBy: req.requestedBy, decidedAt: new Date().toISOString(), decisionNote: null });
  touch();
  return out;
}

/** Ask and, when the role may and the amount is within the limit, approve in
 *  the same breath — so the record still reads as a request a named person
 *  decided. Returns the request either way. */
export async function requestOrWriteOff(input: WriteOffRequestInput & { mode: CounterActionMode }): Promise<ApiResult<WriteOffRequest>> {
  const req = await requestWriteOff(input);
  if (!req.ok) return req;
  if (writeOffNeedsApproval(req.data.amount, input.mode)) return req;
  return approveWriteOff(req.data.id, input.requestedBy);
}

/* ── Demo requests ──────────────────────────────────────────────────────── */
const seeded = new WeakSet<object>();
const HOUR = 3600_000;

export function seedDemoWriteOffRequests(): void {
  const list = requests.peek();
  if (seeded.has(list) || list.length > 0) return;
  seeded.add(list);
  const owing = peekOrders()
    .filter((o) => o.status === "partial" && orderDue(o) > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (owing.length < 2) return;
  const now = Date.now();
  const make = (i: number, ago: number, extra: Partial<WriteOffRequest>) => {
    const o = owing[Math.floor((i * owing.length) / 3) % owing.length];
    const owed = orderDue(o);
    const at = new Date(now - ago * HOUR).toISOString();
    requests.insert({
      orderId: o.id,
      orderReference: o.reference,
      locationId: o.locationId,
      bookingId: null,
      productName: o.lines.find((l) => !l.parentLineId)?.productName ?? null,
      slotStart: null,
      customerName: o.customerName ?? null,
      owedAtRequest: owed,
      amount: owed,
      category: "uncollectible",
      note: "",
      requestedBy: "Nadia Islam",
      requestedAt: at,
      dueAt: new Date(Date.parse(at) + 24 * HOUR).toISOString(),
      status: "pending",
      createdAt: at,
      updatedAt: at,
      ...extra,
    } as Omit<WriteOffRequest, "id">);
  };
  make(0, 28, { category: "uncollectible", note: "Left without paying the balance; phone number does not answer." });
  make(1, 4, { category: "customer_dispute", note: "Says they were charged for more than they booked." });
  make(2, 50, {
    category: "business_decision",
    note: "Regular group, balance waived as a gesture.",
    status: "rejected",
    decidedBy: "Tanvir Ahmed",
    decidedAt: new Date(now - 30 * HOUR).toISOString(),
    decisionNote: "Collect it at their next visit.",
  });
}
