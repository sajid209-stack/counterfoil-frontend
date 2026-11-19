import { getPayNowState, ok, patchPayNowState } from "./client";
import type { ApiResult, PayNowSettings } from "./types";

/** The business default for what can be paid now (Settings → Payment choices).
 *  A booking's own rule lives on the product (`Product.payNow`) and is written
 *  with `updateProduct`. The file keeps its old name so imports stay stable. */
export async function getPayNowSettings(): Promise<ApiResult<PayNowSettings>> {
  return ok(structuredClone(getPayNowState()));
}

export async function updatePayNowSettings(patch: Partial<PayNowSettings>): Promise<ApiResult<PayNowSettings>> {
  return ok(structuredClone(patchPayNowState(patch)));
}
