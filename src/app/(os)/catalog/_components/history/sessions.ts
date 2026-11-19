/*
 * History, as a person reads it (docs/catalog-history.md).
 *
 * The log is faithful and raw: one revision per save. Reading it that way makes
 * one sitting at the keyboard look like a dozen actions, so the grouping lives
 * here, in the client, as the contract says. Pure functions only: no React, no
 * messages. The component words and formats what these return.
 */
import { canRevert, type CatalogActor, type CatalogArea, type CatalogFieldChange, type CatalogRevision, type CatalogValue } from "@/lib/api";

/** Saves by the same person closer together than this are one sitting. */
export const SESSION_GAP_MS = 15 * 60_000;

export type SessionKind =
  /** One or more saves by one person, as their net change. */
  | "edit"
  /** A status-only save or an archive: going live, off sale, archived. */
  | "milestone"
  /** The booking was made. Always the last item. */
  | "created"
  /** An undo, filed by Undo itself. */
  | "revert";

export type Milestone = "on" | "off" | "archived";

export interface Session {
  /** The newest revision's id: stable across a reload. */
  id: string;
  kind: SessionKind;
  /** When it ended: the newest save in it. */
  at: string;
  /** When it began: the oldest save in it. */
  from: string;
  actor: CatalogActor | null;
  revisions: CatalogRevision[];
  /** What is different once the sitting is over: first before, last after. */
  net: CatalogFieldChange[];
  /** Changed and changed back: nothing is different afterwards. */
  zero: CatalogFieldChange[];
  milestone?: Milestone;
  /** For a revert: when the changes it undid were made. */
  revertOf?: string;
}

const key = (c: CatalogFieldChange) => `${c.field}|${c.subject?.id ?? ""}`;
const same = (a: CatalogValue, b: CatalogValue) => JSON.stringify(a) === JSON.stringify(b);

/** Net change per (field, subject): the first before and the last after. */
export function netChanges(revisions: CatalogRevision[]): { net: CatalogFieldChange[]; zero: CatalogFieldChange[] } {
  const chronological = [...revisions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const byKey = new Map<string, CatalogFieldChange>();
  /* A ticket is named as it ends the sitting, so "changed the price of
     Foreigners" never names it by a name it no longer has. */
  const names = new Map<string, string>();
  for (const r of chronological) {
    for (const c of r.changes) {
      if (c.subject) {
        names.set(c.subject.id, c.subject.name);
        if (c.field === "tier.name" && c.after?.type === "text") names.set(c.subject.id, c.after.value);
      }
      const k = key(c);
      const was = byKey.get(k);
      byKey.set(k, was ? { ...was, after: c.after } : { ...c });
    }
  }
  const net: CatalogFieldChange[] = [];
  const zero: CatalogFieldChange[] = [];
  for (const c of byKey.values()) {
    const named = c.subject ? { ...c, subject: { ...c.subject, name: names.get(c.subject.id) ?? c.subject.name } } : c;
    (same(c.before, c.after) ? zero : net).push(named);
  }
  /* A ticket added and removed in one sitting never existed as far as the
     reader is concerned. */
  const added = new Set(net.filter((c) => c.field === "tier.added").map((c) => c.subject?.id));
  const gone = new Set(net.filter((c) => c.field === "tier.removed").map((c) => c.subject?.id));
  const dropped = new Set([...added].filter((id) => gone.has(id)));
  return { net: net.filter((c) => !(c.subject && dropped.has(c.subject.id) && (c.field === "tier.added" || c.field === "tier.removed"))), zero };
}

const statusOnly = (r: CatalogRevision) => r.changes.length > 0 && r.changes.every((c) => c.field === "status");

function milestoneOf(net: CatalogFieldChange[], archived: boolean): Milestone {
  if (archived) return "archived";
  const s = net.find((c) => c.field === "status")?.after;
  if (s?.type === "status") return s.value === "active" ? "on" : s.value === "archived" ? "archived" : "off";
  return "off";
}

/** A revision may join the sitting before it only if it is an ordinary edit by
 *  someone on record and says more than a status change. */
const mergeable = (r: CatalogRevision) => r.kind === "edited" && r.actor !== null && r.changes.length > 0 && !statusOnly(r);

/** Newest first, as given, in: sessions, newest first, out. */
export function buildSessions(revisions: CatalogRevision[]): Session[] {
  const chronological = [...revisions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const out: Session[] = [];
  let open: CatalogRevision[] = [];
  const close = () => {
    if (open.length === 0) return;
    const { net, zero } = netChanges(open);
    const last = open[open.length - 1];
    out.push({ id: last.id, kind: "edit", at: last.at, from: open[0].at, actor: last.actor, revisions: open, net, zero });
    open = [];
  };
  for (const r of chronological) {
    if (mergeable(r)) {
      const prev = open[open.length - 1];
      if (prev && prev.actor?.id === r.actor?.id && Date.parse(r.at) - Date.parse(prev.at) < SESSION_GAP_MS) {
        open.push(r);
        continue;
      }
      close();
      open = [r];
      continue;
    }
    close();
    const { net, zero } = netChanges([r]);
    if (r.kind === "created") out.push({ id: r.id, kind: "created", at: r.at, from: r.at, actor: r.actor, revisions: [r], net: [], zero: [] });
    else if (r.kind === "reverted") out.push({ id: r.id, kind: "revert", at: r.at, from: r.at, actor: r.actor, revisions: [r], net, zero, revertOf: r.revertOf });
    else if (r.kind === "archived" || statusOnly(r)) out.push({ id: r.id, kind: "milestone", at: r.at, from: r.at, actor: r.actor, revisions: [r], net, zero, milestone: milestoneOf(net, r.kind === "archived") });
    else out.push({ id: r.id, kind: "edit", at: r.at, from: r.at, actor: r.actor, revisions: [r], net, zero });
  }
  close();
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.kind === "created" ? 1 : b.kind === "created" ? -1 : 0));
}

