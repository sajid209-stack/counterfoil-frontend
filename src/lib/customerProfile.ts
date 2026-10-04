/**
 * What a customer comes for — derived, never stored.
 *
 * A pure module (no React, no store reads): hand it a customer's orders and
 * bookings and the demo's "now" and it says who they are to the business. The
 * customer page draws it; a backend could serve the same answer from one
 * endpoint.
 *
 * Everything here is deliberately honest about thin history. A pattern is only
 * reported when it is held by enough bookings and enough of them agree — a
 * "usually Fridays" built from two bookings is a coincidence stated as a fact,
 * which is worse than saying nothing. Where there is not enough, the field is
 * simply absent and `enoughForPattern` is false, so the page can say so.
 *
 * Times are read as the wall-clock text a slot carries ("2026-07-31T18:00:00+06:00"
 * → 31 Jul, 18:00), never through a Date in the browser's zone: a pattern like
 * "evenings" is about the venue's evening, and a browser in another zone must
 * not move a booking across it.
 */
import type { Booking, Order, PaymentMethod } from "@/lib/api/types";

/** A wall-clock instant as `YYYY-MM-DDTHH:MM`. */
export type WallTime = string;

/** The wall-clock part of an ISO string: its first 16 characters. */
export const wallOf = (iso: string): WallTime => iso.slice(0, 16);

const DAY = 86_400_000;
const ymdOf = (w: WallTime) => w.slice(0, 10);
/** Whole calendar days from `a` to `b` (positive when `b` is later). */
const daysBetween = (a: WallTime, b: WallTime): number =>
  Math.round((Date.parse(`${ymdOf(b)}T00:00:00Z`) - Date.parse(`${ymdOf(a)}T00:00:00Z`)) / DAY);

/** Weekday of a wall date, 0 = Sunday. */
const weekdayOf = (w: WallTime): number => new Date(`${ymdOf(w)}T00:00:00Z`).getUTCDay();

export type PartOfDay = "morning" | "afternoon" | "evening";
/** Before noon, noon to five, five onwards — how a counter talks about a day. */
export function partOfDay(w: WallTime): PartOfDay {
  const hour = Number(w.slice(11, 13));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export type Relationship = "new" | "regular" | "lapsed";

/** The thresholds, in one place. */
export const PROFILE_RULES = {
  /** A first booking this recent keeps someone "new". */
  newWithinDays: 30,
  /** This many bookings inside `regularWithinDays` makes someone a regular. */
  regularBookings: 4,
  regularWithinDays: 90,
  /** No booking for this long makes someone lapsed. */
  lapsedAfterDays: 90,
  /** Fewer bookings than this is not a pattern, whatever they say. */
  minBookingsForPattern: 3,
  /** How much of the history has to agree before it is called "usually". */
  patternShare: 0.4,
} as const;

/** Orders that never took money, or gave it all back — not part of what
 *  someone buys. */
const isVoided = (o: Order) => o.status === "cancelled" || o.status === "refunded";

/** A booking the customer has, or is going to, turn up to. */
const isLive = (b: Booking) => b.status === "confirmed" && !b.noShow;

/** Line ids that are not a booking the customer came for. */
const NOT_A_BOOKING = /^(addon_|inv_|custom|membership_)/;

export interface FavouriteBooking {
  productId: string;
  name: string;
  /** In how many orders it was bought. */
  times: number;
  /** When it was last bought, as an ISO instant. */
  lastAt: string;
}

export interface UsualTime {
  /** 0 = Sunday. Present only when enough bookings share it. */
  weekday?: number;
  part?: PartOfDay;
}

export interface CustomerProfile {
  /** Bookings they turned up to (check-ins) — the At a glance fact. The seed
   *  rarely records these, so the relationship is NOT based on them. */
  visits: number;
  /** What they BOOKED: non-cancelled, non-refunded orders containing a booking. */
  bookedCount: number;
  firstBooked: WallTime | null;
  lastBooked: WallTime | null;
  /** Whole days since the last booking, relative to `asOf`. */
  daysSinceLastBooked: number | null;
  relationship: Relationship | null;
  /** Top three, most bought first. */
  favourites: FavouriteBooking[];
  usualTime: UsualTime | null;
  /** The commonest group size, from at least two bookings. */
  usualParty: number | null;
  /** The commonest way they pay. */
  usualPayment: PaymentMethod | null;
  /** True once there are enough bookings for a day / time pattern to mean anything. */
  enoughForPattern: boolean;
}

/** The most frequent value; on a tie, the one seen most recently (the array is
 *  in oldest-first order, so the later one wins a tie). */
function mode<T>(values: T[]): { value: T; count: number } | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count || (count === best.count && values.lastIndexOf(value) > values.lastIndexOf(best.value))) {
      best = { value, count };
    }
  }
  return best;
}

