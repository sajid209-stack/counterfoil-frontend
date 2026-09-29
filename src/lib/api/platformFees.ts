import { delay, fail, notFoundError, ok, validationError } from "./client";
import { peekOrders } from "./orders";
import { peekPaymentSettings, payoutDayAfterSchedule } from "./paymentSettings";
import { peekLocations } from "./locations";
import type { ApiResult, ID, ISODate, ISODateTime, Minor, Order, PaymentMethod } from "./types";

/* ── platformfees.v1 — who holds the money, what Counterfoil charges, who owes whom ──

   The business model, as the backend has it (continuum/transactions,
   platform_fees.py) — and this module is the mock of those endpoints, shaped so
   the swap is mechanical:

   A location takes online payments through one of two accounts per gateway:

     • COUNTERFOIL'S ACCOUNT (collected_by "platform", the default). Counterfoil
       receives the money, keeps a 5% platform fee and a 1.5% gateway fee, and
       OWES THE TENANT the rest — settled by a payout.
     • THE TENANT'S OWN ACCOUNT (collected_by "operator"). The money goes
       straight to the tenant, who OWES COUNTERFOIL the 5% — settled by a
       collection.

   Cash and counter card / e-wallet / QR payments are always "operator": the
   money is in the tenant's drawer or merchant account, and the 5% is owed on
   them just the same.

   Rules the screens depend on:
   1. Fees are fixed per transaction, at the moment the money moves. A later
      switch or rate change never rewrites a past entry.
   2. A mid-period switch is normal: a location then has entries of both kinds
      and BOTH balances are non-zero.
   3. The two balances are never netted.
   4. Fees are charged on the amount EXCLUDING VAT — VAT is the tenant's to remit.
   5. Refunds do not return fees. A refund of Counterfoil-held money reduces what
      Counterfoil owes; a refund of tenant-held money changes nothing between
      the two parties.

   The rates are the backend's (basis points), returned by `getPlatformFeeRates`;
   no screen may hard-code them. Money is integer minor units throughout. */

export type CollectedBy = "platform" | "operator";
/** How the settings screen says it: Counterfoil's account, or your own. */
export type Collects = "counterfoil" | "own";
/** The gateways a tenant can bring their own account for. Stripe is not one of
 *  them — the backend refuses own-key Stripe — so it is not offered at all. */
export type GatewayProvider = "bkash" | "sslcommerz";
export const GATEWAY_PROVIDERS: GatewayProvider[] = ["bkash", "sslcommerz"];

export interface PlatformFeeRates {
  platformFeeBp: number;
  platformGatewayFeeBp: number;
}
const RATES: PlatformFeeRates = { platformFeeBp: 500, platformGatewayFeeBp: 150 };

export async function getPlatformFeeRates(): Promise<ApiResult<PlatformFeeRates>> {
  await delay();
  return ok({ ...RATES });
}
export const peekPlatformFeeRates = (): PlatformFeeRates => RATES;

/** "5%", "1.5%" — from basis points, never from a literal. */
export const percentLabel = (bp: number): string => `${(bp / 100).toLocaleString("en", { maximumFractionDigits: 2 })}%`;

// ── the account switch ─────────────────────────────────────────────────────

