/**
 * Finances — the venue's money with Counterfoil, as ONE balance.
 *
 * This replaces four views of the same money (Transactions, Fees & balances,
 * Payouts, Fee collections) with the model every payments product converged
 * on — Stripe's Balances, Shopify Payments, Square's balance, Mercury and
 * Wise: a balance that money comes into, fees come off, and payouts go out of.
 *
 * PRODUCT DECISION (owner, 2026-10-05): the two sides are now netted. The
 * earlier model kept "we will pay you" and "you owe us" apart and never set one
 * against the other (the backend guide's open question 3, "netting"). A
 * balance with Withdraw and Deposit IS netting: Counterfoil's fees come off the
 * balance, and when they outweigh what is held the balance goes below zero and
 * says what the venue owes, which a Deposit covers. `platformFees.ts` still
 * computes the fee on every payment — this module reads its entries; it does
 * not change how a fee is worked out.
 *
 * Every figure is derived from the ledger, never stored, so the two boxes and
 * the activity list cannot disagree. The invariant the tests hold:
 *
 *     available + unsettled === sum of every activity line's `amount`
 *
 * Scoped to one venue: the venue in the OS bar (`useActiveLocation`).
 */
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";
import { createResource, delay, fail, getOperatorState, ok, validationError } from "./client";
import { peekOrders } from "./orders";
import { payoutDayAfterSchedule } from "./paymentSettings";
import { describeDestination, peekFeeEntries, peekPayoutDestination, peekPlatformFeeRates, peekSettlementTerms } from "./platformFees";
import type { PlatformFeeEntry } from "./platformFees";
import type { ApiResult, ID, ISODate, ISODateTime, Minor, PaymentMethod } from "./types";

/** How long an online payment Counterfoil collected takes to clear into the
 *  available balance. Two days, as bKash and card settlement take here. */
export const CLEARING_DAYS = 2;

export type FinanceLineKind =
  /** An online payment Counterfoil collected for you — money IN. */
  | "sale"
  /** Money given back from a payment Counterfoil collected — OUT. */
  | "refund"
  /** Counterfoil's fee on a payment (any payment, wherever the money went). */
  | "platform_fee"
  /** The online payment company's fee, on payments Counterfoil collected. */
  | "processing_fee"
  /** An automatic payout to the bank on the payout schedule — OUT. */
  | "payout"
  /** A payout the venue asked for with Withdraw — OUT. */
  | "withdrawal"
  /** Money the venue added with Deposit — IN. */
  | "deposit";

export type FinanceLineStatus =
  /** A sale still clearing: counted in `unsettled`, not yet in `available`. */
  | "pending"
  /** In the available balance. */
  | "cleared"
  /** A fee taken off the balance. */
  | "billed"
  /** A payout or withdrawal on its way to the bank. */
  | "processing"
  /** A payout or withdrawal the bank has. */
  | "paid"
  /** A deposit that has landed. */
  | "received";

export interface FinanceLine {
  id: ID;
  kind: FinanceLineKind;
  /** Signed, from the balance's side: + comes in, − goes out. */
  amount: Minor;
  status: FinanceLineStatus;
  at: ISODateTime;
  /** The order it belongs to, for sale / refund / fee lines. */
  orderId?: ID;
  orderReference?: string;
  /** How the guest paid (sale, refund, fees), or how a deposit was paid. */
  method?: PaymentMethod | "bank_transfer";
  /** The bank's or provider's reference (payout, withdrawal, deposit). */
  reference?: string;
  /** Where a payout or withdrawal went, masked ("City Bank ••4821"). */
  destination?: string;
  /** For fee lines: the base the fee was taken on and the rate, so the row can
   *  explain itself ("5% of ৳400.00"). */
  feeBase?: Minor;
  rateBp?: number;
  /** Who asked, for withdrawals and deposits. */
  by?: string;
}

export interface FinanceDay {
  date: ISODate;
  /** Newest first. */
  lines: FinanceLine[];
  moneyIn: Minor;
  /** Positive number: the total that went out. */
  moneyOut: Minor;
  net: Minor;
  /** "pending" while any line that day is still clearing or on its way. */
  status: "pending" | "settled";
}

export interface FinanceSummary {
  currency: string;
  /** Online money still clearing. Never negative. */
  unsettled: Minor;
  /** The day the newest unsettled money clears, or null when nothing is. */
  clearsBy: ISODate | null;
  /** Cleared money, after fees and payouts. Can be negative: then the venue
   *  owes Counterfoil this much and a Deposit covers it. */
  available: Minor;
  /** The next automatic payout on the venue's schedule, or null when the
   *  available balance is zero or below. */
  nextPayout: { date: ISODate; amount: Minor } | null;
  /** The payout bank, masked; null when none is set (Withdraw is refused). */
  destination: string | null;
  /** Totals for the period being looked at (the activity filter's range). */
  period: { from: ISODate; to: ISODate; moneyIn: Minor; fees: Minor; refunds: Minor; paidOut: Minor };
}

