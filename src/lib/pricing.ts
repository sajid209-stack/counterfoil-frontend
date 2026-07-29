import type { PricingRule, Product } from "@/lib/api/types";
import { toMinutes } from "@/lib/schedule";

const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** First matching rule wins; otherwise the fallback (base) price. */
export function resolveRulePrice(
  rules: PricingRule[],
  dow: number,
  time: string,
  fallback: number,
): number {
  const mins = toMinutes(time);
  for (const r of rules) {
    const dayMatch = r.days.length === 0 || r.days.includes(dow);
    if (dayMatch && mins >= toMinutes(r.fromTime) && mins < toMinutes(r.toTime)) return r.price;
  }
  return fallback;
}

/** Resolved price for a product at a concrete date + slot time. */
export function resolveProductPrice(
  product: Product,
  date: string,
  time: string,
  fallback: number,
): number {
  return resolveRulePrice(product.pricingRules ?? [], dowOf(date), time, fallback);
}
