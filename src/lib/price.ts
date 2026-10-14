import { eventView } from "@/lib/api/events";
import { eventFromPrice } from "@/lib/api/eventModel";
import type { Minor, Product } from "@/lib/api/types";

/**
 * The one "from" price. The lowest price among tickets that can still be
 * bought today, so a customer is never told a price they cannot get.
 *
 * - An event (BT-15): a ticket counts only if it is on sale, has room left
 *   (counting tickets sold here) and its sales window has not closed.
 * - Every other kind: the active tiers.
 *
 * Null when nothing can be bought.
 */
export function fromPriceOf(product: Product, now: Date = new Date()): Minor | null {
  if (product.bookingType === "BT-15") return eventFromPrice(eventView(product), now);
  const open = product.tiers.filter((t) => t.active);
  return open.length ? Math.min(...open.map((t) => t.price)) : null;
}