export type FinanceFilter = "all" | "sales" | "fees" | "refunds" | "payouts" | "deposits";

export interface FinanceActivityQuery {
  from?: ISODate;
  to?: ISODate;
  filter?: FinanceFilter;
  /** Order reference, bank reference or customer name. */
  search?: string;
  /** Days, not lines: a page is N days. */
  page?: number;
  pageSize?: number;
}

export interface FinanceActivity {
  days: FinanceDay[];
  /** Days matching, across all pages. */
  total: number;
}

export type DepositMethod = "bkash" | "card_terminal" | "bank_transfer";

// ── the ledger ─────────────────────────────────────────────────────────────

/** A withdrawal or deposit made this session, held against its venue. Every
 *  other line is derived from the orders and never stored. */
type SessionLine = FinanceLine & { locationId: ID };
const sessionResource = createResource<SessionLine>("financeLines", "Finance line");

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (iso: ISODateTime): ISODate => isoDay(new Date(iso));
const addDays = (day: ISODate, n: number): ISODate => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const tagOf = (locationId: ID) => locationId.replace(/^loc_/, "").slice(0, 3).toUpperCase();

/** The demo is pinned to DEMO_TODAY, but an order made during a session is
 *  stamped with the real clock — which is after it. Such a line belongs to the
 *  demo's today, or the ledger would hold money from a day that has not
 *  happened and the period totals would disagree with the balance. */
const stampOf = (iso: ISODateTime): ISODateTime => (localDay(iso) > DEMO_TODAY ? demoNow().toISOString() : iso);

/** The day a sale stops being "unsettled" and joins the available balance. */
const clearDayOf = (line: FinanceLine): ISODate => addDays(localDay(line.at), CLEARING_DAYS);

/** Lines carry their own order in the ledger, so two lines made by one payment
 *  (a sale and its fees) keep their reading order whatever the sort. */
const seqOf = new WeakMap<FinanceLine, number>();

function entryLines(e: PlatformFeeEntry, rates: { platformFeeBp: number; platformGatewayFeeBp: number }): FinanceLine[] {
  const at = stampOf(e.createdAt);
  const common = { at, orderId: e.orderId, orderReference: e.orderNumber, method: e.paymentMethod };
  const out: FinanceLine[] = [];
  const push = (l: FinanceLine) => {
    if (l.amount !== 0) out.push(l);
  };
  if (e.kind === "payment") {
    if (e.collectedBy === "platform") {
      push({
        ...common,
        id: `fl_${e.id}_sale`,
        kind: "sale",
        amount: e.amount,
        status: addDays(localDay(at), CLEARING_DAYS) <= DEMO_TODAY ? "cleared" : "pending",
      });
      push({ ...common, id: `fl_${e.id}_pf`, kind: "platform_fee", amount: -e.platformFee, status: "billed", feeBase: e.feeBase, rateBp: rates.platformFeeBp });
      push({ ...common, id: `fl_${e.id}_gf`, kind: "processing_fee", amount: -e.gatewayFee, status: "billed", feeBase: e.feeBase, rateBp: rates.platformGatewayFeeBp });
    } else {
      // The money went straight to the venue; only Counterfoil's fee is owed.
      push({ ...common, id: `fl_${e.id}_pf`, kind: "platform_fee", amount: -e.platformFee, status: "billed", feeBase: e.feeBase, rateBp: rates.platformFeeBp });
    }
  } else if (e.collectedBy === "platform") {
    push({ ...common, id: `fl_${e.id}_rf`, kind: "refund", amount: -Math.abs(e.amount), status: "cleared" });
  }
  return out;
}

/** The automatic payouts. Walks the days in order and, on each payout day up to
 *  and including today, pays out everything available at six that morning — so
 *  a payout is a pure function of the lines before it, and never takes the
 *  balance below zero. A line made after six (today's sales, a withdrawal, a
 *  deposit) belongs to the next one. */
