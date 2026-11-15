/**
 * Sequences — steps Counterfoil does by itself when something happens.
 *
 * The rules (what may start one, which steps fit, what is still missing, and
 * how one plays out for a booking) are pure and live in `src/lib/sequences.ts`.
 * This module is the store: the sequences, their runs, and the handful of
 * bookings "Try it" can be shown against. Spec: docs/sequences.md.
 *
 * Contract for the backend lane:
 *
 *   - `Sequence` is what the API returns and `SequenceInput` what a screen
 *     saves. `status` is only ever changed by `setSequenceOn`, which refuses to
 *     switch on a sequence that `sequenceProblems` still has something to say
 *     about — the same check the screen runs, so the two cannot disagree.
 *   - A delete is soft (`deletedAt`), so Undo brings a sequence back with its
 *     runs. Runs keep the sequence's name as it was (`sequenceName`): renaming
 *     a sequence must not rewrite what the outbox says was sent.
 *   - `SequenceRun` is one sequence working for one customer. Its steps carry
 *     the words as they were sent, the moment, and — when a step was skipped —
 *     the reason as a stable code. The engine that runs sequences is the
 *     backend's; here runs are seeded by playing each sequence against real
 *     seeded bookings (`walkSequence`) and comparing each moment with the clock.
 *   - A message about the customer's own booking goes to anyone with a phone
 *     or an email. An invitation (`START_META[kind].needsYes`) goes only to
 *     customers who said yes (`hasConsent`). Quiet hours hold both. All three
 *     are decided by the engine, never by a step.
 *
 * Business-wide, not per venue: a reminder is the business's promise.
 */
import { useSyncExternalStore } from "react";
import { demoDay, demoNow, slotISO } from "@/lib/schedule";
import {
  runFromWalk,
  sentIn,
  sequenceProblems,
  walkSequence,
  type DetailKey,
  type RunStatus,
  type Sequence,
  type SequenceInput,
  type SequenceRun,
  type SequenceSample,
  type SequenceStep,
  type StartKind,
} from "@/lib/sequences";
import { createResource, delay, fail, getOperatorState, notFoundError, ok, validationError } from "./client";
import { peekBookings } from "./bookings";
import { customerStats, hasConsent, peekCustomers } from "./customers";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import type { ApiResult, Booking, ID, ISODateTime, ListResponse } from "./types";

export type * from "@/lib/sequences";

type StoredSequence = Sequence & { deletedAt?: ISODateTime | null };

const sequences = createResource<StoredSequence>("sequences", "Sequence");
const runs = createResource<SequenceRun>("sequenceRuns", "Sequence run");

// ── change signal ────────────────────────────────────────────────────────────
let version = 0;
const listeners = new Set<() => void>();
const touch = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
/** Re-renders the caller whenever a sequence or a run changes. */
export const useSequencesVersion = (): number => useSyncExternalStore(subscribe, () => version, () => 0);

// ── formatting for stored words (the seed is written in English) ─────────────
const DHAKA_TZ = "Asia/Dhaka";
const seedDay = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: DHAKA_TZ }).format(d).replace(",", "");
const seedClock = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: DHAKA_TZ }).format(d);
const venueName = () => getOperatorState().name;

// ── samples: real bookings a sequence can be played against ──────────────────
function sampleOf(b: Booking): SequenceSample | null {
  const order = peekOrders().find((o) => o.id === b.orderId);
  if (!order?.customerName) return null;
  const customer = order.customerId ? (peekCustomers().find((c) => c.id === order.customerId) ?? null) : null;
  const product = peekProducts().find((p) => p.id === b.productId);
  const paid = order.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const name = customer?.name ?? order.customerName;
  return {
    id: b.id,
    name,
    firstName: name.split(" ")[0],
    customerId: customer?.id ?? null,
    orderId: order.id,
    orderRef: order.reference,
    productId: b.productId,
    booking: product?.name ?? "Booking",
    visitAt: b.slotStart,
    people: b.partySize,
    total: order.total,
    owed: order.status === "cancelled" || order.status === "refunded" ? 0 : Math.max(0, order.total - paid),
    where: order.channel === "online" ? "online" : "counter",
    visits: customer ? customerStats(customer.id).visits : 0,
    hasPhone: !!customer?.phone,
    hasEmail: !!customer?.email,
    canText: !!customer && hasConsent(customer, "sms"),
    canEmail: !!customer && hasConsent(customer, "email"),
    cancelled: b.status === "cancelled",
  };
}

