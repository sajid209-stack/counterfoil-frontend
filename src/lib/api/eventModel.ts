/* The event model — pure, with no store behind it.
 *
 * An event is a catalogue item: a `Product` whose bookingType is "BT-15" (see
 * docs/catalog.md §7). `EventRecord` is no longer stored anywhere; it is the
 * VIEW the event screens still read, derived from the product on every read.
 * This file is that derivation and its inverse, plus the day and capacity
 * helpers that operate on a view.
 *
 * It lives apart from `events.ts` for one reason: the mock seed has to build
 * product records from event-shaped builders, and `events.ts` imports the
 * store (`client.ts`), which imports the seed. A pure module the seed can
 * import without closing that cycle is the whole point of the split.
 */
import { categoryById, type SectionId } from "@/lib/events/catalog";
import { DEMO_TODAY } from "@/lib/schedule";
import type { EventDay, EventInput, EventRecord, EventTier } from "./events";
import type { Channel, Minor, PriceTier, PriceTierInput, Product, ProductInput } from "./types";

/** Is this catalogue item an event? */
export const isEventProduct = (p: Pick<Product, "bookingType">): boolean => p.bookingType === "BT-15";

/** Per-tier sales replayed from the ledger: tier id → tickets sold, net of
 *  refunds. The only thing an `EventRecord` view needs from orders. */
export type LiveSold = ReadonlyMap<string, number>;

/** An event ticket as the event screens read it. */
function tierView(t: PriceTier, live?: LiveSold): EventTier {
  return {
    id: t.id,
    name: t.name,
    price: t.price,
    // A ticket with no cap of its own has no quantity to state; the event
    // screens treat the figure as the cap, so an uncapped tier reads as 0.
    quantity: t.capacity ?? 0,
    sold: (t.openingSold ?? 0) + (live?.get(t.id) ?? 0),
    opening: t.openingSold ?? 0,
    description: t.note,
    salesEnd: t.salesEndsAt,
    maxPerOrder: t.maxPerOrder,
    perks: t.perks,
    dayIds: t.dayIds,
  };
}

/** A ticket as the catalogue stores it. `sold` becomes the OPENING balance: sales
 *  made here are replayed from orders and added on read, never stored. */
export function tierToPrice(t: EventTier): PriceTierInput {
  return {
    id: t.id,
    name: t.name,
    price: t.price,
    active: true,
    capacity: t.quantity,
    openingSold: t.sold,
    note: t.description,
    salesEndsAt: t.salesEnd,
    maxPerOrder: t.maxPerOrder,
    perks: t.perks,
    dayIds: t.dayIds,
  };
}

/** A URL-safe name an operator can read, that cannot collide with an existing
 *  one. */
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

/**
 * The event view of a BT-15 product — WITHOUT live sales: each ticket's `sold`
 * is its opening balance. `events.ts` adds the ledger on top (`eventView`).
 *
 * `published` means "on sale" (status active), exactly what the flag always
 * meant. Whether the public page serves it is a separate question the page
 * asks of the channels, as it did before: a counter-only event is on sale and
 * not published online.
 */