function payoutLines(locationId: ID, others: FinanceLine[]): FinanceLine[] {
  const terms = peekSettlementTerms();
  const bank = describeDestination(peekPayoutDestination());
  const days = others.map((l) => localDay(l.at)).sort();
  if (!days.length) return [];
  const out: FinanceLine[] = [];
  for (let d = days[0]; d <= DEMO_TODAY; d = addDays(d, 1)) {
    if (payoutDayAfterSchedule(addDays(d, -1), terms.payoutSchedule, terms.payoutDay) !== d) continue;
    const at = new Date(`${d}T06:00:00`);
    const available = [...others, ...out].reduce((total, l) => {
      if (l.kind === "sale") return clearDayOf(l) <= d ? total + l.amount : total;
      return Date.parse(l.at) < at.getTime() ? total + l.amount : total;
    }, 0);
    if (available <= 0) continue;
    out.push({
      id: `fl_po_${locationId}_${d}`,
      kind: "payout",
      amount: -available,
      status: d < DEMO_TODAY ? "paid" : "processing",
      at: at.toISOString(),
      reference: `PO-${tagOf(locationId)}-${d.slice(5).replace("-", "")}`,
      ...(bank ? { destination: bank } : {}),
    });
  }
  return out;
}

const stripLocation = (line: SessionLine): FinanceLine => {
  const { locationId, ...rest } = line;
  void locationId;
  return rest;
};

/** Every line for a venue, newest first. Derived in one pass so a figure, the
 *  list and the export cannot disagree. */
function allLines(locationId: ID): FinanceLine[] {
  const entries = peekFeeEntries(locationId).slice().reverse(); // oldest first
  const rates = peekPlatformFeeRates();
  const fromOrders = entries.flatMap((e) => entryLines(e, rates));
  const session = sessionResource
    .peek()
    .filter((l) => l.locationId === locationId)
    .map(stripLocation);
  const base = [...fromOrders, ...session];
  const all = [...base, ...payoutLines(locationId, base)];
  all.forEach((l, i) => seqOf.set(l, i));
  return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (seqOf.get(a) ?? 0) - (seqOf.get(b) ?? 0));
}

const sum = (ls: FinanceLine[], f: (l: FinanceLine) => boolean = () => true) => ls.reduce((s, l) => (f(l) ? s + l.amount : s), 0);

function summaryOf(lines: FinanceLine[], from: ISODate, to: ISODate): FinanceSummary {
  const terms = peekSettlementTerms();
  const pending = lines.filter((l) => l.status === "pending");
  const unsettled = sum(pending);
  const clearsBy = pending.length ? pending.map(clearDayOf).sort().pop()! : null;
  const available = sum(lines, (l) => l.status !== "pending");
  // What the next payout will find: today's balance plus what clears by then.
  const nextDate = payoutDayAfterSchedule(DEMO_TODAY, terms.payoutSchedule, terms.payoutDay);
  const projected = available + sum(pending, (l) => clearDayOf(l) <= nextDate);
  const inRange = lines.filter((l) => {
    const d = localDay(l.at);
    return d >= from && d <= to;
  });
  const of = (...kinds: FinanceLineKind[]) => (l: FinanceLine) => kinds.includes(l.kind);
  return {
    currency: getOperatorState().currency || "BDT",
    unsettled,
    clearsBy,
    available,
    nextPayout: projected > 0 ? { date: nextDate, amount: projected } : null,
    destination: describeDestination(peekPayoutDestination()),
    period: {
      from,
      to,
      moneyIn: sum(inRange, of("sale", "deposit")),
      fees: -sum(inRange, of("platform_fee", "processing_fee")),
      refunds: -sum(inRange, of("refund")),
      paidOut: -sum(inRange, of("payout", "withdrawal")),
    },
  };
}

// ── reads ──────────────────────────────────────────────────────────────────

export async function getFinanceSummary(locationId: ID, from?: ISODate, to?: ISODate): Promise<ApiResult<FinanceSummary>> {
  await delay();
  return ok(summaryOf(allLines(locationId), from ?? addDays(DEMO_TODAY, -29), to ?? DEMO_TODAY));
}

const FILTER_KINDS: Record<Exclude<FinanceFilter, "all">, FinanceLineKind[]> = {
  sales: ["sale"],
  fees: ["platform_fee", "processing_fee"],
  refunds: ["refund"],
  payouts: ["payout", "withdrawal"],
  deposits: ["deposit"],
};

