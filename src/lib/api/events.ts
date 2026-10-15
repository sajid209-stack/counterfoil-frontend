import { createResource, fail, notFoundError, ok, validationError } from "./client";
import { peekOrders } from "./orders";
import {
  eventDays,
  eventSold,
  eventViewBase,
  dayFill,
  isEventProduct,
  productFromEvent,
  slugify,
  tierToPrice,
} from "./eventModel";
import type { AddOn, ApiResult, Channel, ListParams, ListResponse, Lifecycle, Minor, PageSectionId, PriceTier, Product, ProductPage } from "./types";
import { categoryById, type CategoryId, type SectionId } from "@/lib/events/catalog";
import { lookDefaults, pageOf } from "@/lib/productPage";
import { demoNow } from "@/lib/schedule";
import { nextAvailable } from "@/lib/storefront/pattern";
import { peekLocations } from "./locations";

/* The pure half of the event model — the view, its inverse, and the day and
   capacity helpers — lives in eventModel.ts so the mock seed can import it
   without closing a cycle through the store. Re-exported here so every screen
   keeps importing from "@/lib/api". */
export * from "./eventModel";

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
  /**
   * The OPENING BALANCE — what had sold before this system was recording,
   * which is what a venue migrating mid-season actually has. Sales made here
   * are replayed from the ledger and added to it on read (`withLiveSales`),
   * so nothing stores a running total that can drift from the orders.
   */
  sold: number;
  /**
   * How many of `sold` were sold before Counterfoil recorded sales. They are
   * counted as tickets and carry NO money here: inventing a figure for them
   * would put a number in the books that nothing backs.
   */
  opening?: number;
  /**
   * Money actually taken for this ticket: the sum of the order lines that sold
   * it, net of refunds, at the price each line was sold at. Replayed from the
   * ledger on read (`withLiveSales`), so editing the price never rewrites it.
   * Absent on a view read without the ledger, and then zero.
   */
  taken?: Minor;
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
  /** The ticket has no quantity of its own (a booking's ticket with no
   *  capacity): it can be bought until something else stops it. `quantity` is
   *  0 then, and no screen may read that as "none left". */
  unlimited?: boolean;
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
  /** The page's whole section list (the event sections plus "included" and
   *  "know"), in order — only set by `pageView`, which draws any booking. */
  pageSections?: PageSectionId[];
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

/**
 * An event is a catalogue item: a `Product` whose bookingType is "BT-15"
 * (docs/catalog.md §7). There is no events collection any more.
 *
 * `EventRecord` is a DERIVED VIEW of such a product — the shape the event
 * screens (the list, the record, the editor, the designer, the public page and
 * the till's event sheet) were written against, rebuilt from the product on
 * every read by `eventView` and written back through the functions below. The
 * old note here said events deliberately do not reuse `Product`; that decision
 * is reversed. They meet at the ticket tier, which is why `EventTier` always
 * mirrored the shape `PriceTier` uses: a tier is now a price tier with
 * `capacity`, `openingSold`, `dayIds`, `salesEndsAt` and `perks`.
 */
