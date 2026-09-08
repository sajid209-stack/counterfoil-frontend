import type { Product, Resource } from "@/lib/api";
import { isResourceType, needsSchedule } from "@/lib/schedule";

/**
 * Can this product actually be sold?
 *
 * A catalogue's first job is to say what is on sale, and its second — the one
 * this app was not doing at all — is to say what *cannot* be, and why. Status
 * answers "did someone switch it on"; it does not answer "would the till have
 * anything to charge for". Those come apart the moment a product is created
 * and half-configured, which is exactly when somebody needs telling.
 *
 * Everything here is derived from the record. Nothing is stored, so it cannot
 * drift out of date the way a cached "ready" flag would.
 */
export type Blocker = "noPrice" | "noSchedule" | "noResource" | "noChannel";

export function sellingBlockers(product: Product, resources: Resource[] = []): Blocker[] {
  const out: Blocker[] = [];

  // Nothing to charge. `priceRange` already renders "—" for this; the row just
  // never said that the dash was a problem.
  if (product.tiers.filter((t) => t.active).length === 0) out.push("noPrice");

  // A type that sells slots, with no slots defined.
  if (needsSchedule(product.bookingType) && !product.schedule) out.push("noSchedule");

  // A court or lane product with no court or lane attached.
  if (isResourceType(product.bookingType)) {
    const attached = (product.resourceIds ?? []).filter((id) =>
      resources.some((r) => r.id === id),
    );
    if (attached.length === 0) out.push("noResource");
  }

  // On sale nowhere.
  if (product.channels.length === 0) out.push("noChannel");

  return out;
}
