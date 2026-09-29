import { delay, ok } from "./client";
import { peekOrders } from "./orders";
import { peekPaymentSettings } from "./paymentSettings";
import type {
  ApiResult,
  Channel,
  ID,
  ISODate,
  ISODateTime,
  ListParams,
  ListResponse,
  Minor,
  Order,
  PaymentMethod,
  PaymentSettings,
  PaymentStatus,
} from "./types";

/* ── transactions.v1 — every movement of money, as one ledger ──────────────────

   An order says what was sold. A transaction says what happened to the money:
   a charge, a refund, or a balance cleared without money moving. The two are
   different questions and a manager asks both — "what did we sell today" is
   Orders, "does the drawer and the bank agree with the till" is this.

   It is DERIVED, not stored. Every row is read off an order's payments and
   write-offs, so a ledger and an order cannot disagree. A backend serves it as
   one endpoint; this module is the shape of that endpoint.

   Signs are the money's direction from the venue's side: a payment is
   positive, a refund negative. A write-off moves no money, so it carries the
   amount cleared but is never summed into collected or net. */

export type TransactionKind = "payment" | "refund" | "write_off";

export interface Transaction {
  id: ID;
  kind: TransactionKind;
  orderId: ID;
  orderReference: string;
  locationId: ID;
  channel: Channel;
  counterId: ID | null;
  staffId: ID | null;
  customerName: string | null;
  /** Null on a write-off: nothing was tendered. */
  method: PaymentMethod | null;
  /** Signed minor units — see above. */
  amount: Minor;
  status: PaymentStatus;
  /** The provider's own id (a bKash TrxID), when there is one. */
  reference?: string;
  tendered?: Minor;
  change?: Minor;
  /** Why, on a write-off. */
  note?: string;
  at: ISODateTime;
}

export interface TransactionFilters {
  locationId?: string;
  kind?: TransactionKind;
  method?: PaymentMethod;
  status?: PaymentStatus;
  channel?: Channel;
  /** Half-open [from, to), ISO. */
  from?: string;
  to?: string;
}

function fromOrder(o: Order): Transaction[] {
  const base = {
    orderId: o.id,
    orderReference: o.reference,
    locationId: o.locationId,
    channel: o.channel,
    counterId: o.counterId,
    staffId: o.staffId,
    customerName: o.customerName,
  };
  const out: Transaction[] = o.payments.map((p) => ({
    ...base,
    id: p.id,
    kind: p.amount < 0 ? "refund" : "payment",
    method: p.method,
    amount: p.amount,
    status: p.status,
    reference: p.reference,
    tendered: p.tendered,
    change: p.change,
    at: p.createdAt,
  }));
  /* A full refund taken through `refundOrder` flips the status without
     writing the reversal (its own comment says the real endpoint would). The
     money still went back, so the ledger says so — otherwise a refunded order
     reads as money kept. */
  const paid = o.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const reversed = o.payments.some((p) => p.amount < 0);
  if (o.status === "refunded" && !reversed && paid > 0) {
    out.push({
      ...base,
      id: `${o.reference}-R`,
      kind: "refund",
      method: o.payments[0]?.method ?? "cash",
      amount: -paid,
      status: "confirmed",
      at: o.updatedAt,
    });
  }
  (o.writeOffs ?? []).forEach((w, i) =>
    out.push({
      ...base,
      id: `${o.reference}-W${i}`,
      kind: "write_off",
      method: null,
      amount: w.amount,
      status: "confirmed",
      note: w.reason,
      at: w.at,
    }),
  );
  return out;
}

function matches(t: Transaction, f: TransactionFilters, q: string): boolean {
  if (f.locationId && t.locationId !== f.locationId) return false;
  if (f.kind && t.kind !== f.kind) return false;
  if (f.method && t.method !== f.method) return false;
  if (f.status && t.status !== f.status) return false;
  if (f.channel && t.channel !== f.channel) return false;
  if (f.from && t.at < f.from) return false;
  if (f.to && t.at >= f.to) return false;
  if (q) {
    const hay = [t.orderReference, t.customerName ?? "", t.reference ?? "", t.id].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

const SORTS: Record<string, (a: Transaction, b: Transaction) => number> = {
  at: (a, b) => a.at.localeCompare(b.at),
  amount: (a, b) => a.amount - b.amount,
};

/** Every transaction the filters match — the whole set, for totals and export. */
export function peekTransactions(filters: TransactionFilters = {}, search = ""): Transaction[] {
  const q = search.trim().toLowerCase();
  return peekOrders()
    .flatMap(fromOrder)
    .filter((t) => matches(t, filters, q));
}

export async function listTransactions(
  params: ListParams<TransactionFilters> = {},
): Promise<ApiResult<ListResponse<Transaction>>> {
  await delay();
  const rows = peekTransactions(params.filters, params.search);
  const cmp = SORTS[params.sort ?? "at"] ?? SORTS.at;
  rows.sort((a, b) => (params.order === "asc" ? cmp(a, b) : cmp(b, a)));
  const pageSize = params.pageSize ?? 25;
  const page = params.page ?? 1;
  return ok({
    data: structuredClone(rows.slice((page - 1) * pageSize, page * pageSize)),
    page: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) },
  });
}

