import { getTaxConfigState, ok, patchTaxConfigState } from "./client";
import type { ApiResult, TaxConfig } from "./types";

/** The tenant's tax configuration (settings.v2 tax-config). Singleton. */
export async function getTaxConfig(): Promise<ApiResult<TaxConfig>> {
  return ok(structuredClone(getTaxConfigState()));
}

export async function updateTaxConfig(patch: Partial<TaxConfig>): Promise<ApiResult<TaxConfig>> {
  return ok(structuredClone(patchTaxConfigState(patch)));
}
