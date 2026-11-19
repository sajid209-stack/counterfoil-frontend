import type { Minor, PayNowOptions, PayNowRule } from "@/lib/api";

/** The rule as typed in the editor: the minimum is a string until it is saved. */
export interface RuleDraft {
  options: PayNowOptions;
  kind: PayNowRule["minKind"];
  value: string;
}

export const OPTION_ORDER: PayNowOptions[] = ["full", "full_min", "full_custom", "all"];

/** A ৳2,000 booking: round enough to check a minimum in your head. */
export const SAMPLE: Minor = 200_000;

const taka = (minor: number) => (minor / 100).toFixed(minor % 100 ? 2 : 0);

export const toDraft = (r: PayNowRule): RuleDraft => ({
  options: r.options,
  kind: r.minKind,
  value: r.minKind === "percent" ? String(r.minValue) : taka(r.minValue),
});

/** Money as typed ("1,500", "12.50") in minor units, or null. */
function parseAmount(raw: string): Minor | null {
  const s = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Zero is a floor only for "any amount"; a minimum has to be something. */
export const allowsZero = (o: PayNowOptions) => o === "full_custom";

/** The typed minimum in the units the rule stores, or null when it is not valid for these options. */
export function parseMin(d: RuleDraft): number | null {
  const zero = allowsZero(d.options);
  if (d.kind === "percent") {
    const s = d.value.trim();
    const n = Number(s);
    return /^\d{1,3}$/.test(s) && n <= 100 && (zero || n >= 1) ? n : null;
  }
  const a = parseAmount(d.value);
  return a !== null && (zero || a > 0) ? a : null;
}

/** Does the minimum field matter for these options? Full only has none. */
export const needsMin = (o: PayNowOptions) => o !== "full";

export function isValid(d: RuleDraft): boolean {
  return !needsMin(d.options) || parseMin(d) !== null;
}

/** The rule to save, or null while the draft is not valid. */
export function toRule(d: RuleDraft, previous?: PayNowRule): PayNowRule | null {
  if (!isValid(d)) return null;
  if (d.options === "full") {
    // Full only has no minimum; keep the last sensible one so switching back is not a blank.
    const min = parseMin(d);
    return min !== null
      ? { options: "full", minKind: d.kind, minValue: min }
      : { options: "full", minKind: previous?.minKind ?? "percent", minValue: previous?.minValue ?? 0 };
  }
  return { options: d.options, minKind: d.kind, minValue: parseMin(d) as number };
}

/** What a draft starts from when the owner moves off "Full only" with no figure to keep. */
export const defaultValue = (kind: PayNowRule["minKind"]) => (kind === "percent" ? "25" : "500");