export interface EventRecord {
  id: string;
  status: Lifecycle;
  /** On sale: the product's status is active. Whether the public page serves it
   *  is a separate question of the channels (it needs "online"), asked where it
   *  matters — a counter-only event is on sale and has no page. */
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
  /** Photos of the booking — set by `pageView`; an event view has none. */
  images?: { id: string; url: string; alt?: string }[];
  /** `pageView` of a booking that has no first day to name: nothing may draw a
   *  date for it, a clock, "Runs N days" or add-to-calendar. */
  undated?: boolean;
  /** `pageView` of a booking that repeats: its "when" in words ("Every 45 min,
   *  11:00 AM – 4:30 PM"), drawn where an event's date and time are. Then
   *  `startsAt` is the NEXT time it can be booked, not a one-off start. */
  whenText?: string;
  customisation: EventCustomisation;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<EventRecord, "id" | "createdAt" | "updatedAt">;

/* ── The store: events are BT-15 products ─────────────────────────────────
 *
 * There is no events collection. Every function below reads and writes the
 * PRODUCTS store and translates at the edge, so the screens that were written
 * against `EventRecord` keep working and the catalogue sees an event as one
 * more item. Each handle on a collection is just a view on the store (the same
 * trick `inventory.ts` uses), so this file never imports `products.ts`.
 */
const resource = createResource<Product>("products", "Event", {
  search: (p, q) =>
    p.name.toLowerCase().includes(q) ||
    (p.event?.venueName ?? "").toLowerCase().includes(q) ||
    (p.event?.subtype ?? "").toLowerCase().includes(q),
  filter: (p, f) =>
    isEventProduct(p) &&
    (f.categoryId === undefined || p.event?.kind === f.categoryId) &&
    (f.published === undefined || (p.status === "active") === f.published) &&
    // Archived is out unless it is asked for by name. Without this an archived
    // event would keep sitting in the list it was archived to leave, which is
    // the rule every other collection in this layer already follows.
    (f.status === undefined ? p.status !== "archived" : p.status === f.status),
  sort: {
    title: (a, b) => a.name.localeCompare(b.name),
    startsAt: (a, b) => Date.parse(a.event?.startsAt ?? a.createdAt) - Date.parse(b.event?.startsAt ?? b.createdAt),
    createdAt: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  defaultSort: "startsAt",
});

/** Every event product, whatever its state. */
const eventProducts = (): Product[] => resource.peek().filter(isEventProduct);
const eventProduct = (id: string): Product | undefined => eventProducts().find((p) => p.id === id);

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

/* ── What has actually sold ───────────────────────────────────────────────
 *
 * A ticket's opening balance (`PriceTier.openingSold`) is what went before this
 * system was recording, which is exactly what a venue migrating mid-season has.
 * Sales made here are replayed from the ledger and added to it, the same rule
 * seat availability and loyalty balances follow: a stored running total and a
 * ledger disagree exactly once, and then nobody can say which is right.
 *
 * An event ticket is an ORDINARY product line now: productId is the product's
 * id and tierId is the ticket. Lines written when events were a separate record
 * carry an `evt_` prefix in front of the same id, and are still read — mapped
 * to the same event — so an old sale keeps counting.
 */
const LEGACY_LINE_PREFIX = "evt_";

/** Which event a sales line belongs to, or null when it is not an event ticket.
 *  The line's own product id wins; the legacy prefix is only tried when that
 *  id is not an event, because the seeded events' own ids start with `evt_`. */
export function eventIdFromLine(productId: string): string | null {
  const ids = new Set(eventProducts().map((p) => p.id));
  if (ids.has(productId)) return productId;
  if (productId.startsWith(LEGACY_LINE_PREFIX)) {
    const rest = productId.slice(LEGACY_LINE_PREFIX.length);
    if (ids.has(rest)) return rest;
  }
  return null;
}

/** Is this order line an event ticket? Reports bucket on this: a ticket is
 *  "Event tickets" because its product is BT-15, not because of any prefix. */
export const isEventLine = (productId: string): boolean => eventIdFromLine(productId) !== null;

export interface EventTierSales {
  sold: number;
  refunded: number;
  gross: Minor;
  net: Minor;
}

/** Per-tier sales for every event, replayed from the ledger in one pass. */
function ledgerAll(): Map<string, Map<string, EventTierSales>> {
  const ids = new Set(eventProducts().map((p) => p.id));
  const out = new Map<string, Map<string, EventTierSales>>();
  if (!ids.size) return out;
  const idOf = (productId: string) => {
    if (ids.has(productId)) return productId;
    if (productId.startsWith(LEGACY_LINE_PREFIX)) {
      const rest = productId.slice(LEGACY_LINE_PREFIX.length);
      if (ids.has(rest)) return rest;
    }
    return null;
  };
  for (const o of peekOrders()) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) {
      const eventId = idOf(l.productId);
      if (!eventId || !l.tierId) continue;
      let tiers = out.get(eventId);
      if (!tiers) out.set(eventId, (tiers = new Map()));
      const cur = tiers.get(l.tierId) ?? { sold: 0, refunded: 0, gross: 0, net: 0 };
      const refunded = l.refundedQuantity ?? 0;
      cur.sold += l.quantity - refunded;
      cur.refunded += refunded;
      cur.gross += l.total;
      cur.net += l.total - (l.refundedAmount ?? 0);
      tiers.set(l.tierId, cur);
    }
  }
  return out;
}

