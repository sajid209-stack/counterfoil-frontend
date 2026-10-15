import { eventDays, spansDays, type EventLineupEntry } from "@/lib/api/events";
import { parseEventVideo } from "@/lib/events/video";
import { formatClock, formatDay } from "@/lib/format";
import type { PageCtx } from "../context";

/**
 * What each body section draws, decided in ONE place. `sectionHasContent`
 * (has.ts) and the section components both read these, so the section nav can
 * never link to a section that renders nothing, and a section can never render
 * what the nav thinks is absent.
 */

export const clean = (s?: string | null) => (s ?? "").trim();

/** Fixtures and an itinerary are read in order down a column, so for a sports
 *  or travel page the "line-up" is a running order, not a wall of people. */
export const isRoute = (ctx: PageCtx) => ctx.ev.categoryId === "travel" || ctx.page.look === "travel";
export const isSequence = (ctx: PageCtx) =>
  isRoute(ctx) || ctx.ev.categoryId === "sports" || ctx.page.look === "sports";

const named = (ctx: PageCtx): EventLineupEntry[] => ctx.ev.lineup.filter((l) => clean(l.name));

/** The people on the bill. Sessions (`kind: "session"`) never appear here. */
export const peopleOf = (ctx: PageCtx): EventLineupEntry[] => named(ctx).filter((l) => l.kind !== "session");

/** What happens, in time order: sessions and timed people. On a sports or
 *  travel page the fixtures/stops are drawn by the Lineup section already, so
 *  the programme keeps only the sessions then (when both sections are on). */
export function programmeOf(ctx: PageCtx): EventLineupEntry[] {
  const all = named(ctx);
  if (isSequence(ctx)) return ctx.sections.includes("lineup") ? all.filter((l) => l.kind === "session") : all;
  return all.filter((l) => l.kind === "session" || clean(l.at));
}

export function aboutOf(ctx: PageCtx) {
  const description = clean(ctx.ev.description);
  const info = ctx.ev.info.filter((r) => clean(r.label) && clean(r.value));
  const org = ctx.ev.organiser && clean(ctx.ev.organiser.name) ? ctx.ev.organiser : null;
  return description || info.length > 0 || org ? { description, info, org } : null;
}

export const highlightsOf = (ctx: PageCtx) => ctx.ev.highlights.filter((h) => clean(h.label));

/** Tickets that say something about what they buy. A ticket with nothing
 *  written on it has no card: an empty card is a promise nobody made. */
export const includedOf = (ctx: PageCtx) => {
  /* The Tickets cards already carry each ticket's note and perks, so Included
     is drawn only where they do not: a single-ticket, not-on-a-date booking. */
  const active = ctx.product.tiers.filter((t) => t.active !== false).length;
  if (active >= 2 || ctx.product.bookingType === "BT-15") return [];
  return ctx.ev.tiers.filter((t) => clean(t.description) || (t.perks ?? []).some((p) => clean(p)));
};

export const galleryOf = (ctx: PageCtx) => (ctx.ev.images ?? ctx.product.images ?? []).filter((i) => clean(i.url));
export const sponsorsOf = (ctx: PageCtx) => ctx.ev.sponsors.filter((s) => clean(s.name));
export const faqOf = (ctx: PageCtx) => ctx.ev.faq.filter((f) => clean(f.q) && clean(f.a));
export const videoOf = (ctx: PageCtx) => parseEventVideo(ctx.ev.videoUrl);

/* ── time ────────────────────────────────────────────────────────────── */

const minutesOf = (at?: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec((at ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** "21:00" → "9:00 PM"; anything that is not a clock time is shown as written. */
export const timeLabel = (at?: string): string => {
  const v = clean(at);
  if (!v) return "";
  return minutesOf(v) === null ? v : formatClock(v);
};

/* ── the programme's days ────────────────────────────────────────────── */

export interface DayGroup {
  key: string;
  /** The tab / marker: the operator's name for the day, or "Day 2". */
  label: string;
  /** Its date, when there is a real one. */
  sub?: string;
  entries: EventLineupEntry[];
}

/** Sorted by the clock where every entry has one; otherwise left in the
 *  operator's order, which is the only order that means anything then. */
function inTimeOrder(list: EventLineupEntry[]): EventLineupEntry[] {
  if (list.some((e) => minutesOf(e.at) === null)) return list;
  return [...list].sort((a, b) => (minutesOf(a.at) ?? 0) - (minutesOf(b.at) ?? 0));
}

/**
 * Group entries by day. Two shapes are real: a record with day records groups
 * by `dayId` (an entry with none sits on the first day, where somebody will
 * find and fix it); one written before days existed groups by the free text it
 * carries. One day, or none, is a single group — and a single group draws no
 * tabs.
 */
export function dayGroups(ctx: PageCtx, entries: EventLineupEntry[]): DayGroup[] {
  const word = ctx.labels.day;
  if (spansDays(ctx.ev)) {
    const days = eventDays(ctx.ev);
    return days.map((d, i) => ({
      key: d.id,
      label: clean(d.name) || `${word} ${i + 1}`,
      sub: formatDay(d.date, { weekday: true }),
      entries: inTimeOrder(entries.filter((e) => (e.dayId ? e.dayId === d.id : i === 0))),
    }));
  }
  const labels: string[] = [];
  for (const e of entries) {
    const d = clean(e.day);
    if (d && !labels.includes(d)) labels.push(d);
  }
  if (labels.length === 0) return [{ key: "all", label: "", entries: inTimeOrder(entries) }];
  return labels.map((label, i) => ({
    key: label,
    label,
    entries: inTimeOrder(entries.filter((e) => (clean(e.day) ? clean(e.day) === label : i === 0))),
  }));
}

/** "Dhaka FC vs Port City United" → the two sides. A fixture is typed the way
 *  it is written on a board; a row with no opponent is a talk, a class or a
 *  heat and falls through to the plain shape. */
const VS = /\s+(?:vs\.?|v\.?|versus)\s+/i;
export function sidesOf(name: string): [string, string] | null {
  const parts = name.split(VS);
  return parts.length === 2 && clean(parts[0]) && clean(parts[1]) ? [clean(parts[0]), clean(parts[1])] : null;
}

/* ── the venue ───────────────────────────────────────────────────────── */

export function venueOf(ctx: PageCtx) {
  const { ev, location } = ctx;
  const own = clean(ev.venueName);
  const name = own || clean(location.name);
  const address = own
    ? clean(ev.venueAddress)
    : [location.addressLine1, location.addressLine2, location.city].map(clean).filter(Boolean).join(", ");
  const href = name
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`
    : "";
  return { name, address, href };
}
