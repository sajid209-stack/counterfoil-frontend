/* The calendar's own view model.

   Everything the three grids draw is a `CalEvent` — a booking or a hold,
   already resolved to real start/end instants. The grids know nothing about
   bookings, products or holds; they position rectangles. That is what keeps
   day, week and month from drifting apart. */
import type { Booking, HoldView, MarketplaceId, OrderSource, Product, Resource, Staff } from "@/lib/api";
import { formatClockMin, formatClockRange } from "@/lib/format";

/** The visual language a slot can be in. These reuse patterns the app already
 *  established — hatching means "blocked", never a new colour to learn. */
export type EventTone = "booked" | "arrived" | "noshow" | "held" | "locked";

export interface CalEvent {
  id: string;
  kind: "booking" | "hold";
  title: string;
  /** The second line: party size, who a hold is for, the resource. */
  subtitle?: string;
  start: Date;
  end: Date;
  /** Whole-day events (a day-wide hold) sit in their own strip, not the grid. */
  allDay: boolean;
  /** Which lane it belongs to in the day view: a resource id, a staff id, or
   *  null for "not assigned to anything". */
  ownerId: string | null;
  productId: string;
  /** Bookings only: what the detail panel needs to act on one without going
   *  back to the store — how many are coming, and how many are already in. */
  partySize?: number;
  /** Who the booking is for, when the order names them. */
  guest?: string | null;
  /** "2 people" — the head count, on its own. */
  party?: string;
  checkedIn?: number;
  orderId?: string;
  /** Bookings only: sold through a marketplace rather than direct, taken from
   *  the order's own snapshot. Absent means a direct sale — which is what
   *  every order written before marketplaces was. The commission is the
   *  rate and amount AT THE TIME OF SALE, never recomputed. */
  source?: {
    id: MarketplaceId;
    name: string;
    reference?: string;
    commissionBps: number;
    commissionAmount: number;
  };
  /** "Booked on Viator" — appended to a block's accessible name, so the
   *  channel is said in words and not only drawn in violet. */
  sourceLabel?: string;
  /** Holds only: what the detail panel needs to answer "is this court still
   *  ours next Tuesday, and who blocked it?" without going back to the store.
   *  All three are on the record already; nothing was drawing them. */
  hold?: { what: string; product: string; releases: string | null; placedBy: string };
  tone: EventTone;
  locked: boolean;
}

/**
 * The booking being made, as the grid draws it.
 *
 * Google Calendar's quick-create puts a "(No title)" block on the grid the
 * moment you click, and the block follows the form: change the time and it
 * moves, type a title and it gains one. That block is most of why the popover
 * feels like part of the calendar rather than a form floating over it — you
 * see WHERE the thing you are making will go before you make it. This is that
 * block. The panel owns what it says; the grids only draw it.
 */
export interface Ghost {
  /** ISO date. */
  date: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** The day view lane it sits on — a resource id or a session lane. Absent
   *  when nothing chosen says where yet. */
  laneId?: string;
  /** Day tickets and passes have no time, so they sit in the all-day strip. */
  allDay?: boolean;
  /** What is being booked, once chosen. Null draws the placeholder. */
  title: string | null;
  /** The second line: the lane, the therapist. */
  sub?: string | null;
  /** A draft hold rather than a draft booking. Drawn hatched, like the holds
   *  already on the grid — an ember block would promise a sale. */
  hold?: boolean;
}

