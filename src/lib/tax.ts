import type { Operator, Product, ProductPolicies } from "@/lib/api/types";

/** The tax rate (percent) that applies to a product, from its tax class. */
export function taxRateFor(product: Product, operator: Operator | undefined): number {
  const cls = product.taxClass ?? "standard";
  if (cls === "exempt") return 0;
  if (cls === "reduced") return operator?.reducedRatePct ?? 0;
  return operator?.taxRatePct ?? 0;
}

export function defaultPolicies(): ProductPolicies {
  return {
    salesWindowDays: 90,
    cutoffMinutes: 0,
    cancellation: "free_until",
    cancelHours: 24,
    cancelFeePct: 0,
    reschedule: "until",
    rescheduleHours: 24,
    reentry: "single",
    deposit: "full",
    depositPct: 0,
    partyMin: 1,
    partyMax: 20,
  };
}
