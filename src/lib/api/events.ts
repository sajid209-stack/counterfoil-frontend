import { createResource, fail, notFoundError, validationError } from "./client";
import type { AddOn, ApiResult, Channel, ListParams, ListResponse, Lifecycle, Minor } from "./types";
import type { CategoryId, SectionId } from "@/lib/events/catalog";
import { DEMO_TODAY } from "@/lib/schedule";

/**
 * An event is a published PAGE plus the tickets sold from it.
 *
 * It deliberately does not reuse `Product`. A product is a thing on a till with
 * a schedule and capacity; an event is a one-off occasion with a cover image, a
 * lineup, a countdown and a public URL. Modelling one as the other would have
 * put `heroImage` and `sections` on every General Admission ticket in the
 * catalogue. They meet at the ticket tier, which is why `EventTier` mirrors the
 * shape `PriceTier` already uses.
 */
/**
 * One day of a multi-day event.
 *
 * A festival, a tournament and a conference are all several occasions sold as
 * one, and each day has its own programme and often its own price. A day is a
 * first-class record rather than a label because tickets and the running order
 * both point AT it: renaming Saturday, or moving it, must not orphan the
 * fixtures on it or the pass that admits it.
 *
 * The date is a local `yyyy-mm-dd` string, never derived through
 * `toISOString` — at +06:00 that reports the previous day before six in the
 * morning, which is how a festival's opening day ends up filed as the night
 * before.
 */
export interface EventDay {
  id: string;
  /** yyyy-mm-dd, local. */
  date: string;
  /** The operator's own name for it: "Opening night", "Finals day". Optional,
   *  because "Day 1" is what most of them are and the app can say that. */
  name?: string;
  /** When this day runs, where it differs from the event's own hours — a
   *  tournament that starts at nine and finishes with a nine o'clock final. */
  startTime?: string;
  endTime?: string;
}

export interface EventTier {
  id: string;
  name: string;
  /** Minor units. Zero is a real answer — a free RSVP tier. */
  price: Minor;
  quantity: number;
  /** Sold so far; derived from orders once the backend exists. */
  sold: number;
  description?: string;
  /** An early-bird tier stops selling on its own rather than by hand. */
  salesEnd?: string;
  maxPerOrder?: number;
  /** What the tier actually buys. A price with nothing beside it makes a buyer
   *  work out the difference between two tiers from their names alone. */
  perks?: string[];
  /**
   * Which days this ticket admits. Absent means all of them, so every ticket
   * written before events had days keeps admitting the whole event.
   *
   * This is what makes a "both days" pass a fact rather than a name: with it,
   * ৳500 against a ৳300 Saturday and a ৳350 Sunday is a stated saving of ৳150,
   * and Saturday's remaining places are the day passes AND the weekend passes
   * that have gone — the grouped capacity a festival is actually run on. A
   * model where the bundle only draws down its own pool oversells every day it
   * covers.
   */
  dayIds?: string[];
}

/** A figure worth stating before anyone scrolls — what the page is at a glance.
 *  The value stays a STRING: "25,000+", "৳2,00,000" and "3 days" are all
 *  honest answers and none of them survives being stored as a number. */
export interface EventStat {
  id: string;
  value: string;
  label: string;
}

/** A teaser chip. Short by construction — it is a label on a circle, not a
 *  sentence — and it links nowhere, because it is an appetiser for the
 *  sections underneath rather than navigation. */
export interface EventHighlight {
  id: string;
  label: string;
  /** One line saying what the visitor gets out of it.
   *
   *  A chip is a teaser and needs no more than its own word. A benefit — "Gain
   *  real-world insights", and then what that means — is a claim, and a claim
   *  with nothing under it is marketing. Optional, so the categories that draw
   *  these as chips are unaffected. */
  description?: string;
}

/** Everything the operator changed about the template's default look. */
export interface EventCustomisation {
  accent: string;
  displayFont: string;
  bodyFont: string;
  variant: string;
  /** Ordered and filtered by the operator; `hero` and `tickets` always present. */
  sections: SectionId[];
  coverUrl?: string;
}