export interface TransactionSummary {
  /** Confirmed payments in. */
  collected: Minor;
  /** Confirmed refunds out, as a positive figure. */
  refunded: Minor;
  net: Minor;
  /** Net taken in cash — counted at the drawer, never paid out. */
  cash: Minor;
  /** Net taken through a provider — what payouts are made of. */
  digital: Minor;
  writtenOff: Minor;
  count: number;
}

/** Methods whose money arrives by payout rather than in a drawer. Vouchers and
 *  pass credit are not money at all and appear in neither. */
export const PAYOUT_METHODS: PaymentMethod[] = ["bkash", "bangla_qr", "card_terminal"];

export async function getTransactionSummary(filters: TransactionFilters = {}, search = ""): Promise<ApiResult<TransactionSummary>> {
  await delay();
  const rows = peekTransactions(filters, search);
  const money = rows.filter((t) => t.kind !== "write_off" && t.status === "confirmed");
  const sum = (xs: Transaction[]) => xs.reduce((s, t) => s + t.amount, 0);
  const collected = sum(money.filter((t) => t.amount > 0));
  const refunded = -sum(money.filter((t) => t.amount < 0));
  return ok({
    collected,
    refunded,
    net: collected - refunded,
    cash: sum(money.filter((t) => t.method === "cash")),
    digital: sum(money.filter((t) => t.method !== null && PAYOUT_METHODS.includes(t.method))),
    writtenOff: sum(rows.filter((t) => t.kind === "write_off")),
    count: rows.length,
  });
}

/* ── payouts ────────────────────────────────────────────────────────────────
   What the providers send to the bank, on the schedule set in Settings →
   Payments. Each confirmed provider transaction lands in the first payout day
   AFTER the day it happened; a refund comes out of the same payout. Cash is
   not in any payout — it is in a drawer, and banking it is the operator's.

   Fees are not modelled: the contract carries no provider fee, and a payout
   figure with an invented fee in it would be a number nobody could reconcile. */

export type PayoutStatus = "paid" | "in_transit" | "scheduled";

export interface Payout {
  id: ID;
  arrivesOn: ISODate;
  /** The first and last day of takings it carries. */
  from: ISODate;
  to: ISODate;
  amount: Minor;
  count: number;
  status: PayoutStatus;
  byMethod: { method: PaymentMethod; amount: Minor }[];
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The first payout day strictly after `day` on this schedule. */
export function payoutDayAfter(day: ISODate, schedule: PaymentSettings["payoutSchedule"], payoutDay: number): ISODate {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + 1);
  if (schedule === "weekly") while (d.getDay() !== payoutDay) d.setDate(d.getDate() + 1);
  if (schedule === "monthly") while (d.getDate() !== payoutDay) d.setDate(d.getDate() + 1);
  return isoDay(d);
}

export async function listPayouts(locationId: string | undefined, today: ISODate): Promise<ApiResult<Payout[]>> {
  await delay();
  const { payoutSchedule, payoutDay } = peekPaymentSettings();
  const rows = peekTransactions({ locationId }).filter(
    (t) => t.kind !== "write_off" && t.status === "confirmed" && t.method !== null && PAYOUT_METHODS.includes(t.method),
  );
  const groups = new Map<ISODate, Transaction[]>();
  for (const t of rows) {
    const key = payoutDayAfter(t.at.slice(0, 10), payoutSchedule, payoutDay);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: Payout[] = [...groups.entries()].map(([arrivesOn, ts]) => {
    const days = ts.map((t) => t.at.slice(0, 10)).sort();
    const byMethod = PAYOUT_METHODS.map((method) => ({
      method,
      amount: ts.filter((t) => t.method === method).reduce((s, t) => s + t.amount, 0),
    })).filter((m) => m.amount !== 0);
    return {
      id: `po_${arrivesOn}`,
      arrivesOn,
      from: days[0],
      to: days[days.length - 1],
      amount: ts.reduce((s, t) => s + t.amount, 0),
      count: ts.length,
      /* Sent the evening before it lands — so the one arriving today is on
         its way rather than paid, which is the only honest thing to say
         before the bank has confirmed it. */
      status: arrivesOn < today ? "paid" : arrivesOn === today ? "in_transit" : "scheduled",
      byMethod,
    };
  });
  out.sort((a, b) => b.arrivesOn.localeCompare(a.arrivesOn));
  return ok(out);
}
