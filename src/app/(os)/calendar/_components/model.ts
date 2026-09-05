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
export const TONE_CLASS: Record<EventTone, string> = {
  booked: "bg-card border-line [border-left:3px_solid_var(--color-ember)] text-fg",
  // The bar carries the status; the fill stays calm. A month of attended
  // bookings tinted green is a wall of the least actionable thing on screen.
  arrived: "bg-card border-line [border-left:3px_solid_var(--color-success)] text-fg",
  noshow: "bg-subtle border-line [border-left:3px_solid_var(--color-muted)] text-muted line-through",
  held: "border-warning/40 [border-left:3px_solid_var(--color-warning)] text-fg bg-[repeating-linear-gradient(45deg,var(--color-warning-wash),var(--color-warning-wash)_3px,transparent_3px,transparent_7px)]",
  locked: "border-danger/40 [border-left:3px_solid_var(--color-danger)] text-fg bg-[repeating-linear-gradient(45deg,var(--color-danger-wash),var(--color-danger-wash)_3px,transparent_3px,transparent_7px)]",
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
