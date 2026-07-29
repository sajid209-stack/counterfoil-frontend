import { getOperatorState, loadBusiness, ok, patchOperatorState, startFresh } from "./client";
import type { ApiResult, Operator, OperatorPatch } from "./types";

/** The current operator (tenant) — reflects the loaded demo business. */
export async function getOperator(): Promise<ApiResult<Operator>> {
  return ok(structuredClone(getOperatorState()));
}

export async function updateOperator(patch: OperatorPatch): Promise<ApiResult<Operator>> {
  return ok(structuredClone(patchOperatorState(patch)));
}

/** Swap the whole mock to a demo business, or start fresh (golden path). */
export function loadDemoBusiness(name: string, currency: string, productIds: string[]): void {
  loadBusiness(name, currency, productIds);
}
export function startFreshBusiness(): void {
  startFresh();
}
