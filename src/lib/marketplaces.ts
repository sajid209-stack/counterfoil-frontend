/**
 * The marketplaces Counterfoil can list a catalogue on, and the arithmetic of
 * doing so.
 *
 * Pure: no React, no store. What a channel manager is, from the research —
 * Rezdy, Bokun, TrekkSoft, FareHarbor all land in the same place — is three
 * things and not more:
 *
 *   1. a CONNECTION to a marketplace, with a commission agreed by contract,
 *   2. a LISTING per catalogue item you want it to sell,
 *   3. a SYNC that pushes price and availability and pulls bookings back.
 *
 * The one number an operator actually decides on is **what they keep**. A
 * commission stated as "25%" is a percentage; stated as "you keep ৳1,125 of
 * ৳1,500" it is a decision. Every screen here states it the second way, which
 * is the same mandatory-concrete-numbers rule the duration engine and the
 * pricing preview already follow.
 */
import type { MarketplaceId, Minor } from "./api/types";

export interface MarketplaceMeta {
  id: MarketplaceId;
  /** Their own name for themselves — never translated. */
  name: string;
  /** What they sell, so an operator can tell which of their catalogue fits. */
  sells: "tours" | "attractions" | "stays" | "everything";
  /** The commission they usually ask, in basis points. A starting point for
   *  the contract field, never a claim about what this operator negotiated. */
  typicalBps: number;
  /** What connecting actually needs from the operator. */
  needs: "apiKey" | "account";
  /** Where they send people to get it, so the operator is not left hunting. */
  helpUrl: string;
}

/**
 * The six worth offering an operator in this market. Deliberately not "every
 * OTA": a list of forty channels is a list nobody reads, and the long tail is
 * reached through the two aggregators here rather than one by one.
 */
export const MARKETPLACES: MarketplaceMeta[] = [
  { id: "viator", name: "Viator", sells: "tours", typicalBps: 2500, needs: "apiKey", helpUrl: "https://supplier.viator.com" },
  { id: "getyourguide", name: "GetYourGuide", sells: "tours", typicalBps: 2000, needs: "apiKey", helpUrl: "https://supplier.getyourguide.com" },
  { id: "klook", name: "Klook", sells: "attractions", typicalBps: 2000, needs: "account", helpUrl: "https://merchant.klook.com" },
  { id: "tripadvisor", name: "Tripadvisor", sells: "everything", typicalBps: 2200, needs: "apiKey", helpUrl: "https://www.tripadvisor.com/Owners" },
  { id: "expedia", name: "Expedia", sells: "attractions", typicalBps: 2500, needs: "account", helpUrl: "https://apps.expediapartnercentral.com" },
  { id: "airbnb", name: "Airbnb Experiences", sells: "tours", typicalBps: 2000, needs: "account", helpUrl: "https://www.airbnb.com/host/experiences" },
];

export const marketplaceById = (id: MarketplaceId): MarketplaceMeta =>
  MARKETPLACES.find((m) => m.id === id) ?? MARKETPLACES[0];

/* ── The money, stated the way it is decided ─────────────────────────────── */

export interface Split {
  /** What the guest pays on the marketplace. */
  price: Minor;
  /** What the marketplace keeps. */
  commission: Minor;
  /** What reaches the operator. */
  net: Minor;
}

/**
 * Rounded to whole minor units with the commission taking the remainder, so
 * `commission + net === price` exactly. A split that is a paisa out is a
 * reconciliation nobody can close.
 */
export function split(price: Minor, commissionBps: number): Split {
  const commission = Math.round((price * commissionBps) / 10000);
  return { price, commission, net: price - commission };
}

/**
 * The price to charge on a marketplace to take home what the counter takes.
 *
 * The question every operator asks second, and the one a bare commission field
 * cannot answer: at 25%, keeping ৳1,500 means listing at ৳2,000, not ৳1,875.
 * Rounded UP, because rounding down means selling at a loss to save a paisa.
 */
export const priceToNet = (target: Minor, commissionBps: number): Minor =>
  commissionBps >= 10000 ? target : Math.ceil((target * 10000) / (10000 - commissionBps));

export const bpsToPct = (bps: number) => bps / 100;
export const pctToBps = (pct: number) => Math.round(pct * 100);