export const MINUTES_IN_DAY = 1440;

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const isoDate = (d: Date): string => {
  // Local date, not UTC: `toISOString` would shift the day for +06:00.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b);

/** Minutes from midnight, as a float so a 90-minute booking lands exactly. */
export const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/** 24-hour "HH:MM" — DATA (keys, comparisons, slot times). Never draw it:
 *  what a person reads goes through `clockOf` / `clockRangeOf`. */
export const hhmm = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** The clock time of an instant as a person reads it: "7:00 PM" ("7 PM" short). */
export const clockOf = (d: Date, short = false): string => formatClockMin(minutesOf(d), { short });

/** A span between two instants as a person reads it: "7:00 – 9:00 PM". */
export const clockRangeOf = (a: Date, b: Date): string => formatClockRange(minutesOf(a), minutesOf(b));

/** A span for a tight cell, minutes from midnight: "6 – 9 PM", "4:15 – 5 PM",
 *  "11 AM – 1 PM". The AM/PM is said once when both ends share it. */
export function shortClockRange(a: number, b: number): string {
  const x = formatClockMin(a, { short: true });
  const y = formatClockMin(b, { short: true });
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} – ${y}` : `${x} – ${y}`;
}

/** Monday-first week containing `d`. */
export function weekStart(d: Date): Date {
  const x = startOfDay(d);
  const shift = (x.getDay() + 6) % 7; // Sun=0 → 6
  return addDays(x, -shift);
}

/** The 6×7 grid a month view draws, including the leading and trailing days
 *  that belong to the neighbouring months. */
export function monthMatrix(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** How long a booking runs when nothing says otherwise. Prefers the explicit
 *  end, then the product's own session length, and only then a default —
 *  guessing an hour for a 20-minute slot would draw a lie. */
export function bookingEnd(b: Booking, product?: Product): Date {
  if (b.slotEnd) return new Date(b.slotEnd);
  const minutes =
    product?.schedule?.sessionMinutes ||
    product?.schedule?.slotMinutes ||
    product?.durationConfig?.minMinutes ||
    60;
  return new Date(Date.parse(b.slotStart) + minutes * 60000);
}

function toneOf(b: Booking): EventTone {
  if (b.noShow) return "noshow";
  if ((b.checkedIn ?? 0) > 0) return "arrived";
  return "booked";
}

/** The words a block carries, in the reader's language. The page passes them
 *  in from its messages; the English defaults keep the model usable on its
 *  own, but a Bangla screen must never fall back to them. */
export interface EventWords {
  /** "2 people" — the head count on a block. */
  people: (count: number) => string;
  /** A session hold: nothing more is sold on that slot. */
  holdWhole: string;
  /** A lane, court or field held with no name of its own. */
  holdPlace: string;
  holdSeats: (count: number) => string;
  holdSpaces: (count: number) => string;
  /** "Booked on Viator" — the channel, in words. */
  bookedOn: (name: string) => string;
}

const ENGLISH_WORDS: EventWords = {
  people: (n) => `${n} ${n === 1 ? "person" : "people"}`,
  holdWhole: "Sales stopped",
  holdPlace: "Place on hold",
  holdSeats: (n) => `${n} ${n === 1 ? "seat" : "seats"} on hold`,
  holdSpaces: (n) => `${n} ${n === 1 ? "space" : "spaces"} on hold`,
  bookedOn: (name) => `Booked on ${name}`,
};

export function bookingsToEvents(
  bookings: Booking[],
  products: Product[],
  resources: Resource[],
  staff: Staff[],
  /** Who an order is for. The desk's question at a lane is "who is on it",
   *  and the product name alone cannot answer it. */
  guestOf?: (orderId: string) => string | null,
  words: EventWords = ENGLISH_WORDS,
  /** Where an order was sold, from the order itself. Null is a direct sale. */
  sourceOf?: (orderId: string) => OrderSource | null,
): CalEvent[] {
  const productOf = (id: string) => products.find((p) => p.id === id);
  const ownerName = (id?: string | null) =>
    resources.find((r) => r.id === id)?.name ?? staff.find((s) => s.id === id)?.name ?? null;

  return bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => {
      const product = productOf(b.productId);
      const owner = ownerName(b.resourceId);
      const guest = (b.orderId && guestOf?.(b.orderId)) || null;
      const party = words.people(b.partySize);
      const parts = [guest, party, owner].filter(Boolean);
      const src = (b.orderId && sourceOf?.(b.orderId)) || null;
      return {
        id: b.id,
        kind: "booking" as const,
        title: product?.name ?? b.productId,
        subtitle: parts.join(" · "),
        start: new Date(b.slotStart),
        end: bookingEnd(b, product),
        allDay: false,
        ownerId: b.resourceId ?? null,
        productId: b.productId,
        partySize: b.partySize,
        guest,
        party,
        checkedIn: b.checkedIn ?? 0,
        orderId: b.orderId,
        ...(src
          ? {
              source: {
                id: src.marketplaceId,
                name: src.marketplaceName,
                reference: src.reference,
                commissionBps: src.commissionBps,
                commissionAmount: src.commissionAmount,
              },
              sourceLabel: words.bookedOn(src.marketplaceName),
            }
          : {}),
        tone: toneOf(b),
        locked: !!b.lockedAt,
      };
    });
}

/** Holds belong on the calendar — a manager looking at a day needs to see the
 *  capacity that is spoken for as well as the capacity that is sold. */
export function holdsToEvents(holds: HoldView[], words: EventWords = ENGLISH_WORDS): CalEvent[] {
  return holds
    .filter((h) => h.active)
    .map((h) => {
      const start = h.slotStart ? new Date(h.slotStart) : new Date(`${h.date}T00:00:00`);
      const end = h.slotEnd
        ? new Date(h.slotEnd)
        : h.slotStart
          ? new Date(Date.parse(h.slotStart) + 60 * 60000)
          : new Date(`${h.date}T23:59:59`);
      const what =
        h.kind === "session"
          ? words.holdWhole
          : h.kind === "resource"
            ? (h.resourceName ?? words.holdPlace)
            : h.kind === "seats"
              ? words.holdSeats(h.seatLabels?.length ?? 0)
              : words.holdSpaces(h.quantity);
      return {
        id: h.id,
        kind: "hold" as const,
        title: h.heldFor,
        subtitle: `${what} · ${h.productName}`,
        start,
        end,
        allDay: !h.slotStart,
        ownerId: h.resourceId ?? null,
        productId: h.productId,
        tone: h.kind === "session" ? ("locked" as const) : ("held" as const),
        locked: true,
        hold: {
          what,
          product: h.productName,
          /* Null means it sits until somebody releases it — which is a fact a
             manager needs, and the commonest kind of stale hold. */
          releases:
            h.expiresAt == null
              ? null
              : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(h.expiresAt)),
          placedBy: h.placedBy,
        },
      };
    });
}

/**
 * The hours the grids actually draw.
 *
 * These were hardcoded 06:00–23:00. That happens to be right for this venue,
 * which is exactly the problem: it is right by coincidence. Every product
 * already declares `startTime`/`endTime`, so the window is the union of them,
 * widened to contain anything actually booked outside it — an event the grid
 * cannot draw is far worse than an empty hour.
 *
 * Deliberately NOT narrowed to the hours that happen to be busy. A manager
 * checking whether the 07:00 slot is free needs to see that it is empty, and a
 * grid that hides its quiet hours cannot answer that. The cure for opening on
 * an empty morning is scrolling to the bookings — see `focusMinute` — not
 * pretending the morning is not there.
 */
export function tradingWindow(
  products: Product[],
  events: CalEvent[],
): { openHour: number; closeHour: number } {
  const hourOf = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
    return m ? Number(m[1]) + Number(m[2]) / 60 : null;
  };

  let open = 24;
  let close = 0;
  for (const p of products) {
    const s = hourOf(p.schedule?.startTime);
    const e = hourOf(p.schedule?.endTime);
    if (s != null) open = Math.min(open, s);
    if (e != null) close = Math.max(close, e);
  }
  for (const e of events) {
    if (e.allDay) continue;
    open = Math.min(open, e.start.getHours() + e.start.getMinutes() / 60);
    close = Math.max(close, e.end.getHours() + e.end.getMinutes() / 60);
  }

  // Nothing to go on — a fresh venue with no catalogue and nothing booked.
  if (open > close) return { openHour: 8, closeHour: 22 };

  return { openHour: Math.max(0, Math.floor(open)), closeHour: Math.min(24, Math.ceil(close)) };
}

/**
 * Where the grid should be scrolled to when it opens.
 *
 * The complaint this answers: the week opened at 06:00 with `scrollTop` 0 and
 * 315px of unseen day below it, so the first thing on screen was four hours of
 * empty grid while every booking sat off the bottom.
 *
 * Prefer the current time when the window on screen contains it — a manager
 * looking at today wants now — and otherwise the first thing booked. Returns
 * minutes from midnight, or null when there is nothing to aim at and the grid
 * should just stay where it is.
 */
export function focusMinute(events: CalEvent[], now: Date, showsNow: boolean): number | null {
  if (showsNow) return minutesOf(now);
  const timed = events.filter((e) => !e.allDay);
  if (timed.length === 0) return null;
  return Math.min(...timed.map((e) => minutesOf(e.start)));
}

/**
 * Pack overlapping events into side-by-side columns.
 *
 * Without this two bookings at the same time draw on top of each other and one
 * of them is invisible — the single worst thing a calendar can do. Events are
 * grouped into clusters that transitively overlap; within a cluster each takes
 * the first column that is free.
 */
export function packLanes(events: CalEvent[]): { event: CalEvent; lane: number; lanes: number }[] {
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
  const out: { event: CalEvent; lane: number; lanes: number }[] = [];

  let cluster: CalEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const placed = cluster.map((e) => {
      let lane = laneEnds.findIndex((end) => end <= e.start.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = e.end.getTime();
      return { event: e, lane };
    });
    for (const p of placed) out.push({ ...p, lanes: laneEnds.length });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const e of sorted) {
    if (cluster.length > 0 && e.start.getTime() >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end.getTime());
  }
  flush();
  return out;
}

/** Tone → the classes an event block wears. Hatching means blocked, the same
 *  as it does on a sold-out slot or an out-of-service lane. */
/**
 * Tone → the classes a block wears.
 *
 * Filled, not flagged. This used to be a white card with a 3px bar down one
 * edge, on the argument that "the bar carries the status and the fill stays
 * calm". The owner asked for the opposite and was right about the effect: a
 * grid of white rectangles reads as a table, and a grid of tinted ones reads
 * as a schedule you can scan without moving your eyes to the left edge of
 * every block to find out what it is.
 *
 * The washes are pale enough to carry body text — measured, not eyeballed —
 * so the text stays `fg` rather than going to a status colour that would then
 * have to be checked against five different grounds.
 *
 * Hatching survives on the two blocked tones. It is the app's "you cannot have
 * this" signal, used the same way on out-of-service lanes and sold-out slots,
 * and it is texture over the fill rather than instead of it.
 */
/**
 * Tone → a pale fill and a 3px stripe down the leading edge. (The calm pass
 * took the 1px outline off the booked, arrived, no-show and marketplace blocks:
 * the fill and the stripe already say where a block is and what it is, and a
 * grid of outlined boxes reads heavier than a grid of tints. The hatched held
 * and locked blocks keep theirs — texture is their signal, and the line holds
 * the pattern's edge.)
 *
 * The stripe is what survives at any size. A 30-minute booking in a shared
 * hour is 20px of wash, which at this weight is nearly the card it sits on —
 * the stripe is full-strength colour, always 3px, and is the thing the eye
 * catches down a column of them. It is also what lets the fill stay this
 * pale, which is what keeps the text on it readable.
 *
 * The fills stay as the `-wash` tokens rather than becoming a literal 10%
 * alpha: these are 700/800-level colours, and 10% of a dark green over paper
 * is a grey-green rather than a pastel, which is why those tokens were
 * written out per theme in the first place. They ARE the 10% — measured, not
 * computed.
 */
export const TONE_CLASS: Record<EventTone, string> = {
  booked: "bg-ember-wash border-transparent border-l-[3px] border-l-ember-solid text-fg",
  arrived: "bg-success-wash border-transparent border-l-[3px] border-l-success text-fg",
  noshow: "bg-muted-wash border-transparent border-l-[3px] border-l-strong text-muted line-through",
  held: "border-warning/35 border-l-[3px] border-l-warning text-fg bg-warning-wash bg-[repeating-linear-gradient(45deg,rgb(0_0_0/0.05),rgb(0_0_0/0.05)_3px,transparent_3px,transparent_7px)]",
  locked: "border-danger/35 border-l-[3px] border-l-danger-solid text-fg bg-danger-wash bg-[repeating-linear-gradient(45deg,rgb(0_0_0/0.05),rgb(0_0_0/0.05)_3px,transparent_3px,transparent_7px)]",
};


/**
 * A booking sold through a marketplace, in the second axis' colour.
 *
 * Colour on this calendar means STATUS, so source cannot take it over: a plain
 * "booked" marketplace booking wears this INSTEAD of ember, and once something
 * has happened — arrived, no-show, locked — the status colours win and source
 * is carried by the badge alone. The stripe is `market` rather than
 * `market-solid`: in dark the pinned solid measures 2.82:1 against the card,
 * under the 3:1 a mark needs, and `market` is the lifted violet that clears it
 * (5.9:1). The solid is for the badge, where white text sits on it.
 */
export const MARKET_CLASS =
  "bg-market-wash border-transparent border-l-[3px] border-l-market text-fg";

/** What a block wears: its status, unless it is a plain booking sold on a
 *  marketplace — then the marketplace's violet. */
export const toneClass = (e: Pick<CalEvent, "tone" | "source">): string =>
  e.source && e.tone === "booked" ? MARKET_CLASS : TONE_CLASS[e.tone];

/** Tone → a single dot. The month view on a phone has no room for chips, so a
 *  day states how much is on and in what state with dots, the way every phone
 *  calendar does. Hatching cannot survive at 6px, so held and locked fall back
 *  to their border colours — the key underneath still names them. */
export const TONE_DOT: Record<EventTone, string> = {
  booked: "bg-ember",
  arrived: "bg-success",
  noshow: "bg-muted",
  held: "bg-warning",
  locked: "bg-danger",
};

/** The same rule for the phone's dots. */
export const toneDotClass = (e: Pick<CalEvent, "tone" | "source">): string =>
  e.source && e.tone === "booked" ? "bg-market" : TONE_DOT[e.tone];

/** Percentage change, or null when the previous period had nothing to compare
 *  against — "+100%" against a week that did not trade is not a fact. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Hover handlers for an event block, or nothing at all on a touch screen.
 *  `mouseenter` fires on tap there, which would open a card under the finger
 *  at the same instant the tap opens the panel behind it. */
export function peekHandlers(
  event: CalEvent,
  onPeek?: (event: CalEvent | null, anchor: DOMRect | null) => void,
) {
  if (!onPeek) return {};
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (!window.matchMedia("(hover: hover)").matches) return;
      onPeek(event, e.currentTarget.getBoundingClientRect());
    },
    onMouseLeave: () => onPeek(null, null),
    // Scrolling the grid moves the block out from under a card that is
    // positioned in viewport coordinates, so the card goes when it does.
    onWheel: () => onPeek(null, null),
  };
}
