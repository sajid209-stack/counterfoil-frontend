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

/** A CATALOGUE price: "৳300", "৳1,500", but "৳1,250.50" when there are paisa.
 *
 *  On a product card the price is the loudest thing on the tile, and a
 *  trailing ".00" is three characters of noise on it — the reference draws
 *  whole prices. This drops a ZERO, never a value: anything with paisa still
 *  shows them. Totals, the cart, receipts and reports keep `formatMoney`,
 *  where two decimal places are an accounting convention rather than a style. */
export function formatPriceShort(minor: Minor, currency = "BDT"): string {
  if (minor % 100 !== 0) return formatMoney(minor, currency);
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(minor / 100);
  const symbol = currency === "BDT" ? "৳" : `${currency} `;
  return `${symbol}${amount}`;
}

/** Minor units → a short axis label. 4500000 → "৳45k", 250000 → "৳2.5k".
 *  Chart axes need the magnitude, not the paisa — "৳45,000.00" repeated up a
 *  y-axis is noise that crowds out the plot. */
export function formatMoneyCompact(minor: Minor, currency = "BDT"): string {
  const symbol = currency === "BDT" ? "৳" : `${currency} `;
  const major = minor / 100;
  const abs = Math.abs(major);
  if (abs >= 1_000_000) return `${symbol}${trim(major / 1_000_000)}m`;
  if (abs >= 1_000) return `${symbol}${trim(major / 1_000)}k`;
  return `${symbol}${trim(major)}`;
}

/** At most one decimal, and never a trailing ".0" — 45 not 45.0, 2.5 stays 2.5. */
const trim = (n: number): string => String(Math.round(n * 10) / 10);

/** A calendar day, the way a person says it: "4 Aug", or "Tue 4 Aug" with
 *  `weekday`. Takes a plain `YYYY-MM-DD`, which is what schedules, course
 *  dates and slot rows carry — parsed at midday so a timezone can never roll
 *  it onto the day before. A raw ISO date shown to a cashier is a defect, not
 *  a formatting preference, and this existed hand-rolled in five places
 *  before it lived here. */
export function formatDay(ymd: string | null | undefined, opts: { weekday?: boolean } = {}): string {
  if (!ymd) return "\u2014";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("en-GB", {
    ...(opts.weekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
  }).format(d);
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

/**
 * "12m ago", "3h ago", "2d ago", then the date.
 *
 * An orders list is read for recency before it is read for anything else, and
 * "29 Jul, 11:05" makes you do the subtraction yourself. Past about a week the
 * relative form stops helping — "23d ago" is not a date anyone can place — so
 * it hands back to the absolute one.
 *
 * `now` is a parameter rather than `Date.now()` so the demo clock and the
 * tests can both say what time it is.
 */
export function formatRelative(iso: string | null | undefined, now: Date): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 0) return formatDateTime(iso);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return formatDateTime(iso);
}
