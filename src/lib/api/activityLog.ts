/*
 * STORY - the activity log's types, and the part of it that is written live.
 *
 * Kept apart from activity.ts (which READS the log) for one reason: the places
 * that write to it - a till's PIN pad, the gate, device pairing - live inside
 * modules that activity.ts itself reads from. Two modules that import each
 * other work only until one of them uses the other at load time; a small
 * module with no api imports of its own cannot get into that state.
 *
 * Everything here is language-neutral on purpose. An event stores WHAT happened
 * (a kind, a subject, a few facts) and never a sentence: the back office speaks
 * two languages and a stored English phrase would read as English on a Bangla
 * screen for ever. The screen turns kind + facts into words.
 */
import { demoNow } from "@/lib/schedule";
import type { ID, ISODateTime } from "./types";

/** The six groups the Type filter offers. */
export type ActivityGroup = "sessions" | "gate" | "sales" | "bookings" | "devices" | "settings";
export const ACTIVITY_GROUPS: ActivityGroup[] = ["sessions", "gate", "sales", "bookings", "devices", "settings"];

export type ActivityKind =
  | "staff.signed_in"
  | "staff.signed_out"
  | "staff.wrong_pin"
  | "staff.locked_out"
  | "shift.opened"
  | "shift.closed"
  | "ticket.admitted"
  | "ticket.refused"
  | "ticket.reissued"
  | "ticket.terminated"
  | "refund.requested"
  | "refund.approved"
  | "refund.declined"
  | "order.refunded"
  | "order.undone"
  | "order.discount_over_limit"
  | "booking.moved"
  | "hold.placed"
  | "hold.released"
  | "device.paired"
  | "device.off"
  | "settings.changed"
  | "team.invited";

export const GROUP_OF: Record<ActivityKind, ActivityGroup> = {
  "staff.signed_in": "sessions",
  "staff.signed_out": "sessions",
  "staff.wrong_pin": "sessions",
  "staff.locked_out": "sessions",
  "shift.opened": "sessions",
  "shift.closed": "sessions",
  "ticket.admitted": "gate",
  "ticket.refused": "gate",
  "ticket.reissued": "gate",
  "ticket.terminated": "gate",
  "refund.requested": "sales",
  "refund.approved": "sales",
  "refund.declined": "sales",
  "order.refunded": "sales",
  "order.undone": "sales",
  "order.discount_over_limit": "sales",
  "booking.moved": "bookings",
  "hold.placed": "bookings",
  "hold.released": "bookings",
  "device.paired": "devices",
  "device.off": "devices",
  "settings.changed": "settings",
  "team.invited": "settings",
};
export const ACTIVITY_KINDS: ActivityKind[] = Object.keys(GROUP_OF) as ActivityKind[];

/** How loudly an event should be read. Words and a glyph carry it on screen,
 *  never the tint alone. */
export type ActivitySeverity = "info" | "warning" | "critical";

export const DEFAULT_SEVERITY: Record<ActivityKind, ActivitySeverity> = {
  "staff.signed_in": "info",
  "staff.signed_out": "info",
  "staff.wrong_pin": "warning",
  "staff.locked_out": "critical",
  "shift.opened": "info",
  "shift.closed": "info",
  "ticket.admitted": "info",
  "ticket.refused": "warning",
  "ticket.reissued": "info",
  "ticket.terminated": "warning",
  "refund.requested": "info",
  "refund.approved": "info",
  "refund.declined": "warning",
  "order.refunded": "info",
  "order.undone": "info",
  "order.discount_over_limit": "warning",
  "booking.moved": "info",
  "hold.placed": "info",
  "hold.released": "info",
  "device.paired": "info",
  "device.off": "warning",
  "settings.changed": "info",
  "team.invited": "info",
};

/** Who did it. `null` on an event means the system itself. */
export interface ActivityActor {
  /** Null for someone with no staff record (a guest on a till, an old name). */
  staffId: ID | null;
  name: string;
}

export type ActivitySubjectType = "order" | "ticket" | "customer" | "device" | "booking" | "hold" | "staff" | "setting" | "shift" | "counter";

/** The thing it was done to: a label to read and, where the thing has a page,
 *  a link to it. */
export interface ActivitySubject {
  type: ActivitySubjectType;
  id: ID;
  label: string;
  href: string | null;
}

/** The facts a sentence needs (an amount, a code, before and after). Numbers
 *  are money in minor units where the key says so. */
export type ActivityData = Record<string, string | number | null>;

export interface ActivityEvent {
  id: string;
  at: ISODateTime;
  kind: ActivityKind;
  group: ActivityGroup;
  severity: ActivitySeverity;
  actor: ActivityActor | null;
  locationId: ID | null;
  /** Names, resolved when the log is read - so a renamed counter reads right. */
  venue: string | null;
  counter: string | null;
  device: string | null;
  subject: ActivitySubject | null;
  data: ActivityData;
}

/* -- the live part --------------------------------------------------------- */

/** An event as stored: ids for where, names resolved on read. */
export type RawActivity = Omit<ActivityEvent, "group" | "venue" | "counter" | "device"> & {
  counterId: ID | null;
  deviceId: ID | null;
  /** The id of a derived event this one supersedes, so the same thing is not
   *  listed twice (a pairing is both a device's `pairedAt` and a live event). */
  replaces?: string;
};

export interface ActivityInput {
  kind: ActivityKind;
  severity?: ActivitySeverity;
  actor?: ActivityActor | null;
  locationId?: ID | null;
  counterId?: ID | null;
  deviceId?: ID | null;
  subject?: ActivitySubject | null;
  data?: ActivityData;
  at?: ISODateTime;
  replaces?: string;
}

const recorded: RawActivity[] = [];
let seq = 0;
const BOOT_MS = Date.now();

/** The demo clock, moving: noon on the demo's today plus the time this session
 *  has been open. Live events land after every seeded one, in the order they
 *  happened, and never depend on the wall-clock date. */
export const activityNow = (): Date => new Date(demoNow().getTime() + (Date.now() - BOOT_MS));

/**
 * A record written live carries the browser's wall-clock time (a hold's
 * `createdAt`, a refund request's `requestedAt`), while the demo's day is
 * pinned to July. Left alone, the first hold placed this session would be dated
 * months after everything else and the log would put it under a day nobody is
 * on. So a timestamp from this session - at or after the moment this module
 * loaded - is moved onto the demo's moving clock; anything older is a seeded
 * record and is left exactly as it is.
 */
export function onDemoClock(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms < BOOT_MS - 1000) return iso;
  return new Date(demoNow().getTime() + Math.max(0, ms - BOOT_MS)).toISOString();
}

/**
 * Write one thing down. Synchronous and cheap, so a till can call it in the
 * middle of a press without waiting; it never throws and never blocks the
 * action it describes.
 */
export function recordActivity(input: ActivityInput): void {
  try {
    seq += 1;
    recorded.push({
      id: `live:${seq}`,
      at: input.at ?? activityNow().toISOString(),
      kind: input.kind,
      severity: input.severity ?? DEFAULT_SEVERITY[input.kind],
      actor: input.actor ?? null,
      locationId: input.locationId ?? null,
      counterId: input.counterId ?? null,
      deviceId: input.deviceId ?? null,
      subject: input.subject ?? null,
      data: input.data ?? {},
      ...(input.replaces ? { replaces: input.replaces } : {}),
    });
  } catch {
    /* A log must never break the action it is describing. */
  }
}

export const peekRecordedActivity = (): RawActivity[] => recorded;