// ── Filtering ──────────────────────────────────────────────────────────────

export type AreaFilter = "all" | CatalogArea;

/** Keep what matches. With an area chosen, a sitting shows only the changes in
 *  that area (so its sentence and counts follow the filter); with a person
 *  chosen, only their sittings. The creation shows only unfiltered by area. */
export function filterSessions(sessions: Session[], area: AreaFilter, actorId: string): Session[] {
  const out: Session[] = [];
  for (const s of sessions) {
    if (actorId && s.actor?.id !== actorId) continue;
    if (area === "all") {
      out.push(s);
      continue;
    }
    if (s.kind === "created") continue;
    const net = s.net.filter((c) => c.area === area);
    const zero = s.zero.filter((c) => c.area === area);
    if (net.length === 0 && zero.length === 0) continue;
    out.push({ ...s, net, zero });
  }
  return out;
}

/** Everyone who appears in the history, in order of first appearance. */
export function actorsOf(sessions: Session[]): CatalogActor[] {
  const seen = new Map<string, CatalogActor>();
  for (const s of sessions) if (s.actor && !seen.has(s.actor.id)) seen.set(s.actor.id, s.actor);
  return [...seen.values()];
}

export function areasOf(s: Session): CatalogArea[] {
  const order: CatalogArea[] = ["status", "prices", "details", "rules", "where", "payment"];
  const present = new Set([...s.net, ...s.zero].map((c) => c.area));
  return order.filter((a) => present.has(a));
}

// ── Days ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd in the reader's zone. */
export function dayOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface DayGroup {
  day: string;
  sessions: Session[];
}

