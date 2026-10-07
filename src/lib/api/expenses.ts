/**
 * Expenses — what a venue spends, written down where it happened.
 *
 * The model every small-business expense tool settled on (Expensify,
 * QuickBooks, Xero, Ramp, Square's expense tracking, and Shopify POS's "paid
 * out" for cash taken from a drawer): an expense is a short record with an
 * amount, a category, a day, *who or what paid it*, and — optionally — the
 * receipt. Money comes in as one amount, or as a list of items when the owner
 * has the bill in front of them (quantity × unit × unit price).
 *
 * Contract for the backend lane:
 *
 *   - `Expense` is what the API returns. Everything the owner types is stored;
 *     `total`, `lineCount`, `recordedByName` and `counterName` are derived on
 *     read and never stored.
 *   - An expense is either **one amount** (`lines` empty, `amount` set) or
 *     **itemised** (`lines` set, `amount` absent). `total` is the amount, or the
 *     sum of the line totals, where one line total is `round(qty × unitPrice)`.
 *   - `paidFrom: "cash_drawer"` needs a `counterId` at the same venue: it is the
 *     drawer the cash was taken from. Any other way of paying drops it.
 *   - `recordedBy` is the signed-in staff member, read from the session — a
 *     caller never sets it.
 *   - A delete is soft (`deletedAt`), so an Undo can bring it back with its
 *     reference. References (EXP-0001…) are never reused.
 *   - Every write is validated by `expenseProblems`, which returns stable codes;
 *     the English sentence for each is in `EXPENSE_PROBLEM_TEXT`, and a screen
 *     in another language picks its own words by code.
 *
 * Scoped to one venue: the venue in the OS bar (`useActiveLocation`).
 * "Today" is the demo's (`DEMO_TODAY`), never the wall clock.
 */
import { DEMO_STAFF_ID } from "@/lib/session";
import { DEMO_TODAY, demoDay, demoNow } from "@/lib/schedule";
import { formatPriceShort } from "@/lib/format";
import { createResource, delay, fail, notFoundError, ok, validationError } from "./client";
import { peekCounters } from "./counters";
import { peekLocations } from "./locations";
import { peekStaff } from "./staff";
import type { ApiResult, ID, ISODate, ISODateTime, ListResponse, Minor } from "./types";

