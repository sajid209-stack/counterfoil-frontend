/**
 * Sequences — the types and the pure rules. No store, no clock, no React.
 *
 * A sequence is "when this happens, do these steps". Everything a screen needs
 * to *read* one is here: what may start it, which steps make sense after which
 * start, the sentence it reads as, what is still missing, and — the part the
 * outbox and "Try it" share — `walkSequence`, which plays a sequence for one
 * booking and says what would happen and when.
 *
 * Spec: docs/sequences.md. Store and seed: src/lib/api/sequences.ts.
 *
 * Words never live here. Every function that returns a sentence takes the
 * `sequences` namespace translator, so English and Bangla come from messages.
 */
import { formatMoney } from "@/lib/format";
import type { ID, ISODateTime, Minor } from "@/lib/api/types";

/** The `sequences` namespace translator (`useTranslations("sequences")`). */
export type SeqT = ((key: string, values?: Record<string, string | number>) => string) & {
  /** The message as written, unformatted. Idea words hold `{details}` that are
   *  ours to fill, not the translator's, so they are read raw. */
  raw?: (key: string) => unknown;
};

// ── What can start a sequence ────────────────────────────────────────────────

export const START_KINDS = [
  "booked",
  "beforeVisit",
  "afterVisit",
  "cancelled",
  "noShow",
  "balanceOwed",
  "placeOpens",
  "notBack",
  "refundAsked",
  "stockLow",
  "cashShort",
] as const;
export type StartKind = (typeof START_KINDS)[number];

/** Who a sequence is about. It decides which steps and details are offered. */
export type SequenceAbout = "customer" | "team";

export interface StartMeta {
  about: SequenceAbout;
  /** Needs "how long before / after" (minutes). */
  span?: { fallback: number; min: number; max: number };
  /** Needs a number of days. */
  days?: { fallback: number; min: number; max: number };
  /** Needs an amount of money. */
  amount?: { fallback: Minor };
  /** Can be narrowed to chosen bookings from the catalog. */
  bookings?: boolean;
  /**
   * An invitation, not a message about a booking the customer made. Its texts
   * and emails go only to customers who said yes to messages. Everything else
   * is about the customer's own booking and goes to anyone with a phone or an
   * email — the same line Settings → Notifications already draws.
   */
  needsYes?: boolean;
}

const DAY = 1440;

export const START_META: Record<StartKind, StartMeta> = {
  booked: { about: "customer", bookings: true },
  beforeVisit: { about: "customer", bookings: true, span: { fallback: DAY, min: 15, max: 30 * DAY } },
  afterVisit: { about: "customer", bookings: true, span: { fallback: 120, min: 15, max: 30 * DAY } },
  cancelled: { about: "customer", bookings: true },
  noShow: { about: "customer", bookings: true },
  balanceOwed: { about: "customer", bookings: true, span: { fallback: 2 * DAY, min: 60, max: 30 * DAY } },
  placeOpens: { about: "customer", bookings: true },
  notBack: { about: "customer", needsYes: true, days: { fallback: 60, min: 7, max: 365 } },
  refundAsked: { about: "team" },
  stockLow: { about: "team" },
  cashShort: { about: "team", amount: { fallback: 50000 } },
};

export interface SequenceStart {
  kind: StartKind;
  /** How long before / after, in minutes (see `START_META[kind].span`). */
  minutes?: number;
  days?: number;
  amount?: Minor;
  /** Chosen bookings. Empty means every booking. */
  productIds: ID[];
}

// ── Only if ──────────────────────────────────────────────────────────────────

export const CONDITION_FIELDS = ["people", "total", "visits", "where", "day", "owes"] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];
export type ConditionOp = "atLeast" | "atMost" | "is";

/** Which comparisons and values a field takes. `number` and `money` take
 *  atLeast / atMost; `choice` takes "is" and one of `options`. */
export const CONDITION_META: Record<ConditionField, { type: "number" | "money" | "choice"; options?: readonly string[]; fallback: number | string }> = {
  people: { type: "number", fallback: 6 },
  total: { type: "money", fallback: 500000 },
  visits: { type: "number", fallback: 3 },
  where: { type: "choice", options: ["online", "counter"], fallback: "online" },
  day: { type: "choice", options: ["weekend", "weekday"], fallback: "weekend" },
  owes: { type: "choice", options: ["yes", "no"], fallback: "yes" },
};

export interface SequenceCondition {
  id: ID;
  field: ConditionField;
  op: ConditionOp;
  value: number | string;
}

// ── Steps ────────────────────────────────────────────────────────────────────

