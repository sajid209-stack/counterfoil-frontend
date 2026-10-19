import { useSyncExternalStore } from "react";
import { delay, fail, ok, validationError } from "./client";
import type { ApiResult, Minor } from "./types";

/*
 * Refunds & write-offs — the business's timing rules (Settings → Refunds &
 * write-offs). Singleton, mock-backed, read synchronously by the request
 * modules and the screens that explain the rules.
 *
 * Who may ask, or act directly, is per role (Settings → Roles → At the
 * counter); this is WHEN and HOW:
 *  - how long the counter may ask for a refund on a booking;
 *  - how quickly a manager is expected to answer (each request's respond-by
 *    time, and "Overdue" after it);
 *  - whether an unanswered request closes itself;
 *  - where the money goes back to;
 *  - how large a counter write-off may be before a manager has to approve it.
 *
 * See docs/refunds.md §3.
 */

/** Until when the counter may ask for a refund on a booking. */
export type RefundWindow = "before_start" | "until_end" | "any_time";
export const REFUND_WINDOWS: RefundWindow[] = ["before_start", "until_end", "any_time"];

/** Where approved money goes back to. */
export type RefundMethod = "original" | "cash";
export const REFUND_METHODS: RefundMethod[] = ["original", "cash"];

export const RESPOND_WITHIN_HOURS = [4, 12, 24, 48, 72] as const;
export const AUTO_CLOSE_DAYS = [3, 7, 14, 30] as const;

export interface RefundPolicy {
  counterWindow: RefundWindow;
  /** A request should be answered within this many hours. */
  respondWithinHours: number;
  /** Close an unanswered request after this many days; null = keep waiting. */
  autoCloseDays: number | null;
  refundTo: RefundMethod;
  /** A counter write-off at or under this amount needs no manager. 0 = every
   *  counter write-off is approved by a manager. */
  writeOffApproveAbove: Minor;
}

export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  counterWindow: "before_start",
  respondWithinHours: 24,
  autoCloseDays: null,
  refundTo: "original",
  writeOffApproveAbove: 0,
};

let state: RefundPolicy = { ...DEFAULT_REFUND_POLICY };
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The rules as they stand. Synchronous: the request modules read it. */
export const peekRefundPolicy = (): RefundPolicy => state;

/** Re-renders the caller when the rules change. */
export const useRefundPolicy = (): RefundPolicy =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => DEFAULT_REFUND_POLICY,
  );
/** Changes whenever the rules do — for screens that cache derived values. */
export const refundPolicyVersion = (): number => version;

export async function getRefundPolicy(): Promise<ApiResult<RefundPolicy>> {
  await delay();
  return ok(state);
}

export async function updateRefundPolicy(patch: Partial<RefundPolicy>): Promise<ApiResult<RefundPolicy>> {
  await delay();
  const next = { ...state, ...patch };
  const errors: Record<string, string> = {};
  if (!(next.respondWithinHours > 0 && next.respondWithinHours <= 24 * 14)) errors.respondWithinHours = "Choose how many hours, from 1 up to 14 days.";
  if (next.autoCloseDays !== null && !(next.autoCloseDays >= 1 && next.autoCloseDays <= 90)) errors.autoCloseDays = "Choose from 1 to 90 days, or keep waiting.";
  if (!(next.writeOffApproveAbove >= 0)) errors.writeOffApproveAbove = "Enter an amount of zero or more.";
  if (Object.keys(errors).length) return fail(validationError(errors, Object.values(errors)[0]));
  state = next;
  version += 1;
  listeners.forEach((l) => l());
  return ok(state);
}

/** Back to the defaults — used when the demo store is reset. */
export function resetRefundPolicy(): void {
  state = { ...DEFAULT_REFUND_POLICY };
  version += 1;
  listeners.forEach((l) => l());
}

/** When a request made at `requestedAt` should be answered by. */
export const dueAtFor = (requestedAt: string, policy: RefundPolicy = state): string =>
  new Date(Date.parse(requestedAt) + policy.respondWithinHours * 3600_000).toISOString();

/** True when a pending request made at `requestedAt` has closed itself. */
export const isExpiredAt = (requestedAt: string, now = Date.now(), policy: RefundPolicy = state): boolean =>
  policy.autoCloseDays !== null && now > Date.parse(requestedAt) + policy.autoCloseDays * 86_400_000;