export interface PaymentCollectorAccount {
  id: ID;
  /** null = the tenant's default, which every location uses unless it has its own. */
  locationId: ID | null;
  provider: GatewayProvider;
  collects: Collects;
  /** Keys saved for "own". Secrets are write-only: the screen only ever learns
   *  that they exist, and when. */
  hasOwnCredentials: boolean;
  credentialsSavedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CollectorChange {
  id: ID;
  locationId: ID;
  provider: GatewayProvider;
  at: ISODateTime;
  who: string;
  from: Collects;
  to: Collects;
}

const stamp = "2026-06-01T09:00:00.000Z";
let accounts: PaymentCollectorAccount[] = [
  { id: "pca_default_bkash", locationId: null, provider: "bkash", collects: "counterfoil", hasOwnCredentials: false, updatedAt: stamp },
  { id: "pca_default_sslcommerz", locationId: null, provider: "sslcommerz", collects: "counterfoil", hasOwnCredentials: false, updatedAt: stamp },
  /* The museum brought its own bKash merchant account mid-month — so its July
     has entries of both kinds, which is the case the screens must explain. */
  {
    id: "pca_loc_museum_bkash",
    locationId: "loc_museum",
    provider: "bkash",
    collects: "own",
    hasOwnCredentials: true,
    credentialsSavedAt: "2026-07-15T04:10:00.000Z",
    updatedAt: "2026-07-15T04:12:00.000Z",
  },
  {
    id: "pca_loc_museum_sslcommerz",
    locationId: "loc_museum",
    provider: "sslcommerz",
    collects: "counterfoil",
    hasOwnCredentials: false,
    updatedAt: "2026-07-15T04:12:00.000Z",
  },
];
const changes: CollectorChange[] = [
  { id: "chg_1", locationId: "loc_museum", provider: "bkash", at: "2026-07-15T04:12:00.000Z", who: "Lamia Ahmed", from: "counterfoil", to: "own" },
];

export async function listCollectorAccounts(): Promise<ApiResult<PaymentCollectorAccount[]>> {
  await delay();
  return ok(structuredClone(accounts));
}

/** What a location uses now for a gateway: its own record, else the default. */
export function effectiveCollects(locationId: ID, provider: GatewayProvider, list = accounts): Collects {
  const own = list.find((a) => a.locationId === locationId && a.provider === provider);
  const def = list.find((a) => a.locationId === null && a.provider === provider);
  return (own ?? def)?.collects ?? "counterfoil";
}

/** What a location used at a past instant — replayed from the history, so a
 *  switch never reaches back and rewrites a payment taken before it. */
export function collectsAt(locationId: ID, provider: GatewayProvider, at: ISODateTime): Collects {
  const hist = changes.filter((c) => c.locationId === locationId && c.provider === provider).sort((a, b) => a.at.localeCompare(b.at));
  if (!hist.length) return effectiveCollects(locationId, provider);
  const before = hist.filter((c) => c.at <= at);
  return before.length ? before[before.length - 1].to : hist[0].from;
}

function recordChanges(before: PaymentCollectorAccount[], who: string) {
  const at = new Date().toISOString();
  for (const l of peekLocations()) {
    for (const p of GATEWAY_PROVIDERS) {
      const from = effectiveCollects(l.id, p, before);
      const to = effectiveCollects(l.id, p);
      if (from !== to) changes.push({ id: `chg_${changes.length + 1}`, locationId: l.id, provider: p, at, who, from, to });
    }
  }
}

/** Switch a default or a location between Counterfoil's account and its own.
 *  "own" needs keys first — the screen asks for them before calling this. */
export async function switchCollector(
  locationId: ID | null,
  provider: GatewayProvider,
  collects: Collects,
  who = "You",
): Promise<ApiResult<PaymentCollectorAccount>> {
  await delay();
  const before = structuredClone(accounts);
  let row = accounts.find((a) => a.locationId === locationId && a.provider === provider);
  if (collects === "own" && !row?.hasOwnCredentials) {
    return fail(validationError({ credentials: "Save this account's keys first." }, "Save this account's keys first."));
  }
  const now = new Date().toISOString();
  if (!row) {
    row = { id: `pca_${locationId ?? "default"}_${provider}`, locationId, provider, collects, hasOwnCredentials: false, updatedAt: now };
    accounts.push(row);
  } else {
    row.collects = collects;
    row.updatedAt = now;
  }
  recordChanges(before, who);
  return ok(structuredClone(row));
}

/** A location follows the default ("Same as default") or keeps its own
 *  records. Going back to the default drops its records — keys included. */
export async function setLocationOverride(locationId: ID, override: boolean, who = "You"): Promise<ApiResult<PaymentCollectorAccount[]>> {
  await delay();
  const before = structuredClone(accounts);
  if (!override) {
    accounts = accounts.filter((a) => a.locationId !== locationId);
  } else if (!accounts.some((a) => a.locationId === locationId)) {
    const now = new Date().toISOString();
    for (const p of GATEWAY_PROVIDERS) {
      accounts.push({ id: `pca_${locationId}_${p}`, locationId, provider: p, collects: effectiveCollects(locationId, p, before), hasOwnCredentials: false, updatedAt: now });
    }
  }
  recordChanges(before, who);
  return ok(structuredClone(accounts));
}

export const CREDENTIAL_FIELDS: Record<GatewayProvider, string[]> = {
  bkash: ["app_key", "app_secret", "username", "password"],
  sslcommerz: ["store_id", "store_passwd"],
};

/** Save a tenant's gateway keys. Write-only: nothing here is ever read back. */
export async function setGatewayCredentials(
  locationId: ID | null,
  provider: GatewayProvider,
  fields: Record<string, string>,
): Promise<ApiResult<PaymentCollectorAccount>> {
  await delay();
  const errors: Record<string, string> = {};
  for (const f of CREDENTIAL_FIELDS[provider]) if (!fields[f]?.trim()) errors[f] = "Required.";
  if (Object.keys(errors).length) return fail(validationError(errors));
  const now = new Date().toISOString();
  let row = accounts.find((a) => a.locationId === locationId && a.provider === provider);
  if (!row) {
    row = { id: `pca_${locationId ?? "default"}_${provider}`, locationId, provider, collects: "counterfoil", hasOwnCredentials: true, updatedAt: now };
    accounts.push(row);
  }
  row.hasOwnCredentials = true;
  row.credentialsSavedAt = now;
  return ok(structuredClone(row));
}

/** Remove the keys. An account using them goes back to Counterfoil's first,
 *  because a gateway with no keys cannot take a payment. */
export async function clearGatewayCredentials(locationId: ID | null, provider: GatewayProvider, who = "You"): Promise<ApiResult<PaymentCollectorAccount>> {
  await delay();
  const row = accounts.find((a) => a.locationId === locationId && a.provider === provider);
  if (!row) return fail(notFoundError("Payment account"));
  const before = structuredClone(accounts);
  row.hasOwnCredentials = false;
  row.credentialsSavedAt = undefined;
  if (row.collects === "own") row.collects = "counterfoil";
  row.updatedAt = new Date().toISOString();
  recordChanges(before, who);
  return ok(structuredClone(row));
}

export async function listCollectorChanges(locationId?: ID): Promise<ApiResult<CollectorChange[]>> {
  await delay();
  return ok(structuredClone(changes.filter((c) => !locationId || c.locationId === locationId)).sort((a, b) => b.at.localeCompare(a.at)));
}

// ── the fee entries ────────────────────────────────────────────────────────

export type FeeEntryKind = "payment" | "refund";
export type SettlementStatus =
  | "unsettled" // accrued, not yet in a run
  | "scheduled"
  | "instructed"
  | "paid"
  | "open"
  | "past_due"
  | "none"; // moves nothing between the two parties

export interface PlatformFeeEntry {
  id: ID;
  orderId: ID;
  orderNumber: string;
  locationId: ID;
  kind: FeeEntryKind;
  paymentMethod: PaymentMethod;
  /** The gateway, when the money went through one online. */
  provider: GatewayProvider | null;
  collectedBy: CollectedBy;
  amount: Minor;
  vat: Minor;
  feeBase: Minor;
  platformFee: Minor;
  gatewayFee: Minor;
  owedToOperator: Minor;
  owedByOperator: Minor;
  createdAt: ISODateTime;
  /** The payout or collection that settles it; null when nothing is owed. */
  settlementId: ID | null;
  settlementStatus: SettlementStatus;
}

const providerFor = (m: PaymentMethod): GatewayProvider => (m === "bkash" ? "bkash" : "sslcommerz");
const MONEY: PaymentMethod[] = ["cash", "card_terminal", "bkash", "bangla_qr"];

/** The rule, per payment — what fees_for_payment() does on the backend. */
function entriesFor(o: Order): Omit<PlatformFeeEntry, "settlementId" | "settlementStatus">[] {
  const out: Omit<PlatformFeeEntry, "settlementId" | "settlementStatus">[] = [];
  const pays = o.payments.filter((p) => p.status === "confirmed" && MONEY.includes(p.method));
  const vatShare = (amount: number) => (o.total > 0 ? Math.round((Math.abs(amount) * o.taxTotal) / o.total) : 0);
  const holderOf = (method: PaymentMethod, at: ISODateTime): { by: CollectedBy; provider: GatewayProvider | null } => {
    // At the counter the money is the tenant's whatever the method.
    if (o.channel !== "online") return { by: "operator", provider: null };
    const provider = providerFor(method);
    return { by: collectsAt(o.locationId, provider, at) === "counterfoil" ? "platform" : "operator", provider };
  };
  const firstPay = pays.find((p) => p.amount > 0);
  const firstHolder = firstPay ? holderOf(firstPay.method, firstPay.createdAt) : null;

  for (const p of pays) {
    if (p.amount > 0) {
      const h = holderOf(p.method, p.createdAt);
      const vat = vatShare(p.amount);
      const feeBase = p.amount - vat;
      const platformFee = Math.round((feeBase * RATES.platformFeeBp) / 10_000);
      const gatewayFee = h.by === "platform" ? Math.round((feeBase * RATES.platformGatewayFeeBp) / 10_000) : 0;
      out.push({
        id: `fe_${p.id}`,
        orderId: o.id,
        orderNumber: o.reference,
        locationId: o.locationId,
        kind: "payment",
        paymentMethod: p.method,
        provider: h.provider,
        collectedBy: h.by,
        amount: p.amount,
        vat,
        feeBase,
        platformFee,
        gatewayFee,
        owedToOperator: h.by === "platform" ? p.amount - platformFee - gatewayFee : 0,
        owedByOperator: h.by === "operator" ? platformFee : 0,
        createdAt: p.createdAt,
      });
    } else if (p.amount < 0) {
      out.push(refundEntry(o, p.id, p.method, -p.amount, p.createdAt, firstHolder, vatShare(p.amount)));
    }
  }
  /* A full refund taken through `refundOrder` flips the status without writing
     the reversal. The money still went back, so the entry is written here. */
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  if (o.status === "refunded" && !pays.some((p) => p.amount < 0) && paid > 0 && firstPay) {
    out.push(refundEntry(o, `${o.reference}-R`, firstPay.method, paid, o.updatedAt, firstHolder, vatShare(paid)));
  }
  return out;
}

function refundEntry(
  o: Order,
  id: string,
  method: PaymentMethod,
  amount: number,
  at: ISODateTime,
  holder: { by: CollectedBy; provider: GatewayProvider | null } | null,
  vat: number,
): Omit<PlatformFeeEntry, "settlementId" | "settlementStatus"> {
  const by = holder?.by ?? "operator";
  return {
    id: `fe_${id}`,
    orderId: o.id,
    orderNumber: o.reference,
    locationId: o.locationId,
    kind: "refund",
    paymentMethod: method,
    provider: holder?.provider ?? null,
    collectedBy: by,
    amount: -amount,
    vat: -vat,
    feeBase: -(amount - vat),
    // Refunds do not return fees.
    platformFee: 0,
    gatewayFee: 0,
    owedToOperator: by === "platform" ? -amount : 0,
    owedByOperator: 0,
    createdAt: at,
  };
}

// ── settlement ─────────────────────────────────────────────────────────────

/* The terms. Payouts follow the schedule the tenant set in Settings →
   Payments; collections run weekly on Sunday with seven days to pay. Both are
   the backend's to decide (the guide's open question 1) — the screens read
   them from here and say them in words, so changing them is one edit. */
export interface SettlementTerms {
  payoutSchedule: "daily" | "weekly" | "monthly";
  payoutDay: number;
  collectionSchedule: "weekly";
  collectionDay: number;
  collectionDueDays: number;
}
export function peekSettlementTerms(): SettlementTerms {
  const s = peekPaymentSettings();
  return { payoutSchedule: s.payoutSchedule, payoutDay: s.payoutDay, collectionSchedule: "weekly", collectionDay: 0, collectionDueDays: 7 };
}

export type PayoutStatus = "scheduled" | "instructed" | "paid" | "failed" | "cancelled";
export type CollectionStatus = "accruing" | "open" | "paid" | "past_due" | "void";

export interface Payout {
  id: ID;
  number: string;
  locationId: ID;
  /** The day it arrives, or is expected to. */
  date: ISODate;
  periodFrom: ISODate;
  periodTo: ISODate;
  count: number;
  gross: Minor;
  feesDeducted: Minor;
  refundsDeducted: Minor;
  amount: Minor;
  status: PayoutStatus;
  paidOn: ISODate | null;
  /** The bank's reference, once finance has sent it. */
  reference: string | null;
  destination: string | null;
}

export interface FeeCollection {
  id: ID;
  number: string;
  locationId: ID;
  /** The day it is (or will be) issued. */
  issuedOn: ISODate;
  dueOn: ISODate;
  periodFrom: ISODate;
  periodTo: ISODate;
  count: number;
  feeBase: Minor;
  amount: Minor;
  status: CollectionStatus;
  paidOn: ISODate | null;
  paidWith: string | null;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (day: ISODate, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
/** The demo's today. The clock is pinned so the settlement states are stable. */
const TODAY: ISODate = "2026-07-29";
const localDay = (iso: ISODateTime) => isoDay(new Date(iso));

/** Collections paid through the console this session (Pay now). */
const paidCollections = new Map<ID, { on: ISODate; with: string }>();

// ── payout destination ─────────────────────────────────────────────────────

export interface PayoutDestination {
  kind: "bank" | "bkash";
  bankName?: string;
  branch?: string;
  accountName: string;
  /** Only ever the last four. */
  accountLast4: string;
  routingNumber?: string;
  status: "verified" | "pending_verification";
  updatedAt: ISODateTime;
}
export type PayoutDestinationInput = {
  kind: "bank" | "bkash";
  bankName?: string;
  branch?: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string;
};

let destination: PayoutDestination | null = {
  kind: "bank",
  bankName: "BRAC Bank",
  branch: "Gulshan",
  accountName: "Lalbagh Heritage Attractions Ltd",
  accountLast4: "4821",
  routingNumber: "060261726",
  status: "verified",
  updatedAt: "2026-06-01T09:00:00.000Z",
};

export const describeDestination = (d: PayoutDestination | null): string | null =>
  d ? (d.kind === "bank" ? `${d.bankName} ••${d.accountLast4}` : `bKash ••${d.accountLast4}`) : null;

export async function getPayoutDestination(): Promise<ApiResult<PayoutDestination | null>> {
  await delay();
  return ok(destination ? { ...destination } : null);
}

export async function setPayoutDestination(input: PayoutDestinationInput): Promise<ApiResult<PayoutDestination>> {
  await delay();
  const errors: Record<string, string> = {};
  const digits = input.accountNumber.replace(/[\s-]/g, "");
  if (!input.accountName.trim()) errors.accountName = "Enter the name on the account.";
  if (input.kind === "bank") {
    if (!input.bankName?.trim()) errors.bankName = "Enter the bank.";
    if (!/^\d{8,20}$/.test(digits)) errors.accountNumber = "An account number is 8 to 20 digits.";
    if (!/^\d{9}$/.test((input.routingNumber ?? "").trim())) errors.routingNumber = "A routing number is 9 digits.";
  } else if (!/^01\d{9}$/.test(digits)) {
    errors.accountNumber = "A bKash merchant number is 11 digits, starting 01.";
  }
  if (Object.keys(errors).length) return fail(validationError(errors));
  // New details are checked before any money goes to them.
  destination = {
    kind: input.kind,
    bankName: input.kind === "bank" ? input.bankName!.trim() : undefined,
    branch: input.kind === "bank" ? input.branch?.trim() || undefined : undefined,
    accountName: input.accountName.trim(),
    accountLast4: digits.slice(-4),
    routingNumber: input.kind === "bank" ? input.routingNumber!.trim() : undefined,
    status: "pending_verification",
    updatedAt: new Date().toISOString(),
  };
  return ok({ ...destination });
}

// ── the computed ledger ────────────────────────────────────────────────────

interface Ledger {
  entries: PlatformFeeEntry[];
  payouts: Payout[];
  collections: FeeCollection[];
}

/** Everything for one location, derived in one pass so an entry, the run that
 *  settles it and the balance it feeds cannot disagree. */
function build(locationId: ID): Ledger {
  const terms = peekSettlementTerms();
  const raw = peekOrders()
    .filter((o) => o.locationId === locationId)
    .flatMap(entriesFor)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const tag = locationId.replace(/^loc_/, "").slice(0, 3).toUpperCase();

  // Payouts: Counterfoil-held entries, into the first payout day after.
  const payoutGroups = new Map<ISODate, typeof raw>();
  for (const e of raw) {
    if (e.collectedBy !== "platform" || e.owedToOperator === 0) continue;
    const day = payoutDayAfterSchedule(localDay(e.createdAt), terms.payoutSchedule, terms.payoutDay);
    payoutGroups.set(day, [...(payoutGroups.get(day) ?? []), e]);
  }
  const payouts: Payout[] = [];
  const settleOf = new Map<ID, { id: ID; status: SettlementStatus }>();
  let carry: typeof raw = [];
  for (const [date, group] of [...payoutGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const es = [...carry, ...group];
    const amount = es.reduce((s, e) => s + e.owedToOperator, 0);
    /* A run where refunds outweigh takings pays nothing; its entries roll into
       the next run rather than becoming a debt of a different kind. */
    if (amount <= 0) {
      carry = es;
      continue;
    }
    carry = [];
    const status: PayoutStatus = date < TODAY ? "paid" : date === TODAY ? "instructed" : "scheduled";
    const id = `po_${locationId}_${date}`;
    const days = es.map((e) => localDay(e.createdAt)).sort();
    const pays = es.filter((e) => e.kind === "payment");
    payouts.push({
      id,
      number: `PO-${tag}-${date.slice(5).replace("-", "")}`,
      locationId,
      date,
      periodFrom: days[0],
      periodTo: days[days.length - 1],
      count: es.length,
      gross: pays.reduce((s, e) => s + e.amount, 0),
      feesDeducted: pays.reduce((s, e) => s + e.platformFee + e.gatewayFee, 0),
      refundsDeducted: -es.filter((e) => e.kind === "refund").reduce((s, e) => s + e.owedToOperator, 0),
      amount,
      status,
      paidOn: status === "paid" ? date : null,
      reference: status === "paid" || status === "instructed" ? `BEFTN${date.replace(/-/g, "")}${tag}` : null,
      destination: describeDestination(destination),
    });
    for (const e of es) settleOf.set(e.id, { id, status });
  }
  for (const e of carry) settleOf.set(e.id, { id: "", status: "unsettled" });

  // Collections: tenant-held entries owing the fee, weekly.
  const collGroups = new Map<ISODate, typeof raw>();
  for (const e of raw) {
    if (e.owedByOperator === 0) continue;
    const day = payoutDayAfterSchedule(localDay(e.createdAt), "weekly", terms.collectionDay);
    collGroups.set(day, [...(collGroups.get(day) ?? []), e]);
  }
  const collections: FeeCollection[] = [];
  for (const [issuedOn, es] of [...collGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const id = `fc_${locationId}_${issuedOn}`;
    const dueOn = addDays(issuedOn, terms.collectionDueDays);
    const paidNow = paidCollections.get(id);
    /* Seeded history: a run older than its terms was paid three days after
       issue, by bKash. The newest issued run is still open. */
    const seededPaid = issuedOn <= addDays(TODAY, -terms.collectionDueDays);
    const status: CollectionStatus = issuedOn > TODAY
      ? "accruing"
      : paidNow || seededPaid
        ? "paid"
        : dueOn < TODAY
          ? "past_due"
          : "open";
    const days = es.map((e) => localDay(e.createdAt)).sort();
    collections.push({
      id,
      number: `FC-${tag}-${issuedOn.slice(5).replace("-", "")}`,
      locationId,
      issuedOn,
      dueOn,
      periodFrom: days[0],
      periodTo: days[days.length - 1],
      count: es.length,
      feeBase: es.reduce((s, e) => s + e.feeBase, 0),
      amount: es.reduce((s, e) => s + e.owedByOperator, 0),
      status,
      paidOn: status === "paid" ? paidNow?.on ?? addDays(issuedOn, 3) : null,
      paidWith: status === "paid" ? paidNow?.with ?? "bKash" : null,
    });
    const s: SettlementStatus = status === "accruing" ? "unsettled" : status;
    for (const e of es) settleOf.set(e.id, { id, status: s });
  }

  const entries: PlatformFeeEntry[] = raw.map((e) => {
    const s = settleOf.get(e.id);
    return { ...e, settlementId: s?.id || null, settlementStatus: s?.status ?? "none" };
  });
  return { entries, payouts: payouts.reverse(), collections: collections.reverse() };
}

// ── reads ──────────────────────────────────────────────────────────────────

export interface FeeTotals {
  paymentCount: number;
  collectedByPlatform: Minor;
  collectedByOperator: Minor;
  vat: Minor;
  feeBase: Minor;
  platformFee: Minor;
  gatewayFee: Minor;
  refundedFromPlatform: Minor;
  owedToOperator: Minor;
  owedByOperator: Minor;
}

export interface FeeBalance {
  /** We will pay you. */
  earnedToDate: Minor;
  paidOutToDate: Minor;
  outstandingToOperator: Minor;
  nextPayout: { date: ISODate; amount: Minor; status: PayoutStatus } | null;
  /** You owe us. */
  chargedToDate: Minor;
  collectedToDate: Minor;
  outstandingByOperator: Minor;
  nextCollection: { date: ISODate; amount: Minor; status: CollectionStatus } | null;
}

export interface PlatformFeeReport {
  currency: string;
  rates: PlatformFeeRates;
  balance: FeeBalance;
  period: FeeTotals;
  /** A switch inside the period — why both balances moved. */
  switches: CollectorChange[];
}

function totals(es: PlatformFeeEntry[]): FeeTotals {
  const sum = (f: (e: PlatformFeeEntry) => number) => es.reduce((s, e) => s + f(e), 0);
  const pays = es.filter((e) => e.kind === "payment");
  return {
    paymentCount: pays.length,
    collectedByPlatform: pays.filter((e) => e.collectedBy === "platform").reduce((s, e) => s + e.amount, 0),
    collectedByOperator: pays.filter((e) => e.collectedBy === "operator").reduce((s, e) => s + e.amount, 0),
    vat: sum((e) => e.vat),
    feeBase: sum((e) => e.feeBase),
    platformFee: sum((e) => e.platformFee),
    gatewayFee: sum((e) => e.gatewayFee),
    refundedFromPlatform: -es.filter((e) => e.kind === "refund" && e.collectedBy === "platform").reduce((s, e) => s + e.amount, 0),
    owedToOperator: sum((e) => e.owedToOperator),
    owedByOperator: sum((e) => e.owedByOperator),
  };
}

const inRange = (e: { createdAt: string }, from?: ISODate, to?: ISODate) => {
  const d = localDay(e.createdAt);
  return (!from || d >= from) && (!to || d <= to);
};

/** GET /transactions/v2/reports/platform-fees — balances are all-time; the
 *  period figures follow the dates. */
export async function getPlatformFeeReport(locationId: ID, from?: ISODate, to?: ISODate): Promise<ApiResult<PlatformFeeReport>> {
  await delay();
  const { entries, payouts, collections } = build(locationId);
  const all = totals(entries);
  const paidOut = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const collected = collections.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount, 0);
  const nextP = [...payouts].reverse().find((p) => p.status !== "paid");
  const nextC = [...collections].reverse().find((c) => c.status !== "paid" && c.status !== "void");
  return ok({
    currency: "BDT",
    rates: { ...RATES },
    balance: {
      earnedToDate: all.owedToOperator,
      paidOutToDate: paidOut,
      outstandingToOperator: all.owedToOperator - paidOut,
      nextPayout: nextP ? { date: nextP.date, amount: nextP.amount, status: nextP.status } : null,
      chargedToDate: all.owedByOperator,
      collectedToDate: collected,
      outstandingByOperator: all.owedByOperator - collected,
      nextCollection: nextC ? { date: nextC.status === "accruing" ? nextC.issuedOn : nextC.dueOn, amount: nextC.amount, status: nextC.status } : null,
    },
    period: totals(entries.filter((e) => inRange(e, from, to))),
    switches: changes.filter((c) => c.locationId === locationId && (!from || localDay(c.at) >= from) && (!to || localDay(c.at) <= to)),
  });
}

export interface FeeEntryFilters {
  from?: ISODate;
  to?: ISODate;
  collectedBy?: CollectedBy;
  settlementStatus?: SettlementStatus;
  settlementId?: ID;
  orderId?: ID;
}

/** Every entry the filters match — for totals, export and a settlement's lines. */
export function peekFeeEntries(locationId: ID, f: FeeEntryFilters = {}): PlatformFeeEntry[] {
  return build(locationId)
    .entries.filter(
      (e) =>
        inRange(e, f.from, f.to) &&
        (!f.collectedBy || e.collectedBy === f.collectedBy) &&
        (!f.settlementStatus || e.settlementStatus === f.settlementStatus) &&
        (!f.settlementId || e.settlementId === f.settlementId) &&
        (!f.orderId || e.orderId === f.orderId),
    )
    .reverse();
}

export async function listFeeEntries(
  locationId: ID,
  filters: FeeEntryFilters,
  page = 1,
  pageSize = 25,
): Promise<ApiResult<{ data: PlatformFeeEntry[]; total: number }>> {
  await delay();
  const rows = peekFeeEntries(locationId, filters);
  return ok({ data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length });
}

/** The entries of one order, whatever its venue — for the order page. */
export async function getOrderFeeEntries(orderId: ID): Promise<ApiResult<PlatformFeeEntry[]>> {
  await delay();
  const o = peekOrders().find((x) => x.id === orderId);
  if (!o) return fail(notFoundError("Order"));
  return ok(peekFeeEntries(o.locationId, { orderId }).reverse());
}

export async function listPayouts(locationId: ID): Promise<ApiResult<Payout[]>> {
  await delay();
  return ok(build(locationId).payouts);
}

export async function getPayout(id: ID): Promise<ApiResult<{ payout: Payout; entries: PlatformFeeEntry[] }>> {
  await delay();
  const locationId = id.replace(/^po_/, "").replace(/_\d{4}-\d{2}-\d{2}$/, "");
  const l = build(locationId);
  const payout = l.payouts.find((p) => p.id === id);
  if (!payout) return fail(notFoundError("Payout"));
  return ok({ payout, entries: l.entries.filter((e) => e.settlementId === id).reverse() });
}

export async function listFeeCollections(locationId: ID): Promise<ApiResult<FeeCollection[]>> {
  await delay();
  return ok(build(locationId).collections);
}

export async function getFeeCollection(id: ID): Promise<ApiResult<{ collection: FeeCollection; entries: PlatformFeeEntry[] }>> {
  await delay();
  const locationId = id.replace(/^fc_/, "").replace(/_\d{4}-\d{2}-\d{2}$/, "");
  const l = build(locationId);
  const collection = l.collections.find((c) => c.id === id);
  if (!collection) return fail(notFoundError("Collection"));
  return ok({ collection, entries: l.entries.filter((e) => e.settlementId === id).reverse() });
}

/** Pay an open collection online — the billing checkout (SSLCommerz) in the
 *  real system; here it settles at once. */
export async function payFeeCollection(id: ID, method: string): Promise<ApiResult<FeeCollection>> {
  await delay();
  const res = await getFeeCollection(id);
  if (!res.ok) return fail(res.error);
  if (res.data.collection.status !== "open" && res.data.collection.status !== "past_due") {
    return fail(validationError({}, "This collection is not open for payment."));
  }
  paidCollections.set(id, { on: TODAY, with: method });
  const after = await getFeeCollection(id);
  return after.ok ? ok(after.data.collection) : fail(after.error);
}

/** Every open or overdue collection across venues — for the overdue banner. */
export function peekPastDueCollections(): FeeCollection[] {
  return peekLocations().flatMap((l) => build(l.id).collections.filter((c) => c.status === "past_due"));
}
