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

/**
 * Sellable today, and about to stop being — the failure nobody notices.
 *
 * A blocker means the till has nothing to charge for now. A warning means it
 * does, until a date: a course whose last session is in three weeks, a pass
 * whose sales window closes on Friday. Nothing looks wrong on the day it is
 * set up, so nothing is fixed, and the booking quietly stops selling.
 *
 * This is the one rule for it. The dashboard's Needs attention panel and the
 * catalog both read it, so the catalog cannot say "on sale, nothing to do"
 * about the same course the dashboard is warning about.
 */
export type SellingWarning =
  | { kind: "datesRunOut"; date: string }
  | { kind: "salesWindowEnds"; date: string };

/** How far ahead a date running out counts as needing attention now. */
export const WARNING_HORIZON_DAYS = 30;

/** Calendar arithmetic in UTC, so no local offset can move the day. */
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function sellingWarnings(product: Product, today: string): SellingWarning[] {
  const horizon = addDays(today, WARNING_HORIZON_DAYS);
  const out: SellingWarning[] = [];
  if (product.courseDates?.length) {
    const last = [...product.courseDates].sort().at(-1)!;
    if (last <= horizon) out.push({ kind: "datesRunOut", date: last });
  }
  if (product.windowMode === "fixed" && product.windowEnd && product.windowEnd <= horizon) {
    out.push({ kind: "salesWindowEnds", date: product.windowEnd });
  }
  return out;
}