/** Per-tier sales for one event, replayed from the ledger. */
export function eventLedger(eventId: string): Map<string, EventTierSales> {
  return ledgerAll().get(eventId) ?? new Map();
}

const liveIn = (led: Map<string, EventTierSales> | undefined, e: EventRecord): EventRecord =>
  led?.size
    ? {
        ...e,
        tiers: e.tiers.map((t) => ({ ...t, sold: t.sold + (led.get(t.id)?.sold ?? 0), taken: led.get(t.id)?.net ?? 0 })),
      }
    : e;

/** The record with its tiers' `sold` brought up to date from the ledger. Takes
 *  the opening-balance view (`eventViewBase`); a view from `eventView` is
 *  already live and must not be passed through again. */
export function withLiveSales(e: EventRecord): EventRecord {
  return liveIn(eventLedger(e.id), e);
}

/** The event view of a BT-15 product, with tickets sold here counted. The one
 *  place the catalogue, the till and every event screen get an `EventRecord`. */
export const eventView = (p: Product): EventRecord => withLiveSales(eventViewBase(p));

/* ── The page view: any booking, drawn by any look ───────────────────────── */

export interface PageViewOptions {
  /** The moment the page is read at (a preview and a live page pass theirs). */
  now?: Date;
  /** The booking's "when" in words, in the reader's language — built from the
   *  booking by a hook, because this file has no translator. Only used for a
   *  booking that repeats; an on-a-date booking has its own date. */
  whenText?: string;
  /** Where the booking is when it names no location of its own. */
  venue?: { name: string; address?: string };
}

const EVENT_SECTIONS: ReadonlySet<string> = new Set<string>([
  "hero", "countdown", "stats", "highlights", "about", "lineup", "schedule", "gallery", "tickets", "venue", "video", "sponsors", "faq",
]);

/**
 * ANY booking as the record the page templates draw (docs/catalog.md §10.6).
 *
 * An on-a-date booking (BT-15) is its `eventView`, with the look, the section
 * list and the photos of its page laid over it. Every other booking is built
 * from what it already knows:
 *
 *   - when: its NEXT bookable day if it has a schedule (or a course's next
 *     date), with `whenText` saying the pattern in words ("Every 45 min, …");
 *     with neither it is `undated` and no screen may draw a date for it;
 *   - where: its location's name and address (the first of `locationIds`);
 *   - tickets: its price tiers — one with no capacity is unlimited;
 *   - the page: `pageOf`, the look's defaults for what it leaves out.
 *
 * Pure of the clock apart from `nextAvailable`, which takes `opts.now`.
 */
