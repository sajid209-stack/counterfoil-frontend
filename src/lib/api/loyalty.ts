/* loyalty.v1 — points earned and spent.

   The balance is never stored. It is the sum of an append-only ledger, the
   same way an account balance works in the backend: earn, spend, expire and
   adjust entries, replayed. A stored balance and a ledger will disagree the
   first time anything goes wrong, and then nobody can tell which is right. */
import {
  createResource,
  fail,
  getLoyaltyProgramState,
  notFoundError,
  ok,
  patchLoyaltyProgramState,
  validationError,
} from "./client";
import { resolveCustomer } from "./customers";
import type {
  ApiResult,
  ID,
  ISODate,
  LoyaltyAccount,
  LoyaltyEntry,
  LoyaltyProgram,
  Minor,
} from "./types";

const DAY = 86400000;
const EXPIRING_SOON_DAYS = 60;

const entries = createResource<LoyaltyEntry & { id: ID }>("loyaltyEntries", "Points entry", {
  sort: { at: (a, b) => a.at.localeCompare(b.at) },
  defaultSort: "at",
});

export const peekLoyaltyEntries = (): LoyaltyEntry[] => entries.peek();

// ── the programme (a singleton, like tax config) ────────────────────────────
export const getLoyaltyProgram = async (): Promise<ApiResult<LoyaltyProgram>> =>
  ok(getLoyaltyProgramState());

export async function updateLoyaltyProgram(
  patch: Partial<LoyaltyProgram>,
): Promise<ApiResult<LoyaltyProgram>> {
  const next = { ...getLoyaltyProgramState(), ...patch };
  const errors: Record<string, string> = {};
  if (next.pointsPerUnit < 0) errors.pointsPerUnit = "Points earned cannot be negative.";
  if (next.pointValue < 0) errors.pointValue = "A point cannot be worth less than nothing.";
  if (next.minRedeemPoints < 0) errors.minRedeemPoints = "Enter 0 to allow any number of points.";
  if (next.expiryMonths != null && next.expiryMonths < 1) {
    errors.expiryMonths = "Leave this empty if points never expire.";
  }
  if (Object.keys(errors).length) return fail<LoyaltyProgram>(validationError(errors));
  return ok(patchLoyaltyProgramState(patch));
}

// ── the ledger ──────────────────────────────────────────────────────────────
const isExpired = (e: LoyaltyEntry, on: string) =>
  e.kind === "earn" && e.expiresAt != null && e.expiresAt < on;

/**
 * Replay the ledger for one customer.
 *
 * Expiry is applied at read time rather than written as `expire` entries: the
 * backend runs a job for that, and inventing entries here would mean the mock
 * and the real ledger disagree about how many rows exist.
 */
export function loyaltyAccount(customerId: ID): LoyaltyAccount {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + EXPIRING_SOON_DAYS * DAY).toISOString().slice(0, 10);
  const mine = entries
    .peek()
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => a.at.localeCompare(b.at));

  let earned = 0;
  let spent = 0;
  let expired = 0;
  let expiringSoon = 0;

  for (const e of mine) {
    if (e.kind === "earn") {
      earned += e.points;
      if (isExpired(e, today)) expired += e.points;
      else if (e.expiresAt != null && e.expiresAt <= soon) expiringSoon += e.points;
    } else if (e.kind === "spend") {
      spent += e.points;
    } else if (e.kind === "expire") {
      expired += e.points;
    } else if (e.kind === "adjust") {
      earned += e.points;
    }
  }

  const balance = Math.max(0, earned - spent - expired);
  return {
    customerId,
    balance,
    lifetimeEarned: earned,
    lifetimeSpent: spent,
    // Never promise more expiring than is actually left to lose.
    expiringSoon: Math.min(expiringSoon, balance),
    entries: mine.slice().reverse(),
  };
}

export const getLoyaltyAccount = async (customerId: ID): Promise<ApiResult<LoyaltyAccount>> =>
  ok(loyaltyAccount(customerId));

const expiryFor = (program: LoyaltyProgram): ISODate | null => {
  if (program.expiryMonths == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + program.expiryMonths);
  return d.toISOString().slice(0, 10);
};

/** Points a spend earns. Rounded down — never award a point not fully paid for. */
export function pointsForSpend(amount: Minor, program = getLoyaltyProgramState()): number {
  if (!program.enabled || program.pointsPerUnit <= 0 || amount <= 0) return 0;
  return Math.floor((amount / 100) * program.pointsPerUnit);
}