export const EXPENSE_CATEGORIES = ["supplies", "utilities", "wages", "maintenance", "marketing", "rent", "transport", "food", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Where the money came out of. A cash drawer is a counter's, so it carries one. */
export const PAID_FROM = ["cash_drawer", "bank", "bkash", "card"] as const;
export type PaidFrom = (typeof PAID_FROM)[number];

export interface ExpenseLine {
  description: string;
  /** More than 0; may be fractional (2.5 kg). */
  qty: number;
  /** Free text: pcs, kg, litre, box, hr… */
  unit: string;
  /** Minor units per one unit. */
  unitPrice: Minor;
}

/** What is written to the store. */
export interface StoredExpense {
  id: ID;
  /** "EXP-0007". Counted across the whole business, never reused. */
  ref: string;
  locationId: ID;
  /** The day it was spent: an ISO day, never later than today. */
  date: ISODate;
  category: ExpenseCategory;
  /** Who was paid: a shop, a person, a bill. */
  payee?: string;
  title: string;
  note?: string;
  /** Empty for a one-amount expense. */
  lines: ExpenseLine[];
  /** The one amount. Absent when the expense is itemised. */
  amount?: Minor;
  paidFrom: PaidFrom;
  /** The counter whose cash drawer paid. Only with `paidFrom: "cash_drawer"`. */
  counterId?: ID;
  /** A photo of the receipt. In the mock an object URL that lives for the
   *  session; a real backend stores the file and returns its address. Never
   *  uploaded from here. */
  receiptUrl?: string;
  /** The staff member who wrote it down. */
  recordedBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Set when deleted; the row stays so an Undo can bring it back. */
  deletedAt?: ISODateTime;
}

/** What the API returns: the stored fields plus the derived ones. */
export interface Expense extends Omit<StoredExpense, "deletedAt"> {
  /** The amount, or the sum of the line totals. Minor units, derived. */
  total: Minor;
  itemised: boolean;
  /** How many item lines (0 for a one-amount expense). */
  lineCount: number;
  recordedByName: string;
  /** The counter's name, for a cash-drawer expense. */
  counterName?: string;
}

/** What a caller sends to create or replace an expense. */
export interface ExpenseInput {
  locationId: ID;
  date: ISODate;
  category: ExpenseCategory;
  title: string;
  payee?: string;
  note?: string;
  paidFrom: PaidFrom;
  counterId?: ID;
  receiptUrl?: string;
  /** Itemised: at least one line, and no `amount`. */
  lines?: ExpenseLine[];
  /** One amount, in minor units. */
  amount?: Minor;
}

export type ExpenseSortKey = "date" | "ref" | "title" | "category" | "paidFrom" | "items" | "total" | "recordedBy";

export interface ExpenseQuery {
  /** The venue in the bar. Required: there is no "all venues". */
  locationId: ID;
  /** Inclusive ISO days. */
  from?: ISODate;
  to?: ISODate;
  /** Empty or absent = every category / every way of paying. */
  categories?: ExpenseCategory[];
  paidFrom?: PaidFrom[];
  /** Title, payee or reference. */
  search?: string;
  /** Default: newest day first. */
  sort?: ExpenseSortKey;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ExpenseSummary {
  /** The sum of `total` over every expense the filters match (all pages). */
  total: Minor;
  count: number;
  /** Item lines across the matching expenses. */
  items: number;
  /** Biggest first; only categories with something in them. Sums to `total`. */
  byCategory: { category: ExpenseCategory; total: Minor; count: number }[];
  /** Biggest first; only ways of paying with something in them. Sums to `total`. */
  byPaidFrom: { paidFrom: PaidFrom; total: Minor; count: number }[];
}

// ── the arithmetic ─────────────────────────────────────────────────────────

/** One line's total: whole minor units. */
export const expenseLineTotal = (l: Pick<ExpenseLine, "qty" | "unitPrice">): Minor => Math.round(l.qty * l.unitPrice);

/** An expense's total, from what is stored: the amount, or the sum of its lines. */
export const expenseTotal = (e: Pick<StoredExpense, "lines" | "amount">): Minor =>
  e.lines.length > 0 ? e.lines.reduce((s, l) => s + expenseLineTotal(l), 0) : (e.amount ?? 0);

// ── validation ─────────────────────────────────────────────────────────────

export type ExpenseProblemCode =
  | "venueRequired"
  | "titleRequired"
  | "titleLong"
  | "categoryRequired"
  | "dateRequired"
  | "dateFuture"
  | "paidFromRequired"
  | "counterRequired"
  | "counterWrongVenue"
  | "amountRequired"
  | "lineDescription"
  | "lineQty"
  | "lineUnit"
  | "linePrice";

/** The English sentence for each refusal. Every one says what to do. */
export const EXPENSE_PROBLEM_TEXT: Record<ExpenseProblemCode, string> = {
  venueRequired: "Choose a venue.",
  titleRequired: "Add a short title, like “Cleaning supplies”.",
  titleLong: "Keep the title under 80 letters.",
  categoryRequired: "Choose a category.",
  dateRequired: "Pick the day it was spent.",
  dateFuture: "Pick today or an earlier day.",
  paidFromRequired: "Choose how it was paid.",
  counterRequired: "Choose which counter’s cash drawer it came from.",
  counterWrongVenue: "That counter is at another venue. Choose one from this venue.",
  amountRequired: `Enter an amount above ${formatPriceShort(0)}.`,
  lineDescription: "Say what this item is.",
  lineQty: "Enter a quantity above 0.",
  lineUnit: "Add a unit, like pcs or kg.",
  linePrice: `Enter a price above ${formatPriceShort(0)}.`,
};

const isRealDay = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T12:00:00`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

/** The ways an input is wrong, by field, as codes. Field keys: `locationId`,
 *  `title`, `category`, `date`, `paidFrom`, `counterId`, `amount`, and
 *  `lines.<n>.description|qty|unit|unitPrice` for an itemised expense.
 *  Pure and synchronous, so a form can ask while someone is typing. */
export function expenseProblems(input: ExpenseInput, today: ISODate = DEMO_TODAY): Record<string, ExpenseProblemCode> {
  const out: Record<string, ExpenseProblemCode> = {};
  if (!input.locationId || !peekLocations().some((l) => l.id === input.locationId)) out.locationId = "venueRequired";
  const title = input.title?.trim() ?? "";
  if (!title) out.title = "titleRequired";
  else if (title.length > 80) out.title = "titleLong";
  if (!EXPENSE_CATEGORIES.includes(input.category)) out.category = "categoryRequired";
  if (!input.date || !isRealDay(input.date)) out.date = "dateRequired";
  else if (input.date > today) out.date = "dateFuture";
  if (!PAID_FROM.includes(input.paidFrom)) out.paidFrom = "paidFromRequired";
  else if (input.paidFrom === "cash_drawer") {
    if (!input.counterId) out.counterId = "counterRequired";
    else {
      const counter = peekCounters().find((c) => c.id === input.counterId);
      if (!counter || counter.locationId !== input.locationId) out.counterId = "counterWrongVenue";
    }
  }
  if (input.lines && input.lines.length > 0) {
    input.lines.forEach((l, i) => {
      if (!l.description?.trim()) out[`lines.${i}.description`] = "lineDescription";
      if (!Number.isFinite(l.qty) || l.qty <= 0) out[`lines.${i}.qty`] = "lineQty";
      if (!l.unit?.trim()) out[`lines.${i}.unit`] = "lineUnit";
      if (!Number.isFinite(l.unitPrice) || Math.round(l.unitPrice) <= 0) out[`lines.${i}.unitPrice`] = "linePrice";
    });
  } else if (input.amount == null || !Number.isFinite(input.amount) || Math.round(input.amount) <= 0) {
    out.amount = "amountRequired";
  }
  return out;
}

// ── the store ──────────────────────────────────────────────────────────────

const resource = createResource<StoredExpense>("expenses", "Expense");

const seqOf = (ref: string) => Number(ref.replace(/\D/g, "")) || 0;
const refOf = (n: number) => `EXP-${String(n).padStart(4, "0")}`;
const nextRef = () => refOf(resource.peek().reduce((m, e) => Math.max(m, seqOf(e.ref)), 0) + 1);

/** Written on the demo's clock, a second apart so they keep their order — never
 *  the real one, which is after the demo's today (see `finances.ts`). */
const stamp = (): ISODateTime => new Date(demoNow().getTime() + resource.peek().length * 1000).toISOString();

/** An input as it is stored: trimmed, one amount or lines but never both, a
 *  counter only for a cash drawer. */
function clean(input: ExpenseInput): Omit<StoredExpense, "id" | "ref" | "recordedBy" | "createdAt" | "updatedAt"> {
  const lines = (input.lines ?? []).map((l) => ({
    description: l.description.trim(),
    qty: l.qty,
    unit: l.unit.trim(),
    unitPrice: Math.round(l.unitPrice),
  }));
  const payee = input.payee?.trim();
  const note = input.note?.trim();
  return {
    locationId: input.locationId,
    date: input.date,
    category: input.category,
    title: input.title.trim(),
    ...(payee ? { payee } : {}),
    ...(note ? { note } : {}),
    lines,
    ...(lines.length === 0 ? { amount: Math.round(input.amount ?? 0) } : {}),
    paidFrom: input.paidFrom,
    ...(input.paidFrom === "cash_drawer" && input.counterId ? { counterId: input.counterId } : {}),
    ...(input.receiptUrl ? { receiptUrl: input.receiptUrl } : {}),
  };
}

const live = () => resource.peek().filter((e) => !e.deletedAt);

function present(e: StoredExpense): Expense {
  const { deletedAt, ...rest } = e;
  void deletedAt;
  const counter = e.counterId ? peekCounters().find((c) => c.id === e.counterId) : undefined;
  return {
    ...rest,
    total: expenseTotal(e),
    itemised: e.lines.length > 0,
    lineCount: e.lines.length,
    recordedByName: peekStaff().find((s) => s.id === e.recordedBy)?.name ?? "—",
    ...(counter ? { counterName: counter.name } : {}),
  };
}

// ── the seed ───────────────────────────────────────────────────────────────

const L = (description: string, qty: number, unit: string, unitPrice: Minor): ExpenseLine => ({ description, qty, unit, unitPrice });

/** A drawn receipt, so a few seeded rows show what a receipt looks like. */
function receiptPicture(shop: string, total: Minor, rows: string[]): string {
  const money = `৳${(total / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const bars = rows
    .map((r, i) => `<text x="22" y="${112 + i * 22}" font-size="13" fill="#555">${r}</text><text x="218" y="${112 + i * 22}" font-size="13" fill="#555" text-anchor="end">••••</text>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320" font-family="Arial, sans-serif">` +
    `<rect width="240" height="320" fill="#f4f1ea"/><rect x="10" y="8" width="220" height="304" fill="#fff" stroke="#d8d3c8"/>` +
    `<text x="120" y="42" font-size="16" font-weight="bold" fill="#222" text-anchor="middle">${shop}</text>` +
    `<text x="120" y="62" font-size="11" fill="#777" text-anchor="middle">Cash memo</text>` +
    `<line x1="22" y1="78" x2="218" y2="78" stroke="#bbb" stroke-dasharray="3 3"/>${bars}` +
    `<line x1="22" y1="270" x2="218" y2="270" stroke="#bbb" stroke-dasharray="3 3"/>` +
    `<text x="22" y="294" font-size="15" font-weight="bold" fill="#222">Total</text>` +
    `<text x="218" y="294" font-size="15" font-weight="bold" fill="#222" text-anchor="end">${money}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Seed = {
  /** Days from the demo's today; 0 is today, −30 is the oldest. */
  day: number;
  loc: "loc_fort" | "loc_museum" | "loc_garden";
  category: ExpenseCategory;
  title: string;
  payee?: string;
  note?: string;
  paidFrom: PaidFrom;
  counter?: string;
  by: string;
  amount?: Minor;
  lines?: ExpenseLine[];
  receipt?: boolean;
};

/** Thirty-one days across the three venues, in the order they were spent.
 *  Written out rather than generated, so every figure can be read and checked. */
const SEED: Seed[] = [
  { day: -30, loc: "loc_fort", category: "rent", title: "Monthly rent — Lalbagh office", payee: "Haque Properties", paidFrom: "bank", by: "stf_rahim", amount: 4500000, note: "Paid by bank transfer on the 29th." },
  { day: -29, loc: "loc_museum", category: "utilities", title: "Electricity bill — June", payee: "DESCO", paidFrom: "bank", by: "stf_farhana", amount: 1862000 },
  { day: -28, loc: "loc_garden", category: "rent", title: "Ground lease — July", payee: "Baldha Estate Trust", paidFrom: "bank", by: "stf_arif", amount: 3000000 },
  { day: -28, loc: "loc_fort", category: "supplies", title: "Ticket rolls and printer ink", payee: "Rahman Stationery", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_nadia", receipt: true, lines: [L("Thermal ticket rolls", 40, "roll", 8500), L("Printer ink", 2, "bottle", 65000)] },
  { day: -27, loc: "loc_garden", category: "maintenance", title: "Fence repair and paint", payee: "Salam Hardware", paidFrom: "bkash", by: "stf_arif", lines: [L("Weatherproof paint", 6, "litre", 78000), L("Bamboo poles", 30, "pcs", 12000), L("Labour", 2, "day", 120000)] },
  { day: -26, loc: "loc_fort", category: "food", title: "Tea and snacks for staff", payee: "Lalbagh Tea Stall", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_karim", amount: 85000 },
  { day: -25, loc: "loc_museum", category: "marketing", title: "Facebook ads — July", payee: "Meta", paidFrom: "card", by: "stf_farhana", amount: 650000 },
  { day: -24, loc: "loc_fort", category: "transport", title: "Courier — school group letters", payee: "Sundarban Courier", paidFrom: "cash_drawer", counter: "cnt_fort_group", by: "stf_nadia", amount: 42000 },
  { day: -23, loc: "loc_fort", category: "wages", title: "Overtime — Eid weekend", payee: "Staff payroll", paidFrom: "bank", by: "stf_rahim", amount: 1850000 },
  { day: -22, loc: "loc_museum", category: "supplies", title: "Cleaning supplies", payee: "Mohammadpur Traders", paidFrom: "cash_drawer", counter: "cnt_museum_group", by: "stf_tania", lines: [L("Floor cleaner", 10, "litre", 24000), L("Mop heads", 6, "pcs", 18000), L("Garbage bags", 5, "pack", 12000)] },
  { day: -21, loc: "loc_garden", category: "utilities", title: "Water pump electricity", payee: "Dhaka Power", paidFrom: "bkash", by: "stf_arif", amount: 320000 },
  { day: -20, loc: "loc_fort", category: "maintenance", title: "CCTV camera repair", payee: "SafeView Security", paidFrom: "bank", by: "stf_rahim", amount: 780000, note: "Two cameras at the gate, one in the garden." },
  { day: -19, loc: "loc_fort", category: "food", title: "Lunch for tour guides", payee: "Nanna Biryani", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_nadia", lines: [L("Biryani packs", 8, "pcs", 22000), L("Soft drinks", 8, "bottle", 3500)] },
  { day: -18, loc: "loc_museum", category: "maintenance", title: "Gallery lights replaced", payee: "Bright Electric", paidFrom: "cash_drawer", counter: "cnt_museum_group", by: "stf_farhana", lines: [L("LED panel", 4, "pcs", 145000), L("Fitting", 1, "job", 80000)] },
  { day: -16, loc: "loc_fort", category: "marketing", title: "Printed brochures", payee: "Dhaka Print House", paidFrom: "bank", by: "stf_rahim", amount: 600000, receipt: true },
  { day: -14, loc: "loc_fort", category: "utilities", title: "Generator diesel", payee: "Padma Filling Station", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_karim", lines: [L("Diesel", 60, "litre", 10900)] },
  { day: -13, loc: "loc_garden", category: "supplies", title: "Garden tools", payee: "Krishi Bazar", paidFrom: "bkash", by: "stf_arif", receipt: true, lines: [L("Pruning shears", 3, "pcs", 65000), L("Hose pipe", 2, "pcs", 180000), L("Work gloves", 6, "pair", 12000)] },
  { day: -12, loc: "loc_fort", category: "transport", title: "Staff van fuel", payee: "Padma Filling Station", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_jamal", amount: 250000 },
  { day: -10, loc: "loc_museum", category: "wages", title: "Part-time guide payment", payee: "Ruhul Amin", paidFrom: "bank", by: "stf_farhana", amount: 1200000 },
  { day: -9, loc: "loc_fort", category: "other", title: "Bank charges", payee: "BRAC Bank", paidFrom: "bank", by: "stf_rahim", amount: 45000 },
  { day: -8, loc: "loc_fort", category: "supplies", title: "First aid and drinking water", payee: "Lazz Pharma", paidFrom: "cash_drawer", counter: "cnt_fort_group", by: "stf_nadia", lines: [L("First aid kit", 2, "pcs", 95000), L("Water bottles", 24, "bottle", 2500)] },
  { day: -6, loc: "loc_museum", category: "utilities", title: "Internet — July", payee: "Link3", paidFrom: "bank", by: "stf_farhana", amount: 150000 },
  { day: -5, loc: "loc_fort", category: "maintenance", title: "Pathway sweeping and repair", payee: "Local labour crew", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_rahim", amount: 540000 },
  { day: -4, loc: "loc_garden", category: "food", title: "Staff lunch", payee: "Baldha Canteen", paidFrom: "bkash", by: "stf_arif", amount: 96000 },
  { day: -3, loc: "loc_fort", category: "wages", title: "Daily helper — this week", payee: "Rafiq", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_nadia", amount: 300000 },
  { day: -2, loc: "loc_museum", category: "marketing", title: "Tourist map listing", payee: "Dhaka Guide", paidFrom: "card", by: "stf_farhana", amount: 400000 },
  { day: -1, loc: "loc_fort", category: "supplies", title: "Restroom cleaning supplies", payee: "Mohammadpur Traders", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_karim", lines: [L("Hand wash", 6, "bottle", 18000), L("Tissue", 12, "pack", 9500), L("Phenyl", 4, "litre", 14000)] },
  { day: 0, loc: "loc_fort", category: "food", title: "Tea for the visitors’ lounge", payee: "Lalbagh Tea Stall", paidFrom: "cash_drawer", counter: "cnt_fort_main", by: "stf_nadia", amount: 56000 },
  { day: 0, loc: "loc_museum", category: "transport", title: "Rickshaw — artefact delivery", payee: "Kumartoli stand", paidFrom: "cash_drawer", counter: "cnt_museum_group", by: "stf_tania", amount: 18000 },
];

function seedStore(): void {
  const rows = resource.peek();
  if (rows.length > 0) return;
  SEED.forEach((s, i) => {
    const total = s.lines ? s.lines.reduce((t, l) => t + expenseLineTotal(l), 0) : (s.amount ?? 0);
    const date = demoDay(s.day);
    // Index-based variation: the hour and minute it was written down.
    const at = `${date}T${String(9 + ((i * 7) % 9)).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}:00+06:00`;
    rows.push({
      id: `exp_seed_${String(i + 1).padStart(2, "0")}`,
      ref: refOf(i + 1),
      locationId: s.loc,
      date,
      category: s.category,
      ...(s.payee ? { payee: s.payee } : {}),
      title: s.title,
      ...(s.note ? { note: s.note } : {}),
      lines: s.lines ?? [],
      ...(s.lines ? {} : { amount: s.amount }),
      paidFrom: s.paidFrom,
      ...(s.counter ? { counterId: s.counter } : {}),
      ...(s.receipt ? { receiptUrl: receiptPicture(s.payee ?? s.title, total, (s.lines ?? [{ description: s.title }]).map((l) => l.description)) } : {}),
      recordedBy: s.by,
      createdAt: at,
      updatedAt: at,
    });
  });
}
seedStore();

// ── reads ──────────────────────────────────────────────────────────────────

function matcher(q: ExpenseQuery) {
  const needle = q.search?.trim().toLowerCase() ?? "";
  const cats = q.categories ?? [];
  const pays = q.paidFrom ?? [];
  return (e: StoredExpense) => {
    if (e.locationId !== q.locationId) return false;
    if ((q.from && e.date < q.from) || (q.to && e.date > q.to)) return false;
    if (cats.length > 0 && !cats.includes(e.category)) return false;
    if (pays.length > 0 && !pays.includes(e.paidFrom)) return false;
    if (!needle) return true;
    return e.title.toLowerCase().includes(needle) || (e.payee?.toLowerCase().includes(needle) ?? false) || e.ref.toLowerCase().includes(needle);
  };
}

const newestFirst = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || seqOf(b.ref) - seqOf(a.ref);

const COMPARE: Record<ExpenseSortKey, (a: Expense, b: Expense) => number> = {
  date: (a, b) => a.date.localeCompare(b.date),
  ref: (a, b) => seqOf(a.ref) - seqOf(b.ref),
  title: (a, b) => a.title.localeCompare(b.title),
  category: (a, b) => a.category.localeCompare(b.category),
  paidFrom: (a, b) => a.paidFrom.localeCompare(b.paidFrom),
  items: (a, b) => a.lineCount - b.lineCount,
  total: (a, b) => a.total - b.total,
  recordedBy: (a, b) => a.recordedByName.localeCompare(b.recordedByName),
};

/** Every expense the filters match, in the order asked for, all pages. */
function matching(q: ExpenseQuery): Expense[] {
  const key = q.sort ?? "date";
  // No sort named: newest first. A sort named without a direction reads upward.
  const order = q.sort ? (q.order === "desc" ? -1 : 1) : -1;
  return live()
    .filter(matcher(q))
    .map(present)
    .sort((a, b) => COMPARE[key](a, b) * order || newestFirst(a, b));
}

export async function listExpenses(q: ExpenseQuery): Promise<ApiResult<ListResponse<Expense>>> {
  await delay();
  const all = matching(q);
  const pageSize = Math.max(1, Math.floor(q.pageSize ?? 20));
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  // A page past the end (a venue change, a narrower filter) shows the last one.
  const page = Math.min(Math.max(1, Math.floor(q.page ?? 1)), totalPages);
  return ok({ data: all.slice((page - 1) * pageSize, page * pageSize), page: { page, pageSize, total: all.length, totalPages } });
}

export async function getExpense(id: ID): Promise<ApiResult<Expense>> {
  await delay();
  const e = live().find((x) => x.id === id);
  return e ? ok(present(e)) : fail(notFoundError("Expense"));
}

/** The same figures `listExpenses` shows, for the whole filter, not one page. */
export async function getExpenseSummary(q: ExpenseQuery): Promise<ApiResult<ExpenseSummary>> {
  await delay();
  const rows = matching(q);
  const total = rows.reduce((s, e) => s + e.total, 0);
  const group = <K extends string>(keys: readonly K[], of: (e: Expense) => K) =>
    keys
      .map((k) => {
        const hit = rows.filter((e) => of(e) === k);
        return { key: k, total: hit.reduce((s, e) => s + e.total, 0), count: hit.length };
      })
      .filter((g) => g.count > 0)
      .sort((a, b) => b.total - a.total);
  return ok({
    total,
    count: rows.length,
    items: rows.reduce((s, e) => s + e.lineCount, 0),
    byCategory: group(EXPENSE_CATEGORIES, (e) => e.category).map(({ key, total: t, count }) => ({ category: key, total: t, count })),
    byPaidFrom: group(PAID_FROM, (e) => e.paidFrom).map(({ key, total: t, count }) => ({ paidFrom: key, total: t, count })),
  });
}

/** Who this venue has paid lately, newest first, so a form can offer them. */
export async function listExpensePayees(locationId: ID, limit = 6): Promise<ApiResult<string[]>> {
  await delay();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of live().filter((x) => x.locationId === locationId).map(present).sort(newestFirst)) {
    const p = e.payee?.trim();
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    out.push(p);
    if (out.length >= limit) break;
  }
  return ok(out);
}

/** Every live expense, for another module that has to read them (and for tests). */
export const peekExpenses = (locationId?: ID): Expense[] => live().filter((e) => !locationId || e.locationId === locationId).map(present);

// ── the spreadsheet ────────────────────────────────────────────────────────

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface ExpensesCsvLabels {
  /** The eleven column headings, in order. */
  headers?: string[];
  categories?: Partial<Record<ExpenseCategory, string>>;
  paidFrom?: Partial<Record<PaidFrom, string>>;
}

const CSV_HEADERS = ["Reference", "Date", "Title", "Paid to", "Category", "Paid from", "Counter", "Items", "Total", "Added by", "Note"];
const CATEGORY_NAME: Record<ExpenseCategory, string> = { supplies: "Supplies", utilities: "Utilities", wages: "Wages", maintenance: "Maintenance", marketing: "Marketing", rent: "Rent", transport: "Transport", food: "Food", other: "Other" };
const PAID_FROM_NAME: Record<PaidFrom, string> = { cash_drawer: "Cash drawer", bank: "Bank", bkash: "bKash", card: "Card" };

/** Every expense the filters match (all pages) as CSV text, CRLF-separated, one
 *  row each and no total row — so the Total column adds up to the summary. */
export function expensesCsv(q: ExpenseQuery, labels: ExpensesCsvLabels = {}): string {
  const head = labels.headers && labels.headers.length === CSV_HEADERS.length ? labels.headers : CSV_HEADERS;
  const body = matching(q).map((e) =>
    [
      e.ref,
      e.date,
      e.title,
      e.payee ?? "",
      labels.categories?.[e.category] ?? CATEGORY_NAME[e.category],
      labels.paidFrom?.[e.paidFrom] ?? PAID_FROM_NAME[e.paidFrom],
      e.counterName ?? "",
      e.lineCount,
      (e.total / 100).toFixed(2),
      e.recordedByName,
      e.note ?? "",
    ]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...body].join("\r\n");
}

// ── writes ─────────────────────────────────────────────────────────────────

const refused = <T,>(codes: Record<string, ExpenseProblemCode>): ApiResult<T> => {
  const fieldErrors = Object.fromEntries(Object.entries(codes).map(([k, c]) => [k, EXPENSE_PROBLEM_TEXT[c]]));
  return fail(validationError(fieldErrors, Object.values(fieldErrors)[0]));
};

/** Write an expense down. `recordedBy` is the signed-in person: the session's,
 *  unless a test says otherwise. */
export async function createExpense(input: ExpenseInput, recordedBy: ID = DEMO_STAFF_ID): Promise<ApiResult<Expense>> {
  await delay();
  const problems = expenseProblems(input);
  if (Object.keys(problems).length > 0) return refused(problems);
  const at = stamp();
  const row: StoredExpense = { ...clean(input), id: `exp_${globalThis.crypto.randomUUID().slice(0, 8)}`, ref: nextRef(), recordedBy, createdAt: at, updatedAt: at };
  resource.peek().push(row);
  return ok(present(row));
}

/** Replace what was written. Who recorded it, its reference and its creation
 *  stamp do not change. */
export async function updateExpense(id: ID, input: ExpenseInput): Promise<ApiResult<Expense>> {
  await delay();
  const rows = resource.peek();
  const at = rows.findIndex((e) => e.id === id && !e.deletedAt);
  if (at === -1) return fail(notFoundError("Expense"));
  const problems = expenseProblems(input);
  if (Object.keys(problems).length > 0) return refused(problems);
  const old = rows[at];
  const next: StoredExpense = { ...clean(input), id: old.id, ref: old.ref, recordedBy: old.recordedBy, createdAt: old.createdAt, updatedAt: stamp() };
  rows[at] = next;
  return ok(present(next));
}

/** Soft delete: the row stays, hidden, so `restoreExpense` can bring it back. */
export async function deleteExpense(id: ID): Promise<ApiResult<Expense>> {
  await delay();
  const rows = resource.peek();
  const at = rows.findIndex((e) => e.id === id && !e.deletedAt);
  if (at === -1) return fail(notFoundError("Expense"));
  rows[at] = { ...rows[at], deletedAt: stamp() };
  return ok(present(rows[at]));
}

/** Undo a delete: the same expense, with the same reference. */
export async function restoreExpense(id: ID): Promise<ApiResult<Expense>> {
  await delay();
  const rows = resource.peek();
  const at = rows.findIndex((e) => e.id === id && e.deletedAt);
  if (at === -1) return fail(notFoundError("Expense"));
  const { deletedAt, ...rest } = rows[at];
  void deletedAt;
  rows[at] = rest;
  return ok(present(rows[at]));
}