export function pageView(p: Product, opts: PageViewOptions = {}): EventRecord {
  const page = pageOf(p);
  const look = page.look;
  const base = withLiveSales(eventViewBase(p));
  const dated = isEventProduct(p) && !!p.event;
  const cat = categoryById(look === "standard" ? base.categoryId : look);
  const d = lookDefaults(look);

  let startsAt = base.startsAt;
  let undated = false;
  let venueName = base.venueName;
  let venueAddress = base.venueAddress;
  let whenText: string | undefined;
  if (!dated) {
    const now = opts.now ?? demoNow();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const next = nextAvailable(p, now);
    const course = p.courseDates?.find((x) => x >= today) ?? p.courseDates?.[0];
    const day = next?.date ?? course;
    /* Noon, in the business's offset: only the DAY of this is ever shown (the
       time of day lives in `whenText`), and noon keeps that day the same in
       every reader's zone. */
    if (day) startsAt = `${day}T12:00:00+06:00`;
    else {
      undated = true;
      startsAt = p.createdAt;
    }
    whenText = opts.whenText;
    const loc = peekLocations().find((l) => l.id === p.locationIds[0]);
    venueName = loc?.name ?? opts.venue?.name ?? "";
    venueAddress = loc
      ? [loc.addressLine1, loc.addressLine2, loc.city].filter(Boolean).join(", ") || undefined
      : opts.venue?.address;
  }

  const listed = [...new Set(page.sections)];
  const pageSections: PageSectionId[] = [
    ...(listed.includes("hero") ? [] : (["hero"] as PageSectionId[])),
    ...listed,
    ...(listed.includes("tickets") ? [] : (["tickets"] as PageSectionId[])),
  ];
  const variant = page.variant && cat.variants.includes(page.variant) ? page.variant : (d.variant ?? cat.variants[0]);

  return {
    ...base,
    categoryId: cat.id,
    startsAt,
    endsAt: dated ? base.endsAt : undefined,
    days: dated ? base.days : undefined,
    venueName,
    venueAddress,
    undated: undated || undefined,
    whenText,
    images: p.images,
    customisation: {
      accent: page.accent ?? d.accent ?? cat.theme.accent,
      displayFont: page.displayFont ?? d.displayFont ?? cat.theme.display,
      bodyFont: page.bodyFont ?? d.bodyFont ?? cat.theme.body,
      variant,
      sections: pageSections.filter((x): x is SectionId => EVENT_SECTIONS.has(x)),
      pageSections,
      coverUrl: page.coverUrl ?? p.images[0]?.url,
    },
  };
}

const viewsOf = (rows: Product[]): EventRecord[] => {
  const all = ledgerAll();
  return rows.map((p) => liveIn(all.get(p.id), eventViewBase(p)));
};

const toView = (res: ApiResult<Product>): ApiResult<EventRecord> => (res.ok ? { ...res, data: eventView(res.data) } : res);

export const listEvents = async (params?: ListParams): Promise<ApiResult<ListResponse<EventRecord>>> => {
  const res = await resource.list(params);
  return res.ok ? { ...res, data: { ...res.data, data: viewsOf(res.data.data) } } : res;
};

export const getEvent = async (id: string): Promise<ApiResult<EventRecord>> => {
  const res = await resource.get(id);
  return res.ok && isEventProduct(res.data) ? toView(res) : fail<EventRecord>(notFoundError("Event"));
};

/* ── The settlement ───────────────────────────────────────────────────────
 *
 * What a box office actually settles a show on, and the report every ticketing
 * system converges on: per ticket type — capacity, sold, unsold and the face
 * value that brought in — then the same per day, the channel split, and the
 * refunds. Built from the ledger plus each tier's opening balance.
 *
 * Capacity is stated per DAY as a grouped capacity: a weekend pass takes a
 * place on Saturday and on Sunday, so a day's sold count includes every ticket
 * that admits it. Anything else reports a festival as half empty on the day it
 * has actually filled.
 */
export interface SettlementRow {
  id: string;
  name: string;
  price: Minor;
  capacity: number;
  sold: number;
  unsold: number;
  faceValue: Minor;
  gross: Minor;
  refunded: number;
  refundedAmount: Minor;
  net: Minor;
}
export interface EventSettlement {
  event: EventRecord;
  tiers: SettlementRow[];
  days: { id: string; name: string; date: string; capacity: number; sold: number; unsold: number }[];
  byChannel: { channel: Channel | "opening"; sold: number; net: Minor }[];
  totals: { capacity: number; sold: number; unsold: number; faceValue: Minor; gross: Minor; refundedAmount: Minor; net: Minor };
}

