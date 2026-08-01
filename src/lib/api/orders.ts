import { createBooking } from "./bookings";
import { createResource } from "./client";
import { issueTicket, redeemCredits, voidOrderTickets } from "./tickets";
import type { ApiResult, Channel, ListParams, ListResponse, Minor, Order, OrderLine, PaymentMethod } from "./types";

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
  const payments = [...o.payments, { id: `${o.reference}-P${o.payments.length}`, method, amount, at: new Date().toISOString() }];
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return resource.update(orderId, {
    payments,
    status: paid >= o.total ? "paid" : "partial",
    history: withHistory(o, who, `Took ${method} payment of ${amount / 100}`),
  });
}

/** Add lines to an existing order (extras / tier upgrades at the counter). */
export async function addOrderLines(orderId: string, lines: Omit<OrderLine, "id">[], who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const added = lines.map((l, i) => ({ ...l, id: `${o.reference}-X${o.lines.length + i}` }));
  const addTotal = added.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return resource.update(orderId, {
    lines: [...o.lines, ...added],
    subtotal: o.subtotal + addTotal,
    total: o.total + addTotal,
    status: "partial",
    history: withHistory(o, who, `Added ${added.map((l) => l.tierName).join(", ")}`),
  });
}

/** Refund specific lines with a reason. Capacity release is a backend TODO. */
export async function refundOrderLines(orderId: string, lineIds: string[], reason: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const hit = o.lines.filter((l) => lineIds.includes(l.id));
  const amount = hit.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const all = hit.length === o.lines.filter((l) => l.unitPrice > 0).length;
  // Void the unredeemed tickets for the refunded products.
  for (const l of hit) await voidOrderTickets(orderId, l.productId);
  return resource.update(orderId, {
    payments: [...o.payments, { id: `${o.reference}-R${o.payments.length}`, method: o.payments[0]?.method ?? "cash", amount: -amount, at: new Date().toISOString() }],
    status: all ? "refunded" : o.status,
    history: withHistory(o, who, `Refunded ${hit.map((l) => l.tierName).join(", ")} — ${reason}`),
  });
}

/** Append an internal note. */
export async function addOrderNote(orderId: string, text: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  return resource.update(orderId, { notes: [...(o.notes ?? []), { at: new Date().toISOString(), who, text }] });
}

/** Record any other management action on the order's history. */
export async function logOrderAction(orderId: string, text: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  return resource.update(orderId, { history: withHistory(o, who, text) });
}

export interface CheckoutLine {
  productId: string;
  productName: string;
  tierName: string;
  quantity: number;
  unitPrice: Minor;
  taxRatePct?: number; // per-line rate from the product's tax class
}
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
  lines: CheckoutLine[];
  bookings?: CheckoutBooking[]; // slot holds for scheduled products
  taxPct: number;
  method: PaymentMethod;
  amountTendered: Minor;
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
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  // Per-line tax from each product's tax class; falls back to the order rate.
  const tax = input.lines.reduce((s, l) => s + Math.round((l.unitPrice * l.quantity * (l.taxRatePct ?? input.taxPct)) / 100), 0);
  const total = subtotal + tax;
  const payNow = input.payNow ?? total;
  const now = new Date().toISOString();
  const reference = `CF-2026-${String(Math.floor(Date.parse(now) % 900000) + 100000)}`;

  // Spend pass credits first so an invalid pass fails the sale cleanly.
  if (input.credits && input.credits.count > 0) {
    const spent = await redeemCredits(input.credits.ticketId, input.credits.count);
    if (!spent.ok) return spent as ApiResult<never>;
  }

  const orderRes = await resource.create({
    reference,
    status: payNow < total ? "partial" : "paid",
    channel: input.channel,
    locationId: input.locationId,
    counterId: input.counterId,
    staffId: input.staffId,
    customerName: input.customerName ?? null,
    lines: input.lines.map((l, i) => ({ id: `${reference}-L${i}`, ...l })),
    payments: [{ id: `${reference}-P0`, method: input.method, amount: payNow, at: now }],
    subtotal,
    tax,
    total,
  });
  if (!orderRes.ok) return orderRes;
  const order = orderRes.data;

  let firstTicketCode = "";
  let t = 0;
  for (const line of input.lines) {
    if (line.unitPrice < 0) continue; // discount/adjustment lines admit nobody
    for (let q = 0; q < line.quantity && t < 20; q++, t++) {
      const code = `${reference}-${String(t + 1).padStart(2, "0")}`;
      if (!firstTicketCode) firstTicketCode = code;
      await issueTicket({ code, orderId: order.id, productId: line.productId, tierName: line.tierName, validFor: now.slice(0, 10) });
    }
  }

  // Hold slot / daily capacity for scheduled products.
  for (const b of input.bookings ?? []) {
    await createBooking({ orderId: order.id, productId: b.productId, locationId: input.locationId, resourceId: b.resourceId ?? null, slotStart: b.slotStart, slotEnd: b.slotEnd, partySize: b.partySize });
  }

  return { ok: true, data: { order, firstTicketCode } };
}
