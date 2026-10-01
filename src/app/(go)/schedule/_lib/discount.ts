import type { Minor } from "@/lib/api";

/**
 * The after-game discount a counter gives when a guest pays what they still
 * owe — worked out in minor units however the cashier chose to say it (a
 * taka amount, or a percent of the whole order), and checked against the
 * role's own cap before anything is sent to the order.
 */
export type DiscountMode = "amount" | "percent";

/** Minor units a discount input represents, given the order's total. */
export function discountMinorFrom(mode: DiscountMode, raw: number, orderTotal: Minor): Minor {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return mode === "amount" ? Math.round(raw * 100) : Math.round((raw / 100) * orderTotal);
}

/** What percent of the order's total a discount amount represents. */
export function discountPct(discount: Minor, orderTotal: Minor): number {
  if (orderTotal <= 0 || discount <= 0) return 0;
  return (discount / orderTotal) * 100;
}

/** Is this discount within the role's cap on the order's total? A tenth of a
 *  percent of rounding either way should not read as "over the limit". */
export function withinDiscountLimit(discount: Minor, orderTotal: Minor, limitPct: number | null): boolean {
  if (limitPct == null) return true;
  return discountPct(discount, orderTotal) <= limitPct + 0.05;
}