export function eventSettlement(e: EventRecord, dayLabel: (i: number) => string): EventSettlement {
  const led = eventLedger(e.id);
  /* Opening balances come from the product itself, so a record that is already
     live (what the screens hand in) is never counted twice. */
  const p = eventProduct(e.id);
  const raw = p ? eventViewBase(p) : e;
  const tiers: SettlementRow[] = raw.tiers.map((t) => {
    const l = led.get(t.id);
    /* The opening balance counts as sold and as face value, but carries no
       money here: it was taken before this system was recording, and inventing
       a figure for it would put a number in a settlement that nothing backs. */
    const sold = t.sold + (l?.sold ?? 0);
    return {
      id: t.id,
      name: t.name,
      price: t.price,
      capacity: t.quantity,
      sold,
      unsold: Math.max(0, t.quantity - sold),
      /* A guide, not money: the tickets sold, at the price they cost today. */
      faceValue: sold * t.price,
      gross: l?.gross ?? 0,
      refunded: l?.refunded ?? 0,
      refundedAmount: (l?.gross ?? 0) - (l?.net ?? 0),
      net: l?.net ?? 0,
    };
  });
  /* Ordered by price, high to low, then by name — the order a settlement is
     read in, and the one every box-office report uses. */
  tiers.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));

  const live = liveIn(led, raw);
  const days = eventDays(live).map((d, i) => {
    const f = dayFill(live, d.id);
    return {
      id: d.id,
      name: d.name?.trim() || dayLabel(i + 1),
      date: d.date,
      capacity: f.cap,
      sold: f.sold,
      unsold: Math.max(0, f.cap - f.sold),
    };
  });

  const byChannel = new Map<string, { sold: number; net: Minor }>();
  const opening = raw.tiers.reduce((n, t) => n + t.sold, 0);
  if (opening > 0) byChannel.set("opening", { sold: opening, net: 0 });
  for (const o of peekOrders()) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) {
      if (eventIdFromLine(l.productId) !== e.id) continue;
      const cur = byChannel.get(o.channel) ?? { sold: 0, net: 0 };
      cur.sold += l.quantity - (l.refundedQuantity ?? 0);
      cur.net += l.total - (l.refundedAmount ?? 0);
      byChannel.set(o.channel, cur);
    }
  }

  const sum = (f: (r: SettlementRow) => number) => tiers.reduce((n, r) => n + f(r), 0);
  return {
    event: live,
    tiers,
    days,
    byChannel: [...byChannel].map(([channel, v]) => ({ channel: channel as Channel | "opening", ...v })),
    totals: {
      capacity: sum((r) => r.capacity),
      sold: sum((r) => r.sold),
      unsold: sum((r) => r.unsold),
      faceValue: sum((r) => r.faceValue),
      gross: sum((r) => r.gross),
      refundedAmount: sum((r) => r.refundedAmount),
      net: sum((r) => r.net),
    },
  };
}

/**
 * An event's public page, by its address (the item's `slug`).
 *
 * Refused unless it is **live** — on sale, and sold online. A draft and an
 * address nobody has taken look identical from outside, which is the rule the
 * storefront already follows: "not published yet" tells a guesser they are
 * close.
 */
export async function getPublicEvent(slug: string): Promise<ApiResult<EventRecord>> {
  const p = eventProducts().find((x) => (x.slug ?? slugify(x.name)) === slug && x.status === "active" && x.channels.includes("online"));
  if (!p) return fail<EventRecord>(notFoundError("Event"));
  return ok(structuredClone(eventView(p)));
}

/** Every event whose counters sell it at this venue, on sale today. */
export function counterEvents(locationId: string | null): EventRecord[] {
  return viewsOf(
    eventProducts().filter(
      (p) =>
        p.status === "active" &&
        p.channels.includes("counter") &&
        (!locationId || !p.locationIds.length || p.locationIds.includes(locationId)),
    ),
  );
}