/** Award points for a completed sale (§17.5). Called by checkout. */
export async function earnPoints(
  customerId: ID,
  amount: Minor,
  orderId?: ID | null,
): Promise<ApiResult<LoyaltyEntry | null>> {
  const program = getLoyaltyProgramState();
  const points = pointsForSpend(amount, program);
  if (points <= 0) return ok(null);
  if (!resolveCustomer(customerId)) return fail<LoyaltyEntry | null>(notFoundError("Customer"));
  return entries.create({
    customerId,
    kind: "earn",
    points,
    orderId: orderId ?? null,
    at: new Date().toISOString(),
    expiresAt: expiryFor(program),
  } as Omit<LoyaltyEntry & { id: ID }, "id" | "createdAt" | "updatedAt">) as Promise<
    ApiResult<LoyaltyEntry | null>
  >;
}

/** What a number of points is worth off a sale. */
export const pointsValue = (points: number, program = getLoyaltyProgramState()): Minor =>
  Math.max(0, Math.floor(points) * program.pointValue);

/**
 * The most a customer can usefully spend against a given total (§17.7).
 * Bounded by their balance, by the programme's minimum, and by the sale — a
 * customer must never spend points on more than the sale is worth.
 */
export function maxRedeemablePoints(customerId: ID, total: Minor): number {
  const program = getLoyaltyProgramState();
  if (!program.enabled || program.pointValue <= 0 || total <= 0) return 0;
  const { balance } = loyaltyAccount(customerId);
  if (balance < program.minRedeemPoints) return 0;
  return Math.min(balance, Math.floor(total / program.pointValue));
}

/** Spend points against a sale (§17.7, §17.8). */
export async function spendPoints(
  customerId: ID,
  points: number,
  orderId?: ID | null,
): Promise<ApiResult<LoyaltyEntry>> {
  const program = getLoyaltyProgramState();
  if (!program.enabled) {
    return fail<LoyaltyEntry>(validationError({}, "The points programme is switched off."));
  }
  const whole = Math.floor(points);
  if (whole <= 0) return fail<LoyaltyEntry>(validationError({ points: "Enter how many points." }));
  if (whole < program.minRedeemPoints) {
    return fail<LoyaltyEntry>(
      validationError({}, `Points can be spent from ${program.minRedeemPoints} upwards.`),
    );
  }
  const { balance } = loyaltyAccount(customerId);
  if (whole > balance) {
    return fail<LoyaltyEntry>(
      validationError({}, `Only ${balance} points available.`),
    );
  }
  return entries.create({
    customerId,
    kind: "spend",
    points: whole,
    orderId: orderId ?? null,
    at: new Date().toISOString(),
  } as Omit<LoyaltyEntry & { id: ID }, "id" | "createdAt" | "updatedAt">);
}

/** A manager correcting a balance by hand — always with a reason. */
export async function adjustPoints(
  customerId: ID,
  points: number,
  note: string,
): Promise<ApiResult<LoyaltyEntry>> {
  const body = note.trim();
  if (!body) return fail<LoyaltyEntry>(validationError({ note: "Say why you are adjusting it." }));
  if (!Number.isFinite(points) || points === 0) {
    return fail<LoyaltyEntry>(validationError({ points: "Enter a number of points." }));
  }
  const program = getLoyaltyProgramState();
  return entries.create({
    customerId,
    kind: points > 0 ? "adjust" : "spend",
    points: Math.abs(Math.floor(points)),
    note: body,
    at: new Date().toISOString(),
    expiresAt: points > 0 ? expiryFor(program) : null,
  } as Omit<LoyaltyEntry & { id: ID }, "id" | "createdAt" | "updatedAt">);
}

/** Programme-wide totals for the manager (§17.10). */
export async function loyaltyTotals(): Promise<
  ApiResult<{ earned: number; spent: number; outstanding: number; members: number }>
> {
  const byCustomer = new Map<ID, true>();
  for (const e of entries.peek()) byCustomer.set(e.customerId, true);
  let earned = 0;
  let spent = 0;
  let outstanding = 0;
  for (const customerId of byCustomer.keys()) {
    const a = loyaltyAccount(customerId);
    earned += a.lifetimeEarned;
    spent += a.lifetimeSpent;
    outstanding += a.balance;
  }
  return ok({ earned, spent, outstanding, members: byCustomer.size });
}
