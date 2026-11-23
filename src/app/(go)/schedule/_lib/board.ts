import { buildDay } from "@/lib/dayModel";
import { isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import type { Booking, HoldView, Minor, Order, OrderSource, Product, Resource, Staff } from "@/lib/api";
import { bookingEnd } from "@/app/(os)/calendar/_components/model";
import { openSlotsFor, type OpenOption } from "@/app/(os)/calendar/_components/openSlots";
import { flexDurations, freeProvidersAt, patternOf, providerMinutes, providerTimes } from "@/lib/sale/selection";

/**
 * The counter's day, as a board: what can be booked is drawn as columns
 * (a field, a lane, a court, a show) against the hours, and every block on it
 * is one of four things — free, booked, on hold, or a show with seats.
 *
 * It asks the SAME engine the OS calendar asks (`openSlotsFor`) what is free,
 * so the till and the office can never disagree about whether 18:00 on the
 * outdoor field can be sold.
 *
 * Columns come in groups — Fields, Lanes, Courts, Shows — because a phone
 * holds about four columns before a name stops fitting, and a cashier looking
 * for a bowling lane should not scroll past two turf fields to find one.
 */

export type ColumnKind = "resource" | "session" | "unassigned" | "provider";

export interface Column {
  id: string;
  name: string;
  kind: ColumnKind;
  resource?: Resource;
  /** The show a session column is. */
  product?: Product;
  /** The person an appointment column is. */
  staff?: Staff;
  /** Minutes from midnight: when this column sells at all (its products'
   *  opening hours), so a drag cannot draw outside them. */
  hours?: [number, number];
  /** The length a tap on empty time selects: one slot, the shortest length
   *  sold, one appointment. */
  natural?: number;
  /** What a tap's start snaps to (the slot grid, or the length increment). */
  snap?: number;
}

export interface FreeBlock {
  type: "free";
  key: string;
  start: number;
  end: number;
  time: string;
  /** Every booking this hour can be sold as, cheapest first. */
  options: OpenOption[];
  price: Minor;
}

export interface BookedBlock {
  type: "booking";
  key: string;
  start: number;
  end: number;
  booking: Booking;
  product?: Product;
  /** Who it is for, when the order names them. */
  guest: string | null;
  /** Where it was sold, from the order's own snapshot. Null is a direct sale. */
  source: OrderSource | null;
  arrived: boolean;
  noShow: boolean;
}

export interface HeldBlock {
  type: "hold";
  key: string;
  start: number;
  end: number;
  hold: HoldView;
}

export interface SessionBlock {
  type: "session";
  key: string;
  start: number;
  end: number;
  time: string;
  product: Product;
  price: Minor;
  capacity: number;
  remaining: number;
  /** Places held back on this departure, and for whom. */
  held: HoldView[];
  past: boolean;
}

export type Block = FreeBlock | BookedBlock | HeldBlock | SessionBlock;

export interface Group {
  key: string;
  /** The operator's own plural ("Fields", "Lanes") — data, not a message. */
  label: string;
  isSessions: boolean;
  /** Appointments with a person: the columns are the providers. */
  isProviders?: boolean;
  columns: Column[];
  blocks: Map<string, Block[]>;
  /** Minutes from midnight: the first and last hour drawn. */
  from: number;
  to: number;
  freeCount: number;
}

const counterSellable = (p: Product) =>
  p.status === "active" && p.tiers.some((t) => t.active) && p.channels.includes("counter");

/** "18:30" from minutes after midnight. */
export const toTimeOfDay = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const floorHour = (m: number) => Math.floor(m / 60) * 60;
const ceilHour = (m: number) => Math.ceil(m / 60) * 60;

export function buildBoard(args: {
  products: Product[];
  resources: Resource[];
  bookings: Booking[];
  holds: HoldView[];
  orders: Order[];
  date: string;
  today: string;
  nowMinutes: number;
  locationId: string;
  sessionsLabel: string;
  placesLabel: string;
  /** Who can take appointments (the team), and what to call that group. */
  staff?: Staff[];
  providersLabel?: string;
}): Group[] {
  const { date, today, nowMinutes, locationId } = args;
  const here = args.products.filter((p) => counterSellable(p) && p.locationIds.includes(locationId));
  const resourceProducts = here.filter((p) => isResourceType(p.bookingType) && (p.resourceIds ?? []).length > 0);
  const sessionProducts = here.filter((p) => isSlotBased(p.bookingType) && !isResourceType(p.bookingType));

  const guestOf = (orderId: string) => args.orders.find((o) => o.id === orderId)?.customerName ?? null;
  const sourceOf = (orderId: string) => args.orders.find((o) => o.id === orderId)?.source ?? null;
  const dayBookings = args.bookings.filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === date);
  const dayHolds = args.holds.filter((h) => h.active && h.date === date);
  const free = openSlotsFor(here, date, today, nowMinutes);

  const groups: Group[] = [];

  // ── fields, lanes and courts, grouped by what the operator calls them ──
  const byNoun = new Map<string, { label: string; resources: Resource[]; products: Product[] }>();
  for (const p of resourceProducts) {
    for (const rid of p.resourceIds ?? []) {
      const r = args.resources.find((x) => x.id === rid && x.status !== "archived");
      if (!r) continue;
      const key = (r.nounPlural || args.placesLabel).toLowerCase();
      const g = byNoun.get(key) ?? { label: r.nounPlural || args.placesLabel, resources: [], products: [] };
      if (!g.resources.some((x) => x.id === r.id)) g.resources.push(r);
      if (!g.products.some((x) => x.id === p.id)) g.products.push(p);
      byNoun.set(key, g);
    }
  }

  for (const [key, g] of byNoun) {
    const columns: Column[] = g.resources
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((r): Column => {
        const mine = g.products.filter((p) => (p.resourceIds ?? []).includes(r.id));
        let a = Infinity;
        let z = -Infinity;
        let natural = Infinity;
        let snap = Infinity;
        for (const p of mine) {
          const sch = p.schedule;
          if (sch) {
            a = Math.min(a, toMinutes(sch.startTime));
            z = Math.max(z, toMinutes(sch.endTime) + (sch.sessionMinutes || sch.slotMinutes || 60));
          }
          if (patternOf(p) === "flexible") {
            natural = Math.min(natural, flexDurations(p)[0] ?? 60);
            snap = Math.min(snap, Math.min(60, Math.max(15, p.durationConfig?.incrementMinutes ?? 30)));
          } else {
            const step = sch?.sessionMinutes || sch?.slotMinutes || 60;
            natural = Math.min(natural, step);
            snap = Math.min(snap, step);
          }
        }
        return {
          id: r.id,
          name: r.name,
          kind: "resource",
          resource: r,
          hours: Number.isFinite(a) && Number.isFinite(z) ? [a, z] : undefined,
          natural: Number.isFinite(natural) ? natural : 60,
          snap: Number.isFinite(snap) ? snap : 60,
        };
      });
    const blocks = new Map<string, Block[]>();
    const productIds = new Set(g.products.map((p) => p.id));
    let lo = Infinity;
    let hi = -Infinity;
    let freeCount = 0;

    for (const p of g.products) {
      const sch = p.schedule;
      if (!sch) continue;
      lo = Math.min(lo, toMinutes(sch.startTime));
      hi = Math.max(hi, toMinutes(sch.endTime) + (sch.sessionMinutes || sch.slotMinutes || 60));
    }

    for (const col of columns) {
      const list: Block[] = [];
      /* A lane out of service draws nothing bookable; the column header says
         so, once, rather than once an hour. */
      if (!col.resource?.outOfService) {
        for (const s of free.filter((f) => f.laneId === col.id)) {
          if (!s.options.some((o) => productIds.has(o.product.id))) continue;
          freeCount += 1;
        }
      }
      for (const b of dayBookings.filter((x) => x.resourceId === col.id)) {
        const product = here.find((p) => p.id === b.productId);
        const start = toMinutes(b.slotStart.slice(11, 16));
        const end = start + Math.max(15, Math.round((bookingEnd(b, product).getTime() - Date.parse(b.slotStart)) / 60000));
        list.push({ type: "booking", key: `bk|${b.id}`, start, end, booking: b, product, guest: guestOf(b.orderId), source: sourceOf(b.orderId), arrived: (b.checkedIn ?? 0) > 0, noShow: !!b.noShow });
        lo = Math.min(lo, start);
        hi = Math.max(hi, end);
      }
      for (const h of dayHolds.filter((x) => x.kind === "resource" && x.resourceId === col.id)) {
        const start = h.slotStart ? toMinutes(h.slotStart.slice(11, 16)) : lo;
        const end = h.slotEnd ? toMinutes(h.slotEnd.slice(11, 16)) : hi;
        list.push({ type: "hold", key: `hold|${h.id}`, start, end, hold: h });
      }
      blocks.set(col.id, list.sort((a, b) => a.start - b.start));
    }

    /* Bookings of these products that name no field. They are real and they
       take a place somewhere — hiding them would make the board look freer
       than it is — so they get a column of their own, but only when there
       are any. */
    const unassigned = dayBookings.filter((b) => productIds.has(b.productId) && !b.resourceId);
    if (unassigned.length) {
      const id = `unassigned|${key}`;
      columns.push({ id, name: "", kind: "unassigned" });
      blocks.set(
        id,
        unassigned.map((b) => {
          const product = here.find((p) => p.id === b.productId);
          const start = toMinutes(b.slotStart.slice(11, 16));
          const end = start + Math.max(15, Math.round((bookingEnd(b, product).getTime() - Date.parse(b.slotStart)) / 60000));
          return { type: "booking" as const, key: `bk|${b.id}`, start, end, booking: b, product, guest: guestOf(b.orderId), source: sourceOf(b.orderId), arrived: (b.checkedIn ?? 0) > 0, noShow: !!b.noShow };
        }),
      );
    }

    if (!Number.isFinite(lo)) continue;
    groups.push({ key, label: g.label, isSessions: false, columns, blocks, from: floorHour(lo), to: ceilHour(hi), freeCount });
  }

  /* The biggest group first — the turf's fields or the bowling lanes, which
     are what a counter like this sells all day — rather than whichever the
     catalogue happened to list first. */
  groups.sort((x, y) => y.columns.length - x.columns.length || x.label.localeCompare(y.label));

  // ── appointments: one column per person, a block per appointment ──
  const providerProducts = here.filter((p) => patternOf(p) === "provider");
  if (providerProducts.length && args.staff) {
    const people = new Map<string, Staff>();
    for (const p of providerProducts) {
      for (const id of p.providerIds ?? []) {
        const m = args.staff.find((x) => x.id === id);
        if (m && !people.has(id)) people.set(id, m);
      }
    }
    const columns: Column[] = [];
    const blocks = new Map<string, Block[]>();
    let lo = Infinity;
    let hi = -Infinity;
    let freeCount = 0;
    for (const m of [...people.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const mine = providerProducts.filter((p) => (p.providerIds ?? []).includes(m.id));
      let a = Infinity;
      let z = -Infinity;
      let natural = Infinity;
      for (const p of mine) {
        const times = providerTimes(p, date).map(toMinutes);
        const len = providerMinutes(p);
        natural = Math.min(natural, len);
        if (times.length) {
          a = Math.min(a, ...times);
          z = Math.max(z, Math.max(...times) + len);
        }
      }
      const list: Block[] = [];
      for (const b of dayBookings.filter((x) => x.resourceId === m.id)) {
        const product = here.find((p) => p.id === b.productId);
        const start = toMinutes(b.slotStart.slice(11, 16));
        const end = start + Math.max(15, Math.round((bookingEnd(b, product).getTime() - Date.parse(b.slotStart)) / 60000));
        list.push({ type: "booking", key: `bk|${b.id}`, start, end, booking: b, product, guest: guestOf(b.orderId), source: sourceOf(b.orderId), arrived: (b.checkedIn ?? 0) > 0, noShow: !!b.noShow });
      }
      if (!Number.isFinite(a)) {
        if (!list.length) continue;
        a = Math.min(...list.map((b) => b.start));
        z = Math.max(...list.map((b) => b.end));
      }
      for (const b of list) z = Math.max(z, b.end);
      lo = Math.min(lo, a);
      hi = Math.max(hi, z);
      for (const p of mine) {
        for (const t of providerTimes(p, date)) {
          const tm = toMinutes(t);
          if ((date > today || (date === today && tm >= nowMinutes)) && freeProvidersAt(p, date, t).includes(m.id)) freeCount += 1;
        }
      }
      const nat = Number.isFinite(natural) ? natural : 60;
      columns.push({ id: m.id, name: m.name, kind: "provider", staff: m, hours: [a, z], natural: nat, snap: nat });
      blocks.set(m.id, list.sort((x, y) => x.start - y.start));
    }
    if (columns.length) {
      groups.push({ key: "providers", label: args.providersLabel ?? "Appointments", isSessions: false, isProviders: true, columns, blocks, from: floorHour(lo), to: ceilHour(hi), freeCount });
    }
  }

  // ── shows and tours: one column each, a block per departure ──
  if (sessionProducts.length) {
    const day = buildDay(sessionProducts, date);
    const columns: Column[] = [];
    const blocks = new Map<string, Block[]>();
    let lo = Infinity;
    let hi = -Infinity;
    let freeCount = 0;
    for (const p of sessionProducts) {
      const slots = day.slots.filter((s) => s.lane.isSession && s.lane.id === p.id);
      if (!slots.length) continue;
      columns.push({ id: p.id, name: p.name, kind: "session", product: p });
      blocks.set(
        p.id,
        slots.map((s, i) => {
          /* A tour that lasts longer than the gap between its departures would
             draw each block over the next. On the board a departure ends where
             the next one starts; how long it runs is the till's to state. */
          const next = slots[i + 1];
          const end = next ? Math.min(s.minutes + s.spanMinutes, next.minutes) : s.minutes + s.spanMinutes;
          const past = date < today || (date === today && s.minutes + s.spanMinutes <= nowMinutes);
          const held = dayHolds.filter((h) => h.productId === p.id && h.kind !== "resource" && (!h.slotStart || h.slotStart.slice(11, 16) === s.time));
          if (!past && (s.remaining ?? 0) > 0) freeCount += 1;
          lo = Math.min(lo, s.minutes);
          hi = Math.max(hi, s.minutes + s.spanMinutes);
          return {
            type: "session" as const,
            key: `ses|${p.id}|${s.time}`,
            start: s.minutes,
            end,
            time: s.time,
            product: p,
            price: s.price ?? p.tiers[0]?.price ?? 0,
            capacity: s.capacity ?? 0,
            remaining: s.remaining ?? 0,
            held,
            past,
          };
        }),
      );
    }
    if (columns.length) {
      groups.push({ key: "sessions", label: args.sessionsLabel, isSessions: true, columns, blocks, from: floorHour(lo), to: ceilHour(hi), freeCount });
    }
  }

  return groups;
}

/** How many bookings a day carries, for the dots on the week strip. */
export function dayLoad(bookings: Booking[], date: string, locationId: string): number {
  return bookings.filter((b) => b.status === "confirmed" && b.slotStart.slice(0, 10) === date && b.locationId === locationId).length;
}

/** The quarter hour the board draws and snaps to. */
export const QUARTER = 15;
export const snapDown = (m: number, to = QUARTER) => Math.floor(m / to) * to;
export const snapNearest = (m: number, to = QUARTER) => Math.round(m / to) * to;

/**
 * The stretches of one column that can be drawn on: inside its opening hours,
 * not already gone, and not under a booking or a hold. A drag is clamped to
 * the run it starts in, so it stops at the next booking instead of drawing
 * across it.
 *
 * `deadBefore` is the first minute of the day that can still be sold: 0 for a
 * future day, now for today, a whole day for yesterday.
 */
export function freeRuns(group: Group, column: Column, deadBefore: number): [number, number][] {
  if (group.isSessions || column.kind === "unassigned" || column.kind === "session") return [];
  if (column.resource?.outOfService) return [];
  const [open, close] = column.hours ?? [group.from, group.to];
  const from = Math.max(open, Math.ceil(deadBefore / QUARTER) * QUARTER);
  const busy = (group.blocks.get(column.id) ?? [])
    .map((b) => [b.start, b.end] as const)
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = from;
  for (const [a, b] of busy) {
    if (b <= at) continue;
    if (a > at) out.push([at, Math.min(a, close)]);
    at = Math.max(at, b);
    if (at >= close) break;
  }
  if (at < close) out.push([at, close]);
  return out.filter(([a, b]) => b > a);
}

/** The run that holds a minute, or null when that minute cannot be drawn on. */
export function runAt(runs: [number, number][], minute: number): [number, number] | null {
  return runs.find(([a, b]) => minute >= a && minute < b) ?? null;
}
