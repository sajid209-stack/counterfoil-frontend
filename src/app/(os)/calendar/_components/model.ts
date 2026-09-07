/* The calendar's own view model.

   Everything the three grids draw is a `CalEvent` — a booking or a hold,
   already resolved to real start/end instants. The grids know nothing about
   bookings, products or holds; they position rectangles. That is what keeps
   day, week and month from drifting apart. */
import type { Booking, HoldView, Product, Resource, Staff } from "@/lib/api";

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
  orderId?: string;
  tone: EventTone;
  locked: boolean;
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

export const hhmm = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

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

export function bookingsToEvents(
  bookings: Booking[],
  products: Product[],
  resources: Resource[],
  staff: Staff[],
): CalEvent[] {
  const productOf = (id: string) => products.find((p) => p.id === id);
  const ownerName = (id?: string | null) =>
    resources.find((r) => r.id === id)?.name ?? staff.find((s) => s.id === id)?.name ?? null;

  return bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => {
      const product = productOf(b.productId);
      const owner = ownerName(b.resourceId);
      const parts = [
        `${b.partySize} ${b.partySize === 1 ? "guest" : "guests"}`,
        owner,
      ].filter(Boolean);
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
        orderId: b.orderId,
        tone: toneOf(b),
        locked: !!b.lockedAt,
      };
    });
}

/** Holds belong on the calendar — a manager looking at a day needs to see the
 *  capacity that is spoken for as well as the capacity that is sold. */
export function holdsToEvents(holds: HoldView[]): CalEvent[] {
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
          ? "Session closed"
          : h.kind === "resource"
            ? (h.resourceName ?? "Resource held")
            : h.kind === "seats"
              ? `${h.seatLabels?.length ?? 0} seats held`
              : `${h.quantity} places held`;
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
export const TONE_CLASS: Record<EventTone, string> = {
  booked: "bg-ember-wash border-ember/25 text-fg",
  arrived: "bg-success-wash border-success/25 text-fg",
  noshow: "bg-muted-wash border-line text-muted line-through",
  held: "border-warning/35 text-fg bg-warning-wash bg-[repeating-linear-gradient(45deg,rgb(0_0_0/0.05),rgb(0_0_0/0.05)_3px,transparent_3px,transparent_7px)]",
  locked: "border-danger/35 text-fg bg-danger-wash bg-[repeating-linear-gradient(45deg,rgb(0_0_0/0.05),rgb(0_0_0/0.05)_3px,transparent_3px,transparent_7px)]",
};

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

/** What the cards above the grid count. */
export interface WindowStats {
  bookings: number;
  arrived: number;
  noshow: number;
  holds: number;
}

/**
 * Totals for one window, so the cards above the grid can state what the period
 * on screen actually contains and how it compares with the one before it.
 *
 * Counted from the events the SELECT filters allow but before the state
 * toggles narrow them: switching "no-show" off is a way of looking at the
 * grid, not a claim that there were no no-shows, and a headline figure that
 * moved when you did that would be lying.
 */
export function windowStats(events: CalEvent[], from: Date, to: Date): WindowStats {
  const inRange = events.filter((e) => e.start >= from && e.start < to);
  return {
    bookings: inRange.filter((e) => e.kind === "booking").length,
    arrived: inRange.filter((e) => e.tone === "arrived").length,
    noshow: inRange.filter((e) => e.tone === "noshow").length,
    holds: inRange.filter((e) => e.kind === "hold").length,
  };
}

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
