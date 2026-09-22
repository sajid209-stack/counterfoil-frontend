/**
 * The catalog: everything an operator sells, as one list.
 *
 * Bookings and events were two features with two lists, two ways of saying
 * whether a thing was for sale, and two "new" buttons — so an operator adding
 * a sunset boat trip had to decide which half of the product it belonged to
 * before they could start. They are one feature now. The records stay what
 * they are (a `Product` is configured by its booking behaviour, an
 * `EventRecord` by its date, tickets and page); this module is only the one
 * vocabulary both are read in.
 *
 * Nothing here is stored. Every field is derived from the record and the
 * clock, the same rule `lib/sellable` and the events lifecycle already follow.
 */
import {
  eventCapacity,
  eventFromPrice,
  eventSold,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  type BookingTypeCode,
  type EventRecord,
  type Minor,
  type Product,
  type ProductInput,
  type Resource,
} from "@/lib/api";
import { sellingBlockers, sellingWarnings, type Blocker, type SellingWarning } from "@/lib/sellable";
import { isDailyCapped, isResourceType } from "@/lib/schedule";

export type CatalogKind = "booking" | "event";

/**
 * Whether a thing can be bought right now, in the same words for both kinds.
 *
 * - `onSale` — a customer could buy it today.
 * - `needsSetup` — switched on, but the till would have nothing to charge for
 *   (no price, no schedule, no court…). Its own state rather than "On sale" with
 *   a footnote, because "on" and "sellable" come apart exactly when somebody
 *   needs telling.
 * - `soldOut` — an event on sale with every ticket gone.
 * - `offSale` — a booking switched off, or an event not published.
 * - `ended` — an event whose date has passed.
 * - `archived` — out of the catalog; kept for the orders that point at it.
 */
export type CatalogState = "onSale" | "needsSetup" | "soldOut" | "offSale" | "ended" | "archived";

export interface CatalogItem {
  kind: CatalogKind;
  /** Unique across both kinds — a product and an event can share a raw id. */
  key: string;
  id: string;
  name: string;
  href: string;
  state: CatalogState;
  /** The cheapest way in, or null when nothing is left to buy. */
  fromPrice: Minor | null;
  updatedAt: string;
  /** An event's date; a booking has no single one. */
  startsAt?: string;
  blockers: Blocker[];
  /** Sellable now, but about to stop — dates running out, a sales window
   *  closing. The same rule the dashboard's Needs attention panel reads. */
  warnings: SellingWarning[];
  product?: Product;
  event?: EventRecord;
}

export const productState = (p: Product, blockers: Blocker[]): CatalogState =>
  p.status === "archived" ? "archived" : p.status !== "active" ? "offSale" : blockers.length ? "needsSetup" : "onSale";

export function eventState(e: EventRecord, now: Date): CatalogState {
  if (e.status === "archived") return "archived";
  if (!e.published) return "offSale";
  if (Date.parse(e.endsAt ?? e.startsAt) < now.getTime()) return "ended";
  if (eventCapacity(e) > 0 && eventFromPrice(e) === null) return "soldOut";
  return "onSale";
}

/**
 * Whether a row needs somebody: it cannot sell although it is switched on, or
 * it sells today and is about to stop. Something off sale, ended or archived
 * is not asking for anything — the operator put it there.
 */
export const needsAttention = (i: CatalogItem) =>
  (i.state === "needsSetup" || i.state === "onSale") && (i.blockers.length > 0 || i.warnings.length > 0);

export function productItem(p: Product, resources: Resource[], today: string): CatalogItem {
  const blockers = sellingBlockers(p, resources);
  const prices = p.tiers.filter((t) => t.active).map((t) => t.price);
  return {
    kind: "booking",
    key: `booking:${p.id}`,
    id: p.id,
    name: p.name,
    href: `/catalog/bookings/${p.id}`,
    state: productState(p, blockers),
    fromPrice: prices.length ? Math.min(...prices) : null,
    updatedAt: p.updatedAt,
    blockers,
    warnings: p.status === "active" ? sellingWarnings(p, today) : [],
    product: p,
  };
}

export function eventItem(e: EventRecord, now: Date): CatalogItem {
  return {
    kind: "event",
    key: `event:${e.id}`,
    id: e.id,
    name: e.title,
    href: `/catalog/events/${e.id}`,
    state: eventState(e, now),
    fromPrice: eventFromPrice(e),
    updatedAt: e.updatedAt,
    startsAt: e.startsAt,
    blockers: [],
    warnings: [],
    event: e,
  };
}