/** Bookings with a named customer, nearest to now first. */
function bookingSamples(): SequenceSample[] {
  const now = demoNow().getTime();
  return peekBookings()
    .map(sampleOf)
    .filter((s): s is SequenceSample => !!s)
    .sort((a, b) => Math.abs(new Date(a.visitAt).getTime() - now) - Math.abs(new Date(b.visitAt).getTime() - now));
}

/**
 * Customers who still owe money. The seed's part-paid sales are for things
 * with no time slot, so each is given a visit in the next three days — enough
 * for "before a visit that is not fully paid" to have someone real to work
 * for, with the real name and the real amount owed.
 */
function owingSamples(): SequenceSample[] {
  const times = ["10:00", "14:00", "16:30"];
  return peekOrders()
    .filter((o) => o.status === "partial" && !!o.customerName)
    .map((o, i): SequenceSample => {
      const customer = o.customerId ? (peekCustomers().find((c) => c.id === o.customerId) ?? null) : null;
      const paid = o.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
      const name = customer?.name ?? o.customerName ?? "";
      const line = o.lines[0];
      return {
        id: `smp_${o.id}`,
        name,
        firstName: name.split(" ")[0],
        customerId: customer?.id ?? null,
        orderId: o.id,
        orderRef: o.reference,
        productId: line?.productId ?? null,
        booking: line?.productName ?? "Booking",
        visitAt: slotISO(demoDay(i % 3), times[i % 3]),
        people: Math.max(1, o.lines.reduce((n, l) => n + (l.parentLineId ? 0 : l.quantity), 0)),
        total: o.total,
        owed: Math.max(0, o.total - paid),
        where: o.channel === "online" ? "online" : "counter",
        visits: customer ? customerStats(customer.id).visits : 0,
        hasPhone: !!customer?.phone,
        hasEmail: !!customer?.email,
        canText: !!customer && hasConsent(customer, "sms"),
        canEmail: !!customer && hasConsent(customer, "email"),
        cancelled: false,
      };
    })
    .filter((s) => s.owed > 0);
}

const teamSample = (id: string, name: string, details: Partial<Record<DetailKey, string>>, booking = ""): SequenceSample => ({
  id,
  name,
  firstName: name.split(" ")[0],
  customerId: null,
  orderId: null,
  orderRef: null,
  productId: null,
  booking,
  visitAt: demoNow().toISOString(),
  people: 1,
  total: 0,
  owed: 0,
  where: "counter",
  visits: 0,
  hasPhone: true,
  hasEmail: true,
  canText: true,
  canEmail: true,
  cancelled: false,
  details,
});

/**
 * Up to five things "Try it" can be shown against. For a customer sequence:
 * real bookings near today, chosen so the list is not five of the same case —
 * someone who owes money and someone who did not say yes to texts are in it
 * when the seed has them. For a team sequence: the thing it is about.
 */
export function trySamples(kind: StartKind): SequenceSample[] {
  if (kind === "stockLow")
    return [teamSample("smp_water", "Bottled water", { item: "Bottled water", left: "6" }), teamSample("smp_tote", "Souvenir tote bag", { item: "Souvenir tote bag", left: "3" }), teamSample("smp_guide", "Exhibition guide", { item: "Exhibition guide", left: "0" })];
  if (kind === "cashShort")
    return [teamSample("smp_cash1", "Nadia Islam", { staff: "Nadia Islam", amount: "৳650.00" }), teamSample("smp_cash2", "Rahim Uddin", { staff: "Rahim Uddin", amount: "৳1,200.00" })];
  // A sequence about money owed is shown against people who owe, first.
  const all = kind === "balanceOwed" ? [...owingSamples(), ...bookingSamples()] : bookingSamples();
  const picked: SequenceSample[] = [];
  const take = (s?: SequenceSample) => {
    if (s && picked.length < 5 && !picked.some((p) => p.name === s.name)) picked.push(s);
  };
  if (kind === "balanceOwed") take(all.find((s) => s.hasPhone && s.owed > 0));
  take(all.find((s) => s.hasPhone && s.owed === 0));
  take(all.find((s) => s.owed > 0));
  take(all.find((s) => !s.hasPhone || !s.canText));
  take(all.find((s) => s.people >= 6));
  for (const s of all) take(s);
  if (kind === "refundAsked") return picked.slice(0, 3).map((s) => ({ ...s, details: { customer: s.name, booking: s.booking } }));
  return picked;
}

