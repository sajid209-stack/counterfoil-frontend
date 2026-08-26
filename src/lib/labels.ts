import { useTranslations } from "next-intl";

/** Localized labels for domain enums. Only the TEXT localizes — colour/tone
 *  mapping (StatusPill) stays on the semantic tokens. Unknown values fall back
 *  to a humanized version of the raw string so nothing ever renders blank. */

const KNOWN_STATUS = new Set([
  "active", "inactive", "confirmed", "paid", "completed", "pending", "invited",
  "partial", "partly_refunded", "archived", "refunded", "suspended", "cancelled",
  "void", "issued", "redeemed", "expired", "no_show", "draft",
]);

const KNOWN_METHOD = new Set(["cash", "bkash", "bangla_qr", "card_terminal", "credits", "mixed"]);
const KNOWN_TAX = new Set(["standard", "reduced", "exempt"]);

function humanize(v: string): string {
  return v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Hook returning enum-label resolvers bound to the active locale. */
export function useEnumLabels() {
  const t = useTranslations("enums");
  return {
    status: (v: string) => (KNOWN_STATUS.has(v) ? t(`status.${v}` as never) : humanize(v)),
    method: (v: string) => (KNOWN_METHOD.has(v) ? t(`method.${v}` as never) : humanize(v)),
    tax: (v: string) => (KNOWN_TAX.has(v) ? t(`tax.${v}` as never) : humanize(v)),
  };
}
