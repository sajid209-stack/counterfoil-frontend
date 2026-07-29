import * as seed from "@/lib/mock/data";
import { ok } from "./client";
import type { ApiResult, Operator } from "./types";

/** The current operator (tenant). Single-tenant in the mock; carries the
 *  currency and default timezone every money/time value is interpreted in. */
export async function getOperator(): Promise<ApiResult<Operator>> {
  return ok(structuredClone(seed.operator));
}
