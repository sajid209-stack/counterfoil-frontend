import { formatMoney } from "@/lib/format";
import type { CalEvent } from "./model";

type T = (key: string, values?: Record<string, string | number>) => string;

/** "Booked on Viator · VT-123456" — the reference is what a dispute with the
 *  marketplace is argued with, so it travels with the name when there is one. */
export const bookedOnLine = (t: T, s: NonNullable<CalEvent["source"]>): string =>
  s.reference
    ? t("bookedOnRef", { name: s.name, reference: s.reference })
    : t("bookedOn", { name: s.name });

/** 2500 → "25%", 1750 → "17.5%". */
const pct = (bps: number): string => `${Math.round(bps) / 100}%`;

/** "Viator takes 25% · ৳375.00", from the order's own snapshot — the rate and
 *  amount at the time of sale, never recomputed from what the connection says
 *  today, because a renegotiated rate must not rewrite last month. */
export const commissionLine = (t: T, s: NonNullable<CalEvent["source"]>): string =>
  t("commission", { name: s.name, pct: pct(s.commissionBps), amount: formatMoney(s.commissionAmount) });
