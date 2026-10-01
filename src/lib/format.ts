import type { Minor } from "@/lib/api";

/** Minor units → display string. 1050 → "৳10.50". Currency is the operator's. */
export function formatMoney(minor: Minor, currency = "BDT"): string {
  // The sign goes OUTSIDE the symbol. Intl puts it inside — "৳-47,850.00" —
  // which breaks the optical alignment of a money column and reads as part of
  // the currency rather than as a direction. And it is a true minus (U+2212),
  // not a hyphen: a hyphen is too short and sits at the wrong optical height
  // beside lining figures.
  const negative = minor < 0;
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(minor) / 100);
  const symbol = currency === "BDT" ? "৳" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${amount}`;
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

/** ISO datetime → "29 Jul, 2:30 PM". For recent-activity style stamps. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  return `${day}, ${formatClockOf(d)}`;
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

/* ── Clock times, 12-hour with AM/PM ──────────────────────────────────────
 * Every time a person reads — on the till, in OS, on a ticket — is 12-hour
 * with AM/PM: "7:00 PM", never "19:00". Times are still STORED as 24-hour
 * "HH:MM" strings (slots, schedules, keys); only what is drawn changes, so
 * these take that string (or minutes, or a Date) and never feed back into data.
 * Latin digits and Latin AM/PM in both languages, like prices. */

const clockParts = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  return { h: h24 % 12 === 0 ? 12 : h24 % 12, mm: m % 60, pm: h24 >= 12 };
};

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Minutes after midnight → "7:00 PM". 1440 (end of day) → "12:00 AM". */
export function formatClockMin(min: number, opts: { short?: boolean } = {}): string {
  const { h, mm, pm } = clockParts(min);
  const ampm = pm ? "PM" : "AM";
  if (opts.short && mm === 0) return `${h} ${ampm}`;
  return `${h}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** "19:00" → "7:00 PM"; `short` gives "7 PM" on the hour (axes, grid cells).
 *  Anything that is not a time is handed back untouched, and empty → "—". */
export function formatClock(hhmm: string | null | undefined, opts: { short?: boolean } = {}): string {
  if (!hhmm) return "—";
  const min = toMin(hhmm);
  return min == null ? hhmm : formatClockMin(min, opts);
}

/** A span: "7:00 – 9:00 PM" when both are on one side of noon, otherwise
 *  "11:00 AM – 1:00 PM". Takes "HH:MM" strings or minutes. */
export function formatClockRange(from: string | number, to: string | number): string {
  const a = typeof from === "number" ? from : toMin(from);
  const b = typeof to === "number" ? to : toMin(to);
  if (a == null || b == null) return `${from} – ${to}`;
  const pa = clockParts(a), pb = clockParts(b);
  const left = `${pa.h}:${String(pa.mm).padStart(2, "0")}`;
  return pa.pm === pb.pm ? `${left} – ${formatClockMin(b)}` : `${formatClockMin(a)} – ${formatClockMin(b)}`;
}

/** The clock time of an instant, in this browser's zone: "7:05 PM". */
export function formatClockOf(at: string | Date | null | undefined): string {
  if (!at) return "—";
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "—";
  return formatClockMin(d.getHours() * 60 + d.getMinutes());
}
