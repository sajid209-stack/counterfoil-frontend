import { getAdvancePolicyState, ok, patchAdvancePolicyState } from "./client";
import type { AdvancePolicy, ApiResult } from "./types";

/** Whether this business takes money up front, and how little it will accept.
 *  Singleton, per channel — see the AdvancePolicy contract. */
export async function getAdvancePolicy(): Promise<ApiResult<AdvancePolicy>> {
  return ok(structuredClone(getAdvancePolicyState()));
}

export async function updateAdvancePolicy(patch: Partial<AdvancePolicy>): Promise<ApiResult<AdvancePolicy>> {
  return ok(structuredClone(patchAdvancePolicyState(patch)));
}
