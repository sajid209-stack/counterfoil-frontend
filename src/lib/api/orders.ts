import { createBooking } from "./bookings";
import { createResource } from "./client";
import { issueTicket } from "./tickets";
import type { ApiResult, Channel, ListParams, ListResponse, Minor, Order, PaymentMethod } from "./types";

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
  lines: CheckoutLine[];
  bookings?: CheckoutBooking[]; // slot holds for scheduled products
  taxPct: number;
  method: PaymentMethod;
  amountTendered: Minor;
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
  const now = new Date().toISOString();
  const reference = `CF-2026-${String(Math.floor(Date.parse(now) % 900000) + 100000)}`;

  const orderRes = await resource.create({
    reference,
    status: "paid",
    channel: input.channel,
    locationId: input.locationId,
    counterId: input.counterId,
    staffId: input.staffId,
    customerName: null,
    lines: input.lines.map((l, i) => ({ id: `${reference}-L${i}`, ...l })),
    payments: [{ id: `${reference}-P0`, method: input.method, amount: total, at: now }],
    subtotal,
    tax,
    total,
  });
  if (!orderRes.ok) return orderRes;
  const order = orderRes.data;

  let firstTicketCode = "";
  let t = 0;
  for (const line of input.lines) {
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
