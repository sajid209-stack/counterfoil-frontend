/**
 * What a booking's Overview states, derived from the records — nothing stored.
 *
 * One layout for every booking (docs/catalog.md §10.4), so one set of derivations:
 * what each ticket has sold and taken (the order ledger, for ANY product), the
 * days of an on-a-date booking and how full each is, and the next days a
 * repeating booking can be booked. The availability engine is the one the till
 * uses; the money is read from the orders, never from sold × today's price.
 */
import {
  eventDays,
  eventView,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isEventProduct,
  isOpenOn,
  peekOrders,
  tierDays,
  type Minor,
  type Product,
} from "@/lib/api";
import { isDailyCapped, isResourceType } from "@/lib/schedule";

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** One ticket's sales, as the Overview's "Sales by ticket" states them. */
export interface TicketSalesRow {
  id: string;
  name: string;
  /** What it costs now. */
  price: Minor;
  /** How many exist, or null when it has no limit of its own. */
  quantity: number | null;
  /** Sold in all: before Counterfoil plus what the orders here sold, net of refunds. */
  sold: number;
  /** Of those, sold before Counterfoil recorded sales. They carry no money. */
  opening: number;
  /** Money actually taken, from the order lines — never sold × today's price. */
  taken: Minor;
  /** When sales stop (yyyy-mm-dd), if they do. */
  salesEnd?: string;
}

interface Ledger {
  sold: number;
  taken: Minor;
}

/**
 * What the orders sold of ONE product, per ticket (tier id).
 *
 * The event ledger in lib/api/events.ts does this for events only; every
 * booking has the same order lines, so this is the same replay for any product.
 * A cancelled order sold nothing; a refunded line gives back its quantity and
 * its money. Lines written when events were a separate record carry an `evt_`
 * prefix in front of the same id and still count.
 */
export function productLedger(p: Pick<Product, "id" | "bookingType">): Map<string, Ledger> {
  const legacy = isEventProduct(p) ? `evt_${p.id}` : null;
  const out = new Map<string, Ledger>();
  for (const o of peekOrders()) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) {
      if ((l.productId !== p.id && l.productId !== legacy) || !l.tierId || l.parentLineId) continue;
      const cur = out.get(l.tierId) ?? { sold: 0, taken: 0 };
      cur.sold += l.quantity - (l.refundedQuantity ?? 0);
      cur.taken += l.total - (l.refundedAmount ?? 0);
      out.set(l.tierId, cur);
    }
  }
  return out;
}

/** Each ticket's sales: what it opened with plus what the orders here sold. A
 *  ticket that has been switched off is listed only if it ever sold. */
export function ticketSales(p: Product): TicketSalesRow[] {
  const led = productLedger(p);
  const rows: TicketSalesRow[] = [];
  for (const t of p.tiers) {
    const l = led.get(t.id);
    const opening = t.openingSold ?? 0;
    const sold = opening + (l?.sold ?? 0);
    if (!t.active && sold === 0) continue;
    rows.push({
      id: t.id,
      name: t.name,
      price: t.price,
      quantity: t.capacity ?? null,
      sold,
      opening,
      taken: l?.taken ?? 0,
      salesEnd: t.salesEndsAt ? t.salesEndsAt.slice(0, 10) : undefined,
    });
  }
  return rows;
}

export interface SalesTotals {
  sold: number;
  /** The total number of tickets, when EVERY ticket has a quantity; otherwise
   *  there is no honest total, and the Overview says how many sold. */
  capacity: number | null;
  taken: Minor;
}

export function salesTotals(rows: TicketSalesRow[]): SalesTotals {
  const counted = rows.length > 0 && rows.every((r) => r.quantity !== null);
  return {
    sold: rows.reduce((n, r) => n + r.sold, 0),
    capacity: counted ? rows.reduce((n, r) => n + (r.quantity ?? 0), 0) : null,
    taken: rows.reduce((n, r) => n + r.taken, 0),
  };
}

/** One day of an on-a-date booking, and how full it is. */
export interface DayLoad {
  id: string;
  date: string;
  name?: string;
  startTime: string;
  endTime?: string;
  /** Tickets sold that admit this day — a weekend pass counts on both its days. */
  sold: number;
  /** Tickets that exist for this day, or null if any ticket for it has no limit. */
  cap: number | null;
  pct: number;
  /** The ticket types that admit this day. */
  admits: string[];
}

/**
 * The days of an on-a-date booking with their grouped capacity. Every ticket
 * that admits a day draws it down, so a weekend pass takes a place on Saturday
 * and on Sunday; counting only the tickets named after a day would let a
 * festival sell its Saturday twice. A one-day booking has one day.
 */
export function dayLoads(p: Product): DayLoad[] {
  if (!isEventProduct(p) || !p.event) return [];
  const e = eventView(p);
  const days = eventDays(e);
  return days.map((d) => {
    const admits = e.tiers.filter((t) => tierDays(e, t).some((x) => x.id === d.id));
    const sold = admits.reduce((n, t) => n + t.sold, 0);
    const limited = admits.length > 0 && admits.every((t) => !t.unlimited);
    const cap = limited ? admits.reduce((n, t) => n + t.quantity, 0) : null;
    return {
      id: d.id,
      date: d.date,
      name: d.name,
      startTime: d.startTime ?? e.startsAt.slice(11, 16),
      endTime: d.endTime ?? (days.length === 1 && e.endsAt ? e.endsAt.slice(11, 16) : undefined),
      sold,
      cap,
      pct: cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0,
      admits: admits.map((t) => t.name),
    };
  });
}

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