export function eventViewBase(p: Product): EventRecord {
  const ev = p.event ?? { kind: "entertainment" as const, subtype: "event", startsAt: p.createdAt, venueName: "" };
  const cat = categoryById(ev.kind);
  const pg = p.page;
  return {
    id: p.id,
    status: p.status,
    published: p.status === "active",
    slug: p.slug ?? slugify(p.name),
    title: p.name,
    subtitle: pg?.tagline,
    categoryId: ev.kind,
    subtype: ev.subtype,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    days: ev.days,
    venueName: ev.venueName,
    venueAddress: ev.venueAddress,
    description: p.description || undefined,
    lineup: pg?.lineup ?? [],
    stats: pg?.stats ?? [],
    highlights: pg?.highlights ?? [],
    info: pg?.info ?? [],
    faq: pg?.faq ?? [],
    videoUrl: pg?.videoUrl,
    organiser: pg?.organiser,
    sponsors: pg?.sponsors ?? [],
    tiers: p.tiers.filter((t) => t.active !== false).map((t) => tierView(t)),
    channels: p.channels,
    locationIds: p.locationIds,
    extras: p.addOns,
    customisation: {
      accent: pg?.accent ?? cat.theme.accent,
      displayFont: pg?.displayFont ?? cat.theme.display,
      bodyFont: pg?.bodyFont ?? cat.theme.body,
      variant: pg?.variant ?? cat.variants[0],
      sections: pg ? pg.sections.filter((s): s is SectionId => s !== "included" && s !== "know") : cat.sections,
      coverUrl: pg?.coverUrl,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * An event as a new catalogue item — the inverse of `eventViewBase`. Used by the
 * seed and by any create path that still builds an event-shaped object.
 *
 * `published` decides the status: on sale is active, anything else is inactive,
 * and an archived record stays archived. Event tickets are sold untaxed at the
 * till, as they always were (the old line carried no product, so no rate).
 */
export function productFromEvent(e: EventInput | EventRecord): ProductInput {
  return {
    name: e.title,
    description: e.description ?? "",
    images: [],
    bookingType: "BT-15",
    tiers: e.tiers.map(tierToPrice),
    locationIds: e.locationIds ?? [],
    channels: e.channels ?? ["online"],
    status: e.status === "archived" ? "archived" : e.published ? "active" : "inactive",
    taxClass: "exempt",
    addOns: e.extras,
    event: {
      kind: e.categoryId,
      subtype: e.subtype,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      days: e.days,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
    },
    page: {
      look: e.categoryId,
      accent: e.customisation.accent,
      displayFont: e.customisation.displayFont,
      bodyFont: e.customisation.bodyFont,
      variant: e.customisation.variant,
      sections: e.customisation.sections,
      coverUrl: e.customisation.coverUrl,
      tagline: e.subtitle,
      stats: e.stats,
      highlights: e.highlights,
      info: e.info,
      faq: e.faq,
      lineup: e.lineup,
      videoUrl: e.videoUrl,
      organiser: e.organiser,
      sponsors: e.sponsors,
    },
    online: "listed",
    slug: e.slug,
  };
}

/** A whole seed record: the product, keeping the event's id and timestamps so
 *  everything that already points at the id keeps pointing at it. */
export function productRecordFromEvent(e: EventRecord): Product {
  return {
    ...productFromEvent(e),
    id: e.id,
    archivedAt: e.status === "archived" ? e.updatedAt : null,
    tiers: e.tiers.map((t) => tierToPrice(t) as PriceTier),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/* ── capacity and takings, derived — never stored, so they cannot drift ───── */

export const eventCapacity = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.quantity, 0);
export const eventSold = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold, 0);
/** Money actually taken: what the order lines brought in, net of refunds. NOT
 *  sold × today's price — a price change must never rewrite money already taken,
 *  and tickets sold before Counterfoil carry none. */
export const eventTaken = (e: EventRecord) => e.tiers.reduce((s, t) => s + (t.taken ?? 0), 0);
/** What a public card says: the cheapest tier anyone can still buy. */
export const eventFromPrice = (e: EventRecord, now: Date = new Date()): Minor | null => {
  const open = e.tiers.filter((t) => {
    if (t.quantity > 0 && t.sold >= t.quantity) return false;
    if (!t.salesEnd) return true;
    const at = Date.parse(t.salesEnd.length <= 10 ? `${t.salesEnd}T23:59:59` : t.salesEnd);
    return Number.isNaN(at) || at > now.getTime();
  });
  return open.length ? Math.min(...open.map((t) => t.price)) : null;
};

/** Where an event is sold, read the same way for old and new records: one
 *  written before events had channels is sold on its page and nowhere else. */
export const eventChannels = (e: Pick<EventRecord, "channels">): Channel[] => e.channels ?? ["online"];

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
 * A team entry admitting eleven players is one ticket here — an event ticket
 * has no headcount, unlike a booking's `PriceTier.admits` — so calling these
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