export interface EventLineupEntry {
  id: string;
  name: string;
  role?: string;
  /** "21:00" for a set time, or a day label on an itinerary. */
  at?: string;
  /** A person on the bill, or a slot on the running order.
   *
   *  One array feeds two sections — the bill (speakers, lineup, works) and the
   *  agenda — and that works right up until the agenda gains a lunch break,
   *  which then appears in the speaker grid with a portrait. It cannot be
   *  inferred: "Panel: what merchants ask for" carries a room in its role
   *  field and is no more a person than lunch is. Undefined means person, so
   *  every record written before this reads exactly as it did. */
  kind?: "person" | "session";
  /** Which day of a multi-day event this sits on — "Day 1", "Sat 12 Dec".
   *  Optional because most events are one day, and an agenda that demands a
   *  day label from a single-evening gig would be asking for nothing. Where no
   *  entry carries one the schedule renders as a single track.
   *
   *  Superseded by `dayId` where the event has real days: free text cannot be
   *  renamed, reordered or priced. Kept, and still read as the fallback, so
   *  every record written before `EventDay` existed renders exactly as it did. */
  day?: string;
  /** The day this belongs to, when the event has days. Wins over `day`. */
  dayId?: string;
}

/** Who is putting the event on. A conference page is believed or not on the
 *  strength of this line, which is why it is a first-class field rather than a
 *  sentence someone remembers to type into the description. */
export interface EventOrganiser {
  name: string;
  blurb?: string;
}

/** Names only, by design. Sponsor artwork is an upload this product does not
 *  have yet, and a wall of broken images says less than a wall of names. */
export interface EventSponsor {
  id: string;
  name: string;
  /** "Headline", "Partner" — the operator's own word, shown as a group label. */
  tier?: string;
}