// ── seed ─────────────────────────────────────────────────────────────────────
const DAY = 1440;
const sid = (n: number) => `st_seed_${String(n).padStart(2, "0")}`;

type SeedSequence = Omit<StoredSequence, "createdAt" | "updatedAt"> & { madeDaysAgo: number };

const SEED: SeedSequence[] = [
  {
    id: "seq_reminder",
    name: "Remind customers the day before",
    status: "on",
    start: { kind: "beforeVisit", minutes: DAY, productIds: [] },
    onlyIf: [],
    steps: [{ id: sid(1), kind: "text", body: "Hi {firstName}, see you tomorrow at {time} for {booking}. Your ticket: {link} — {venue}" }],
    stopIf: ["cancelled"],
    quietHours: true,
    ideaId: "reminder",
    madeDaysAgo: 41,
  },
  {
    id: "seq_review",
    name: "Ask for a review after the visit",
    status: "on",
    start: { kind: "afterVisit", minutes: 180, productIds: [] },
    onlyIf: [],
    steps: [{ id: sid(2), kind: "text", body: "Thank you for coming, {firstName}. How was {booking}? Tell us in one tap: {link}" }],
    stopIf: [],
    quietHours: true,
    ideaId: "review",
    madeDaysAgo: 38,
  },
  {
    id: "seq_noshow",
    name: "Follow up when someone does not come",
    status: "on",
    start: { kind: "noShow", productIds: [] },
    onlyIf: [],
    steps: [
      { id: sid(3), kind: "wait", minutes: 60 },
      { id: sid(4), kind: "text", body: "We missed you today, {firstName}. Want another time for {booking}? Reply to this text and we will help." },
      {
        id: sid(5),
        kind: "branch",
        condition: { id: "if_seed_01", field: "visits", op: "atLeast", value: 3 },
        yes: [],
        no: [{ id: sid(6), kind: "note", body: "Did not come to {booking} on {date}." }],
      },
    ],
    stopIf: [],
    quietHours: true,
    ideaId: "noShow",
    madeDaysAgo: 30,
  },
  {
    id: "seq_balance",
    name: "Ask for the balance before the visit",
    status: "on",
    start: { kind: "balanceOwed", minutes: 2 * DAY, productIds: [] },
    onlyIf: [],
    steps: [
      { id: sid(7), kind: "text", body: "Hi {firstName}, {owed} is still to pay for {booking} on {date}. Pay here: {link}" },
      { id: sid(8), kind: "wait", minutes: DAY },
      {
        id: sid(9),
        kind: "branch",
        condition: { id: "if_seed_02", field: "owes", op: "is", value: "yes" },
        yes: [{ id: sid(10), kind: "team", to: "managers", body: "{customer} still owes {owed} for {booking} on {date}." }],
        no: [],
      },
    ],
    stopIf: ["cancelled", "paid"],
    quietHours: true,
    ideaId: "balance",
    madeDaysAgo: 22,
  },
  {
    id: "seq_waitlist",
    name: "Offer a free place to the waitlist",
    status: "off",
    start: { kind: "placeOpens", productIds: [] },
    onlyIf: [],
    steps: [
      { id: sid(11), kind: "offer", holdMinutes: 30 },
      { id: sid(12), kind: "team", to: "onShift", body: "A place opened on {booking} at {time}. It was offered to the waitlist." },
    ],
    stopIf: [],
    quietHours: false,
    ideaId: "waitlist",
    madeDaysAgo: 9,
  },
  {
    id: "seq_stock",
    name: "Tell me when stock runs low",
    status: "off",
    start: { kind: "stockLow", productIds: [] },
    onlyIf: [],
    // Not finished on purpose: the words are missing, so the list shows the state.
    steps: [{ id: sid(13), kind: "team", to: "managers", body: "" }],
    stopIf: [],
    quietHours: false,
    ideaId: "stock",
    madeDaysAgo: 2,
  },
];

const ago = (minutes: number) => new Date(demoNow().getTime() - minutes * 60000);

