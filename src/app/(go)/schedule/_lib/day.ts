import { applyResourceRate, getResourceMatrix, getSlots } from "@/lib/api";
import { resolveProductPrice } from "@/lib/pricing";
import { isResourceType, isSlotBased, toMinutes } from "@/lib/schedule";
import type { Minor, Product, Resource } from "@/lib/api";

/**
 * A day at the counter, derived once.
 *
 * The screen used to list one row per PRODUCT per RESOURCE per time, which is
 * how a turf with two products sharing two fields produced sixty-five rows for
 * what is really two fields and two sessions. Availability is computed per
 * RESOURCE (a booking on the outdoor field blocks it for every product on it),
 * so "Cricket — Outdoor Field 18:00" and "Futsal — Outdoor Field 18:00" were
 * always the same free hour written twice, differing only in price.
 *
 * So a row here is a **slot on a schedulable thing**: one field at one time,
 * or one departure of one session. Which product it is sold as is a question
 * asked at the point of sale, and only where more than one answer exists.
 */

/** What a slot IS, as opposed to what it says. The label is a price or a
 *  count and cannot be filtered on; this can. */
export type SlotKind = "open" | "full";

/** One way to sell a slot: a booking and what it costs here. */
export interface SellOption {
  product: Product;
  price: Minor;
}

/** A schedulable thing: a field, a court, or a session that runs on its own. */
export interface Lane {
  id: string;
  name: string;
  /** For a field: the bookings that run on it. Empty for a session. */
  sub: string;
  isSession: boolean;
  resource: Resource | null;
  products: Product[];
}

export interface DaySlot {
  key: string;
  time: string;
  minutes: number;
  /** How long the slot runs, so "free right now" can mean the hour a counter
   *  is standing in rather than a guessed sixty minutes. */
  spanMinutes: number;
  lane: Lane;
  kind: SlotKind;
  /** Every booking this slot can be sold as, cheapest first. Empty when full. */
  options: SellOption[];
  /** The figure to state: the cheapest way in, or a session's ticket price. */
  price: Minor | null;
  /** Sessions only — a field is one place, and has no fill to draw. */
  sold?: number;
  capacity?: number;
  remaining?: number;
  waitlist: boolean;
}

export interface DayModel {
  slots: DaySlot[];
  /** Every field and court on today's schedule, in service or not. */
  lanes: Lane[];
  /** Out of service, named once rather than once an hour. */
  closed: Lane[];
}

const sessionMinutesOf = (p: Product) => p.schedule?.sessionMinutes || p.schedule?.slotMinutes || 60;

/** Slot rows, deduplicated by the thing being scheduled. */
export function buildDay(products: Product[], date: string): DayModel {
  const lanes = new Map<string, Lane>();
  const slots = new Map<string, DaySlot>();

  for (const p of products) {
    if (isResourceType(p.bookingType) && !p.flexibleDurations) {
      const minutes = sessionMinutesOf(p);
      for (const row of getResourceMatrix(p, date)) {
        const lane = lanes.get(row.resource.id) ?? {
          id: row.resource.id,
          name: row.resource.name,
          sub: "",
          isSession: false,
          resource: row.resource,
          products: [],
        };
        if (!lane.products.some((x) => x.id === p.id)) lane.products.push(p);
        lanes.set(lane.id, lane);

        /* A field that is out of service is named once, above the day. The
           dashboard settled this rule already: "Needs attention names them
           once, rather than once an hour." */
        if (row.resource.outOfService) continue;

        for (const cell of row.slots) {
          const key = `${lane.id}|${cell.time}`;
          const slot =
            slots.get(key) ??
            ({
              key,
              time: cell.time,
              minutes: toMinutes(cell.time),
              spanMinutes: minutes,
              lane,
              kind: "full",
              options: [],
              price: null,
              waitlist: false,
            } satisfies DaySlot);
          /* Availability can differ between two products on ONE field — a
             product with a buffer sees the hour after a booking as taken while
             a product without one does not. So the slot is open if any booking
             can take it, and lists only the ones that can. */
          if (cell.available) {
            slot.options.push({
              product: p,
              price: applyResourceRate(resolveProductPrice(p, date, cell.time, p.tiers[0]?.price ?? 0), minutes, row.resource),
            });
            slot.kind = "open";
          }
          if (minutes > slot.spanMinutes) slot.spanMinutes = minutes;
          if (p.waitlistEnabled) slot.waitlist = true;
          slots.set(key, slot);
        }
      }
    } else if (isSlotBased(p.bookingType)) {
      const lane: Lane = { id: p.id, name: p.name, sub: "", isSession: true, resource: null, products: [p] };
      lanes.set(lane.id, lane);
      const minutes = sessionMinutesOf(p);
      for (const s of getSlots(p, date)) {
        const open = s.remaining > 0;
        const price = resolveProductPrice(p, date, s.time, p.tiers[0]?.price ?? 0);
        slots.set(`${lane.id}|${s.time}`, {
          key: `${lane.id}|${s.time}`,
          time: s.time,
          minutes: toMinutes(s.time),
          spanMinutes: minutes,
          lane,
          kind: open ? "open" : "full",
          options: open ? [{ product: p, price }] : [],
          price,
          sold: s.sold,
          capacity: s.capacity,
          remaining: s.remaining,
          waitlist: !!p.waitlistEnabled,
        });
      }
    }
  }

  for (const lane of lanes.values()) {
    if (!lane.isSession) lane.sub = lane.products.map((p) => p.name).join(" · ");
  }
  for (const slot of slots.values()) {
    if (slot.lane.isSession) continue;
    slot.options.sort((a, b) => a.price - b.price);
    slot.price = slot.options[0]?.price ?? null;
  }

  const all = [...slots.values()].sort((a, b) => a.minutes - b.minutes || a.lane.name.localeCompare(b.lane.name));
  const laneList = [...lanes.values()].filter((l) => !l.isSession).sort((a, b) => a.name.localeCompare(b.name));
  return { slots: all, lanes: laneList, closed: laneList.filter((l) => l.resource?.outOfService) };
}

/** The slots grouped by their start time, in order. */
export function groupByTime(slots: DaySlot[]): { time: string; minutes: number; slots: DaySlot[] }[] {
  const out: { time: string; minutes: number; slots: DaySlot[] }[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.time === s.time) last.slots.push(s);
    else out.push({ time: s.time, minutes: s.minutes, slots: [s] });
  }
  return out;
}

/** A day either side of a plain `YYYY-MM-DD`. Parsed at midday for the same
 *  reason `formatDay` is: at +06:00 a midnight parse rolls the date onto the
 *  day before, which is how a booking gets filed to yesterday. */
export function shiftDay(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