export function createEvent(input: EventInput): Promise<ApiResult<EventRecord>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  const prod = productFromEvent(input);
  return resource
    .create({ ...prod, archivedAt: prod.status === "archived" ? new Date().toISOString() : null } as Omit<Product, "id" | "createdAt" | "updatedAt">)
    .then(toView);
}

/** An event patch applied to its product, field by field. Written out rather
 *  than round-tripped through the view, so anything the view does not carry
 *  (photos, the page's sample marks, other tiers' fields) survives an edit. */
function applyPatch(p: Product, patch: Partial<EventInput>): Partial<Product> {
  const next: Partial<Product> = {};
  const ev = { ...(p.event ?? { kind: "entertainment" as const, subtype: "event", startsAt: p.createdAt, venueName: "" }) };
  const cat = categoryById(ev.kind ?? "entertainment");
  const pg: ProductPage = { ...(p.page ?? { look: ev.kind ?? "standard", sections: cat.sections, stats: [], highlights: [], info: [], faq: [], lineup: [], sponsors: [] }) };
  let evTouched = false;
  let pgTouched = false;
  const setEv = <K extends keyof typeof ev>(k: K, v: (typeof ev)[K]) => {
    ev[k] = v;
    evTouched = true;
  };
  const setPg = <K extends keyof typeof pg>(k: K, v: (typeof pg)[K]) => {
    pg[k] = v;
    pgTouched = true;
  };

  if ("title" in patch) next.name = patch.title;
  if ("description" in patch) next.description = patch.description ?? "";
  if ("slug" in patch) next.slug = patch.slug;
  if ("channels" in patch) next.channels = patch.channels ?? ["online"];
  if ("locationIds" in patch) next.locationIds = patch.locationIds ?? [];
  if ("extras" in patch) next.addOns = patch.extras;
  const statusChange = patch.status !== undefined && patch.status !== p.status ? patch.status : undefined;
  if (statusChange) {
    next.status = statusChange;
    next.archivedAt = statusChange === "archived" ? new Date().toISOString() : null;
  } else if (patch.published !== undefined && p.status !== "archived" && patch.published !== (p.status === "active")) {
    // Echoing back the value a view already had is not a change.
    next.status = patch.published ? "active" : "inactive";
  }

  if ("categoryId" in patch && patch.categoryId) {
    setEv("kind", patch.categoryId);
    setPg("look", patch.categoryId);
  }
  if ("subtype" in patch && patch.subtype !== undefined) setEv("subtype", patch.subtype);
  if ("startsAt" in patch && patch.startsAt) setEv("startsAt", patch.startsAt);
  if ("endsAt" in patch) setEv("endsAt", patch.endsAt);
  if ("days" in patch) setEv("days", patch.days);
  if ("venueName" in patch && patch.venueName !== undefined) setEv("venueName", patch.venueName);
  if ("venueAddress" in patch) setEv("venueAddress", patch.venueAddress);

  if ("subtitle" in patch) setPg("tagline", patch.subtitle);
  if ("lineup" in patch && patch.lineup) setPg("lineup", patch.lineup);
  if ("stats" in patch && patch.stats) setPg("stats", patch.stats);
  if ("highlights" in patch && patch.highlights) setPg("highlights", patch.highlights);
  if ("info" in patch && patch.info) setPg("info", patch.info);
  if ("faq" in patch && patch.faq) setPg("faq", patch.faq);
  if ("videoUrl" in patch) setPg("videoUrl", patch.videoUrl);
  if ("organiser" in patch) setPg("organiser", patch.organiser);
  if ("sponsors" in patch && patch.sponsors) setPg("sponsors", patch.sponsors);
  if ("customisation" in patch && patch.customisation) {
    const c = patch.customisation;
    pg.accent = c.accent;
    pg.displayFont = c.displayFont;
    pg.bodyFont = c.bodyFont;
    pg.variant = c.variant;
    pg.sections = c.sections;
    pg.coverUrl = c.coverUrl;
    pgTouched = true;
  }

  if ("tiers" in patch && patch.tiers) {
    /* The editor hands back the tickets as it read them — `sold` already
       includes what was sold here. Taking that as the opening balance would
       count every sale twice, so the ledger's share comes back off. */
    const led = eventLedger(p.id);
    const existing = new Map(p.tiers.map((t) => [t.id, t]));
    next.tiers = patch.tiers.map((t) => {
      const mapped = tierToPrice({ ...t, sold: Math.max(0, t.sold - (led.get(t.id)?.sold ?? 0)) });
      return { ...(existing.get(t.id) ?? {}), ...mapped, id: t.id } as PriceTier;
    });
  }

  if (evTouched) next.event = ev;
  if (pgTouched) next.page = pg;
  return next;
}

