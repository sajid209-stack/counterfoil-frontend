import { createResource, fail, notFoundError, ok } from "./client";
import { peekProducts } from "./products";
import type { ApiResult, ListParams, ListResponse, Ticket } from "./types";

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

/** Look up a ticket by its printed code (scan flow). */
export function findTicketByCode(code: string): Ticket | undefined {
  return resource.peek().find((t) => t.code.toLowerCase() === code.trim().toLowerCase());
}

/** Redeem a ticket at the gate. */
export const redeemTicket = (id: string): Promise<ApiResult<Ticket>> =>
  resource.update(id, { status: "redeemed", redeemedAt: new Date().toISOString() });

/** Issue a fresh ticket (used by POS checkout). */
export function issueTicket(input: {
  code: string;
  orderId: string;
  productId: string;
  tierName: string;
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
