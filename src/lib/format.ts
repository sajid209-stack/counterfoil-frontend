import type { Minor } from "@/lib/api";

/** Minor units → display string. 1050 → "৳10.50". Currency is the operator's. */
export function formatMoney(minor: Minor, currency = "BDT"): string {
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  const symbol = currency === "BDT" ? "৳" : `${currency} `;
  return `${symbol}${amount}`;
}

/** ISO datetime → "29 Jul 2026". Empty/nullish → "—". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** ISO datetime → "29 Jul, 14:30". For recent-activity style stamps. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
