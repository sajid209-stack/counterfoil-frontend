import { createResource, fail, validationError } from "./client";
import type { ApiResult, ListParams, ListResponse, Lifecycle, Minor } from "./types";
import type { CategoryId, SectionId } from "@/lib/events/catalog";

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
   *  entry carries one the schedule renders as a single track. */
  day?: string;
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
    (f.status === undefined || e.status === f.status),
  sort: {
    title: (a, b) => a.title.localeCompare(b.title),
    startsAt: (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    createdAt: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  },
  defaultSort: "startsAt",
});

const validate = (input: Partial<EventInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("title" in input && !input.title?.trim()) errors.title = "Give the event a name.";
  if ("startsAt" in input && !input.startsAt) errors.startsAt = "Say when it starts.";
  if ("venueName" in input && !input.venueName?.trim()) errors.venueName = "Say where it is.";
  if ("tiers" in input && (input.tiers ?? []).length === 0) errors.tiers = "Add at least one ticket.";
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
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

/** Capacity and takings, derived — never stored, so they cannot drift. */
export const eventCapacity = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.quantity, 0);
export const eventSold = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold, 0);
export const eventRevenue = (e: EventRecord) => e.tiers.reduce((s, t) => s + t.sold * t.price, 0);
/** What a public card says: the cheapest tier anyone can still buy. */
export const eventFromPrice = (e: EventRecord): Minor | null => {
  const open = e.tiers.filter((t) => t.sold < t.quantity);
  return open.length ? Math.min(...open.map((t) => t.price)) : null;
};

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
