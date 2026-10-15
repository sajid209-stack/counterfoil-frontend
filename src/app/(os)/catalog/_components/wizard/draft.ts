import { isSlugFree, isSlugValid } from "@/lib/api/products";

/** A translator for one namespace: a key and, where it needs them, values. */
export type Tr = (key: string, values?: Record<string, string | number>) => string;

/** Whole taka as typed → minor units. A blank or half-typed field is 0. */
export const majorToMinor = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const MAX_SLUG = 60;

/** Is this link name one that can be saved: well formed, short enough and not
 *  already another item's? SellChannels shows the reason; the wizard only needs
 *  the yes or no, to hold Continue back. */
export const slugIsFine = (slug: string) => {
  const clean = slug.trim();
  return clean !== "" && clean.length <= MAX_SLUG && isSlugValid(clean) && isSlugFree(clean);
};