export interface EventRecord {
  id: string;
  status: Lifecycle;
  /** draft until the operator publishes; the page is only reachable when live. */
  published: boolean;
  slug: string;
  title: string;
  subtitle?: string;
  categoryId: CategoryId;
  subtype: string;
  startsAt: string;
  endsAt?: string;
  /** The days it runs, in order, when it runs on more than one. Absent — and
   *  a single entry — both mean a one-day event, and no screen draws a day
   *  control for one. `startsAt` stays the first day's opening instant, so
   *  everything that sorts, counts down or states when it begins is unchanged. */
  days?: EventDay[];
  venueName: string;
  venueAddress?: string;
  description?: string;
  lineup: EventLineupEntry[];
  stats: EventStat[];
  highlights: EventHighlight[];
  /** The three facts a buyer checks before committing, in the operator's own
   *  words — what they are called differs by category (a gallery has opening
   *  hours, a tour has a departure point), so the labels travel with the data. */
  info: { id: string; label: string; value: string }[];
  faq: { id: string; q: string; a: string }[];
  /** A YouTube or Vimeo link as the operator pasted it. Parsed at render time
   *  (`lib/events/video`) rather than stored as an id, so what is saved is what
   *  they can paste back into a browser and check. */
  videoUrl?: string;
  organiser?: EventOrganiser;
  sponsors: EventSponsor[];
  tiers: EventTier[];
  /** Where tickets are sold: on the event's own page, at the counter, or
   *  both — the same two channels a booking has. Optional so records written
   *  before it read as they always did: online only (`eventChannels`). */
  channels?: Channel[];
  /** The venues whose counters sell it, when the counter is one of them. */
  locationIds?: string[];
  /** Countable things that go with a ticket: a programme, a glow band, a
   *  T-shirt. The same shape a booking's extras use, so one editor and one
   *  reverse index serve both — an event is a thing you sell, and the stock
   *  question is the same question. */
  extras?: AddOn[];
  customisation: EventCustomisation;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<EventRecord, "id" | "createdAt" | "updatedAt">;

const resource = createResource<EventRecord>("events", "Event", {
  search: (e, q) =>
    e.title.toLowerCase().includes(q) ||
    e.venueName.toLowerCase().includes(q) ||
    e.subtype.toLowerCase().includes(q),
  filter: (e, f) =>
    (f.categoryId === undefined || e.categoryId === f.categoryId) &&
    (f.published === undefined || e.published === f.published) &&
    // Archived is out unless it is asked for by name. Without this an archived
    // event would keep sitting in the list it was archived to leave, which is
    // the rule every other collection in this layer already follows.
    (f.status === undefined ? e.status !== "archived" : e.status === f.status),
  sort: {
    title: (a, b) => a.title.localeCompare(b.title),
    startsAt: (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    createdAt: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  defaultSort: "startsAt",
});

const validate = (input: Partial<EventInput>, existingDays?: EventDay[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("title" in input && !input.title?.trim()) errors.title = "Give the event a name.";
  if ("startsAt" in input && !input.startsAt) errors.startsAt = "Say when it starts.";
  if ("venueName" in input && !input.venueName?.trim()) errors.venueName = "Say where it is.";
  if ("tiers" in input && (input.tiers ?? []).length === 0) errors.tiers = "Add at least one ticket.";
  /* A patch that touches only the tickets is still checked against the days
     the record already has — otherwise "which days does this admit?" is
     enforced on the one save that happens to carry both, and nowhere else. */
  const days = "days" in input ? input.days : existingDays;
  if (input.days?.length) {
    const d = input.days;
    if (d.some((x) => !x.date)) errors.days = "Give every day a date.";
    else if (d.some((x, i) => i > 0 && x.date <= d[i - 1].date)) errors.days = "Put the days in order, one date each.";
  }
  /* A ticket pointing at a day that is not there admits nothing, and would
     read on the page as admitting everything. Refused rather than repaired:
     silently widening what a ticket admits is a decision about money. */
  if (input.tiers && days?.length) {
    const known = new Set(days.map((d) => d.id));
    const orphan = input.tiers.find((t) => t.dayIds?.some((d) => !known.has(d)));
    if (orphan) errors.tiers = `"${orphan.name}" admits a day this event does not have.`;
  }
  return errors;
};

export const listEvents = (params?: ListParams): Promise<ApiResult<ListResponse<EventRecord>>> =>
  resource.list(params);

export const getEvent = (id: string): Promise<ApiResult<EventRecord>> => resource.get(id);

export function createEvent(input: EventInput): Promise<ApiResult<EventRecord>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateEvent(id: string, patch: Partial<EventInput>): Promise<ApiResult<EventRecord>> {
  const errors = validate(patch, resource.peek().find((x) => x.id === id)?.days);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

/**
 * Take an event off the list without losing it.
 *
 * Unpublishes as it goes: an archived event that kept serving its public page
 * would be on sale to the world and invisible to the operator, which is the
 * worst of both. Its orders are untouched — that is the whole difference
 * between archiving and deleting.
 */
export function archiveEvent(id: string): Promise<ApiResult<EventRecord>> {
  return resource.update(id, { status: "archived", published: false });
}

/** Back onto the list, as a draft. It does NOT republish itself: whoever
 *  archived it took it off sale, and putting it back is a separate decision. */
export function restoreEvent(id: string): Promise<ApiResult<EventRecord>> {
  return resource.update(id, { status: "active" });
}

/** Publish or unpublish. The page is only reachable while this is true. */
export function setEventPublished(id: string, published: boolean): Promise<ApiResult<EventRecord>> {
  return resource.update(id, { published });
}

/**
 * A permanent delete — and only while nothing has been sold.
 *
 * A ticket that has been bought points at its event, and removing the record
 * under it would orphan the order and the ticket the guest is holding. That is
 * exactly the case archiving exists for, so the refusal names it.
 */
export function deleteEvent(id: string): Promise<ApiResult<EventRecord>> {
  const e = resource.peek().find((x) => x.id === id);
  if (!e) return Promise.resolve(fail(notFoundError("Event")));
  if (eventSold(e) > 0) {
    return Promise.resolve(
      fail(validationError({ event: "Tickets have been sold for this event. Archive it instead." })),
    );
  }
  return resource.remove(id);
}

/**
 * Copy an event to build the next one from — the commonest thing anyone does
 * to a recurring event, and it was a full trip through the wizard.
 *
 * Three things deliberately do NOT come across. It lands **unpublished**,
 * because a half-edited copy must not be on sale the moment it exists. Every
 * tier's **sold count resets to zero**, because last year's numbers are not
 * this year's and a copy that inherited them would report revenue nobody took.
 * And each tier gets a **fresh id**, so an order can never resolve to a tier on
 * the wrong event.
 */
export function duplicateEvent(id: string, title: string): Promise<ApiResult<EventRecord>> {
  const e = resource.peek().find((x) => x.id === id);
  if (!e) return Promise.resolve(fail(notFoundError("Event")));
  const taken = resource.peek().map((x) => x.slug);
  const c = structuredClone(e);
  const stamp = Date.now().toString(36);
  const dayMap = new Map((c.days ?? []).map((d, i) => [d.id, `day_${stamp}_${i}`]));
  /* Written out rather than spread, and deliberately: a field added to
     EventRecord tomorrow must not start copying itself into duplicates
     silently. The bookings catalogue's `omit` carries the same note. */
  return resource.create({
    title,
    slug: slugify(title, taken),
    published: false,
    status: "active",
    subtitle: c.subtitle,
    categoryId: c.categoryId,
    subtype: c.subtype,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    venueName: c.venueName,
    venueAddress: c.venueAddress,
    description: c.description,
    stats: c.stats,
    highlights: c.highlights,
    info: c.info,
    faq: c.faq,
    videoUrl: c.videoUrl,
    organiser: c.organiser,
    sponsors: c.sponsors,
    customisation: c.customisation,
    channels: c.channels,
    locationIds: c.locationIds,
    extras: c.extras,
    /* Days are re-idded with everything that points at them, or the copy's
       tickets and fixtures would admit and sit on the ORIGINAL's days — which
       still resolve, so nothing would look wrong until the two drifted. */
    days: c.days?.map((d, i) => ({ ...d, id: `day_${stamp}_${i}` })),
    lineup: c.lineup.map((l) => ({ ...l, dayId: l.dayId ? dayMap.get(l.dayId) : undefined })),
    tiers: c.tiers.map((t, i) => ({
      ...t,
      id: `tier_${stamp}_${i}`,
      sold: 0,
      dayIds: t.dayIds?.map((d) => dayMap.get(d)).filter((d): d is string => !!d),
    })),
  });
}

/** Where an event is sold, read the same way for old and new records: one
 *  written before events had channels is sold on its page and nowhere else. */
export const eventChannels = (e: Pick<EventRecord, "channels">): Channel[] => e.channels ?? ["online"];

/** Capacity and takings, derived — never stored, so they cannot drift. */
export const eventCapacity = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.quantity, 0);
export const eventSold = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold, 0);
export const eventRevenue = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold * t.price, 0);
/** What a public card says: the cheapest tier anyone can still buy. */
export const eventFromPrice = (e: EventRecord): Minor | null => {
  const open = e.tiers.filter((t) => t.sold < t.quantity);
  return open.length ? Math.min(...open.map((t) => t.price)) : null;
};

/* ── days ─────────────────────────────────────────────────────────────────── */

/** The days an event runs, always at least one.
 *
 *  A one-day event has no `days` array and never needs one, so rather than
 *  make every caller branch, this hands back the single day it implies. The
 *  id is the event's own, so a tier or a fixture can point at it either way. */
export function eventDays(e: Pick<EventRecord, "id" | "startsAt" | "days">): EventDay[] {
  if (e.days?.length) return e.days;
  return [{ id: `${e.id}_d1`, date: e.startsAt.slice(0, 10) }];
}

/** The one question every screen asks before drawing a day CONTROL: does this
 *  event have real days to point at? */
export const spansDays = (e: Pick<EventRecord, "days">) => (e.days?.length ?? 0) > 1;

/**
 * Does it run past the day it starts on? A different question, and the one
 * every screen that merely *states* when an event happens should ask.
 *
 * An event can run for days without having day records — the three-day
 * Sundarbans tour does, on the free-text shape it was written in. Asking
 * `spansDays` there would print its first morning's clock under a page about a
 * three-day cruise, which is the same class of lie as a cross-day time range.
 */
export const runsOverDays = (e: Pick<EventRecord, "days" | "startsAt" | "endsAt">) =>
  spansDays(e) || (!!e.endsAt && e.endsAt.slice(0, 10) > e.startsAt.slice(0, 10));

/** How many days it covers, whichever shape it is written in. */
export function dayCountOf(e: Pick<EventRecord, "id" | "days" | "startsAt" | "endsAt">): number {
  if (e.days?.length) return e.days.length;
  if (!e.endsAt) return 1;
  const a = Date.parse(`${e.startsAt.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${e.endsAt.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) || b < a ? 1 : Math.round((b - a) / 86400000) + 1;
}

/** Which days a ticket admits. No scope means the whole event — which is what
 *  every ticket sold before this meant, and what a single-day event's tickets
 *  mean for ever. */
export function tierDays(e: Pick<EventRecord, "id" | "startsAt" | "days">, t: Pick<EventTier, "dayIds">): EventDay[] {
  const all = eventDays(e);
  if (!t.dayIds?.length) return all;
  const want = new Set(t.dayIds);
  return all.filter((d) => want.has(d.id));
}

/** Does this ticket admit every day there is? A "both days" pass on a two-day
 *  event is a bundle whether or not it says so in its name. */
export const isBundleTier = (e: Pick<EventRecord, "id" | "startsAt" | "days">, t: Pick<EventTier, "dayIds">) =>
  spansDays(e) && tierDays(e, t).length > 1;

/**
 * What one day has sold, and out of how many.
 *
 * **Every ticket that admits the day draws it down**, which is the whole point:
 * a weekend pass takes a place on Saturday and on Sunday. Counting only the
 * tickets named after a day would let a festival sell its Saturday twice.
 *
 * It counts TICKETS, not people, and is worded that way wherever it is shown.
 * A team entry admitting eleven players is one ticket here — `EventTier` has
 * no headcount, unlike a booking's `PriceTier.admits` — so calling these
 * "places" would understate a day against a venue's fire limit. Adding a
 * headcount is the real fix and is recorded as open.
 */
export function dayFill(e: EventRecord, dayId: string): { sold: number; cap: number; pct: number } {
  const admits = e.tiers.filter((t) => tierDays(e, t).some((d) => d.id === dayId));
  const sold = admits.reduce((n, t) => n + t.sold, 0);
  const cap = admits.reduce((n, t) => n + t.quantity, 0);
  return { sold, cap, pct: cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0 };
}

/**
 * What a bundle saves against buying its days one at a time, or null.
 *
 * The comparison is the cheapest ticket that admits **only** that day, because
 * that is the alternative a buyer actually has. Null rather than zero when
 * there is nothing to compare against, when the sum is not cheaper, or when the
 * ticket is not a bundle — a page that claims a saving of ৳0, or claims one for
 * a pass that costs more than the parts, is worse than one that says nothing.
 */
export function bundleSaving(e: EventRecord, t: EventTier, today: string = DEMO_TODAY): Minor | null {
  if (!isBundleTier(e, t)) return null;
  let sum = 0;
  for (const d of tierDays(e, t)) {
    /* Only against a ticket somebody could actually buy instead. A day pass
       that has sold out, or whose sales window has closed, is not an
       alternative — advertising a discount against it is advertising a
       discount against nothing. */
    const singles = e.tiers.filter(
      (x) => x.id !== t.id && x.dayIds?.length === 1 && x.dayIds[0] === d.id && x.sold < x.quantity && (!x.salesEnd || x.salesEnd > today),
    );
    if (!singles.length) return null;
    sum += Math.min(...singles.map((x) => x.price));
  }
  const saving = sum - t.price;
  if (saving <= 0) return null;
  /* And only where the comparison is like for like.
     A ৳1,000 student pass "saving ৳6,000" against two full-price day tickets
     is arithmetically true and commercially meaningless: the baseline is a
     ticket that buyer was never going to buy. There is no concession field to
     read, so the signal used is the size of the claim — a saving larger than
     the ticket's own price means two different products are being compared,
     and the honest answer is to say nothing. */
  return saving <= t.price ? saving : null;
}

/** A slug an operator can read, and that cannot collide with an existing one. */
export function slugify(title: string, taken: string[] = []): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "event";
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}-${i}`)) return `${base}-${i}`;
}
