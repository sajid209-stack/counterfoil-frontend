/**
 * Small facts about a booking that a card or a page states: how long it lasts
 * and what it costs from. Derived from the booking itself, so nothing here has
 * to be typed in twice.
 */
import type { Product } from "@/lib/api/types";

/** How long one booking lasts, where the booking has a length. */
export function productMinutes(p: Product): number | null {
  const s = p.schedule;
  switch (p.bookingType) {
    case "BT-03":
    case "BT-09":
    case "BT-04":
      return s?.sessionMinutes || s?.slotMinutes || null;
    case "BT-05":
      return p.durationConfig?.minMinutes ?? p.flexibleDurations?.[0] ?? null;
    default:
      return null;
  }
}

/** The cheapest active tier, which is what a public card says. */
export function fromPrice(tiers: { price: number; active: boolean }[]): number | null {
  const open = tiers.filter((x) => x.active);
  return open.length ? Math.min(...open.map((x) => x.price)) : null;
}
