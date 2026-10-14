/**
 * What a booking's Overview states, derived from the records — nothing stored.
 *
 * Two questions a manager opens a booking to answer: "when can people come, and
 * how full is it?" and "is it selling?". The first is read from the same
 * availability engine the till uses; the second from the orders.
 */
import { getDailyRemaining, getResourceMatrix, getSlots, isOpenOn, peekOrders, type Minor, type Product } from "@/lib/api";
import { isDailyCapped, isResourceType } from "@/lib/schedule";
import { lineNet, settled } from "@/lib/api/reports";

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface SalesRecent {
  /** Tickets or places sold. */
  qty: number;
  /** What they took, before VAT. */
  net: Minor;
  orders: number;
}

/**
 * What a booking sold since `from` — the last 30 days. Counted from the order
 * lines of orders that were actually paid or part paid (the same rule the
 * analytics use), and with no upper bound: a sale rung up at the till today is
 * later than the demo's pinned date and still counts.
 */
export function salesSince(productId: string, from: string): SalesRecent {
  let qty = 0;
  let net = 0;
  let orders = 0;
  for (const o of peekOrders()) {
    if (!settled(o) || o.createdAt.slice(0, 10) < from) continue;
    const mine = o.lines.filter((l) => l.productId === productId && !l.parentLineId);
    if (!mine.length) continue;
    orders++;
    for (const l of mine) {
      qty += l.quantity - (l.refundedQuantity ?? 0);
      net += lineNet(l) - (l.refundedAmount ?? 0);
    }
  }
  return { qty, net, orders };
}

export const thirtyDaysBefore = (today: string) => shiftDay(today, -30);

export interface ComingUpRow {
  date: string;
  /** How many times (departures, slots) it has that day; 0 for a day-capped booking. */
  times: number;
  /** The first of them, "HH:MM". */
  first?: string;
  used: number;
  cap: number;
  unit: "places" | "slots";
}

/**
 * The next few days it can be booked, with how full each is. Empty for a
 * booking that has no days of its own (an entry ticket, a pass), which the
 * Overview says in words rather than drawing an empty list.
 */
export function comingUp(p: Product, today: string, limit = 4, horizon = 45): ComingUpRow[] {
  if (!p.schedule) return [];
  const rows: ComingUpRow[] = [];
  for (let n = 0; n < horizon && rows.length < limit; n++) {
    const date = shiftDay(today, n);
    if (!isOpenOn(p, date)) continue;
    if (isResourceType(p.bookingType)) {
      let cap = 0;
      let used = 0;
      let first: string | undefined;
      for (const row of getResourceMatrix(p, date)) {
        if (row.resource.outOfService) continue;
        cap += row.slots.length;
        used += row.slots.filter((c) => !c.available).length;
        const open = row.slots.find((c) => c.available)?.time;
        if (open && (!first || open < first)) first = open;
      }
      if (cap > 0) rows.push({ date, times: 0, first, used, cap, unit: "slots" });
    } else if (isDailyCapped(p.bookingType)) {
      const perDay = p.schedule.dailyCapacity ?? 0;
      if (perDay > 0) rows.push({ date, times: 0, used: perDay - Math.min(perDay, getDailyRemaining(p, date)), cap: perDay, unit: "places" });
    } else {
      const slots = getSlots(p, date);
      if (slots.length) {
        rows.push({
          date,
          times: slots.length,
          first: slots[0].time,
          used: slots.reduce((s, x) => s + x.sold, 0),
          cap: slots.reduce((s, x) => s + x.capacity, 0),
          unit: "places",
        });
      }
    }
  }
  return rows;
}
