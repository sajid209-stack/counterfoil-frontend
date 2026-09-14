import { ok } from "./client";
import type { ApiResult, PaymentSettings, TillMethod } from "./types";

/*
 * How the business takes money at the counter, and when it is paid out
 * (payments.v2).
 *
 * The till's payment buttons were a constant in each till — cash, bKash, Bangla
 * QR, card terminal, in that order, for every business — so an operator who
 * never takes QR payments still had a QR button on every sale, and one whose
 * customers mostly pay by bKash could not put it first. The order and the
 * switches live here now, and every till reads them through `tillMethods`.
 *
 * The float and the count tolerance were constants on the shift screens
 * (৳2,000 and ৳100). A kiosk and a busy gate do not start the day with the same
 * cash, or count it to the same precision.
 */
const seed: PaymentSettings = {
  methods: [
    { method: "cash", enabled: true },
    { method: "bkash", enabled: true },
    { method: "bangla_qr", enabled: true },
    { method: "card_terminal", enabled: true },
  ],
  payoutSchedule: "daily",
  payoutDay: 0,
  defaultFloat: 200_000,
  countTolerance: 10_000,
};

let state: PaymentSettings = structuredClone(seed);

const pause = () => new Promise((r) => setTimeout(r, 200));

export async function getPaymentSettings(): Promise<ApiResult<PaymentSettings>> {
  await pause();
  return ok(structuredClone(state));
}

export async function updatePaymentSettings(patch: Partial<PaymentSettings>): Promise<ApiResult<PaymentSettings>> {
  await pause();
  state = { ...state, ...structuredClone(patch) };
  // Cash is how a till still sells when everything else is down, so it can be
  // moved but never switched off — whatever a patch says.
  state.methods = state.methods.map((m) => (m.method === "cash" ? { ...m, enabled: true } : m));
  return ok(structuredClone(state));
}

/** The current settings, synchronously — for screens that read one number once. */
export const peekPaymentSettings = (): PaymentSettings => state;

/**
 * The payment buttons a till offers, in the business's order: cash always, and
 * the rest when they are switched on and a live payment account can take them.
 */
export function tillMethods(nonCashOk: boolean): TillMethod[] {
  return state.methods.filter((m) => m.method === "cash" || (m.enabled && nonCashOk)).map((m) => m.method);
}
