import { createResource, fail, notFoundError, ok } from "./client";
import { credentialsFor, resolveCredential, revokeCredentials } from "./credentials";
import { peekProducts } from "./products";
import type { ApiResult, ListParams, ListResponse, Ticket, TicketCredential } from "./types";

const resource = createResource<Ticket>("tickets", "Ticket", {
  search: (t, q) => t.code.toLowerCase().includes(q),
  filter: (t, f) => {
    if (f.status && t.status !== f.status) return false;
    if (f.orderId && t.orderId !== f.orderId) return false;
    return true;
  },
  sort: { code: (a, b) => a.code.localeCompare(b.code) },
  defaultSort: "code",
});

export const listTickets = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Ticket>>> => resource.list(params);

export const getTicket = (id: string): Promise<ApiResult<Ticket>> => resource.get(id);

/** Unmediated read for the api layer (credentials resolve tickets by id). */
export const peekTickets = (): Ticket[] => resource.peek();

/** Write a field on a ticket from inside the api layer. */
export const patchTicket = (id: string, patch: Partial<Ticket>): Promise<ApiResult<Ticket>> =>
  resource.update(id, patch);

/**
 * Resolve a scanned code — through its CREDENTIAL, not the ticket.
 *
 * This is the whole reason credentials exist. A reissue mints a new code and
 * supersedes the old one, so a scan has to ask the credential store which
 * tokens are live: matching `Ticket.code` directly would admit a photograph of
 * the replaced ticket for ever, and then "re-issue" would be a button that
 * quietly printed a second valid ticket.
 *
 * The superseded and revoked ones come back too, so the gate can say WHY it is
 * refusing rather than reporting an unknown code. A steward holding a
 * screenshot needs "this was replaced on Sunday", not "no such ticket".
 */
export function resolveTicketCode(
  code: string,
): { ticket: Ticket; credential: TicketCredential } | undefined {
  const credential = resolveCredential(code);
  if (!credential) return undefined;
  const ticket = resource.peek().find((t) => t.id === credential.ticketId);
  return ticket ? { ticket, credential } : undefined;
}

/** Look up a ticket by a code that is still live. A replaced code resolves to
 *  nothing here on purpose; the gate uses `resolveTicketCode` so it can name
 *  the reason. */
export function findTicketByCode(code: string): Ticket | undefined {
  const hit = resolveTicketCode(code);
  return hit?.credential.status === "active" ? hit.ticket : undefined;
}

/** The code that currently scans — the active credential, which `Ticket.code`
 *  mirrors. Read through the credential so the two cannot drift. */
export function ticketCode(ticket: Ticket): string {
  return credentialsFor(ticket.id).find((c) => c.status === "active")?.code ?? ticket.code;
}

/** Redeem a ticket at the gate. */
export const redeemTicket = (id: string): Promise<ApiResult<Ticket>> =>
  resource.update(id, { status: "redeemed", redeemedAt: new Date().toISOString() });

/** Void every unredeemed ticket on an order (refunds). */
export async function voidOrderTickets(orderId: string, productId?: string): Promise<void> {
  const hit = resource.peek().filter((t) => t.orderId === orderId && t.status === "issued" && (!productId || t.productId === productId));
  for (const t of hit) {
    await resource.update(t.id, { status: "void" });
    // The token dies with the entitlement, or the credentials list reads as a
    // live code on a refunded ticket.
    await revokeCredentials(t.id);
  }
}

/** How many people a ticket admits — the line snapshot when present (F11),
 *  else the tier's current composition (Family = 4). */
export function ticketAdmits(ticket: Ticket): number {
  if (ticket.admits != null) return ticket.admits;
  const product = peekProducts().find((p) => p.id === ticket.productId);
  const tier = product?.tiers.find((t) => t.name === ticket.tierName);
  return tier?.admits ?? 1;
}

/** Admit part of a group ticket (a Family of 4 arrives as 3 — admit 3, one
 *  remains). Fully admitted → the ticket flips to redeemed. */
export async function admitTicket(id: string, count: number): Promise<ApiResult<Ticket>> {
  const ticket = resource.peek().find((t) => t.id === id);
  if (!ticket) return fail(notFoundError("Ticket"));
  const admits = ticketAdmits(ticket);
  const admitted = Math.min(admits, (ticket.admitted ?? 0) + count);
  return resource.update(id, {
    admitted,
    ...(admitted >= admits ? { status: "redeemed" as const, redeemedAt: new Date().toISOString() } : {}),
  });
}

/** Issue a fresh ticket (used by POS checkout). Carries its order line id so
 *  a scan traces back to what was sold, and the admits snapshot. */
export function issueTicket(input: {
  code: string;
  orderId: string;
  lineId?: string;
  productId: string;
  tierName: string;
  admits?: number;
  validFor: string;
}): Promise<ApiResult<Ticket>> {
  return resource.create({ ...input, status: "issued", redeemedAt: null });
}

// ── Credits packs (BT-12) — a sold pack's ticket IS the pass ────────────────
export interface CreditPass {
  ticketId: string;
  code: string;
  packName: string;
  remaining: number;
  productIds: string[]; // products the credits can pay for
}

/** Validate a pass code at POS: must be an issued ticket for a credits
 *  product, unexpired, with credits left. */
export async function findCreditPass(code: string): Promise<ApiResult<CreditPass>> {
  const ticket = findTicketByCode(code);
  if (!ticket) return fail(notFoundError("Pass"));
  const product = peekProducts().find((p) => p.id === ticket.productId);
  if (!product?.credits) return fail({ code: "validation", message: "That code isn't a credits pass." });
  if (ticket.status === "void") return fail({ code: "conflict", message: "That pass was voided." });
  const expiry = new Date(`${ticket.validFor}T00:00:00+06:00`).getTime() + product.credits.expiryDays * 86400000;
  if (Date.now() > expiry) return fail({ code: "conflict", message: "That pass has expired." });
  const remaining = product.credits.count - (ticket.creditsUsed ?? 0);
  if (remaining <= 0) return fail({ code: "conflict", message: "No credits left on that pass." });
  return ok({ ticketId: ticket.id, code: ticket.code, packName: product.name, remaining, productIds: product.credits.productIds });
}

/** Spend credits against a pass (called by checkout). */
export async function redeemCredits(ticketId: string, count: number): Promise<ApiResult<Ticket>> {
  const ticket = resource.peek().find((t) => t.id === ticketId);
  if (!ticket) return fail(notFoundError("Pass"));
  const product = peekProducts().find((p) => p.id === ticket.productId);
  const total = product?.credits?.count ?? 0;
  const used = ticket.creditsUsed ?? 0;
  if (used + count > total) return fail({ code: "conflict", message: "Not enough credits left." });
  return resource.update(ticketId, { creditsUsed: used + count });
}