export const STEP_KINDS = ["wait", "text", "email", "team", "note", "offer", "app", "branch"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const TEAM_AUDIENCES = ["managers", "onShift", "everyone"] as const;
export type TeamAudience = (typeof TEAM_AUDIENCES)[number];

export type SequenceStep =
  | { id: ID; kind: "wait"; minutes: number }
  | { id: ID; kind: "text"; body: string }
  | { id: ID; kind: "email"; subject: string; body: string }
  | { id: ID; kind: "team"; to: TeamAudience; body: string }
  | { id: ID; kind: "note"; body: string }
  | { id: ID; kind: "offer"; holdMinutes: number }
  | { id: ID; kind: "app"; url: string }
  | { id: ID; kind: "branch"; condition: SequenceCondition; yes: SequenceStep[]; no: SequenceStep[] };

export type BranchStep = Extract<SequenceStep, { kind: "branch" }>;

export const STOP_RULES = ["cancelled", "checkedIn", "paid"] as const;
export type StopRule = (typeof STOP_RULES)[number];

export type SequenceStatus = "on" | "off";

export interface Sequence {
  id: ID;
  name: string;
  status: SequenceStatus;
  start: SequenceStart;
  onlyIf: SequenceCondition[];
  steps: SequenceStep[];
  stopIf: StopRule[];
  /** Hold customer messages between 9 PM and 9 AM until 9 AM. */
  quietHours: boolean;
  /** The idea it began from, if any. */
  ideaId?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** What a screen sends when it saves. */
export type SequenceInput = Pick<Sequence, "name" | "start" | "onlyIf" | "steps" | "stopIf" | "quietHours"> & { ideaId?: string | null };

export const MAX_STEPS = 8;
export const MAX_CONDITIONS = 4;
export const QUIET_FROM = 21;
export const QUIET_TO = 9;

// ── Small helpers ────────────────────────────────────────────────────────────

export const newId = (prefix: string): ID => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** True when this start's messages need the customer's yes (see `StartMeta.needsYes`). */
export const needsYes = (start: Pick<SequenceStart, "kind">): boolean => !!START_META[start.kind].needsYes;

export const aboutOf = (seq: Pick<Sequence, "start">): SequenceAbout => START_META[seq.start.kind].about;

/** Steps that make sense for this start. `inBranch` removes the branch itself:
 *  one level only — an "if" inside an "if" is a diagram nobody can read. */
export function stepKindsFor(start: SequenceStart, inBranch = false): StepKind[] {
  const about = START_META[start.kind].about;
  const kinds: StepKind[] = about === "customer" ? ["text", "email", "wait", "team", "note"] : ["team", "wait"];
  if (start.kind === "placeOpens") kinds.unshift("offer");
  kinds.push("app");
  if (!inBranch) kinds.push("branch");
  return kinds;
}

/** Every step in reading order, with the side of a branch it sits on. */
export interface PlacedStep {
  step: SequenceStep;
  /** The branch it is inside, if any. */
  parentId: ID | null;
  side: "yes" | "no" | null;
}

export function placedSteps(steps: SequenceStep[]): PlacedStep[] {
  const out: PlacedStep[] = [];
  for (const s of steps) {
    out.push({ step: s, parentId: null, side: null });
    if (s.kind === "branch") {
      for (const y of s.yes) out.push({ step: y, parentId: s.id, side: "yes" });
      for (const n of s.no) out.push({ step: n, parentId: s.id, side: "no" });
    }
  }
  return out;
}

export const findStep = (steps: SequenceStep[], id: ID): PlacedStep | null => placedSteps(steps).find((p) => p.step.id === id) ?? null;

/** Steps that do something. Waits and the "if" itself are not counted: a wait
 *  is time passing, and an "if" is a question. */
export const countSteps = (steps: SequenceStep[]): number => placedSteps(steps).filter((p) => p.step.kind !== "wait" && p.step.kind !== "branch").length;

/** The list with one step changed. Works at either level. */
export function replaceStep(steps: SequenceStep[], id: ID, next: SequenceStep): SequenceStep[] {
  return steps.map((s) => {
    if (s.id === id) return next;
    if (s.kind !== "branch") return s;
    return { ...s, yes: s.yes.map((y) => (y.id === id ? next : y)), no: s.no.map((n) => (n.id === id ? next : n)) };
  });
}

export function removeStep(steps: SequenceStep[], id: ID): SequenceStep[] {
  return steps
    .filter((s) => s.id !== id)
    .map((s) => (s.kind === "branch" ? { ...s, yes: s.yes.filter((y) => y.id !== id), no: s.no.filter((n) => n.id !== id) } : s));
}

/** Where a new step goes: the top-level list, or one side of a branch. */
export interface Slot {
  parentId: ID | null;
  side: "yes" | "no" | null;
  /** Position in that list (0 = first). */
  index: number;
}

export function insertStep(steps: SequenceStep[], slot: Slot, step: SequenceStep): SequenceStep[] {
  const put = (list: SequenceStep[]) => [...list.slice(0, slot.index), step, ...list.slice(slot.index)];
  if (!slot.parentId) return put(steps);
  return steps.map((s) => {
    if (s.id !== slot.parentId || s.kind !== "branch") return s;
    return slot.side === "no" ? { ...s, no: put(s.no) } : { ...s, yes: put(s.yes) };
  });
}

/** Move a step one place up (-1) or down (+1) inside its own list. */
export function moveStep(steps: SequenceStep[], id: ID, by: -1 | 1): SequenceStep[] {
  const shift = (list: SequenceStep[]) => {
    const i = list.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };
  const top = shift(steps);
  if (top !== steps) return top;
  return steps.map((s) => (s.kind === "branch" ? { ...s, yes: shift(s.yes), no: shift(s.no) } : s));
}

export function canMove(steps: SequenceStep[], id: ID, by: -1 | 1): boolean {
  const lists = [steps, ...steps.flatMap((s) => (s.kind === "branch" ? [s.yes, s.no] : []))];
  for (const l of lists) {
    const i = l.findIndex((s) => s.id === id);
    if (i >= 0) return i + by >= 0 && i + by < l.length;
  }
  return false;
}

/** A fresh step of a kind, with the smallest sensible content. */
export function blankStep(kind: StepKind): SequenceStep {
  const id = newId("st");
  switch (kind) {
    case "wait":
      return { id, kind, minutes: 60 };
    case "text":
      return { id, kind, body: "" };
    case "email":
      return { id, kind, subject: "", body: "" };
    case "team":
      return { id, kind, to: "managers", body: "" };
    case "note":
      return { id, kind, body: "" };
    case "offer":
      return { id, kind, holdMinutes: 30 };
    case "app":
      return { id, kind, url: "" };
    case "branch":
      return { id, kind, condition: blankCondition("owes"), yes: [], no: [] };
  }
}

export function blankCondition(field: ConditionField): SequenceCondition {
  const meta = CONDITION_META[field];
  return { id: newId("if"), field, op: meta.type === "choice" ? "is" : "atLeast", value: meta.fallback };
}

export function blankStart(kind: StartKind): SequenceStart {
  const m = START_META[kind];
  return { kind, productIds: [], ...(m.span ? { minutes: m.span.fallback } : {}), ...(m.days ? { days: m.days.fallback } : {}), ...(m.amount ? { amount: m.amount.fallback } : {}) };
}

// ── Details that go into words ───────────────────────────────────────────────

export const CUSTOMER_DETAILS = ["firstName", "booking", "date", "time", "people", "owed", "venue", "link"] as const;
export const TEAM_DETAILS = ["venue", "item", "left", "amount", "staff", "customer", "booking"] as const;
export type DetailKey = (typeof CUSTOMER_DETAILS)[number] | (typeof TEAM_DETAILS)[number];

/** Details a step may use. A "tell the team" step in a customer sequence can
 *  name the customer and the booking; a customer never sees stock or cash. */
export function detailsFor(start: SequenceStart, kind: StepKind): DetailKey[] {
  const about = START_META[start.kind].about;
  if (about === "team") {
    if (start.kind === "stockLow") return ["venue", "item", "left"];
    if (start.kind === "cashShort") return ["venue", "amount", "staff"];
    return ["venue", "customer", "booking", "amount"];
  }
  if (kind === "team" || kind === "note") return ["customer", "booking", "date", "time", "people", "owed"];
  return [...CUSTOMER_DETAILS];
}

/** Words with their details filled in. An unknown `{detail}` stays as typed,
 *  so a mistake shows in the preview rather than in a customer's phone. */
export const fillWords = (words: string, values: Partial<Record<DetailKey, string>>): string =>
  words.replace(/\{(\w+)\}/g, (all, k: string) => values[k as DetailKey] ?? all);

/** Split words into plain runs and detail chips, for editors and previews. */
export function splitWords(words: string): { text: string; detail: DetailKey | null }[] {
  const out: { text: string; detail: DetailKey | null }[] = [];
  const known = new Set<string>([...CUSTOMER_DETAILS, ...TEAM_DETAILS]);
  let last = 0;
  for (const m of words.matchAll(/\{(\w+)\}/g)) {
    if (!known.has(m[1])) continue;
    if (m.index! > last) out.push({ text: words.slice(last, m.index), detail: null });
    out.push({ text: m[0], detail: m[1] as DetailKey });
    last = m.index! + m[0].length;
  }
  if (last < words.length) out.push({ text: words.slice(last), detail: null });
  return out;
}

/** How many text messages these words cost. Bangla and emoji make a text
 *  shorter (70 characters, then 67 a part); plain Latin gets 160, then 153. */
export function textParts(words: string): { chars: number; parts: number; perPart: number } {
  const chars = [...words].length;
  const plain = /^[\x00-\x7F£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§äöñüà€\s]*$/.test(words);
  const single = plain ? 160 : 70;
  const multi = plain ? 153 : 67;
  const parts = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, parts, perPart: chars <= single ? single : multi };
}

// ── What is still missing ────────────────────────────────────────────────────

export type ProblemCode =
  | "name"
  | "noSteps"
  | "tooManySteps"
  | "startSpan"
  | "startDays"
  | "startAmount"
  | "waitLength"
  | "textWords"
  | "emailSubject"
  | "emailWords"
  | "teamWords"
  | "noteWords"
  | "appAddress"
  | "branchEmpty"
  | "endsOnWait";

export interface SequenceProblem {
  /** "name", "start", or a step id. */
  where: "name" | "start" | ID;
  code: ProblemCode;
}

const isAddress = (url: string) => /^https:\/\/[^\s/]+\.[^\s/]+/.test(url.trim());

function stepProblems(s: SequenceStep): ProblemCode[] {
  switch (s.kind) {
    case "wait":
      return s.minutes >= 1 ? [] : ["waitLength"];
    case "text":
      return s.body.trim() ? [] : ["textWords"];
    case "email":
      return [...(s.subject.trim() ? [] : (["emailSubject"] as const)), ...(s.body.trim() ? [] : (["emailWords"] as const))];
    case "team":
      return s.body.trim() ? [] : ["teamWords"];
    case "note":
      return s.body.trim() ? [] : ["noteWords"];
    case "app":
      return isAddress(s.url) ? [] : ["appAddress"];
    case "offer":
      return [];
    case "branch":
      return s.yes.length + s.no.length > 0 ? [] : ["branchEmpty"];
  }
}

/** Everything that stops a sequence being switched on, in reading order. */
export function sequenceProblems(seq: SequenceInput): SequenceProblem[] {
  const out: SequenceProblem[] = [];
  if (!seq.name.trim()) out.push({ where: "name", code: "name" });
  const m = START_META[seq.start.kind];
  if (m.span && !((seq.start.minutes ?? 0) >= m.span.min)) out.push({ where: "start", code: "startSpan" });
  if (m.days && !((seq.start.days ?? 0) >= m.days.min)) out.push({ where: "start", code: "startDays" });
  if (m.amount && !((seq.start.amount ?? 0) > 0)) out.push({ where: "start", code: "startAmount" });
  if (seq.steps.length === 0) out.push({ where: "start", code: "noSteps" });
  const placed = placedSteps(seq.steps);
  if (placed.length > MAX_STEPS + 4) out.push({ where: "start", code: "tooManySteps" });
  for (const p of placed) for (const code of stepProblems(p.step)) out.push({ where: p.step.id, code });
  const last = seq.steps.at(-1);
  if (last?.kind === "wait") out.push({ where: last.id, code: "endsOnWait" });
  return out;
}

export const problemsAt = (problems: SequenceProblem[], where: string): ProblemCode[] => problems.filter((p) => p.where === where).map((p) => p.code);

/** What a list shows: on, off, or not finished (off and cannot be switched on). */
export type SequenceState = "on" | "off" | "unfinished";
export const stateOf = (seq: Sequence): SequenceState => (seq.status === "on" ? "on" : sequenceProblems(seq).length ? "unfinished" : "off");

// ── Sentences ────────────────────────────────────────────────────────────────

/** "45 min", "2 hr", "1 day", "1 day 2 hr". */
export function spanWords(t: SeqT, minutes: number): string {
  const d = Math.floor(minutes / DAY);
  const h = Math.floor((minutes % DAY) / 60);
  const m = Math.round(minutes % 60);
  const parts = [d ? t("span.day", { count: d }) : "", h ? t("span.hr", { count: h }) : "", m ? t("span.min", { count: m }) : ""].filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(" ") : t("span.min", { count: 0 });
}

/** "1 day before a visit" — what starts it, as the start of a sentence. */
export function startSentence(t: SeqT, start: SequenceStart): string {
  return t(`start.${start.kind}.sentence`, {
    span: spanWords(t, start.minutes ?? 0),
    days: start.days ?? 0,
    amount: formatMoney(start.amount ?? 0),
  });
}

/** "Every booking" · "Futsal" · "Futsal and 2 more". */
export function whichBookings(t: SeqT, start: SequenceStart, nameOf: (id: ID) => string | undefined): string {
  const names = start.productIds.map(nameOf).filter((n): n is string => !!n);
  if (names.length === 0) return t("which.every");
  if (names.length === 1) return names[0];
  return t("which.more", { name: names[0], count: names.length - 1 });
}

/** "Only if the group is 6 or more." With `lead: "iff"`: "If the group is 6 or more". */
export function conditionSentence(t: SeqT, c: SequenceCondition, lead: "onlyIf" | "iff" = "onlyIf"): string {
  const type = CONDITION_META[c.field].type;
  if (type === "choice") return t(`${lead}.${c.field}.${String(c.value)}`);
  const value = type === "money" ? formatMoney(Number(c.value)) : String(c.value);
  return t(`${lead}.${c.field}.${c.op === "atMost" ? "atMost" : "atLeast"}`, { value });
}

/** The step's one line on its card: the kind, and what it holds. */
export function stepTitle(t: SeqT, s: SequenceStep): string {
  if (s.kind === "wait") return t("step.wait.titleFor", { span: spanWords(t, s.minutes) });
  if (s.kind === "branch") return conditionSentence(t, s.condition, "iff");
  if (s.kind === "team") return t("step.team.titleFor", { who: t(`team.${s.to}`) });
  if (s.kind === "offer") return t("step.offer.titleFor", { span: spanWords(t, s.holdMinutes) });
  return t(`step.${s.kind}.name`);
}

/** The whole sequence as one sentence: "1 day before a visit, text the customer." */
export function sequenceSentence(t: SeqT, seq: Pick<Sequence, "start" | "steps">): string {
  const first = seq.steps.find((s) => s.kind !== "wait") ?? seq.steps[0];
  const start = startSentence(t, seq.start);
  if (!first) return t("sentence.startOnly", { start });
  const then = first.kind === "wait" ? t("then.wait", { span: spanWords(t, first.minutes) }) : first.kind === "branch" ? t("then.branch") : t(`then.${first.kind}`);
  const more = countSteps(seq.steps) - (first.kind === "wait" || first.kind === "branch" ? 0 : 1);
  return more > 0 ? t("sentence.more", { start, then, count: more }) : t("sentence.whole", { start, then });
}

// ── Playing a sequence for one booking ───────────────────────────────────────

/** One booking (or one thing, for team sequences) a sequence can work on. */
export interface SequenceSample {
  id: ID;
  /** Full name, and the first word of it. */
  name: string;
  firstName: string;
  customerId: ID | null;
  orderId: ID | null;
  orderRef: string | null;
  productId: ID | null;
  booking: string;
  /** When the visit starts. */
  visitAt: ISODateTime;
  people: number;
  total: Minor;
  owed: Minor;
  where: "online" | "counter";
  visits: number;
  /** Has somewhere to send a text / an email. */
  hasPhone: boolean;
  hasEmail: boolean;
  /** Said yes to texts / emails (marketing consent). */
  canText: boolean;
  canEmail: boolean;
  cancelled: boolean;
  /** Details only this sample knows ({item}, {left}, {staff}…), for team sequences. */
  details?: Partial<Record<DetailKey, string>>;
}

export type SkipReason = "noPhone" | "noEmail" | "noTextYes" | "noEmailYes" | "cancelled" | "switchedOff" | "sendFailed";

/** One line of what a sequence does for one booking. */
export interface WalkRow {
  stepId: ID;
  kind: StepKind;
  /** When this step happens. For a wait: when the wait ends. */
  at: Date;
  /** Minutes since the sequence started. */
  after: number;
  /** The words as the reader gets them (text, email, team, note). */
  words?: string;
  subject?: string;
  /** A message held back to 9 AM by quiet hours. */
  held?: boolean;
  skipped?: SkipReason;
  /** For an "if": which side was taken. */
  took?: "yes" | "no";
  side: "yes" | "no" | null;
}

export interface Walk {
  /** When the sequence starts for this booking. */
  startAt: Date;
  /** The first "only if" line that is not true — the sequence does not start. */
  blockedBy: SequenceCondition | null;
  rows: WalkRow[];
}

const DHAKA = 6 * 60;
/** Hour of the day in Dhaka (UTC+6, no daylight saving). */
const dhakaHour = (d: Date) => Math.floor((((d.getTime() / 60000 + DHAKA) % DAY) + DAY) % DAY / 60);
const dhakaDay = (d: Date) => new Date(d.getTime() + DHAKA * 60000).getUTCDay();

/** The next 9 AM in Dhaka at or after `d`, if `d` falls in quiet hours. */
export function afterQuietHours(d: Date): Date {
  const h = dhakaHour(d);
  if (h >= QUIET_TO && h < QUIET_FROM) return d;
  const mins = ((d.getTime() / 60000 + DHAKA) % DAY + DAY) % DAY;
  const until = h >= QUIET_FROM ? DAY - mins + QUIET_TO * 60 : QUIET_TO * 60 - mins;
  return new Date(d.getTime() + until * 60000);
}

export function conditionHolds(c: SequenceCondition, s: SequenceSample): boolean {
  const n = Number(c.value);
  const cmp = (x: number) => (c.op === "atMost" ? x <= n : x >= n);
  switch (c.field) {
    case "people":
      return cmp(s.people);
    case "total":
      return cmp(s.total);
    case "visits":
      return cmp(s.visits);
    case "where":
      return s.where === c.value;
    case "owes":
      return (s.owed > 0) === (c.value === "yes");
    case "day": {
      const day = dhakaDay(new Date(s.visitAt));
      // The weekend in Bangladesh is Friday and Saturday.
      const weekend = day === 5 || day === 6;
      return weekend === (c.value === "weekend");
    }
  }
}

/** When a sequence starts for this booking. Starts that are "when X happens"
 *  begin at `now`: there is no better moment to show. */
export function startMoment(start: SequenceStart, sample: SequenceSample, now: Date): Date {
  const visit = new Date(sample.visitAt).getTime();
  const mins = (start.minutes ?? 0) * 60000;
  if (start.kind === "beforeVisit" || start.kind === "balanceOwed") return new Date(visit - mins);
  if (start.kind === "afterVisit") return new Date(visit + mins);
  return now;
}

export interface WalkOptions {
  /** Venue name, for the {venue} detail. */
  venue: string;
  /** Format a date and a time the way the app does (the caller owns locale). */
  day: (d: Date) => string;
  clock: (d: Date) => string;
  /** Extra details for team sequences ({item}, {left}, {amount}, {staff}). */
  extra?: Partial<Record<DetailKey, string>>;
  /** Start at this moment instead of the one the start implies. */
  startAt?: Date;
}

/**
 * Play a sequence for one booking: every step, in order, with its moment and
 * its words. Nothing is sent and nothing is stored — "Try it" shows the result,
 * and the seed turns it into a run by comparing each moment with the clock.
 */
export function walkSequence(seq: Pick<Sequence, "start" | "onlyIf" | "steps" | "quietHours">, sample: SequenceSample, now: Date, opts: WalkOptions): Walk {
  const startAt = opts.startAt ?? startMoment(seq.start, sample, now);
  const blockedBy = seq.onlyIf.find((c) => !conditionHolds(c, sample)) ?? null;
  const visit = new Date(sample.visitAt);
  const values: Partial<Record<DetailKey, string>> = {
    firstName: sample.firstName,
    customer: sample.name,
    booking: sample.booking,
    date: opts.day(visit),
    time: opts.clock(visit),
    people: String(sample.people),
    owed: formatMoney(sample.owed),
    amount: formatMoney(sample.owed || sample.total),
    venue: opts.venue,
    link: "cfoil.link/t/4KQ2",
    ...sample.details,
    ...opts.extra,
  };
  const rows: WalkRow[] = [];
  let cursor = startAt.getTime();
  const play = (steps: SequenceStep[], side: "yes" | "no" | null) => {
    for (const s of steps) {
      const base = { stepId: s.id, kind: s.kind, side } as const;
      const after = () => Math.round((cursor - startAt.getTime()) / 60000);
      if (s.kind === "wait") {
        cursor += s.minutes * 60000;
        rows.push({ ...base, at: new Date(cursor), after: after() });
        continue;
      }
      if (s.kind === "branch") {
        const took = conditionHolds(s.condition, sample) ? "yes" : "no";
        rows.push({ ...base, at: new Date(cursor), after: after(), took });
        play(took === "yes" ? s.yes : s.no, took);
        continue;
      }
      let at = new Date(cursor);
      let held = false;
      const toCustomer = s.kind === "text" || s.kind === "email";
      if (toCustomer && seq.quietHours) {
        const moved = afterQuietHours(at);
        held = moved.getTime() !== at.getTime();
        at = moved;
        cursor = at.getTime();
      }
      const yes = needsYes(seq.start);
      const skipped: SkipReason | undefined =
        s.kind === "text" ? (!sample.hasPhone ? "noPhone" : yes && !sample.canText ? "noTextYes" : undefined) : s.kind === "email" ? (!sample.hasEmail ? "noEmail" : yes && !sample.canEmail ? "noEmailYes" : undefined) : undefined;
      const words = "body" in s ? fillWords(s.body, values) : undefined;
      rows.push({ ...base, at, after: after(), words, ...(s.kind === "email" ? { subject: fillWords(s.subject, values) } : {}), ...(held ? { held } : {}), ...(skipped ? { skipped } : {}) });
    }
  };
  if (!blockedBy) play(seq.steps, null);
  return { startAt, blockedBy, rows };
}

/** Minutes from the start to each step, with no booking in hand (quiet hours
 *  cannot be known without a date). For the "after 1 day 2 hr" notes on the spine. */
export function elapsedByStep(steps: SequenceStep[]): Record<ID, number> {
  const out: Record<ID, number> = {};
  const play = (list: SequenceStep[], from: number): number => {
    let at = from;
    for (const s of list) {
      if (s.kind === "wait") at += s.minutes;
      out[s.id] = at;
      if (s.kind === "branch") at = Math.max(play(s.yes, at), play(s.no, at));
    }
    return at;
  };
  play(steps, 0);
  return out;
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export type RunStatus = "working" | "done" | "stopped" | "problem";
export type RunStepStatus = "done" | "waiting" | "next" | "skipped" | "failed";

export interface RunStep {
  stepId: ID;
  kind: StepKind;
  status: RunStepStatus;
  /** When it happened, or when it is due. */
  at: ISODateTime;
  words?: string;
  subject?: string;
  held?: boolean;
  reason?: SkipReason;
  took?: "yes" | "no";
  side: "yes" | "no" | null;
}

/** One sequence working for one customer (or one thing, for team sequences). */
export interface SequenceRun {
  id: ID;
  sequenceId: ID;
  /** Snapshot: renaming a sequence does not rewrite its history. */
  sequenceName: string;
  status: RunStatus;
  startedAt: ISODateTime;
  /** The last moment anything happened in it — what the outbox sorts by. */
  touchedAt: ISODateTime;
  who: { name: string; customerId: ID | null; orderId: ID | null; orderRef: string | null; booking: string };
  steps: RunStep[];
  /** Why it stopped, when it did. */
  stopped?: StopRule | "switchedOff";
}

/** Turn a walk into a run as it stands at `now`: past steps are done (or
 *  skipped, or failed), the first future one is waiting, the rest are next. */
export function runFromWalk(walk: Walk, now: Date, failAt?: ID): { steps: RunStep[]; status: RunStatus; touchedAt: Date } {
  const steps: RunStep[] = [];
  let waiting = false;
  let failed = false;
  let touched = walk.startAt;
  for (const r of walk.rows) {
    const past = r.at.getTime() <= now.getTime();
    let status: RunStepStatus;
    if (failed || waiting) status = "next";
    else if (!past) {
      status = "waiting";
      waiting = true;
    } else if (r.stepId === failAt) {
      status = "failed";
      failed = true;
    } else status = r.skipped ? "skipped" : "done";
    if (past && !waiting && status !== "next") touched = r.at;
    steps.push({
      stepId: r.stepId,
      kind: r.kind,
      status,
      at: r.at.toISOString(),
      side: r.side,
      ...(r.words !== undefined ? { words: r.words } : {}),
      ...(r.subject !== undefined ? { subject: r.subject } : {}),
      ...(r.held ? { held: true } : {}),
      ...(status === "skipped" && r.skipped ? { reason: r.skipped } : {}),
      ...(status === "failed" ? { reason: "sendFailed" as const } : {}),
      ...(r.took ? { took: r.took } : {}),
    });
  }
  return { steps, status: failed ? "problem" : waiting ? "working" : "done", touchedAt: touched };
}

/** The step a run is on now: the one waiting or failed, else the last done. */
export function currentStep(run: SequenceRun): RunStep | null {
  return run.steps.find((s) => s.status === "failed" || s.status === "waiting") ?? run.steps.filter((s) => s.status === "done" || s.status === "skipped").at(-1) ?? null;
}

/** Messages a run really sent (texts and emails that are done). */
export const sentIn = (run: SequenceRun): number => run.steps.filter((s) => s.status === "done" && (s.kind === "text" || s.kind === "email")).length;

// ── Ideas ────────────────────────────────────────────────────────────────────

export const IDEA_GROUPS = ["before", "after", "changes", "team"] as const;
export type IdeaGroup = (typeof IDEA_GROUPS)[number];

/** A ready-made sequence. Its words come from messages (`ideas.<id>.*`), so an
 *  idea opens in the operator's language. */
export interface SequenceIdea {
  id: string;
  group: IdeaGroup;
  /** Builds the draft. `w(key)` reads `ideas.<id>.<key>` from messages. */
  build: (w: (key: string) => string) => Omit<SequenceInput, "name">;
}

const st = <K extends StepKind>(kind: K, rest: Omit<Extract<SequenceStep, { kind: K }>, "id" | "kind">) => ({ id: newId("st"), kind, ...rest }) as Extract<SequenceStep, { kind: K }>;
const iff = (field: ConditionField, op: ConditionOp, value: number | string): SequenceCondition => ({ id: newId("if"), field, op, value });

export const SEQUENCE_IDEAS: readonly SequenceIdea[] = [
  {
    id: "reminder",
    group: "before",
    build: (w) => ({ start: { kind: "beforeVisit", minutes: DAY, productIds: [] }, onlyIf: [], steps: [st("text", { body: w("text") })], stopIf: ["cancelled"], quietHours: true, ideaId: "reminder" }),
  },
  {
    id: "confirm",
    group: "before",
    build: (w) => ({ start: { kind: "booked", productIds: [] }, onlyIf: [iff("where", "is", "online")], steps: [st("email", { subject: w("subject"), body: w("email") })], stopIf: [], quietHours: false, ideaId: "confirm" }),
  },
  {
    id: "balance",
    group: "before",
    build: (w) => ({
      start: { kind: "balanceOwed", minutes: 2 * DAY, productIds: [] },
      onlyIf: [],
      steps: [st("text", { body: w("text") }), st("wait", { minutes: DAY }), st("branch", { condition: iff("owes", "is", "yes"), yes: [st("team", { to: "managers", body: w("team") })], no: [] })],
      stopIf: ["cancelled", "paid"],
      quietHours: true,
      ideaId: "balance",
    }),
  },
  {
    id: "bigGroup",
    group: "before",
    build: (w) => ({ start: { kind: "booked", productIds: [] }, onlyIf: [iff("people", "atLeast", 10)], steps: [st("team", { to: "managers", body: w("team") })], stopIf: [], quietHours: false, ideaId: "bigGroup" }),
  },
  {
    id: "review",
    group: "after",
    build: (w) => ({ start: { kind: "afterVisit", minutes: 180, productIds: [] }, onlyIf: [], steps: [st("text", { body: w("text") })], stopIf: [], quietHours: true, ideaId: "review" }),
  },
  {
    id: "thanks",
    group: "after",
    build: (w) => ({ start: { kind: "afterVisit", minutes: DAY, productIds: [] }, onlyIf: [iff("visits", "atLeast", 3)], steps: [st("text", { body: w("text") }), st("note", { body: w("note") })], stopIf: [], quietHours: true, ideaId: "thanks" }),
  },
  {
    id: "comeBack",
    group: "after",
    build: (w) => ({ start: { kind: "notBack", days: 60, productIds: [] }, onlyIf: [], steps: [st("text", { body: w("text") })], stopIf: [], quietHours: true, ideaId: "comeBack" }),
  },
  {
    id: "noShow",
    group: "changes",
    build: (w) => ({
      start: { kind: "noShow", productIds: [] },
      onlyIf: [],
      steps: [st("wait", { minutes: 60 }), st("text", { body: w("text") }), st("branch", { condition: iff("visits", "atLeast", 3), yes: [], no: [st("note", { body: w("note") })] })],
      stopIf: [],
      quietHours: true,
      ideaId: "noShow",
    }),
  },
  {
    id: "waitlist",
    group: "changes",
    build: (w) => ({ start: { kind: "placeOpens", productIds: [] }, onlyIf: [], steps: [st("offer", { holdMinutes: 30 }), st("team", { to: "onShift", body: w("team") })], stopIf: [], quietHours: false, ideaId: "waitlist" }),
  },
  {
    id: "sorry",
    group: "changes",
    build: (w) => ({ start: { kind: "cancelled", productIds: [] }, onlyIf: [], steps: [st("text", { body: w("text") })], stopIf: [], quietHours: true, ideaId: "sorry" }),
  },
  {
    id: "stock",
    group: "team",
    build: (w) => ({ start: { kind: "stockLow", productIds: [] }, onlyIf: [], steps: [st("team", { to: "managers", body: w("team") })], stopIf: [], quietHours: false, ideaId: "stock" }),
  },
  {
    id: "cash",
    group: "team",
    build: (w) => ({ start: { kind: "cashShort", amount: 50000, productIds: [] }, onlyIf: [], steps: [st("team", { to: "managers", body: w("team") })], stopIf: [], quietHours: false, ideaId: "cash" }),
  },
  {
    id: "refund",
    group: "team",
    build: (w) => ({ start: { kind: "refundAsked", productIds: [] }, onlyIf: [], steps: [st("team", { to: "managers", body: w("team") }), st("wait", { minutes: 240 }), st("team", { to: "everyone", body: w("teamAgain") })], stopIf: [], quietHours: false, ideaId: "refund" }),
  },
];

/** An idea as a draft, named and worded in the reader's language. */
export function ideaDraft(t: SeqT, id: string): SequenceInput | null {
  const idea = SEQUENCE_IDEAS.find((i) => i.id === id);
  if (!idea) return null;
  const words = (key: string) => (t.raw ? String(t.raw(`ideas.${id}.${key}`)) : t(`ideas.${id}.${key}`));
  return { name: t(`ideas.${id}.name`), ...idea.build(words) };
}

/** An empty sequence, for "Start with nothing". */
export const emptyDraft = (): SequenceInput => ({ name: "", start: blankStart("beforeVisit"), onlyIf: [], steps: [], stopIf: [], quietHours: true, ideaId: null });