/** Sold against built, for an event's fill bar. */
export const eventFill = (e: EventRecord) => {
  const cap = eventCapacity(e);
  const sold = eventSold(e);
  return { sold, cap, pct: cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0 };
};

/**
 * How much of a booking's next week is taken — the booking half of the
 * "is it selling?" column, drawn with the same bar an event's fill uses so the
 * two kinds can be compared down one column.
 *
 * Measured in whatever the booking is sold by: places across its sessions, a
 * day's allowance, or the slots of its fields and lanes. Something with no
 * capacity to fill — an open entry ticket, a pass, a bundle — has no bar, and
 * says so with a count rather than an empty track.
 */
export interface BookingUse {
  used: number;
  cap: number;
  pct: number;
  unit: "places" | "slots";
}

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function bookingUse(p: Product, today: string, days = 7): BookingUse | null {
  if (!p.schedule) return null;
  let used = 0;
  let cap = 0;
  let unit: BookingUse["unit"] = "places";
  for (let n = 0; n < days; n++) {
    const date = shiftDay(today, n);
    if (isResourceType(p.bookingType)) {
      unit = "slots";
      for (const row of getResourceMatrix(p, date)) {
        if (row.resource.outOfService) continue;
        cap += row.slots.length;
        used += row.slots.filter((c) => !c.available).length;
      }
    } else if (isDailyCapped(p.bookingType)) {
      const perDay = p.schedule.dailyCapacity ?? 0;
      if (!perDay || !isOpenOn(p, date)) continue;
      cap += perDay;
      used += perDay - Math.min(perDay, getDailyRemaining(p, date));
    } else {
      for (const s of getSlots(p, date)) {
        cap += s.capacity;
        used += s.sold;
      }
    }
  }
  if (cap <= 0) return null;
  return { used, cap, pct: Math.min(100, Math.round((used / cap) * 100)), unit };
}

/**
 * What a booking is, in the operator's words — the catalog's "type" column and
 * the chooser's cards read the same key, so a card and the rows it creates can
 * never be called two different things.
 */
export type BookingKind =
  | "entry"
  | "timed"
  | "tour"
  | "space"
  | "appointment"
  | "course"
  | "pass"
  | "bundle";

export function bookingKindOf(bt: BookingTypeCode): BookingKind {
  switch (bt) {
    case "BT-01":
    case "BT-02":
    case "BT-06":
      return "entry";
    case "BT-03":
      return "timed";
    case "BT-09":
      return "tour";
    case "BT-04":
    case "BT-05":
      return "space";
    case "BT-10":
      return "appointment";
    case "BT-13":
      return "course";
    case "BT-12":
    case "BT-14":
      return "pass";
    case "BT-08":
      return "bundle";
    /* A seated show is a timed session whose places are seats: it is made as
       one and given a seat layout afterwards, so it is counted, named and
       offered as one — otherwise the chooser's counts could never add up to
       the catalog's. */
    case "BT-07":
    default:
      return "timed";
  }
}

/** The kinds the chooser offers, in the order it offers them — every kind a
 *  booking can be, so a card's "N in your catalog" and the Bookings tab agree. */
export const BOOKING_KINDS: BookingKind[] = ["entry", "timed", "tour", "space", "appointment", "course", "pass", "bundle"];

/** Copy an object without certain keys. Written out rather than destructured
 *  into throwaway names, so that adding a field to a record cannot silently
 *  start copying it into a duplicate. */
export function omit<T extends object, K extends keyof T>(source: T, keys: K[]): Omit<T, K> {
  const out = { ...source };
  for (const key of keys) delete out[key];
  return out;
}

/**
 * A booking, as a new one to be made from it: everything but its identity,
 * off sale so a half-edited copy never reaches the till, and every price tier
 * given a fresh id so an order can never resolve to a tier on the wrong
 * product. The catalog's row menu and the chooser's "copy something you
 * already sell" both make copies, and must make the same one.
 */
export function productCopy(p: Product, name: string): ProductInput {
  return {
    ...omit(p, ["id", "createdAt", "updatedAt", "archivedAt", "tiers"]),
    name,
    status: "inactive",
    tiers: p.tiers.map((tier) => omit(tier, ["id"])),
  };
}