export function updateEvent(id: string, patch: Partial<EventInput>): Promise<ApiResult<EventRecord>> {
  const p = eventProduct(id);
  if (!p) return Promise.resolve(fail(notFoundError("Event")));
  const errors = validate(patch, p.event?.days);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, applyPatch(p, patch)).then(toView);
}

/**
 * Take an event off the list without losing it.
 *
 * Takes it off sale as it goes: an archived event that kept serving its public
 * page would be on sale to the world and invisible to the operator, which is
 * the worst of both. Its orders are untouched — that is the whole difference
 * between archiving and deleting.
 */
export function archiveEvent(id: string): Promise<ApiResult<EventRecord>> {
  return resource.archive(id).then(toView);
}

/** Back onto the list, as a draft. It does NOT go back on sale: whoever
 *  archived it took it off sale, and putting it back is a separate decision. */
export function restoreEvent(id: string): Promise<ApiResult<EventRecord>> {
  return resource.update(id, { status: "inactive", archivedAt: null }).then(toView);
}

/** On sale or off sale. */
export function setEventPublished(id: string, published: boolean): Promise<ApiResult<EventRecord>> {
  return resource.update(id, { status: published ? "active" : "inactive", archivedAt: null }).then(toView);
}

/**
 * A permanent delete — and only while nothing has been sold.
 *
 * A ticket that has been bought points at its event, and removing the record
 * under it would orphan the order and the ticket the guest is holding. That is
 * exactly the case archiving exists for, so the refusal names it.
 */
export function deleteEvent(id: string): Promise<ApiResult<EventRecord>> {
  const p = eventProduct(id);
  if (!p) return Promise.resolve(fail(notFoundError("Event")));
  if (eventSold(eventView(p)) > 0) {
    return Promise.resolve(
      fail(validationError({ event: "Tickets have been sold for this event. Archive it instead." })),
    );
  }
  return resource.remove(id).then(toView);
}

/**
 * Copy an event to build the next one from — the commonest thing anyone does
 * to a recurring event, and it was a full trip through the wizard.
 *
 * Three things deliberately do NOT come across. It lands **off sale**, because
 * a half-edited copy must not be on sale the moment it exists. Every tier's
 * **sold count resets to zero**, because last year's numbers are not this
 * year's and a copy that inherited them would report revenue nobody took. And
 * each tier gets a **fresh id**, so an order can never resolve to a tier on the
 * wrong event.
 */
export function duplicateEvent(id: string, title: string): Promise<ApiResult<EventRecord>> {
  const p = eventProduct(id);
  if (!p) return Promise.resolve(fail(notFoundError("Event")));
  const taken = eventProducts().map((x) => x.slug ?? slugify(x.name));
  const c = structuredClone(eventViewBase(p));
  const stamp = Date.now().toString(36);
  const dayMap = new Map((c.days ?? []).map((d, i) => [d.id, `day_${stamp}_${i}`]));
  /* Written out rather than spread, and deliberately: a field added to
     EventRecord tomorrow must not start copying itself into duplicates
     silently. The bookings catalogue's `omit` carries the same note. */
  return createEvent({
    title,
    slug: slugify(title, taken),
    published: false,
    status: "inactive",
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
