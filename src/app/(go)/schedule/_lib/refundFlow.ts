import { approveRefundRequest, requestRefund, type RefundReason, type RefundRequest } from "@/lib/api/refundRequests";
import type { ApiResult } from "@/lib/api";

/**
 * Ask for a refund — and, when the till itself is allowed to give the money
 * back, approve it in the same breath so the audit trail still reads as a
 * request a named person decided, not a payment nobody signed off on.
 *
 * Shared by the Schedule board and Check-in: the same booking, the same
 * money, asked for from two different screens.
 */
export async function sendOrApproveRefund(input: {
  bookingId: string;
  reason: RefundReason;
  note: string;
  requestedBy: string;
  place?: string | null;
  /** This till's role can give the money back itself, within its limit. */
  direct: boolean;
}): Promise<ApiResult<RefundRequest>> {
  const req = await requestRefund({
    bookingId: input.bookingId,
    reason: input.reason,
    note: input.note,
    requestedBy: input.requestedBy,
    place: input.place,
  });
  if (!req.ok || !input.direct) return req;
  return approveRefundRequest(req.data.id, input.requestedBy);
}
