/**
 * The expense form as plain data, apart from the screen that draws it.
 *
 * Every field is text while someone is typing — "1,250.5", "2.5", "" — and
 * becomes a number only when the form is read. Keeping them apart is what lets
 * the total move as each key is pressed without a half-typed "12." ever being
 * rounded under the person's thumb.
 */
import { DEMO_TODAY } from "@/lib/schedule";
import { expenseLineTotal, expenseProblems, type Expense, type ExpenseCategory, type ExpenseInput, type ExpenseProblemCode, type PaidFrom } from "@/lib/api";

export interface FormLine {
  /** Only for React: which row is which when one is removed. */
  key: string;
  description: string;
  qty: string;
  unit: string;
  /** The price of one unit, in taka as typed. */
  price: string;
}

export interface FormState {
  mode: "single" | "items";
  /** The one amount, in taka as typed. */
  amount: string;
  lines: FormLine[];
  title: string;
  category: ExpenseCategory | "";
  date: string;
  paidFrom: PaidFrom | "";
  counterId: string;
  locationId: string;
  payee: string;
  note: string;
  receiptUrl: string;
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Taka as typed → minor units. `null` when empty, `NaN` when it is not a number.
 *  Takes commas, spaces, a ৳ sign and Bangla digits, because that is what people type. */
export function parseMinor(text: string): number | null {
  const s = text
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/[,\s৳]/g, "");
  if (s === "") return null;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

/** A quantity as typed: more than 0, up to three decimals. `NaN` when it is not one. */
export function parseQty(text: string): number {
  const s = text.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d))).replace(/[,\s]/g, "");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 1000) / 1000;
}

/** Minor units → the text to edit: "85", "650.5", "1250.75". */
export const minorToText = (minor: number): string => {
  const s = (minor / 100).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
};

let nextKey = 0;
export const newKey = () => `ln${++nextKey}`;

export const blankLine = (): FormLine => ({ key: newKey(), description: "", qty: "1", unit: "pcs", price: "" });

/** A row nobody has started: no words and no price. It is dropped on save. */
const isBlank = (l: FormLine) => l.description.trim() === "" && l.price.trim() === "";

/** One line's total as it stands, 0 while it is not a number yet. */
export function lineMinor(l: FormLine): number {
  const q = parseQty(l.qty);
  const p = parseMinor(l.price);
  return Number.isFinite(q) && p != null && Number.isFinite(p) ? expenseLineTotal({ qty: q, unitPrice: p }) : 0;
}

/** What the form adds up to, live. */
export function formTotal(f: FormState): number {
  if (f.mode === "items") return f.lines.reduce((s, l) => s + lineMinor(l), 0);
  const a = parseMinor(f.amount);
  return a != null && Number.isFinite(a) ? a : 0;
}

export function emptyForm(locationId: string, counterId: string): FormState {
  return {
    mode: "single",
    amount: "",
    lines: [blankLine()],
    title: "",
    category: "",
    date: DEMO_TODAY,
    paidFrom: "cash_drawer",
    counterId,
    locationId,
    payee: "",
    note: "",
    receiptUrl: "",
  };
}

export function fromExpense(e: Expense): FormState {
  return {
    mode: e.itemised ? "items" : "single",
    amount: e.itemised ? "" : minorToText(e.amount ?? 0),
    lines: e.itemised
      ? e.lines.map((l) => ({ key: newKey(), description: l.description, qty: String(l.qty), unit: l.unit, price: minorToText(l.unitPrice) }))
      : [blankLine()],
    title: e.title,
    category: e.category,
    date: e.date,
    paidFrom: e.paidFrom,
    counterId: e.counterId ?? "",
    locationId: e.locationId,
    payee: e.payee ?? "",
    note: e.note ?? "",
    receiptUrl: e.receiptUrl ?? "",
  };
}

/** What changed is what matters, so the row keys stay out of the comparison. */
export const snapshot = (f: FormState): string => JSON.stringify({ ...f, lines: f.lines.map(({ key, ...rest }) => (void key, rest)) });

/** Going from one amount to a list keeps what was typed: the amount becomes the
 *  first line. Going back keeps the sum. */
export function switchMode(f: FormState, mode: FormState["mode"]): FormState {
  if (mode === f.mode) return f;
  if (mode === "items") {
    const typed = parseMinor(f.amount);
    const first = f.lines.length === 1 && isBlank(f.lines[0]) && typed != null && Number.isFinite(typed) && typed > 0;
    return { ...f, mode, lines: first ? [{ ...f.lines[0], description: f.title.trim(), price: minorToText(typed) }] : f.lines };
  }
  const sum = formTotal(f);
  return { ...f, mode, amount: sum > 0 ? minorToText(sum) : f.amount };
}

export interface ReadForm {
  input: ExpenseInput;
  /** Problems found now, by field, as codes — keys on the form's own rows. */
  problems: Record<string, ExpenseProblemCode>;
}

/** Read the form into what the API takes, and say what is wrong with it. An
 *  unstarted row is dropped, and the problems are put back on the rows the
 *  person sees. */
export function readForm(f: FormState): ReadForm {
  let kept: number[] = [];
  let lines: ExpenseInput["lines"];
  if (f.mode === "items") {
    kept = f.lines.map((l, i) => (isBlank(l) ? -1 : i)).filter((i) => i >= 0);
    // Nothing started: keep the first row so it can say what it needs.
    if (kept.length === 0) kept = [0];
    lines = kept.map((i) => {
      const l = f.lines[i];
      const p = parseMinor(l.price);
      return { description: l.description, qty: parseQty(l.qty), unit: l.unit, unitPrice: p == null ? NaN : p };
    });
  }
  const amount = f.mode === "single" ? parseMinor(f.amount) : null;
  const input: ExpenseInput = {
    locationId: f.locationId,
    date: f.date,
    category: f.category as ExpenseCategory,
    title: f.title,
    payee: f.payee,
    note: f.note,
    paidFrom: f.paidFrom as PaidFrom,
    counterId: f.paidFrom === "cash_drawer" ? f.counterId : undefined,
    receiptUrl: f.receiptUrl || undefined,
    ...(lines ? { lines } : { amount: amount == null ? NaN : amount }),
  };
  const raw = expenseProblems(input);
  const problems: Record<string, ExpenseProblemCode> = {};
  for (const [k, code] of Object.entries(raw)) {
    const m = /^lines\.(\d+)\.(.+)$/.exec(k);
    problems[m ? `lines.${kept[Number(m[1])]}.${m[2]}` : k] = code;
  }
  return { input, problems };
}