export async function listFinanceActivity(locationId: ID, q: FinanceActivityQuery = {}): Promise<ApiResult<FinanceActivity>> {
  await delay();
  const { from, to, filter = "all", page = 1, pageSize = 10 } = q;
  const needle = q.search?.trim().toLowerCase() ?? "";
  const nameOf = new Map(peekOrders().map((o) => [o.id, o.customerName?.toLowerCase() ?? ""]));
  const matches = (l: FinanceLine) => {
    if (filter !== "all" && !FILTER_KINDS[filter].includes(l.kind)) return false;
    const d = localDay(l.at);
    if ((from && d < from) || (to && d > to)) return false;
    if (!needle) return true;
    return (
      (l.orderReference?.toLowerCase().includes(needle) ?? false) ||
      (l.reference?.toLowerCase().includes(needle) ?? false) ||
      (l.orderId ? (nameOf.get(l.orderId) ?? "").includes(needle) : false)
    );
  };
  const byDay = new Map<ISODate, FinanceLine[]>();
  for (const l of allLines(locationId).filter(matches)) {
    const d = localDay(l.at);
    byDay.set(d, [...(byDay.get(d) ?? []), l]);
  }
  const days: FinanceDay[] = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, lines]) => {
      const moneyIn = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
      const moneyOut = -lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
      return {
        date,
        lines,
        moneyIn,
        moneyOut,
        net: moneyIn - moneyOut,
        status: lines.some((l) => l.status === "pending" || l.status === "processing") ? "pending" : "settled",
      };
    });
  const size = Math.max(1, pageSize);
  const at = Math.max(1, page);
  return ok({ days: days.slice((at - 1) * size, at * size), total: days.length });
}

/** Every line in a range, for the CSV export. */
export function peekFinanceLines(locationId: ID, from?: ISODate, to?: ISODate): FinanceLine[] {
  return allLines(locationId).filter((l) => {
    const d = localDay(l.at);
    return (!from || d >= from) && (!to || d <= to);
  });
}

// ── writes ─────────────────────────────────────────────────────────────────

/** Session lines are stamped on the demo's clock, a second apart so they keep
 *  their order — never the real one (see `stampOf`). */
const sessionStamp = (locationId: ID): ISODateTime =>
  new Date(demoNow().getTime() + sessionResource.peek().filter((l) => l.locationId === locationId).length * 1000).toISOString();

const refuse = <T,>(message: string): ApiResult<T> => fail(validationError({ amount: message }, message));

export async function withdraw(locationId: ID, amount: Minor, who: string): Promise<ApiResult<FinanceLine>> {
  await delay();
  const amt = Math.round(amount);
  if (!Number.isFinite(amt) || amt <= 0) return refuse(`Enter an amount above ${formatMoney(0)}.`);
  const bank = describeDestination(peekPayoutDestination());
  if (!bank) return refuse("Add a payout bank before you withdraw.");
  const available = sum(allLines(locationId), (l) => l.status !== "pending");
  if (available <= 0) return refuse(`There is nothing to withdraw yet. Your balance is ${formatMoney(available)}.`);
  if (amt > available) return refuse(`You can withdraw up to ${formatMoney(available)}. That is all that is in your balance.`);
  const n = sessionResource.peek().filter((l) => l.locationId === locationId && l.kind === "withdrawal").length + 1;
  const line = sessionResource.insert({
    locationId,
    kind: "withdrawal",
    amount: -amt,
    status: "processing",
    at: sessionStamp(locationId),
    reference: `WD-${tagOf(locationId)}-${String(n).padStart(3, "0")}`,
    destination: bank,
    by: who,
  });
  return ok(stripLocation(line));
}

export async function deposit(locationId: ID, amount: Minor, method: DepositMethod, who: string): Promise<ApiResult<FinanceLine>> {
  await delay();
  const amt = Math.round(amount);
  if (!Number.isFinite(amt) || amt <= 0) return refuse(`Enter an amount above ${formatMoney(0)}.`);
  const n = sessionResource.peek().filter((l) => l.locationId === locationId && l.kind === "deposit").length + 1;
  const line = sessionResource.insert({
    locationId,
    kind: "deposit",
    amount: amt,
    status: "received",
    at: sessionStamp(locationId),
    method,
    reference: `DP-${tagOf(locationId)}-${String(n).padStart(3, "0")}`,
    by: who,
  });
  return ok(stripLocation(line));
}

// ── small reads for the Finances boxes ─────────────────────────────────────

export interface FinanceExtras {
  /** What is still clearing, by the day each part becomes available. Sums to `unsettled`. */
  clearing: { date: ISODate; amount: Minor }[];
  /** The newest automatic payout, or null when none has gone out yet. */
  lastPayout: { date: ISODate; amount: Minor } | null;
}

export async function getFinanceExtras(locationId: ID): Promise<ApiResult<FinanceExtras>> {
  await delay();
  const lines = allLines(locationId);
  const byDay = new Map<ISODate, Minor>();
  for (const l of lines.filter((x) => x.status === "pending")) {
    const d = clearDayOf(l);
    byDay.set(d, (byDay.get(d) ?? 0) + l.amount);
  }
  const clearing = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => ({ date, amount }));
  const last = lines.find((l) => l.kind === "payout"); // newest first
  return ok({ clearing, lastPayout: last ? { date: localDay(last.at), amount: -last.amount } : null });
}