function seedSequences(): void {
  if (sequences.peek().length) return;
  for (const s of SEED) {
    const { madeDaysAgo, ...rest } = s;
    const at = ago(madeDaysAgo * DAY).toISOString();
    sequences.peek().push({ ...rest, createdAt: at, updatedAt: at });
  }
}

let runsSeeded = false;
/** Runs are made on first read, by playing each sequence that is on against
 *  real seeded bookings. Chosen by index, never by `rand()`, so the outbox is
 *  the same on every load. */
function seedRuns(): void {
  if (runsSeeded) return;
  runsSeeded = true;
  seedSequences();
  if (runs.peek().length) return;
  const now = demoNow();
  const all = bookingSamples();
  const past = all.filter((s) => new Date(s.visitAt).getTime() < now.getTime());
  const near = all.filter((s) => Math.abs(new Date(s.visitAt).getTime() - now.getTime()) < 14 * DAY * 60000);
  let n = 0;
  const add = (seqId: ID, sample: SequenceSample, opts: { startAt?: Date; failAt?: ID; force?: boolean } = {}) => {
    const seq = sequences.peek().find((s) => s.id === seqId);
    if (!seq) return;
    const walk = walkSequence(seq, sample, now, { venue: venueName(), day: seedDay, clock: seedClock, startAt: opts.startAt });
    if (walk.blockedBy || walk.rows.length === 0) return;
    if (walk.startAt.getTime() > now.getTime() || walk.startAt.getTime() < now.getTime() - 14 * DAY * 60000) return;
    const made = runFromWalk(walk, now, opts.failAt);
    const stoppedEarly = sample.cancelled && seq.stopIf.includes("cancelled");
    n += 1;
    runs.peek().push({
      id: `run_seed_${String(n).padStart(3, "0")}`,
      sequenceId: seq.id,
      sequenceName: seq.name,
      status: stoppedEarly ? "stopped" : made.status,
      startedAt: walk.startAt.toISOString(),
      touchedAt: made.touchedAt.toISOString(),
      who: { name: sample.name, customerId: sample.customerId, orderId: sample.orderId, orderRef: sample.orderRef, booking: sample.booking },
      steps: stoppedEarly ? made.steps.map((s) => ({ ...s, status: "skipped" as const, reason: "cancelled" as const })) : made.steps,
      ...(stoppedEarly ? { stopped: "cancelled" as const } : {}),
    });
  };
  near.slice(0, 16).forEach((s) => add("seq_reminder", s));
  past.slice(0, 12).forEach((s) => add("seq_review", s));
  // No-shows: a few past bookings by index, each half an hour after its time —
  // and the most recent one 25 min ago, so one run is still on its wait.
  const missed = past.filter((_, i) => i % 3 === 1).slice(0, 5);
  missed.forEach((s, i) => add("seq_noshow", s, { startAt: i === 0 ? new Date(now.getTime() - 25 * 60000) : new Date(new Date(s.visitAt).getTime() + 30 * 60000) }));
  owingSamples()
    .slice(0, 6)
    .forEach((s, i) => add("seq_balance", s, i === 1 ? { failAt: sid(7) } : {}));
}

seedSequences();

// ── reads ────────────────────────────────────────────────────────────────────
const live = () => sequences.peek().filter((s) => !s.deletedAt);
const present = (s: StoredSequence): Sequence => {
  const { deletedAt: _gone, ...rest } = s;
  void _gone;
  return rest;
};

/** A sequence as the list shows it: with what its runs have been doing. */
export interface SequenceRow extends Sequence {
  /** Runs started in the last 30 days. */
  runs30: number;
  /** Runs waiting on a step right now. */
  working: number;
  /** Runs with a failed step. */
  problems: number;
  lastRunAt: ISODateTime | null;
}

function rowOf(s: StoredSequence): SequenceRow {
  const mine = runs.peek().filter((r) => r.sequenceId === s.id);
  const since = demoNow().getTime() - 30 * DAY * 60000;
  return {
    ...present(s),
    runs30: mine.filter((r) => new Date(r.startedAt).getTime() >= since).length,
    working: mine.filter((r) => r.status === "working").length,
    problems: mine.filter((r) => r.status === "problem").length,
    lastRunAt: mine.map((r) => r.touchedAt).sort().at(-1) ?? null,
  };
}