export function buildCustomerProfile(input: {
  orders: Order[];
  bookings: Booking[];
  /** The demo's now, as `YYYY-MM-DDTHH:MM`. */
  asOf: WallTime;
}): CustomerProfile {
  const { orders, bookings, asOf } = input;

  // ── what they booked, and the relationship ──────────────────────────────
  const visits = bookings.filter((b) => (b.checkedIn ?? 0) > 0).length;
  const live = orders.filter((o) => !isVoided(o));
  const bookedAt = live
    .filter((o) => o.lines.some((l) => !l.parentLineId && !NOT_A_BOOKING.test(l.productId)))
    .map((o) => wallOf(o.createdAt))
    .sort();
  const bookedCount = bookedAt.length;
  const firstBooked = bookedAt[0] ?? null;
  const lastBooked = bookedAt.at(-1) ?? null;
  const daysSinceLastBooked = lastBooked ? Math.max(0, daysBetween(lastBooked, asOf)) : null;
  const recentBookings = bookedAt.filter((w) => daysBetween(w, asOf) <= PROFILE_RULES.regularWithinDays).length;

  let relationship: Relationship | null = null;
  if (bookedCount <= 1 || (firstBooked && daysBetween(firstBooked, asOf) < PROFILE_RULES.newWithinDays)) {
    relationship = "new";
  } else if (daysSinceLastBooked != null && daysSinceLastBooked > PROFILE_RULES.lapsedAfterDays) {
    relationship = "lapsed";
  } else if (recentBookings >= PROFILE_RULES.regularBookings) {
    relationship = "regular";
  }

  // ── what they buy most ───────────────────────────────────────────────────
  const byProduct = new Map<string, FavouriteBooking>();
  for (const o of live) {
    const seen = new Set<string>();
    for (const l of o.lines) {
      if (l.parentLineId || NOT_A_BOOKING.test(l.productId) || seen.has(l.productId)) continue;
      seen.add(l.productId);
      const prev = byProduct.get(l.productId);
      if (!prev) {
        byProduct.set(l.productId, { productId: l.productId, name: l.productName, times: 1, lastAt: o.createdAt });
      } else {
        prev.times += 1;
        if (Date.parse(o.createdAt) > Date.parse(prev.lastAt)) {
          prev.lastAt = o.createdAt;
          prev.name = l.productName;
        }
      }
    }
  }
  const favourites = [...byProduct.values()]
    .sort((a, b) => b.times - a.times || Date.parse(b.lastAt) - Date.parse(a.lastAt))
    .slice(0, 3);

  // ── when, and with how many ──────────────────────────────────────────────
  const liveBookings = bookings
    .filter(isLive)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  const enoughForPattern = bookedCount >= PROFILE_RULES.minBookingsForPattern;

  let usualTime: UsualTime | null = null;
  if (enoughForPattern && liveBookings.length >= PROFILE_RULES.minBookingsForPattern) {
    const days = mode(liveBookings.map((b) => weekdayOf(wallOf(b.slotStart))));
    const parts = mode(liveBookings.map((b) => partOfDay(wallOf(b.slotStart))));
    const need = PROFILE_RULES.patternShare * liveBookings.length;
    const found: UsualTime = {};
    if (days && days.count >= need) found.weekday = days.value;
    if (parts && parts.count >= need) found.part = parts.value;
    if (found.weekday != null || found.part != null) usualTime = found;
  }

  const party = liveBookings.length >= 2 ? mode(liveBookings.map((b) => b.partySize)) : null;

  const methods: PaymentMethod[] = [];
  for (const o of [...live].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (const p of o.payments) if (p.status === "confirmed" && p.amount > 0) methods.push(p.method);
  }
  const pay = mode(methods);

  return {
    visits,
    bookedCount,
    firstBooked,
    lastBooked,
    daysSinceLastBooked,
    relationship,
    favourites,
    usualTime,
    usualParty: party?.value ?? null,
    usualPayment: pay?.value ?? null,
    enoughForPattern,
  };
}

/** The next bookings still to come, soonest first. "Still to come" is a start
 *  at or after `asOf`; a cancelled booking is not coming. */
export function upcomingBookings(bookings: Booking[], asOf: WallTime, limit = 3): Booking[] {
  return bookings
    .filter((b) => b.status === "confirmed" && wallOf(b.slotStart) >= asOf)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
    .slice(0, limit);
}

/** How long ago a wall date was, in whole days (never negative). */
export const daysAgo = (w: WallTime, asOf: WallTime): number => Math.max(0, daysBetween(w, asOf));
