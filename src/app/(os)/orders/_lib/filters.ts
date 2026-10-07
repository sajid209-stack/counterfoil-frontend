import type { OrderChannel, OrderMethod, OrderStatus, SalesQuery } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";

/**
 * A sales report is its filters, and its filters live in the address.
 *
 * Everything the Orders list can be narrowed by is one query-string key, so a
 * filtered report is a link: paste it to a colleague, bookmark "this month's
 * cash sales", or hand it to the print page, which reads the same string. The
 * state is never held twice — the page derives it from the address and writes
 * back to the address, so back, forward, reload and Reset all do the obvious
 * thing without a second copy to fall out of step.
 *
 * Defaults are left out of the string, which keeps a link short and means an
 * unfiltered list is just `/orders`.
 */

export const CHANNELS: OrderChannel[] = ["counter", "online", "marketplace"];
export const STATUSES: OrderStatus[] = ["paid", "pending", "partial", "partly_refunded", "refunded", "cancelled"];
export const METHODS: OrderMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal", "voucher", "credit", "split", "none"];
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_SIZE = 20;
export const DEFAULT_SORT = "createdAt";

export interface SalesFilters {
  /** Local days, inclusive, or "" for any date. */
  from: string;
  to: string;
  q: string;
  counters: string[];
  staff: string[];
  channels: OrderChannel[];
  methods: OrderMethod[];
  statuses: OrderStatus[];
  /** One customer's orders — at every venue — from the customer's page. */
  customerId: string;
  /** Their name, only to say whose orders these are. */
  customer: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  size: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[\w.:-]{1,80}$/;

type Params = { get(name: string): string | null };

const list = <T extends string>(raw: string | null, allowed?: readonly T[]): T[] => {
  if (!raw) return [];
  const out = raw.split(",").map((s) => s.trim()).filter((s): s is T => ID.test(s) && (!allowed || (allowed as readonly string[]).includes(s)));
  return [...new Set(out)];
};

export function parseFilters(sp: Params): SalesFilters {
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const ranged = ISO.test(from) && ISO.test(to) && from <= to;
  const size = Number(sp.get("size"));
  const page = Number(sp.get("page"));
  return {
    from: ranged ? from : "",
    to: ranged ? to : "",
    q: (sp.get("q") ?? "").slice(0, 80),
    counters: list(sp.get("counter")),
    staff: list(sp.get("staff")),
    channels: list(sp.get("channel"), CHANNELS),
    methods: list(sp.get("method"), METHODS),
    statuses: list(sp.get("status"), STATUSES),
    customerId: ID.test(sp.get("customerId") ?? "") ? sp.get("customerId")! : "",
    customer: (sp.get("customer") ?? "").slice(0, 120),
    sort: /^[a-zA-Z]+$/.test(sp.get("sort") ?? "") ? sp.get("sort")! : DEFAULT_SORT,
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_SIZE,
  };
}

/** The query string for a set of filters, defaults omitted. `extra` is for the
 *  print links, which also carry the venue. */
export function toSearch(f: SalesFilters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.from && f.to) {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  if (f.q) p.set("q", f.q);
  if (f.counters.length) p.set("counter", f.counters.join(","));
  if (f.staff.length) p.set("staff", f.staff.join(","));
  if (f.channels.length) p.set("channel", f.channels.join(","));
  if (f.methods.length) p.set("method", f.methods.join(","));
  if (f.statuses.length) p.set("status", f.statuses.join(","));
  if (f.customerId) p.set("customerId", f.customerId);
  if (f.customerId && f.customer) p.set("customer", f.customer);
  if (f.sort !== DEFAULT_SORT || f.dir !== "desc") {
    p.set("sort", f.sort);
    p.set("dir", f.dir);
  }
  if (f.page > 1) p.set("page", String(f.page));
  if (f.size !== DEFAULT_SIZE) p.set("size", String(f.size));
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p.toString();
}

/** How many of the facets are narrowing the list (the date counts as one). */
export const activeCount = (f: SalesFilters): number =>
  (f.from ? 1 : 0) + (f.counters.length ? 1 : 0) + (f.staff.length ? 1 : 0) + (f.channels.length ? 1 : 0) + (f.methods.length ? 1 : 0) + (f.statuses.length ? 1 : 0) + (f.q.trim() ? 1 : 0);

/** The question the filters ask of the orders. The venue is the console's lens,
 *  not a filter: one person's orders ignore it, as the customer page promises. */
export function toQuery(f: SalesFilters, locationId: string): SalesQuery {
  return {
    from: f.from || undefined,
    to: f.to || undefined,
    search: f.q || undefined,
    counters: f.counters,
    staff: f.staff,
    channels: f.channels,
    methods: f.methods,
    statuses: f.statuses,
    customerId: f.customerId || undefined,
    locationId: f.customerId ? undefined : locationId || undefined,
  };
}

/** Everything cleared except whose orders these are and how they are ordered. */
export const cleared = (f: SalesFilters): SalesFilters => ({
  ...f,
  from: "", to: "", q: "", counters: [], staff: [], channels: [], methods: [], statuses: [], page: 1,
});

/* ── Date ranges ───────────────────────────────────────────────────────────
 * Local `yyyy-mm-dd` strings throughout, the way DatePicker keeps them: never
 * derived with `toISOString`, which reports the previous day before 06:00 at
 * +06:00. "Today" is the app's own clock, the pinned demo day. */

export const shiftDay = (day: string, n: number): string => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthStart = (day: string) => `${day.slice(0, 8)}01`;

export const PRESETS: { value: string; range: () => [string, string] }[] = [
  { value: "today", range: () => [DEMO_TODAY, DEMO_TODAY] },
  { value: "yesterday", range: () => [shiftDay(DEMO_TODAY, -1), shiftDay(DEMO_TODAY, -1)] },
  { value: "7d", range: () => [shiftDay(DEMO_TODAY, -6), DEMO_TODAY] },
  { value: "30d", range: () => [shiftDay(DEMO_TODAY, -29), DEMO_TODAY] },
  { value: "month", range: () => [monthStart(DEMO_TODAY), DEMO_TODAY] },
  {
    value: "lastmonth",
    range: () => {
      const end = shiftDay(monthStart(DEMO_TODAY), -1);
      return [monthStart(end), end];
    },
  },
];

/** The named range a from/to pair is, or "custom". */
export function presetOf(from: string, to: string): string {
  return PRESETS.find((p) => {
    const [a, b] = p.range();
    return a === from && b === to;
  })?.value ?? "custom";
}

export { DEMO_TODAY };