export async function listSequences(): Promise<ApiResult<SequenceRow[]>> {
  await delay();
  seedRuns();
  // On first, then by the last time anything happened, then newest.
  const rank = (r: SequenceRow) => (r.status === "on" ? 0 : 1);
  return ok(
    live()
      .map(rowOf)
      .sort((a, b) => rank(a) - rank(b) || (b.lastRunAt ?? "").localeCompare(a.lastRunAt ?? "") || b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function getSequence(id: ID): Promise<ApiResult<SequenceRow>> {
  await delay();
  seedRuns();
  const s = live().find((x) => x.id === id);
  return s ? ok(rowOf(s)) : fail(notFoundError("Sequence"));
}

export const peekSequences = (): Sequence[] => live().map(present);

export interface SequenceSummary {
  /** Sequences switched on. */
  on: number;
  /** Runs started in the last 7 days. */
  runsWeek: number;
  /** Texts and emails sent in the last 7 days. */
  sentWeek: number;
  /** Runs with a failed step, any age. */
  needLook: number;
  /** Runs waiting on a step right now. */
  working: number;
}

export async function getSequenceSummary(): Promise<ApiResult<SequenceSummary>> {
  await delay();
  seedRuns();
  const since = demoNow().getTime() - 7 * DAY * 60000;
  const ids = new Set(live().map((s) => s.id));
  const mine = runs.peek().filter((r) => ids.has(r.sequenceId));
  const week = mine.filter((r) => new Date(r.startedAt).getTime() >= since);
  return ok({
    on: live().filter((s) => s.status === "on").length,
    runsWeek: week.length,
    sentWeek: week.reduce((n, r) => n + sentIn(r), 0),
    needLook: mine.filter((r) => r.status === "problem").length,
    working: mine.filter((r) => r.status === "working").length,
  });
}

export interface RunQuery {
  sequenceId?: ID;
  status?: RunStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

/** The outbox: runs, the latest activity first. */
export async function listSequenceRuns(q: RunQuery = {}): Promise<ApiResult<ListResponse<SequenceRun>>> {
  await delay();
  seedRuns();
  const ids = new Set(live().map((s) => s.id));
  const needle = q.search?.trim().toLowerCase();
  const rows = runs
    .peek()
    .filter((r) => ids.has(r.sequenceId))
    .filter((r) => !q.sequenceId || r.sequenceId === q.sequenceId)
    .filter((r) => !q.status || q.status === "all" || r.status === q.status)
    .filter((r) => !needle || `${r.who.name} ${r.who.booking} ${r.who.orderRef ?? ""} ${r.sequenceName}`.toLowerCase().includes(needle))
    .sort((a, b) => b.touchedAt.localeCompare(a.touchedAt));
  const pageSize = q.pageSize ?? 20;
  const page = Math.max(1, q.page ?? 1);
  return ok({ data: rows.slice((page - 1) * pageSize, page * pageSize), page: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) } });
}

export async function getSequenceRun(id: ID): Promise<ApiResult<SequenceRun>> {
  await delay();
  seedRuns();
  const r = runs.peek().find((x) => x.id === id);
  return r ? ok(r) : fail(notFoundError("Sequence run"));
}

/** How many runs a sequence started on each of the last `days` days, oldest first. */
export function runsByDay(sequenceId: ID, days = 14): number[] {
  seedRuns();
  const out = new Array<number>(days).fill(0);
  const end = demoNow().getTime();
  for (const r of runs.peek()) {
    if (r.sequenceId !== sequenceId) continue;
    const back = Math.floor((end - new Date(r.startedAt).getTime()) / (DAY * 60000));
    if (back >= 0 && back < days) out[days - 1 - back] += 1;
  }
  return out;
}

// ── writes ───────────────────────────────────────────────────────────────────
const stamp = () => demoNow().toISOString();
const nextId = () => `seq_${Math.random().toString(36).slice(2, 10)}`;

/** Saving never demands a finished sequence — only a name is not required
 *  either: an unnamed one is kept and shown as "Not finished". */
export async function createSequence(input: SequenceInput): Promise<ApiResult<Sequence>> {
  await delay();
  const at = stamp();
  const row: StoredSequence = { ...structuredClone(input), id: nextId(), status: "off", createdAt: at, updatedAt: at };
  sequences.peek().push(row);
  touch();
  return ok(present(row));
}

export async function updateSequence(id: ID, input: SequenceInput): Promise<ApiResult<Sequence>> {
  await delay();
  const row = live().find((s) => s.id === id);
  if (!row) return fail(notFoundError("Sequence"));
  Object.assign(row, structuredClone(input), { updatedAt: stamp() });
  // A sequence that is on must stay able to run: saving a broken one switches it off.
  if (row.status === "on" && sequenceProblems(row).length) row.status = "off";
  touch();
  return ok(present(row));
}

/**
 * Switch a sequence on or off. On is refused while anything is missing; the
 * error names the first problem's code (`fieldErrors.status`). Switching off
 * with `stopWaiting` also stops the runs that are waiting on a step.
 */
export async function setSequenceOn(id: ID, on: boolean, opts: { stopWaiting?: boolean } = {}): Promise<ApiResult<Sequence>> {
  await delay();
  const row = live().find((s) => s.id === id);
  if (!row) return fail(notFoundError("Sequence"));
  if (on) {
    const problems = sequenceProblems(row);
    if (problems.length) return fail(validationError({ status: problems[0].code }, "This sequence is not finished."));
  }
  row.status = on ? "on" : "off";
  row.updatedAt = stamp();
  if (!on && opts.stopWaiting) {
    for (const r of runs.peek()) {
      if (r.sequenceId !== id || r.status !== "working") continue;
      r.status = "stopped";
      r.stopped = "switchedOff";
      r.touchedAt = stamp();
      r.steps = r.steps.map((s) => (s.status === "waiting" || s.status === "next" ? { ...s, status: "skipped" as const, reason: "switchedOff" as const } : s));
    }
  }
  touch();
  return ok(present(row));
}

const reId = (steps: SequenceStep[]): SequenceStep[] =>
  steps.map((s) => {
    const id = `st_${Math.random().toString(36).slice(2, 10)}`;
    return s.kind === "branch" ? { ...s, id, condition: { ...s.condition, id: `if_${Math.random().toString(36).slice(2, 10)}` }, yes: reId(s.yes), no: reId(s.no) } : { ...s, id };
  });

/** A copy, off, with the name the caller gives it ("Copy of …" is the screen's word). */
export async function copySequence(id: ID, name: string): Promise<ApiResult<Sequence>> {
  await delay();
  const src = live().find((s) => s.id === id);
  if (!src) return fail(notFoundError("Sequence"));
  const at = stamp();
  const row: StoredSequence = { ...structuredClone(present(src)), id: nextId(), name, status: "off", steps: reId(structuredClone(src.steps)), createdAt: at, updatedAt: at };
  sequences.peek().push(row);
  touch();
  return ok(present(row));
}

export async function deleteSequence(id: ID): Promise<ApiResult<Sequence>> {
  await delay();
  const row = live().find((s) => s.id === id);
  if (!row) return fail(notFoundError("Sequence"));
  row.deletedAt = stamp();
  row.status = "off";
  touch();
  return ok(present(row));
}

/** Undo a delete. It comes back off, with its runs. */
export async function restoreSequence(id: ID): Promise<ApiResult<Sequence>> {
  await delay();
  const row = sequences.peek().find((s) => s.id === id);
  if (!row) return fail(notFoundError("Sequence"));
  row.deletedAt = null;
  touch();
  return ok(present(row));
}

/** Send a failed step again. It goes through, and the run carries on. */
export async function retrySequenceRun(id: ID): Promise<ApiResult<SequenceRun>> {
  await delay();
  const r = runs.peek().find((x) => x.id === id);
  if (!r) return fail(notFoundError("Sequence run"));
  const now = demoNow();
  let waiting = false;
  r.steps = r.steps.map((s) => {
    if (s.status === "failed") {
      const { reason: _why, ...rest } = s;
      void _why;
      return { ...rest, status: "done" as const, at: now.toISOString() };
    }
    if (s.status !== "next") return s;
    if (waiting) return s;
    if (new Date(s.at).getTime() <= now.getTime()) return { ...s, status: "done" as const };
    waiting = true;
    return { ...s, status: "waiting" as const };
  });
  r.status = r.steps.some((s) => s.status === "waiting") ? "working" : "done";
  r.touchedAt = now.toISOString();
  touch();
  return ok(r);
}