/** Newest first in, newest first out. */
export function groupByDay(sessions: Session[]): DayGroup[] {
  const out: DayGroup[] = [];
  for (const s of sessions) {
    const day = dayOf(s.at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.sessions.push(s);
    else out.push({ day, sessions: [s] });
  }
  return out;
}

// ── The sentence ───────────────────────────────────────────────────────────

export type Headline =
  | { type: "price"; change: CatalogFieldChange }
  | { type: "rename"; change: CatalogFieldChange }
  | { type: "field"; change: CatalogFieldChange }
  | { type: "tierOn" | "tierOff" | "tierAdded" | "tierRemoved"; change: CatalogFieldChange }
  | { type: "statusOn" | "statusOff" | "archived" }
  | { type: "several"; count: number }
  | { type: "revert" }
  | { type: "netZero" };

export function headlineOf(s: Session): Headline {
  if (s.kind === "revert") return { type: "revert" };
  if (s.kind === "milestone") return { type: s.milestone === "on" ? "statusOn" : s.milestone === "archived" ? "archived" : "statusOff" };
  if (s.net.length === 0) return { type: "netZero" };
  if (s.net.length > 1) return { type: "several", count: s.net.length };
  const c = s.net[0];
  switch (c.field) {
    case "tier.price": return { type: "price", change: c };
    case "tier.name": return { type: "rename", change: c };
    case "tier.added": return { type: "tierAdded", change: c };
    case "tier.removed": return { type: "tierRemoved", change: c };
    case "tier.onSale": return { type: c.after?.type === "bool" && c.after.value ? "tierOn" : "tierOff", change: c };
    case "status": {
      const v = c.after;
      return { type: v?.type === "status" && v.value === "active" ? "statusOn" : v?.type === "status" && v.value === "archived" ? "archived" : "statusOff" };
    }
    default: return { type: "field", change: c };
  }
}

// ── The rail ───────────────────────────────────────────────────────────────

export interface Stats {
  changes: number;
  people: CatalogActor[];
  /** The newest item that is not the creation. */
  last: Session | null;
}

export function statsOf(sessions: Session[]): Stats {
  let changes = 0;
  const people = new Map<string, CatalogActor>();
  let last: Session | null = null;
  for (const s of sessions) {
    if (s.actor) people.set(s.actor.id, s.actor);
    if (s.kind === "created") continue;
    changes += Math.max(1, s.net.length);
    if (!last) last = s;
  }
  return { changes, people: [...people.values()], last };
}

/** Since when the booking has been in the state it is in now: the newest
 *  status change that left it there, else when it was made. */
export function inStateSince(sessions: Session[], status: string): string | null {
  for (const s of sessions) {
    const c = s.net.find((x) => x.field === "status");
    if (c?.after?.type === "status" && c.after.value === status) return s.at;
  }
  return sessions.find((s) => s.kind === "created")?.at ?? null;
}

// ── Undo ───────────────────────────────────────────────────────────────────

export interface UndoRow {
  change: CatalogFieldChange;
  /** What it is now: the latest value the history knows of. */
  current: CatalogValue;
  /** Has changed again since this sitting. */
  again: boolean;
}

export interface UndoPreview {
  rows: UndoRow[];
  /** Cannot be put back from here. */
  notUndone: CatalogFieldChange[];
}

/** What undoing a session would do, against everything saved after it. */
export function previewUndo(session: Session, all: CatalogRevision[]): UndoPreview {
  const later = [...all].filter((r) => Date.parse(r.at) > Date.parse(session.at)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const rows: UndoRow[] = [];
  const notUndone: CatalogFieldChange[] = [];
  for (const c of session.net) {
    if (!canRevert(c)) {
      notUndone.push(c);
      continue;
    }
    let current = c.after;
    let again = false;
    let removed = false;
    for (const r of later) {
      for (const x of r.changes) {
        if (x.subject && c.subject && x.subject.id === c.subject.id && x.field === "tier.removed") removed = true;
        if (key(x) === key(c)) {
          current = x.after;
          again = true;
        }
      }
    }
    if (removed) notUndone.push(c);
    else if (!same(current, c.before)) rows.push({ change: c, current, again });
  }
  return { rows, notUndone };
}
