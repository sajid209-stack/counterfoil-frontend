import type { Minor, PayNowOptions, PayNowRule, PayNowSettings, Product } from "@/lib/api/types";

/**
 * What can be paid now — the one calculation every till and the OS read.
 *
 * A rule (Settings → Payment choices) says which part payments sit beside Full
 * for a booking. A sale mixes bookings with different rules, so the sale's
 * choices are built line by line:
 *
 *   - a line that is not for LATER (a shop item, a ticket for now, anything
 *     without a future date) is always paid in full;
 *   - Minimum charges each line its own minimum where its rule offers one, and
 *     the whole line where it does not;
 *   - Custom (any amount) may go as low as each line's floor: its minimum where
 *     its rule offers any amount, the minimum where it offers only Minimum, and
 *     the whole line otherwise.
 *
 * Minimum is offered when at least one line offers it and it comes to less than
 * the total; Custom when at least one line offers any amount. Full always.
 */

export const offersMinimum = (o: PayNowOptions) => o === "full_min" || o === "all";
export const offersCustom = (o: PayNowOptions) => o === "full_custom" || o === "all";

/** The rule a booking sells under: its own, or the business default. */
export function payNowRuleFor(product: Pick<Product, "payNow"> | undefined | null, settings: PayNowSettings | undefined | null): PayNowRule {
  return product?.payNow ?? settings?.default ?? { options: "full", minKind: "percent", minValue: 0 };
}

/** The least a rule accepts now on a given amount, never above the amount. */
export function ruleMinimum(rule: PayNowRule, total: Minor): Minor {
  const min = rule.minKind === "percent" ? Math.round((total * rule.minValue) / 100) : rule.minValue;
  return Math.max(0, Math.min(total, min));
}

export interface PayNowLine {
  rule: PayNowRule;
  /** What the line costs, after its discounts and tax. */
  total: Minor;
  /** Is the guest arriving later (a future date, or later today)? */
  later: boolean;
}

export interface PayNowChoices {
  total: Minor;
  /** The Minimum tile's amount, or null when Minimum is not offered. */
  minimum: Minor | null;
  /** The lowest a typed amount may be, or null when Custom is not offered. */
  customMin: Minor | null;
}

export function payNowChoices(lines: PayNowLine[]): PayNowChoices {
  let total = 0;
  let minSum = 0;
  let floorSum = 0;
  let anyMin = false;
  let anyCustom = false;
  for (const l of lines) {
    total += l.total;
    const o = l.later ? l.rule.options : "full";
    const lineMin = ruleMinimum(l.rule, l.total);
    if (offersMinimum(o)) {
      anyMin = true;
      minSum += lineMin;
    } else {
      minSum += l.total;
    }
    if (offersCustom(o)) {
      anyCustom = true;
      floorSum += lineMin;
    } else {
      floorSum += offersMinimum(o) ? lineMin : l.total;
    }
  }
  const minimum = anyMin && minSum > 0 && minSum < total ? minSum : null;
  /* A part payment of nothing is not a payment: at least one whole unit. */
  const customMin = anyCustom && total > 0 ? Math.min(total, Math.max(floorSum, 100)) : null;
  return { total, minimum, customMin: customMin != null && customMin < total ? customMin : null };
}

/** Is any part payment possible at all? Drives whether "How much now" shows. */
export const partPaymentOffered = (c: PayNowChoices) => c.minimum != null || c.customMin != null;
