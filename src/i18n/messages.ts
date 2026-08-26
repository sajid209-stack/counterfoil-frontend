import type { Locale } from "./locale";

// The message catalog is split per-namespace (src/messages/<locale>/<ns>.json)
// so screen migrations don't collide on one giant file. This module is the
// single place that knows the namespace list — add a namespace here once and
// both locales + the typing pick it up.
export const NAMESPACES = [
  "common", "nav", "enums", "errors",
  "auth", "dashboard", "calendar", "customers",
  "orders", "reports", "products", "resources",
  "settings", "profile", "pos", "scan", "checkin", "shift", "quickpass", "schedule",
  "moneysetup", "seatmaps", "promotions", "ticket", "pricing", "bookingRules",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}
