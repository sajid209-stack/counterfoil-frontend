import { cancelBooking, createBooking, peekBookings } from "./bookings";
import { itemForAddOn, recordMovement, recordSale } from "./inventory";
import { conflictError, createResource, delay, fail, ok } from "./client";
import { seatsTaken } from "./layouts";
import { issueTicket, redeemCredits, voidOrderTickets } from "./tickets";
import { buildOrderLines, type LineInput } from "@/lib/orderMath";
import type { ApiResult, Channel, ListParams, ListResponse, Minor, Order, OrderStatus, PaymentMethod, Ticket, WriteOffCategory } from "./types";

const resource = createResource<Order>("orders", "Order", {
  search: (o, q) =>
    o.reference.toLowerCase().includes(q) ||
    (o.customerName?.toLowerCase().includes(q) ?? false),
  filter: (o, f) => {
    if (f.status && o.status !== f.status) return false;
    if (f.channel && o.channel !== f.channel) return false;
    if (f.locationId && o.locationId !== f.locationId) return false;
    // The customer page was pulling five hundred orders and filtering them
    // in the component; the question belongs in the query.
    if (f.customerId && o.customerId !== f.customerId) return false;
    // "When" is the question an orders list is asked most often, and sorting
    // by date cannot answer it — you can put today at the top but you cannot
    // ask for only today. Half-open [from, to): a day boundary belongs to one
    // side or the other, never to both.
    if (typeof f.from === "string" && o.createdAt < f.from) return false;
    if (typeof f.to === "string" && o.createdAt >= f.to) return false;
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

/**
 * What has actually been taken against an order, and what is still owed.
 *
 * Refunds land as negative payments, so this is already net of them — except
 * for a full refund taken through `refundOrder` below, which only flips the
 * status. Anything summing money across orders must therefore exclude
 * `refunded` and `cancelled` rather than trusting the payments alone.
 *
 * Extracted because the order detail page was recomputing this expression in
 * five places and `addOrderPayment` in a sixth.
 */
export const orderPaid = (o: Order): Minor => o.payments.reduce((s, p) => s + p.amount, 0);
export const orderOutstanding = (o: Order): Minor => Math.max(0, o.total - orderPaid(o));

/** Statuses whose money is no longer the venue's. */
export const isVoidedOrder = (o: Order): boolean =>
  o.status === "cancelled" || o.status === "refunded";

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
    // A forgiven balance is as settled as a paid one: paid + written off is what the order is held against.
    status: paid + orderWrittenOff(o) >= o.total ? "paid" : "partial",
    history: withHistory(o, who, `Took ${method} payment of ${amount / 100}`),
  });
}

/** Add lines to an existing order (extras / tier upgrades at the counter).
 *  Runs through the same order engine — full snapshot lines, per-line tax. */
