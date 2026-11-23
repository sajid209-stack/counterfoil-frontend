/* ── Booking a span drawn on a board ───────────────────────────────────────
 *
 * The pure half of the quick-create panel. `optionsInRange` says what can be
 * sold inside a drawn span; this says what the CHOSEN option still has to ask
 * (how long, which lane, who) and turns the answers into a `Draft` that
 * `resolveDraft` prices exactly as the till would.
 *
 * Nothing here renders. The OS calendar's panel keeps its own copy of the same
 * rules inside its component; this is the version a second surface (the till's
 * schedule) can call without importing OS UI.
 */

import { freeGuides, type Resource, type Staff } from "@/lib/api";
import { toMinutes } from "@/lib/schedule";
import type { OpenOption, OpenSlot } from "@/app/(os)/calendar/_components/openSlots";
import {
  flexDurations,
  flexStartBlocked,
  providerMinutes,
  resolveDraft,
  type Draft,
} from "./selection";

export interface RangeCtx {
  date: string;
  nowMin: number;
  /** Every open slot of the day (`openSlotsFor`). */
  slots: OpenSlot[];
  resources: Resource[];
  team: Staff[];
}

/** How long one fixed slot of a field runs. */
export const slotSpan = (o: OpenOption) => o.product.schedule?.sessionMinutes || 60;

/** The places a booking could go at its time. */
export const placesOf = (o: OpenOption): string[] =>
  o.lanes ? o.lanes.map((l) => l.resourceId) : o.resourceId ? [o.resourceId] : [];

/** A field's hours that follow the chosen one, free on the same field for the
 *  same booking: what "2 hrs" can actually take. */
export function runOf(ctx: RangeCtx, o: OpenOption | null, resourceId: string | undefined): OpenSlot[] {
  if (!o || o.kind !== "slot" || !resourceId || !o.time) return [];
  const mine = ctx.slots
    .filter((s) => s.laneId === resourceId && s.options.some((x) => x.product.id === o.product.id))
    .sort((a, b) => a.minutes - b.minutes);
  const start = mine.findIndex((s) => s.time === o.time);
  if (start < 0) return [];
  const out = [mine[start]];
  for (let i = start + 1; i < mine.length && out.length < 8; i++) {
    const prev = out[out.length - 1];
    if (mine[i].minutes !== prev.minutes + prev.span) break;
    out.push(mine[i]);
  }
  return out;
}

/** Whether one place can take this booking for this long, by the rule the till
 *  uses (taken, past, or running past close; a field, its run of free hours). */
export function fits(ctx: RangeCtx, o: OpenOption, resourceId: string | undefined, m: number): boolean {
  if (!o.time) return true;
  if (o.kind === "flexible") return flexStartBlocked(o.product, ctx.date, o.time, m, resourceId, ctx.nowMin) === null;
  if (o.kind === "slot") return !!resourceId && runOf(ctx, o, resourceId).length * slotSpan(o) >= m;
  return true;
}

/** Every length the booking sells here, before asking what is free. */
export function lengthsOf(ctx: RangeCtx, o: OpenOption | null): number[] {
  if (!o) return [];
  if (o.kind === "flexible") return flexDurations(o.product);
  if (o.kind === "slot") {
    const longest = Math.max(0, ...placesOf(o).map((r) => runOf(ctx, o, r).length));
    return Array.from({ length: longest }, (_, i) => (i + 1) * slotSpan(o));
  }
  return [];
}

/** A length is on offer when somewhere can take it. */
export function lengthFits(ctx: RangeCtx, o: OpenOption, m: number): boolean {
  const places = placesOf(o);
  return places.length ? places.some((r) => fits(ctx, o, r, m)) : fits(ctx, o, undefined, m);
}

/** The lengths that can be taken, and the one to start on: the longest that
 *  fits what was drawn (`room` minutes after this option's start), else the
 *  shortest. */
export function lengthChoice(ctx: RangeCtx, o: OpenOption | null, room: number | null): { ok: number[]; start: number | null } {
  const ok = o ? lengthsOf(ctx, o).filter((m) => lengthFits(ctx, o, m)) : [];
  if (!ok.length) return { ok, start: null };
  if (room == null) return { ok, start: ok[0] };
  const fit = ok.filter((m) => m <= room);
  return { ok, start: fit.length ? fit[fit.length - 1] : ok[0] };
}

/** Everything the booking asks, as answered. */
export interface Answers {
  resourceId?: string;
  length?: number | null;
  qty: Record<string, number>;
  providerId?: string;
  guideId?: string;
  validityId?: string;
}

/** The draft a chosen option and its answers make. */
export function draftFor(ctx: RangeCtx, o: OpenOption, a: Answers): Draft {
  const base: Draft = { productId: o.product.id, date: ctx.date, qty: a.qty };
  switch (o.kind) {
    case "slot": {
      const where = a.resourceId ?? o.resourceId!;
      const run = runOf(ctx, o, where);
      const n = Math.max(1, Math.round((a.length ?? slotSpan(o)) / slotSpan(o)));
      const times = run.length ? run.slice(0, n).map((s) => s.time) : [o.time!];
      return { ...base, slots: times.map((time) => ({ date: ctx.date, time, resourceId: where })) };
    }
    case "session":
      return {
        ...base,
        slotTime: o.time,
        guideId: a.guideId ?? freeGuides(o.product, ctx.date, o.time!)[0],
      };
    case "flexible":
      return {
        ...base,
        slotTime: o.time,
        resourceId: a.resourceId ?? o.resourceId,
        durationMinutes: a.length ?? flexDurations(o.product)[0],
      };
    case "provider":
      return { ...base, slotTime: o.time, providerId: a.providerId || undefined };
    default:
      return { ...base, validityId: a.validityId ?? o.product.validityOptions?.[0]?.id };
  }
}

/** What the booking costs on one place for one length, priced by the engine
 *  that will charge it — so "cheapest lane" means cheapest for THIS booking. */
export function priceOn(ctx: RangeCtx, o: OpenOption, resourceId: string, m: number | null): number {
  if (!o.time) return o.price;
  const d: Draft =
    o.kind === "slot"
      ? {
          productId: o.product.id,
          date: ctx.date,
          qty: {},
          slots: runOf(ctx, o, resourceId)
            .slice(0, Math.max(1, Math.round((m ?? slotSpan(o)) / slotSpan(o))))
            .map((x) => ({ date: ctx.date, time: x.time, resourceId })),
        }
      : { productId: o.product.id, date: ctx.date, qty: {}, slotTime: o.time, resourceId, durationMinutes: m ?? flexDurations(o.product)[0] };
  return resolveDraft(o.product, d, "p", { resources: ctx.resources, team: ctx.team }).amount;
}

/** The minutes a chosen option occupies, for drawing it. */
export function spanMinutes(o: OpenOption, length: number | null): number {
  switch (o.kind) {
    case "slot":
      return length ?? slotSpan(o);
    case "flexible":
      return length ?? flexDurations(o.product)[0];
    case "session":
      return o.minutes ?? (o.product.schedule?.sessionMinutes || o.product.schedule?.slotMinutes || 60);
    case "provider":
      return providerMinutes(o.product);
    default:
      return 0;
  }
}

/** "2:00" → minutes, tolerant of an option with no time. */
export const startOf = (o: OpenOption) => (o.time ? toMinutes(o.time) : null);
