import { forgetBundleDemo, getOperatorState, loadBundleDemo, loadBusiness, ok, patchOperatorState, startFresh } from "./client";
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
  forgetBundleDemo();
  loadBusiness(name, currency, productIds);
}
/** A whole-business demo (its own venue, shelf and storefront), remembered in this browser. */
export function loadWholeDemo(id: string): void {
  loadBundleDemo(id);
}
export function startFreshBusiness(): void {
  forgetBundleDemo();
  startFresh();
}
