import * as seed from "@/lib/mock/data";
import { ok } from "./client";
import type { ApiResult, Operator, OperatorPatch } from "./types";

// Single-tenant in the mock. Kept as a mutable module-level copy so Business
// Setup edits persist within a session (mirrors what the real endpoint does).
let current: Operator = structuredClone(seed.operator);

/** The current operator (tenant). Carries the currency, timezone, and tax rate
 *  every money/time value is interpreted in. */
export async function getOperator(): Promise<ApiResult<Operator>> {
  return ok(structuredClone(current));
}

export async function updateOperator(
  patch: OperatorPatch,
): Promise<ApiResult<Operator>> {
  current = { ...current, ...patch, updatedAt: new Date().toISOString() };
  return ok(structuredClone(current));
}
