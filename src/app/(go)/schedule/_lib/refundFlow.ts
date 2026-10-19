import { approveRefundRequest, requestRefund, type RefundReason, type RefundRequest, type RefundScope } from "@/lib/api/refundRequests";
import type { ApiResult } from "@/lib/api";

/**
 * Ask for a refund — and, when the till itself is allowed to give the money
 * back, approve it in the same breath so the audit trail still reads as a
 * request a named person decided, not a payment nobody signed off on.
 *
 * Shared by the Schedule board, Check-in and My sales: the same money, asked
 * for from three different screens. `scope` is what goes back — the whole
 * booking (the default), some tickets, or an amount with the tickets left
 * valid; a sale with no booking behind it (My sales) names its `orderId`.
 */
export async function sendOrApproveRefund(input: {
  scope?: RefundScope;
  bookingId?: string;
  orderId?: string;
  ticketIds?: string[];
  /** Goodwill only — minor units. */
  amount?: number;
  reason: RefundReason;
  note: string;
  requestedBy: string;
  place?: string | null;
  /** This till's role can give the money back itself, within its limit. */
  direct: boolean;
}): Promise<ApiResult<RefundRequest>> {
  const req = await requestRefund({
    scope: input.scope,
    bookingId: input.bookingId,
    orderId: input.orderId,
    ticketIds: input.ticketIds,
    amount: input.amount,
    reason: input.reason,
    note: input.note,
    requestedBy: input.requestedBy,
    place: input.place,
  });
  if (!req.ok || !input.direct) return req;
  return approveRefundRequest(req.data.id, input.requestedBy);
}
