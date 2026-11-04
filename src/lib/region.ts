/*
 * The business's region, read from its currency.
 *
 * Counterfoil was built for Bangladesh first, so taka, VAT and bKash are the
 * defaults everywhere. A US business (the TrustHer partner demos) needs dollars,
 * sales tax and card payments instead. Rather than threading the operator's
 * currency through every screen, the active business sets it here once, and the
 * three places that care read it:
 *
 *   - lib/format     — the money symbol ("$" instead of "৳")
 *   - the i18n layer — "VAT" reads "tax", "৳" reads "$" (components/RegionIntlProvider)
 *   - payments       — bKash and Bangla QR are switched off (api/paymentSettings)
 *
 * Standalone on purpose (no imports): format.ts, the api layer, the client store
 * and server components all import it. The React hook is in lib/useRegion.
 */

let currency = "BDT";
const subs = new Set<() => void>();

export const regionCurrency = (): string => currency;
export const isUsRegion = (): boolean => currency === "USD";

/** Set by the store whenever the active business changes. */
export function setRegionCurrency(next: string): void {
  if (!next || next === currency) return;
  currency = next;
  subs.forEach((f) => f());
}

/** For lib/useRegion: re-render when the business's region changes. */
export const subscribeRegion = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/** The symbol a price is written with. */
export function currencySymbol(code: string = currency): string {
  if (code === "BDT") return "৳";
  if (code === "USD") return "$";
  return `${code} `;
}