export async function addOrderLines(orderId: string, inputs: LineInput[], who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const { lines: added, totals } = buildOrderLines(inputs, 0, `${o.reference}-X${o.lines.length}`);
  /* An extra handed over after the sale leaves the shelf like any other — a
     programme added at Check-In was charged for and never counted. */
  await recordSale(orderId, o.locationId, added.map((l) => ({ productId: l.productId, quantity: l.quantity })), who);
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
 *  refundedAmount), voids their unredeemed tickets, reverses the money as a
 *  negative payment, and puts refunded stock back on the shelf.
 *
 *  A refunded SEAT goes back on sale by itself, because seat availability is
 *  replayed from the ledger (`seatsTaken`) rather than stored — a fully
 *  refunded line stops claiming its seat the moment it is marked. Slot and
 *  daily capacity are still a backend TODO: those are counted, not named. */
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
  /* And put the stock back. A refunded tote bag is a tote bag on the shelf;
     without this the count only ever falls, which is the same class of lie as
     a count that only ever rises. */
  for (const l of hit) {
    const item = itemForAddOn(l.productId);
    if (!item || !item.tracked) continue;
    await recordMovement({
      itemId: item.id,
      locationId: o.locationId,
      kind: "returned",
      quantity: Math.abs(l.quantity),
      reason: `Refunded on ${o.reference}`,
      orderId,
      by: who,
    });
  }
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
  const writeOffs = [...(o.writeOffs ?? []), { at, who, amount, category, reason }];
  // Forgiving what was left of a part-paid order settles it: nothing is owed, so it should not go on reading "Part paid".
  const settled = o.status === "partial" && orderDue({ ...o, writeOffs }) === 0;
  return resource.update(orderId, {
    writeOffs,
    ...(settled ? { status: "paid" as const } : {}),
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
   *  order lands as "partial" with the balance due at arrival. Zero is a
   *  reservation taken on the phone or at the desk: the order is "pending",
   *  records no payment, and the whole total is owed at arrival — the same
   *  shape a seeded pending order has. */
  payNow?: Minor;
  /** Credits pass to spend against eligible lines (BT-12 redemption). */
  credits?: { ticketId: string; count: number } | null;
}

/** Complete a sale: creates a paid order AND its tickets in the store, so the
 *  issued code is real and scannable. Returns the order + first ticket code. */
export async function checkout(
  input: CheckoutInput,
): Promise<ApiResult<{ order: Order; firstTicketCode: string; tickets: Ticket[]; stockRefused: { name: string; reason: string }[] }>> {
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

  /**
   * The seats, re-checked at the moment money is taken.
   *
   * A cap on the picker stops ONE till. Two cashiers with the same slow cart
   * both pass it, and the second sale silently takes a seat somebody is
   * already holding a ticket for. This is the last point where that can be
   * refused, which is why the check belongs here and not in the sheet — the
   * same reasoning that put the credits spend above.
   *
   * It names the seat, because "that seat has gone" is something a cashier can
   * act on and a bare refusal is not.
   */
  const wanted = lines.filter((l) => l.booking?.seatLabel);
  if (wanted.length) {
    const clashes: string[] = [];
    const seen = new Set<string>();
    for (const l of wanted) {
      const b = l.booking!;
      const key = `${l.productId}|${b.date ?? ""}|${b.startTime ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        const taken = seatsTaken(l.productId, b.date || undefined, b.startTime);
        for (const w of wanted) {
          const wb = w.booking!;
          if (`${w.productId}|${wb.date ?? ""}|${wb.startTime ?? ""}` !== key) continue;
          if (taken.has(wb.seatLabel!)) clashes.push(wb.seatLabel!);
        }
      }
    }
    if (clashes.length) {
      /* A conflict, not a form error: `validationError` defaults to "Please fix
         the highlighted fields", and at a till there is no field to highlight —
         the cashier gets a toast, so the toast has to be the whole sentence. */
      return fail(
        conflictError(
          `${clashes.join(", ")} ${clashes.length === 1 ? "has" : "have"} just been sold. Choose another ${clashes.length === 1 ? "seat" : "seats"}.`,
        ),
      );
    }
  }

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

  const reserveOnly = payNow <= 0 && total > 0;
  const orderRes = await resource.create({
    reference,
    status: reserveOnly ? "pending" : payNow < total ? "partial" : "paid",
    channel: input.channel,
    locationId: input.locationId,
    counterId: input.counterId,
    staffId: input.staffId,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    lines,
    // Nothing taken is nothing recorded — a ৳0 payment would read as a sale
    // somebody settled.
    payments: reserveOnly ? [] : [payment],
    ...totals,
  });
  if (!orderRes.ok) return orderRes;
  const order = orderRes.data;

  // Tickets generate PER LINE: quantity × admits. A line of 2 Family tickets
  // (admits 4) mints 2 tickets, each admitting 4. Add-on child lines admit
  // nobody and mint nothing. Each ticket carries its line id.
  // The issued tickets come back with the sale, as a real checkout's would: the
  // till's completion screen draws from them, rather than asking the server
  // again for what it has only just been told.
  let firstTicketCode = "";
  const tickets: Ticket[] = [];
  let t = 0;
  for (const line of order.lines) {
    if (line.parentLineId || line.admits <= 0 || line.unitPrice < 0) continue;
    for (let q = 0; q < line.quantity && t < 20; q++, t++) {
      const code = `${reference}-${String(t + 1).padStart(2, "0")}`;
      if (!firstTicketCode) firstTicketCode = code;
      const issued = await issueTicket({ code, orderId: order.id, lineId: line.id, productId: line.productId, tierName: line.tierName, admits: line.admits, validFor: now.slice(0, 10) });
      if (issued.ok) tickets.push(issued.data);
    }
  }

  /* What the sale takes off the shelf.
     After the order exists, never before: stock moved for a sale that then
     failed is stock nobody sold — the same order of operations the credits
     pass follows. Here rather than in each till, so all three tills, the
     calendar's quick-create and Check-In's "Add extra" all move the count by
     existing rather than by remembering to. */
  const stock = await recordSale(
    order.id,
    input.locationId,
    order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    input.staffId ?? "Counter",
  );

  // Hold slot / daily capacity for scheduled products.
  for (const b of input.bookings ?? []) {
    await createBooking({ orderId: order.id, productId: b.productId, locationId: input.locationId, resourceId: b.resourceId ?? null, slotStart: b.slotStart, slotEnd: b.slotEnd, partySize: b.partySize });
  }

  /* `stockRefused` travels with the sale rather than being logged and lost:
     a line that was charged for but could not leave a shelf is something the
     counter has to be told while the guest is still standing there. */
  return { ok: true, data: { order, firstTicketCode, tickets, stockRefused: stock.refused } };
}

/** How long a sale can be undone from the till once it is complete. */
export const UNDO_SALE_SECONDS = 5;

/**
 * Undo a sale the till has just completed — the "oops, wrong item" a cashier
 * needs within a few seconds, before the guest has walked away.
 *
 * Everything the sale did is taken back: the money (a reversing payment), the
 * tickets and their codes, the bookings (so the slot goes back on sale) and
 * the stock. The order stays on the record as CANCELLED, with who undid it —
 * a sale that vanished without trace is a sale nobody can account for.
 *
 * The window is checked here as well as on screen, so a late tap cannot undo
 * a sale whose guest is already through the gate. Two seconds of grace cover
 * the time between the tap and this call.
 */
export async function cancelSale(orderId: string, who = "Counter", windowSeconds = UNDO_SALE_SECONDS + 2): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  if (o.status === "cancelled") return fail(conflictError("This sale is already cancelled."));
  const age = (Date.now() - Date.parse(o.createdAt)) / 1000;
  if (age > windowSeconds) return fail(conflictError("Too late to undo this sale. Refund it instead."));
  await voidOrderTickets(orderId);
  for (const b of peekBookings().filter((x) => x.orderId === orderId && x.status === "confirmed")) await cancelBooking(b.id);
  for (const l of o.lines) {
    const item = itemForAddOn(l.productId);
    if (!item || !item.tracked || l.quantity <= 0) continue;
    await recordMovement({ itemId: item.id, locationId: o.locationId, kind: "returned", quantity: l.quantity, reason: `Sale undone on ${o.reference}`, orderId, by: who });
  }
  const paid = orderPaid(o);
  return resource.update(orderId, {
    status: "cancelled",
    payments: paid > 0
      ? [...o.payments, { id: `${o.reference}-U`, method: o.payments[0]?.method ?? "cash", amount: -paid, status: "confirmed", createdAt: new Date().toISOString() }]
      : o.payments,
    history: withHistory(o, who, "Sale undone at the till"),
  });
}

/**
 * Take a discount off what a guest still owes — the after-the-match discount
 * a counter gives when the lights went out for twenty minutes, or the game
 * ran short.
 *
 * It is a LINE, not an edit to the old ones: a negative adjustment line at the
 * tax rate of the booking it is given against, so the VAT owed falls with the
 * price and every report that sums lines sees it. The original lines stay as
 * they were sold. It can never be more than is still owed.
 */
export async function discountOrderBalance(orderId: string, amount: Minor, reason: string, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  const owed = orderOutstanding(o);
  if (amount <= 0) return fail(conflictError("Enter a discount above zero."));
  if (amount > owed) return fail(conflictError("A discount cannot be more than what is still owed."));
  if (!reason.trim()) return fail(conflictError("Say why the discount was given."));
  const base = o.lines.find((l) => !l.parentLineId && l.total > 0) ?? o.lines[0];
  const rate = base?.taxRate ?? 0;
  const net = Math.round(amount / (1 + rate));
  const { lines: added, totals } = buildOrderLines(
    [{ productId: "adj_discount", productName: "Discount", tierName: reason.trim(), admits: 0, quantity: 1, unitPrice: -net, taxClass: base?.taxClass, taxRate: rate }],
    0,
    `${o.reference}-D${o.lines.length}`,
  );
  const total = o.total + totals.total;
  const paid = orderPaid(o);
  return resource.update(orderId, {
    lines: [...o.lines, ...added],
    subtotal: o.subtotal + totals.subtotal,
    taxTotal: o.taxTotal + totals.taxTotal,
    total,
    status: paid >= total ? "paid" : "partial",
    history: withHistory(o, who, `Discount of ${-totals.total / 100} on the balance — ${reason.trim()}`),
  });
}

/* ═══ The sales report ═══════════════════════════════════════════════════════
 *
 * What the Orders list, its Summary, its CSV and its two print pages all read.
 * One definition of "what a sale is worth", so the figure in the panel, the
 * figure in the file and the figure on paper cannot disagree.
 *
 * **What counts.** A cancelled order never happened and a fully refunded one
 * has gone back out, so neither is a sale: they stay in the list (and in the
 * Transactions count, because somebody has to be able to find them) and add
 * nothing to any money figure. A partly refunded order counts for what was
 * kept. The identity the whole summary is built on, order by order:
 *
 *     sales = total − refunded lines
 *     sales = paid (net of refunds) + still owed + written off
 *
 * **Why `orderPaid` is not enough here.** It adds the payments, which is right
 * for an order refunded line by line (the refund lands as a negative payment)
 * and wrong for one refunded through `refundOrder`, which only flips the status
 * and leaves the full payment standing. The helpers below say what the venue is
 * actually holding either way.
 */

/** Where a sale came from. A marketplace booking is still an online sale (it
 *  is `channel: "online"` plus a `source`), so reports that bucket by channel
 *  keep working — this is the three-way cut a person actually asks for. */
export type OrderChannel = "counter" | "online" | "marketplace";
/** How an order was paid: one method, "split" across several, or not at all. */
export type OrderMethod = PaymentMethod | "split" | "none";

/** The value the counter and staff filters use for "none recorded" — an online
 *  sale has no counter, and most of them have nobody who rang them up. */
export const NO_ONE = "none";

export const orderChannelOf = (o: Order): OrderChannel => (o.source ? "marketplace" : o.channel === "online" ? "online" : "counter");

export function orderMethodOf(o: Order): OrderMethod {
  const used = [...new Set(o.payments.filter((p) => p.amount > 0).map((p) => p.method))];
  return used.length === 0 ? "none" : used.length === 1 ? used[0] : "split";
}

/** Units sold: every line, add-ons included, as the table has always counted them. */
export const orderItemCount = (o: Order): number => o.lines.reduce((s, l) => s + l.quantity, 0);

/** Money that came in, before anything went back. */
export const orderReceived = (o: Order): Minor => o.payments.reduce((s, p) => s + (p.amount > 0 ? p.amount : 0), 0);

/** Money handed back: the refund payments, or — for an order refunded by status
 *  alone — everything it was paid. */
export function orderRefundedOut(o: Order): Minor {
  const back = o.payments.reduce((s, p) => s + (p.amount < 0 ? -p.amount : 0), 0);
  return back > 0 ? back : o.status === "refunded" ? orderReceived(o) : 0;
}

/** What the venue is holding against this order, net of refunds. */
export const orderNetPaid = (o: Order): Minor => orderReceived(o) - orderRefundedOut(o);

/** The value of the lines that were refunded one by one. */
export const orderLineRefunds = (o: Order): Minor => o.lines.reduce((s, l) => s + (l.refundedAmount ?? 0), 0);

export const orderWrittenOff = (o: Order): Minor => (o.writeOffs ?? []).reduce((s, w) => s + w.amount, 0);

/** What the order is worth once voided orders and refunded lines are out. */
export const orderSales = (o: Order): Minor => (isVoidedOrder(o) ? 0 : o.total - orderLineRefunds(o));

/** What is still to be collected. Unlike `orderOutstanding` this knows about
 *  refunded lines and written-off balances, so a part-refunded order does not
 *  read as owing the refund. */
export const orderDue = (o: Order): Minor => (isVoidedOrder(o) ? 0 : Math.max(0, orderSales(o) - orderNetPaid(o) - orderWrittenOff(o)));

export interface SalesQuery {
  /** Local calendar days, inclusive: "2026-07-29". */
  from?: string;
  to?: string;
  locationId?: string;
  customerId?: string;
  /** Matches the reference, the customer's name and a marketplace's own reference. */
  search?: string;
  /** Counter ids; `NO_ONE` for orders with none. An empty list means everything. */
  counters?: string[];
  staff?: string[];
  channels?: OrderChannel[];
  methods?: OrderMethod[];
  statuses?: OrderStatus[];
}

const startOfDay = (ymd: string) => Date.parse(`${ymd}T00:00:00`);
const startOfNextDay = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.getTime();
};

/** The orders a report asks for. Pure, so a page that already holds the venue's
 *  orders can narrow them in place — the same answer the API would give.
 *  Compared as instants, never as text: the seed spells timestamps both with a
 *  `Z` and with `+06:00`, and a string compare across the two is nonsense. */
export function filterSalesOrders(all: Order[], q: SalesQuery = {}): Order[] {
  const from = q.from ? startOfDay(q.from) : null;
  const before = q.to ? startOfNextDay(q.to) : null;
  const needle = q.search?.trim().toLowerCase();
  return all.filter((o) => {
    if (q.locationId && o.locationId !== q.locationId) return false;
    if (q.customerId && o.customerId !== q.customerId) return false;
    if (from !== null || before !== null) {
      const at = Date.parse(o.createdAt);
      if (from !== null && at < from) return false;
      if (before !== null && at >= before) return false;
    }
    if (needle && !(o.reference.toLowerCase().includes(needle) || (o.customerName?.toLowerCase().includes(needle) ?? false) || (o.source?.reference?.toLowerCase().includes(needle) ?? false))) return false;
    if (q.counters?.length && !q.counters.includes(o.counterId ?? NO_ONE)) return false;
    if (q.staff?.length && !q.staff.includes(o.staffId ?? NO_ONE)) return false;
    if (q.channels?.length && !q.channels.includes(orderChannelOf(o))) return false;
    if (q.methods?.length && !q.methods.includes(orderMethodOf(o))) return false;
    if (q.statuses?.length && !q.statuses.includes(o.status)) return false;
    return true;
  });
}

/** Every matching order, unpaged — the Export and the print pages need all of
 *  them, not the twenty on screen. */
export async function listSalesOrders(q: SalesQuery = {}): Promise<ApiResult<Order[]>> {
  await delay();
  return ok(filterSalesOrders(resource.peek(), q));
}

export type SalesSortKey =
  | "reference" | "createdAt" | "customer" | "channel" | "counter" | "staff"
  | "total" | "tax" | "paid" | "discount" | "method" | "status" | "items";

/** Order a report. Names live outside this file (the staff and counter
 *  records), so the caller says how to read one. */
export function sortSalesOrders(
  rows: Order[],
  key: string,
  dir: "asc" | "desc",
  names: { staff?: (id: string | null) => string; counter?: (id: string | null) => string } = {},
): Order[] {
  const text = (f: (o: Order) => string) => (a: Order, b: Order) => f(a).localeCompare(f(b), undefined, { numeric: true, sensitivity: "base" });
  const num = (f: (o: Order) => number) => (a: Order, b: Order) => f(a) - f(b);
  const by: Record<string, (a: Order, b: Order) => number> = {
    reference: text((o) => o.reference),
    createdAt: num((o) => Date.parse(o.createdAt)),
    customer: text((o) => o.customerName ?? ""),
    channel: text((o) => orderChannelOf(o)),
    counter: text((o) => names.counter?.(o.counterId) ?? o.counterId ?? ""),
    staff: text((o) => names.staff?.(o.staffId) ?? o.staffId ?? ""),
    total: num((o) => o.total),
    tax: num((o) => o.taxTotal ?? 0),
    paid: num(orderNetPaid),
    discount: num((o) => o.discountTotal ?? 0),
    method: text(orderMethodOf),
    status: text((o) => o.status),
    items: num(orderItemCount),
  };
  const cmp = by[key] ?? by.createdAt;
  const sign = dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => sign * cmp(a, b) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

/** One line of a breakdown: how many orders, and what they come to. A voided
 *  order is counted but contributes nothing, so every breakdown's orders add up
 *  to Transactions and its amounts add up to Sales. */
export interface SalesRow {
  key: string;
  orders: number;
  amount: Minor;
}

export interface SalesSummary {
  /** Everything the filters match — the table's own total. */
  orders: number;
  /** Of those, the ones that are not cancelled or fully refunded. */
  counted: number;
  /** Units sold, on counted orders. */
  items: number;
  gross: Minor;
  discounts: Minor;
  /** Gross less discounts: what the sale came to before VAT. */
  net: Minor;
  vat: Minor;
  total: Minor;
  /** Lines refunded on orders that were otherwise kept. */
  partRefunds: Minor;
  /** What the sales are worth: total less part refunds. The headline. */
  sales: Minor;
  /** Taken, net of refunds. */
  paid: Minor;
  owed: Minor;
  writtenOff: Minor;
  /** Everything handed back across the matching orders, including those
   *  refunded or undone in full — which are not in `sales`. */
  refunds: Minor;
  /** What came in, per method, net of refunds. With `owed` and `writtenOff` it adds up to `sales`. */
  methods: { key: PaymentMethod; amount: Minor }[];
  channels: SalesRow[];
  counters: SalesRow[];
  staff: SalesRow[];
  statuses: SalesRow[];
  /** The best sellers by value, and everything else rolled into one line so the list still adds up. */
  topItems: { key: string; name: string; qty: number; amount: Minor }[];
  otherItems: { count: number; qty: number; amount: Minor };
}

export function summariseSales(rows: Order[], topN = 10): SalesSummary {
  const s: SalesSummary = {
    orders: rows.length, counted: 0, items: 0,
    gross: 0, discounts: 0, net: 0, vat: 0, total: 0, partRefunds: 0, sales: 0,
    paid: 0, owed: 0, writtenOff: 0, refunds: 0,
    methods: [], channels: [], counters: [], staff: [], statuses: [],
    topItems: [], otherItems: { count: 0, qty: 0, amount: 0 },
  };
  const methods = new Map<PaymentMethod, number>();
  const groups = { channels: new Map<string, SalesRow>(), counters: new Map<string, SalesRow>(), staff: new Map<string, SalesRow>(), statuses: new Map<string, SalesRow>() };
  const bump = (g: Map<string, SalesRow>, key: string, amount: Minor) => {
    const row = g.get(key) ?? { key, orders: 0, amount: 0 };
    row.orders += 1;
    row.amount += amount;
    g.set(key, row);
  };
  const items = new Map<string, { key: string; name: string; qty: number; amount: Minor }>();

  for (const o of rows) {
    const worth = orderSales(o);
    s.refunds += orderRefundedOut(o);
    bump(groups.channels, orderChannelOf(o), worth);
    bump(groups.counters, o.counterId ?? NO_ONE, worth);
    bump(groups.staff, o.staffId ?? NO_ONE, worth);
    bump(groups.statuses, o.status, worth);
    if (isVoidedOrder(o)) continue;
    s.counted += 1;
    s.items += orderItemCount(o);
    s.gross += o.subtotal;
    s.discounts += o.discountTotal ?? 0;
    s.vat += o.taxTotal ?? 0;
    s.total += o.total;
    s.partRefunds += orderLineRefunds(o);
    s.sales += worth;
    s.paid += orderNetPaid(o);
    s.owed += orderDue(o);
    s.writtenOff += orderWrittenOff(o);
    for (const p of o.payments) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount);
    for (const l of o.lines) {
      const key = l.productName;
      const row = items.get(key) ?? { key, name: l.productName, qty: 0, amount: 0 };
      row.qty += l.quantity - (l.refundedQuantity ?? 0);
      row.amount += l.total - (l.refundedAmount ?? 0);
      items.set(key, row);
    }
  }
  s.net = s.gross - s.discounts;
  s.methods = [...methods].map(([key, amount]) => ({ key, amount })).filter((m) => m.amount !== 0).sort((a, b) => b.amount - a.amount);
  const rowsOf = (g: Map<string, SalesRow>) => [...g.values()].sort((a, b) => b.amount - a.amount || b.orders - a.orders);
  s.channels = rowsOf(groups.channels);
  s.counters = rowsOf(groups.counters);
  s.staff = rowsOf(groups.staff);
  s.statuses = rowsOf(groups.statuses);
  const ranked = [...items.values()].sort((a, b) => b.amount - a.amount || b.qty - a.qty || a.name.localeCompare(b.name));
  s.topItems = ranked.slice(0, topN);
  for (const r of ranked.slice(topN)) {
    s.otherItems.count += 1;
    s.otherItems.qty += r.qty;
    s.otherItems.amount += r.amount;
  }
  return s;
}

/** Put a customer on a sale that was rung up without one (a walk-in, or an
 *  online guest who was never matched to a record). */
export async function attachOrderCustomer(orderId: string, customer: { id: string; name: string }, who = "Counter"): Promise<ApiResult<Order>> {
  const o = resource.peek().find((x) => x.id === orderId);
  if (!o) return resource.get(orderId);
  return resource.update(orderId, {
    customerId: customer.id,
    customerName: customer.name,
    history: withHistory(o, who, `Added customer ${customer.name}`),
  });
}
