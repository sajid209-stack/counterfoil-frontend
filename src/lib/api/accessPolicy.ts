import { ok } from "./client";
import type { AccessPolicy, ApiResult } from "./types";

/*
 * Sign-in rules for the whole team (access-policy.v1).
 *
 * Security settings are personal — your password, your two-step. These are the
 * business's: whether two-step is required and of whom, how long an OS sign-in
 * lasts, how quickly an unattended till locks itself, and how a PIN is guarded.
 * A till left signed in on a busy counter is how a stranger rings up a refund,
 * so the defaults lean safe.
 */
const seed: AccessPolicy = {
  twoStep: "managers",
  sessionHours: 12,
  tillLockMinutes: 5,
  pinLength: 4,
  // Three is what the PIN screen always allowed; the rule now says so.
  pinAttempts: 3,
  deviceBound: true,
};

let state: AccessPolicy = structuredClone(seed);

const pause = () => new Promise((r) => setTimeout(r, 220));

export async function getAccessPolicy(): Promise<ApiResult<AccessPolicy>> {
  await pause();
  return ok(structuredClone(state));
}

export async function updateAccessPolicy(next: AccessPolicy): Promise<ApiResult<AccessPolicy>> {
  await pause();
  state = structuredClone(next);
  return ok(structuredClone(state));
}
