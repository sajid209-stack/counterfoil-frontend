import { createBooking } from "./bookings";
import { createResource } from "./client";
import { issueTicket, redeemCredits, voidOrderTickets } from "./tickets";
import { buildOrderLines, type LineInput } from "@/lib/orderMath";
import type { ApiResult, Channel, ListParams, ListResponse, Minor, Order, PaymentMethod, WriteOffCategory } from "./types";

const resource = createResource<Order>("orders", "Order", {
  search: (o, q) =>
    o.reference.toLowerCase().includes(q) ||
    (o.customerName?.toLowerCase().includes(q) ?? false),
  filter: (o, f) => {
    if (f.status && o.status !== f.status) return false;
    if (f.channel && o.channel !== f.channel) return false;
    if (f.locationId && o.locationId !== f.locationId) return false;
    return true;
  },
  sort: {
    reference: (a, b) => a.reference.localeCompare(b.reference),
    total: (a, b) => a.total - b.total,
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
    status: (a, b) => a.status.localeCompare(b.status),
  },
  defaultSort: "createdAt",
});

export const listOrders = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Order>>> => resource.list(params);

export const getOrder = (id: string): Promise<ApiResult<Order>> => resource.get(id);

/** Look up one order by its human reference (POS "Settle a booking" lookup).
 *  Exact match preferred, else a contains-match; errors if nothing matches. */
export function findOrderByReference(ref: string): Promise<ApiResult<Order>> {
  const q = ref.trim().toLowerCase();
  const all = resource.peek();
  const hit = all.find((o) => o.reference.toLowerCase() === q) ?? all.find((o) => q.length >= 3 && o.reference.toLowerCase().includes(q));
  return resource.get(hit?.id ?? "__no_order__");
}

/** Full refund — flips status; the real endpoint would also reverse payments. */
export const refundOrder = (id: string): Promise<ApiResult<Order>> =>
  resource.update(id, { status: "refunded" });

/** Read-only access for reports/aggregation within the api layer. */
export const peekOrders = (): Order[] => resource.peek();

const withHistory = (o: Order, who: string, text: string) => [
  ...(o.history ?? []),
  { at: new Date().toISOString(), who, text },
];

/** Take a further payment against an order (deposits, counter balances). */
export async function addOrderPayment(orderId: string, method: PaymentMethod, amount: Minor, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const payments: Order["payments"] = [...o.payments, { id: `${o.reference}-P${o.payments.length}`, method, amount, status: "confirmed", createdAt: new Date().toISOString() }];
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return resource.update(orderId, {
    payments,
    status: paid >= o.total ? "paid" : "partial",
    history: withHistory(o, who, `Took ${method} payment of ${amount / 100}`),
  });
}

/** Add lines to an existing order (extras / tier upgrades at the counter).
 *  Runs through the same order engine — full snapshot lines, per-line tax. */
export async function addOrderLines(orderId: string, inputs: LineInput[], who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const { lines: added, totals } = buildOrderLines(inputs, 0, `${o.reference}-X${o.lines.length}`);
  return resource.update(orderId, {
    lines: [...o.lines, ...added],
    subtotal: o.subtotal + totals.subtotal,
    taxTotal: o.taxTotal + totals.taxTotal,
    total: o.total + totals.total,
    status: "partial",
    history: withHistory(o, who, `Added ${added.map((l) => l.tierName).join(", ")}`),
  });
}

/** Refund specific lines with a reason — marks the lines (refundedQuantity /
 *  refundedAmount), voids their unredeemed tickets, and reverses the money as
 *  a negative payment. Capacity release is a backend TODO. */
export async function refundOrderLines(orderId: string, lineIds: string[], reason: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const hit = o.lines.filter((l) => lineIds.includes(l.id));
  const amount = hit.reduce((s, l) => s + l.total - l.refundedAmount, 0);
  const lines = o.lines.map((l) =>
    lineIds.includes(l.id) ? { ...l, refundedQuantity: l.quantity, refundedAmount: l.total } : l,
  );
  const all = lines.filter((l) => l.subtotal > 0).every((l) => l.refundedQuantity >= l.quantity);
  // Void the unredeemed tickets for the refunded lines.
  for (const l of hit) await voidOrderTickets(orderId, l.productId);
  return resource.update(orderId, {
    lines,
    payments: [...o.payments, { id: `${o.reference}-R${o.payments.length}`, method: o.payments[0]?.method ?? "cash", amount: -amount, status: "confirmed", createdAt: new Date().toISOString() }],
    status: all ? "refunded" : "partly_refunded",
    history: withHistory(o, who, `Refunded ${hit.map((l) => l.tierName).join(", ")} — ${reason}`),
  });
}

/** Append an internal note. */
export async function addOrderNote(orderId: string, text: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  return resource.update(orderId, { notes: [...(o.notes ?? []), { at: new Date().toISOString(), who, text }] });
}

