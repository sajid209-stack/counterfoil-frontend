import { createResource, conflictError, fail, notFoundError, ok, validationError } from "./client";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import { split } from "@/lib/marketplaces";
import { sellingBlockers } from "@/lib/sellable";
import type {
  ApiResult,
  ConnectionStatus,
  ID,
  ListingStatus,
  MarketplaceConnection,
  MarketplaceId,
  MarketplaceListing,
  Minor,
} from "./types";

/**
 * Listing a catalogue on the marketplaces that sell it.
 *
 * The shape is the channel manager every tours-and-attractions platform
 * settled on: a connection per marketplace carrying the commission agreed by
 * contract, and a listing per catalogue item. What is deliberately NOT here is
 * a pretend integration — nothing calls Viator. What is here is the contract
 * the backend will implement and every rule that does not depend on it.
 */

const connections = createResource<MarketplaceConnection>("marketplaceConnections", "Connection", {
  sort: { created: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  defaultSort: "created",
});
const listings = createResource<MarketplaceListing>("marketplaceListings", "Listing", {
  sort: { created: (a, b) => a.createdAt.localeCompare(b.createdAt) },
  defaultSort: "created",
});

export const peekConnections = (): MarketplaceConnection[] => connections.peek();
export const peekListings = (): MarketplaceListing[] => listings.peek();

export const listConnections = async (): Promise<ApiResult<MarketplaceConnection[]>> =>
  ok(structuredClone(connections.peek()));

export const getConnection = (id: ID) => connections.get(id);

export const listingsFor = (connectionId: ID): MarketplaceListing[] =>
  listings.peek().filter((l) => l.connectionId === connectionId);

/* ── Connecting ──────────────────────────────────────────────────────────── */

export interface ConnectInput {
  marketplaceId: MarketplaceId;
  commissionBps: number;
  accountRef?: string;
  apiKey?: string;
}

/**
 * Connect a marketplace.
 *
 * The credential is accepted and **only its last four characters are kept** —
 * the rest is the backend's to hold. Storing a whole API key in a mock that
 * ships to a browser would be teaching the wrong lesson in the one place it
 * matters.
 */
export async function connectMarketplace(input: ConnectInput): Promise<ApiResult<MarketplaceConnection>> {
  const errors: Record<string, string> = {};
  if (input.commissionBps < 0 || input.commissionBps >= 10000) {
    errors.commissionBps = "A commission has to be between 0 and 100%.";
  }
  if (Object.keys(errors).length) return fail(validationError(errors));
  if (connections.peek().some((c) => c.marketplaceId === input.marketplaceId)) {
    return fail(conflictError("That marketplace is already connected."));
  }
  return connections.create({
    marketplaceId: input.marketplaceId,
    status: "connected",
    commissionBps: input.commissionBps,
    accountRef: input.accountRef,
    apiKeyLast4: input.apiKey?.slice(-4),
    lastSyncedAt: new Date().toISOString(),
  } as Omit<MarketplaceConnection, "id" | "createdAt" | "updatedAt">);
}

export function updateConnection(id: ID, patch: Partial<MarketplaceConnection>): Promise<ApiResult<MarketplaceConnection>> {
  if (patch.commissionBps != null && (patch.commissionBps < 0 || patch.commissionBps >= 10000)) {
    return Promise.resolve(fail(validationError({ commissionBps: "A commission has to be between 0 and 100%." })));
  }
  return connections.update(id, patch);
}

/**
 * Disconnect. The listings go with it, because a listing without a connection
 * is a row that can never sync and can never be fixed — and leaving them would
 * make reconnecting silently restore listings nobody re-approved.
 */
export async function disconnectMarketplace(id: ID): Promise<ApiResult<{ removed: number }>> {
  const mine = listingsFor(id);
  for (const l of mine) await listings.remove(l.id);
  const res = await connections.remove(id);
  if (!res.ok) return fail(res.error);
  return ok({ removed: mine.length });
}

/* ── Listings ────────────────────────────────────────────────────────────── */

/**
 * Put a catalogue item on a marketplace.
 *
 * Refused when the item could not be sold anyway. A listing for a booking with
 * no price or no schedule is a listing that will be rejected by the
 * marketplace or, worse, accepted and then unfulfillable — so the check is the
 * same `sellableBlockers` the catalogue already shows on the row.
 */
export async function addListing(connectionId: ID, productId: ID): Promise<ApiResult<MarketplaceListing>> {
  const conn = connections.peek().find((c) => c.id === connectionId);
  if (!conn) return fail<MarketplaceListing>(notFoundError("Connection"));
  if (listings.peek().some((l) => l.connectionId === connectionId && l.productId === productId)) {
    return fail<MarketplaceListing>(conflictError("That is already listed here."));
  }
  const product = peekProducts().find((p) => p.id === productId);
  if (!product) return fail<MarketplaceListing>(notFoundError("Booking"));
  /* The same blockers the catalogue already shows on the row. A listing for a
     booking with no price or no schedule is one the marketplace will refuse —
     or, worse, accept and leave unfulfillable. */
  const blockers = sellingBlockers(product);
  if (blockers.length) {
    return fail<MarketplaceListing>(conflictError(`${product.name} can't be sold yet.`));
  }
  return listings.create({
    connectionId,
    productId,
    productName: product.name,
    status: "draft",
    lastSyncedAt: null,
  } as Omit<MarketplaceListing, "id" | "createdAt" | "updatedAt">);
}

export const updateListing = (id: ID, patch: Partial<MarketplaceListing>) => listings.update(id, patch);
export const removeListing = (id: ID) => listings.remove(id);

/**
 * Send the drafts for review.
 *
 * Submitting is not publishing: a marketplace reviews a listing and can refuse
 * it. The mock moves them to `submitted` and leaves them there, which is what
 * actually happens — the state that resolves it comes back from the channel.
 */
export async function submitListings(connectionId: ID, ids: ID[]): Promise<ApiResult<{ submitted: number }>> {
  let n = 0;
  for (const id of ids) {
    const l = listings.peek().find((x) => x.id === id && x.connectionId === connectionId);
    if (!l || l.status !== "draft") continue;
    await listings.update(id, { status: "submitted" });
    n++;
  }
  return ok({ submitted: n });
}

/**
 * A sync. The mock stamps the moment rather than moving anything, because
 * there is nothing on the other end — and a button that claimed to have pushed
 * prices somewhere would be the worst kind of lie on this screen.
 */
export async function syncConnection(id: ID): Promise<ApiResult<MarketplaceConnection>> {
  const now = new Date().toISOString();
  for (const l of listingsFor(id)) {
    if (l.status === "live" || l.status === "submitted") await listings.update(l.id, { lastSyncedAt: now });
  }
  return connections.update(id, { lastSyncedAt: now, status: "connected", issue: undefined });
}

/* ── What it is worth ────────────────────────────────────────────────────── */

export interface ChannelPerformance {
  orders: number;
  gross: Minor;
  commission: Minor;
  net: Minor;
}

/**
 * What a marketplace has actually brought in, from the ledger.
 *
 * Derived, never stored — the rule seat availability, loyalty balances and
 * event sales all follow here. The commission is read off each ORDER rather
 * than recomputed from today's rate: a renegotiated commission must not
 * rewrite what was owed on last month's bookings.
 */
export function performanceOf(marketplaceId: MarketplaceId): ChannelPerformance {
  const out: ChannelPerformance = { orders: 0, gross: 0, commission: 0, net: 0 };
  for (const o of peekOrders()) {
    if (o.status === "cancelled" || o.source?.marketplaceId !== marketplaceId) continue;
    out.orders++;
    out.gross += o.total;
    out.commission += o.source.commissionAmount;
    out.net += o.total - o.source.commissionAmount;
  }
  return out;
}

/** The split a listing would produce at today's price and today's rate. */
export function listingSplit(listing: MarketplaceListing, conn: MarketplaceConnection): ReturnType<typeof split> {
  const product = peekProducts().find((p) => p.id === listing.productId);
  const base =
    listing.priceOverride ??
    (product?.tiers.filter((t) => t.active).map((t) => t.price).sort((a, b) => a - b)[0] ?? 0);
  return split(base, conn.commissionBps);
}

/** How many of a marketplace's listings are in each state. */
export function listingCounts(connectionId: ID): Record<ListingStatus, number> {
  const out: Record<ListingStatus, number> = { draft: 0, submitted: 0, live: 0, paused: 0, rejected: 0 };
  for (const l of listingsFor(connectionId)) out[l.status]++;
  return out;
}

/** A connection needing a decision, and what it is — for the index's notice. */
export function connectionIssue(c: MarketplaceConnection): string | null {
  if (c.status === "attention") return c.issue ?? "Needs attention";
  const counts = listingCounts(c.id);
  if (counts.rejected > 0) return `${counts.rejected} rejected`;
  if (counts.draft > 0) return `${counts.draft} not sent yet`;
  return null;
}

export const statusOfConnection = (c: MarketplaceConnection): ConnectionStatus => c.status;
