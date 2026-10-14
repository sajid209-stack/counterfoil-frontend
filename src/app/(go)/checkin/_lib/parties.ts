import type { Booking, Customer, Minor, Order } from "@/lib/api";

/* ── The day at the door, as parties ──────────────────────────────────────
 *
 * Check-in is read by a steward with a guest standing in front of them, so
 * everything here answers the questions that guest raises: are they on the
 * list, do they owe anything, are they in yet. Pure, so the page and its tests
 * agree on who counts as "due" or "not in yet" without either recomputing it.
 */

/** The four ways the list is cut. */
export type CheckInFilter = "all" | "due" | "notin" | "in";
export const FILTERS: CheckInFilter[] = ["all", "due", "notin", "in"];

export type ArrivalState = "in" | "partial" | "notin" | "noshow";

export interface Party {
  booking: Booking;
  order: Order | undefined;
  /** Display name — the customer's, or the reference when there is none. */
  name: string;
  /** True when `name` is really the reference (no customer name was given). */
  nameIsReference: boolean;
  reference: string;
  size: number;
  arrived: number;
  state: ArrivalState;
  /** What the party's order still owes, in minor units. */
  due: Minor;
  /** Session key: product and start. */
  sessionKey: string;
  phone: string | null;
}

export interface PartyInput {
  bookings: Booking[];
  orders: Order[];
  customers: Customer[];
  outstanding: (o: Order) => Minor;
}

export function buildParties({ bookings, orders, customers, outstanding }: PartyInput): Party[] {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const byCustomer = new Map(customers.map((c) => [c.id, c]));
  return bookings.map((b) => {
    const order = byOrder.get(b.orderId);
    const named = order?.customerName?.trim();
    const arrived = b.checkedIn ?? 0;
    const state: ArrivalState = b.noShow ? "noshow" : arrived >= b.partySize ? "in" : arrived > 0 ? "partial" : "notin";
    return {
      booking: b,
      order,
      /* No name and no order behind it: an empty name, which the row draws as
         "Walk-in" — never the internal order id. */
      name: named || order?.reference || "",
      nameIsReference: !named && !!order,
      reference: order?.reference ?? "",
      size: b.partySize,
      arrived,
      state,
      due: order ? outstanding(order) : 0,
      sessionKey: `${b.productId}|${b.slotStart}`,
      phone: (order?.customerId ? byCustomer.get(order.customerId)?.phone : null) ?? null,
    };
  });
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Does a party match what was typed in the search box? Name, booking code or
 *  phone — a phone in any format ("01712-345678", "+8801712345678"). */
export function matchesSearch(p: Party, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (p.booking.orderId.toLowerCase().includes(q)) return true;
  if (p.reference.toLowerCase().includes(q)) return true;
  if (p.order?.customerName?.toLowerCase().includes(q)) return true;
  const qd = digits(q);
  // Three digits is enough to mean a phone and not a stray number in a name.
  if (qd.length >= 3 && p.phone && digits(p.phone).includes(qd)) return true;
  return false;
}

/** A party someone has to collect from. A guest recorded as not coming is not
 *  collected from at the door. */
export const isDue = (p: Party) => p.state !== "noshow" && p.due > 0;

export function inFilter(p: Party, f: CheckInFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "due":
      return isDue(p);
    case "notin":
      return p.state === "notin" || p.state === "partial";
    case "in":
      return p.state === "in";
  }
}

export function countByFilter(ps: Party[]): Record<CheckInFilter, number> {
  return {
    all: ps.length,
    due: ps.filter((p) => inFilter(p, "due")).length,
    notin: ps.filter((p) => inFilter(p, "notin")).length,
    in: ps.filter((p) => inFilter(p, "in")).length,
  };
}

/** What is still to collect across parties: each ORDER counted once, however
 *  many of its bookings are on the list (two rows of one order owe one sum). */
export function totalDue(ps: Party[]): { amount: Minor; parties: number } {
  const seen = new Set<string>();
  let amount = 0;
  let parties = 0;
  for (const p of ps) {
    if (!isDue(p)) continue;
    parties += 1;
    if (seen.has(p.booking.orderId)) continue;
    seen.add(p.booking.orderId);
    amount += p.due;
  }
  return { amount, parties };
}

/** Sessions in time order, each with its parties. Sorted by start, then by
 *  booking name so two bookings at one time keep a stable order. */
export function groupBySession(ps: Party[], productName: (id: string) => string): { key: string; productId: string; start: string; parties: Party[] }[] {
  const map = new Map<string, Party[]>();
  for (const p of ps) map.set(p.sessionKey, [...(map.get(p.sessionKey) ?? []), p]);
  return [...map.entries()]
    .map(([key, parties]) => ({ key, productId: parties[0].booking.productId, start: parties[0].booking.slotStart, parties }))
    .sort((a, b) => a.start.localeCompare(b.start) || productName(a.productId).localeCompare(productName(b.productId)));
}
