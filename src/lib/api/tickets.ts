import { createResource } from "./client";
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