/** Write off part of an order's balance (bad debt / dispute / goodwill) — not a
 *  refund (no money moves), just clears what's owed and records why. */
export async function writeOffOrder(orderId: string, amount: Minor, category: WriteOffCategory, reason: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const at = new Date().toISOString();
  return resource.update(orderId, {
    writeOffs: [...(o.writeOffs ?? []), { at, who, amount, category, reason }],
    history: withHistory(o, who, `Wrote off ${amount} (${category})${reason ? ` — ${reason}` : ""}`),
  });
}

/** Record any other management action on the order's history. */
export async function logOrderAction(orderId: string, text: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  return resource.update(orderId, { history: withHistory(o, who, text) });
}

/** A cart line at settle — the shape the POS produces. See lib/orderMath. */
export type CheckoutLine = LineInput;
export interface CheckoutBooking {
  productId: string;
  resourceId?: string | null;
  slotStart: string; // "2026-07-29T14:00:00+06:00"
  slotEnd?: string;
  partySize: number;
}
export interface CheckoutInput {
  channel: Channel;
  locationId: string;
  counterId: string | null;
  staffId: string | null;
  customerName?: string | null;
  /** The customer record this sale attaches to (Milestone 2). */
  customerId?: string | null;
  lines: CheckoutLine[];
  bookings?: CheckoutBooking[]; // slot holds for scheduled products
  /** Cart-level discount in minor units — allocated across lines pro rata
   *  (largest-remainder) by the order engine. */
  orderDiscount?: Minor;
  /** Fallback tax rate (percent) for lines without their own snapshot rate. */
  taxPct: number;
  method: PaymentMethod;
  amountTendered: Minor;
  /** Wallet transaction id (bKash etc.) recorded on the payment. */
  paymentReference?: string;
  /** Amount actually collected now. Below the order total (a deposit) the
   *  order lands as "partial" with the balance due at arrival. */
  payNow?: Minor;
  /** Credits pass to spend against eligible lines (BT-12 redemption). */
  credits?: { ticketId: string; count: number } | null;
}

/** Complete a sale: creates a paid order AND its tickets in the store, so the
 *  issued code is real and scannable. Returns the order + first ticket code. */
export async function checkout(
  input: CheckoutInput,
): Promise<ApiResult<{ order: Order; firstTicketCode: string }>> {
  const now = new Date().toISOString();
  const reference = `CF-2026-${String(Math.floor(Date.parse(now) % 900000) + 100000)}`;

  // ONE math path for every order in the system (lib/orderMath).
  const { lines, totals } = buildOrderLines(
    input.lines.map((l) => ({ ...l, taxRate: l.taxRate ?? input.taxPct / 100 })),
    input.orderDiscount ?? 0,
    reference,
  );
  const total = totals.total;
  const payNow = input.payNow ?? total;

  // Spend pass credits first so an invalid pass fails the sale cleanly.
  if (input.credits && input.credits.count > 0) {
    const spent = await redeemCredits(input.credits.ticketId, input.credits.count);
    if (!spent.ok) return spent as ApiResult<never>;
  }

  const payment: Order["payments"][number] = {
    id: `${reference}-P0`,
    method: input.method,
    amount: payNow,
    status: "confirmed",
    createdAt: now,
    ...(input.method === "cash"
      ? { tendered: input.amountTendered, change: Math.max(0, input.amountTendered - payNow) }
      : {}),
    ...(input.paymentReference ? { reference: input.paymentReference } : {}),
  };

  const orderRes = await resource.create({
    reference,
    status: payNow < total ? "partial" : "paid",
    channel: input.channel,
    locationId: input.locationId,
    counterId: input.counterId,
    staffId: input.staffId,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    lines,
    payments: [payment],
    ...totals,
  });
  if (!orderRes.ok) return orderRes;
  const order = orderRes.data;

  // Tickets generate PER LINE: quantity × admits. A line of 2 Family tickets
  // (admits 4) mints 2 tickets, each admitting 4. Add-on child lines admit
  // nobody and mint nothing. Each ticket carries its line id.
  let firstTicketCode = "";
  let t = 0;
  for (const line of order.lines) {
    if (line.parentLineId || line.admits <= 0 || line.unitPrice < 0) continue;
    for (let q = 0; q < line.quantity && t < 20; q++, t++) {
      const code = `${reference}-${String(t + 1).padStart(2, "0")}`;
      if (!firstTicketCode) firstTicketCode = code;
      await issueTicket({ code, orderId: order.id, lineId: line.id, productId: line.productId, tierName: line.tierName, admits: line.admits, validFor: now.slice(0, 10) });
    }
  }

  // Hold slot / daily capacity for scheduled products.
  for (const b of input.bookings ?? []) {
    await createBooking({ orderId: order.id, productId: b.productId, locationId: input.locationId, resourceId: b.resourceId ?? null, slotStart: b.slotStart, slotEnd: b.slotEnd, partySize: b.partySize });
  }

  return { ok: true, data: { order, firstTicketCode } };
}
