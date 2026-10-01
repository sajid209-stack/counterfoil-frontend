/**
 * What a booking page has to ask, on the storefront.
 *
 * The till asks a different question per booking type — guides, seat maps,
 * duration steppers, courses — and a storefront prototype does not need to
 * reproduce every one of them to prove the GUEST JOURNEY end to end. Four
 * shapes cover the common cases honestly; anything else sells as a plain
 * ticket (no date, no time) rather than pretending to offer a slot it cannot
 * check. See the report for what that leaves out.
 */
import { DEMO_NOW_MINUTES, DEMO_TODAY, dowOf, toMinutes } from "@/lib/schedule";
import { getDailyRemaining, getSlots, isOpenOn, isResourceFreeFor } from "@/lib/api/slots";
import type { BookingTypeCode, Product, ProductSchedule } from "@/lib/api/types";

export type StorefrontPattern = "open" | "daily" | "sessions" | "resource";

export function storefrontPattern(bt: BookingTypeCode): StorefrontPattern {
  if (bt === "BT-04" || bt === "BT-05") return "resource";
  if (bt === "BT-06") return "daily";
  if (bt === "BT-03" || bt === "BT-09") return "sessions";
  return "open";
}

const isoOfLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The next bookable days, in the business's own local reading of `now` —
 *  the same convention the venue page already uses for "open today". */
export function nextBookableDays(product: Product, now: Date, count = 10): string[] {
  const out: string[] = [];
  const maxDays = Math.max(1, product.policies?.salesWindowDays ?? 90);
  for (let i = 0; i <= maxDays && out.length < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = isoOfLocalDate(d);
    if (isOpenOn(product, iso)) out.push(iso);
  }
  return out;
}

export interface TimeOption {
  time: string;
  remaining: number;
}

/** Every departure on a date, for the flat-session patterns (BT-03/09). On
 *  today, a departure that has already started cannot be bought — the demo's
 *  clock (`DEMO_NOW_MINUTES`) has moved past it, same as the resource grid
 *  below, so the two patterns cannot disagree about what "now" means. */
export function timeOptionsFor(product: Product, date: string): TimeOption[] {
  const all = getSlots(product, date).map((s) => ({ time: s.time, remaining: s.remaining }));
  if (date !== DEMO_TODAY) return all;
  return all.filter((s) => toMinutes(s.time) >= DEMO_NOW_MINUTES);
}

/** This weekday's trading hours for the product's own schedule — respecting a
 *  day override — so the booking page can state the hours the TIME GRID is
 *  actually built from, rather than the venue's general opening hours (which
 *  can legitimately differ: a turf selling until 11pm inside a venue whose
 *  front gate reads "closes 6pm"). */
export function scheduleHoursOn(sch: ProductSchedule, date: string): { startTime: string; endTime: string } {
  const o = sch.dayOverrides?.[dowOf(date)];
  return { startTime: o?.startTime ?? sch.startTime, endTime: o?.endTime ?? sch.endTime };
}

export interface ResourceTimeOption {
  time: string;
  /** Resource ids free for the whole requested span at this time. */
  freeIds: string[];
}

/** Every start time on a date for a resource-pool booking (BT-04/05), checked
 *  for a SPECIFIC duration — not just the schedule's default session length —
 *  because a longer booking can rule out a start a shorter one would allow.
 *  Mirrors the till's own `flexStartBlocked` reasoning: a lane busy an hour
 *  into a 3-hour booking must refuse that start, not just the hour it is
 *  busy. Pass `resourceId` to scope to one named field/lane; omit it to see
 *  every time any resource is free (aggregated, for "Any free {noun}"). */
export function resourceTimeOptions(
  product: Product,
  date: string,
  durationMinutes: number,
  resourceId?: string | null,
): ResourceTimeOption[] {
  const sch = product.schedule;
  if (!sch) return [];
  const allIds = product.resourceIds ?? [];
  const ids = resourceId ? allIds.filter((id) => id === resourceId) : allIds;
  if (!ids.length) return [];
  const buffer = product.bufferMinutes ?? 0;
  const { startTime, endTime } = scheduleHoursOn(sch, date);
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const step = sch.slotMinutes || 30;
  // On today, an hour the demo's clock has already reached is not for sale —
  // a guest cannot buy a slot that has already started. `timeOptionsFor`
  // (the sessions pattern, just above) applies the identical floor, so the
  // two patterns — and "Any free {noun}", which only ever resolves against
  // whatever this function offers — cannot disagree about what "now" means.
  // Starts are still walked from the schedule's own grid (not from the floor
  // directly) so a floor that doesn't land on a step boundary never shifts
  // the grid itself, only which of its starts survive.
  const isToday = date === DEMO_TODAY;
  const out: ResourceTimeOption[] = [];
  for (let m = start; m <= end; m += step) {
    if (isToday && m < DEMO_NOW_MINUTES) continue;
    // The booking must fit before close — a 3-hour booking cannot start an
    // hour before closing even though the hour itself is open.
    if (m + durationMinutes > end) continue;
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const freeIds = ids.filter((id) => isResourceFreeFor(id, date, time, durationMinutes, buffer));
    out.push({ time, freeIds });
  }
  return out;
}

/** Which resource — named or "any" — is actually free for a span, used both
 *  to decide what to show and, at Add time, which resource a sale resolving
 *  to "Any" should be assigned. Cheapest first, the way the calendar's own
 *  quick-create ranks a default lane. */
export function cheapestFreeResourceId(
  ids: string[],
  freeIds: string[],
  priceOf: (id: string) => number,
): string | null {
  const free = ids.filter((id) => freeIds.includes(id));
  if (!free.length) return null;
  return free.slice().sort((a, b) => priceOf(a) - priceOf(b))[0];
}

/** Re-exported so callers of this module get the daily-cap and single-resource
 *  questions from one place rather than a second import of `lib/api/slots`. */
export { isResourceFreeFor, getDailyRemaining };
