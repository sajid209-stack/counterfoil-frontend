/* booking.v1 — holds and locks (§61).

   A hold takes capacity off public sale without pretending to be a booking.
   Two rules shape the module:

   1. **Expiry is a clock crossing, not a stored flag** — same as membership
      lapsing. `status` records what a person decided (released, converted);
      `effectiveStatus` resolves that against now, so a checkout hold releases
      itself with nobody running a job.

   2. **A hold always names who it is for.** An unexplained block on the
      calendar is indistinguishable from a bug six weeks later, so `heldFor` is
      required — even the till's own checkout holds are labelled. */
import { getOperatorState, createResource, fail, notFoundError, ok, validationError } from "./client";
import { peekBookings } from "./bookings";
import type {
  ApiResult,
  Hold,
  HoldInput,
  HoldStatus,
  HoldView,
  ID,
  ISODate,
  ISODateTime,
  ListParams,
  ListResponse,
  Product,
  Unavailability,
} from "./types";

/** How long the till holds capacity while a cart is open (§61.11). */
export const CHECKOUT_HOLD_MINUTES = 10;
/** The label the till uses, so its holds are obvious in the manager's list. */
export const CHECKOUT_HELD_FOR = "Checkout in progress";

const holds = createResource<Hold>("holds", "Hold", {
  search: (h, q) =>
    h.heldFor.toLowerCase().includes(q) ||
    h.productName.toLowerCase().includes(q) ||
    h.placedBy.toLowerCase().includes(q) ||
    (h.reason ?? "").toLowerCase().includes(q),
  sort: {
    date: (a, b) => `${a.date}${a.slotStart ?? ""}`.localeCompare(`${b.date}${b.slotStart ?? ""}`),
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  },
  defaultSort: "date",
});

export const peekHolds = (): Hold[] => holds.peek();

/** Resolve a stored hold against the clock. */
export function holdView(h: Hold): HoldView {
  const now = Date.now();
  const expired = h.status === "held" && h.expiresAt != null && Date.parse(h.expiresAt) <= now;
  const effectiveStatus: HoldStatus = expired ? "expired" : h.status;
  return {
    ...h,
    effectiveStatus,
    active: effectiveStatus === "held",
    minutesToExpiry:
      h.expiresAt == null ? null : Math.round((Date.parse(h.expiresAt) - now) / 60000),
  };
}

/** Every hold currently taking capacity off sale. */
export const activeHolds = (): HoldView[] => holds.peek().map(holdView).filter((h) => h.active);

export async function listHolds(params?: ListParams): Promise<ApiResult<ListResponse<HoldView>>> {
  const res = await holds.list(params);
  if (!res.ok) return res as ApiResult<ListResponse<HoldView>>;
  const filters = params?.filters ?? {};
  let rows = res.data.data.map(holdView);
  if (filters.effectiveStatus) {
    rows = rows.filter((h) => h.effectiveStatus === filters.effectiveStatus);
  }
  // The till's own short-lived holds are noise in the manager's list unless
  // they are asked for.
  if (filters.includeCheckout !== true) {
    rows = rows.filter((h) => h.heldFor !== CHECKOUT_HELD_FOR);
  }
  return ok({ ...res.data, data: rows, page: { ...res.data.page, total: rows.length } });
}

export async function getHold(id: ID): Promise<ApiResult<HoldView>> {
  const found = holds.peek().find((h) => h.id === id);
  return found ? ok(holdView(found)) : fail<HoldView>(notFoundError("Hold"));
}

export function placeHold(input: HoldInput): Promise<ApiResult<Hold>> {
  const errors: Record<string, string> = {};
  if (!input.heldFor?.trim()) errors.heldFor = "Say who this is being held for.";
  if (!input.date) errors.date = "Pick a date.";
  if (input.kind === "capacity" && input.quantity <= 0) {
    errors.quantity = "Hold at least one place.";
  }
  if (input.kind === "seats" && !(input.seatLabels ?? []).length) {
    errors.seatLabels = "Choose the seats to hold.";
  }
  if (input.kind === "resource" && !input.resourceId) {
    errors.resourceId = "Choose what is being held.";
  }
  if (Object.keys(errors).length) {
    return Promise.resolve(fail<Hold>(validationError(errors)));
  }
  return holds.create({
    ...input,
    productName: input.productName ?? "",
    heldFor: input.heldFor.trim(),
    status: "held",
    convertedOrderId: null,
  } as Omit<Hold, "id" | "createdAt" | "updatedAt">);
}

/** Put the capacity back on sale (§61.3). */
export function releaseHold(id: ID): Promise<ApiResult<Hold>> {
  return holds.update(id, { status: "released" });
}

/** Turn a hold into a real booking (§61.6). The hold is closed rather than
 *  deleted, so the calendar can still explain where the booking came from. */
export function convertHold(id: ID, orderId: ID): Promise<ApiResult<Hold>> {
  return holds.update(id, { status: "converted", convertedOrderId: orderId });
}

export function extendHold(id: ID, minutes: number): Promise<ApiResult<Hold>> {
  const h = holds.peek().find((x) => x.id === id);
  if (!h) return Promise.resolve(fail<Hold>(notFoundError("Hold")));
  const from = h.expiresAt && Date.parse(h.expiresAt) > Date.now() ? Date.parse(h.expiresAt) : Date.now();
  return holds.update(id, { expiresAt: new Date(from + minutes * 60000).toISOString() });
}

// ── the till's own hold (§61.11) ────────────────────────────────────────────
/** Hold capacity while a cart is open. Self-releasing: it carries an expiry,
 *  so an abandoned till gives the places back without anyone intervening. */
export function placeCheckoutHold(input: {
  productId: ID;
  productName: string;
  locationId: ID | null;
  date: ISODate;
  slotStart?: ISODateTime | null;
  quantity: number;
  placedBy: string;
}): Promise<ApiResult<Hold>> {
  return placeHold({
    ...input,
    kind: "capacity",
    heldFor: CHECKOUT_HELD_FOR,
    expiresAt: new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60000).toISOString(),
  } as HoldInput);
}

/** Release every checkout hold this till placed — on completing, clearing or
 *  parking a cart. */
export async function releaseCheckoutHolds(placedBy: string): Promise<ApiResult<number>> {
  const mine = holds
    .peek()
    .filter((h) => h.status === "held" && h.heldFor === CHECKOUT_HELD_FOR && h.placedBy === placedBy);
  for (const h of mine) await holds.update(h.id, { status: "released" });
  return ok(mine.length);
}

// ── what holds do to availability ──────────────────────────────────────────
const sameSlot = (h: HoldView, date: ISODate, slotStart?: string | null) =>
  h.date === date && (h.slotStart ?? null) === (slotStart ?? null);

/**
 * Places held back for a product on a date (and optionally one slot).
 *
 * A `session` hold takes everything, so it is reported as Infinity and callers
 * clamp remaining to zero — that keeps "stop selling this departure" as one
 * mechanism rather than a second flag to remember everywhere.
 */
export function heldPlaces(productId: ID, date: ISODate, slotStart?: string | null): number {
  let held = 0;
  for (const h of activeHolds()) {
    if (h.productId !== productId) continue;
    if (h.kind === "seats" || h.kind === "resource") continue;
    // A whole-day hold counts against every slot on that day.
    const appliesToSlot = h.slotStart == null ? h.date === date : sameSlot(h, date, slotStart);
    if (!appliesToSlot) continue;
    if (h.kind === "session") return Number.POSITIVE_INFINITY;
    held += h.quantity;
  }
  return held;
}

/** Seat labels held back on a date/slot — the seat picker greys these out. */
export function heldSeats(productId: ID, date: ISODate, slotStart?: string | null): string[] {
  return activeHolds()
    .filter((h) => h.productId === productId && h.kind === "seats" && sameSlot(h, date, slotStart))
    .flatMap((h) => h.seatLabels ?? []);
}

/** True when a resource is held back over a span. */
export function isResourceHeld(resourceId: ID, date: ISODate, startISO: string, endISO: string): boolean {
  return activeHolds().some(
    (h) =>
      h.kind === "resource" &&
      h.resourceId === resourceId &&
      h.date === date &&
      // Overlap, not containment: a hold that clips the edge still blocks.
      (h.slotStart ?? `${date}T00:00:00`) < endISO &&
      (h.slotEnd ?? `${date}T23:59:59`) > startISO,
  );
}

/** The hold responsible for a slot being unavailable, if one is. */
export function blockingHold(productId: ID, date: ISODate, slotStart?: string | null): HoldView | undefined {
  return activeHolds().find(
    (h) =>
      h.productId === productId &&
      h.kind !== "seats" &&
      h.kind !== "resource" &&
      (h.slotStart == null ? h.date === date : sameSlot(h, date, slotStart)),
  );
}

// ── locks ───────────────────────────────────────────────────────────────────
const bookings = () => peekBookings();

/** Bookings on this slot are locked when a `session` hold covers it (§61.9). */
export function isSessionLocked(productId: ID, date: ISODate, slotStart?: string | null): boolean {
  return activeHolds().some(
    (h) =>
      h.kind === "session" &&
      h.productId === productId &&
      (h.slotStart == null ? h.date === date : sameSlot(h, date, slotStart)),
  );
}

/** History older than the operator's window cannot be edited (§61.10). */
export function isPastLocked(dateISO: string): boolean {
  const days = getOperatorState().pastEditLockDays;
  if (days == null || days <= 0) return false;
  const cutoff = Date.now() - days * 86400000;
  return Date.parse(dateISO) < cutoff;
}

/**
 * Whether a booking can be changed, and why not when it cannot (§61.7, 10, 12).
 * Every edit path asks this ONE function, so a booking that is untouchable is
 * untouchable everywhere rather than in whichever screens remembered to check.
 */
export function bookingEditable(
  bookingId: ID,
  who: string,
): { editable: true } | { editable: false; reason: string } {
  const b = bookings().find((x) => x.id === bookingId);
  if (!b) return { editable: false, reason: "This booking no longer exists." };
  if (b.lockedAt) {
    return {
      editable: false,
      reason: b.lockReason
        ? `Locked by ${b.lockedBy ?? "a manager"}: ${b.lockReason}`
        : `Locked by ${b.lockedBy ?? "a manager"}.`,
    };
  }
  if (isPastLocked(b.slotStart)) {
    return {
      editable: false,
      reason: `Bookings older than ${getOperatorState().pastEditLockDays} days are closed for editing.`,
    };
  }
  if (b.editingBy && b.editingBy !== who && b.editingUntil && Date.parse(b.editingUntil) > Date.now()) {
    return { editable: false, reason: `${b.editingBy} is editing this booking right now.` };
  }
  return { editable: true };
}

export async function lockBooking(
  bookingId: ID,
  who: string,
  reason: string,
): Promise<ApiResult<true>> {
  const b = bookings().find((x) => x.id === bookingId);
  if (!b) return fail<true>(notFoundError("Booking"));
  b.lockedAt = new Date().toISOString();
  b.lockedBy = who;
  b.lockReason = reason.trim() || null;
  return ok(true);
}

/** Unlocking always takes a reason — the record has to say who overrode what. */
export async function unlockBooking(
  bookingId: ID,
  who: string,
  reason: string,
): Promise<ApiResult<true>> {
  if (!reason.trim()) {
    return fail<true>(validationError({ reason: "Say why it is being unlocked." }));
  }
  const b = bookings().find((x) => x.id === bookingId);
  if (!b) return fail<true>(notFoundError("Booking"));
  b.lockedAt = null;
  b.lockedBy = null;
  b.lockReason = `Unlocked by ${who}: ${reason.trim()}`;
  return ok(true);
}

/** Claim a short edit lease (§61.12). Advisory in the mock; the backend
 *  enforces it, and this is the contract it will enforce. */
const LEASE_MINUTES = 5;
export async function claimBookingEdit(bookingId: ID, who: string): Promise<ApiResult<true>> {
  const check = bookingEditable(bookingId, who);
  if (!check.editable) return fail<true>({ code: "conflict", message: check.reason });
  const b = bookings().find((x) => x.id === bookingId)!;
  b.editingBy = who;
  b.editingUntil = new Date(Date.now() + LEASE_MINUTES * 60000).toISOString();
  return ok(true);
}

export async function releaseBookingEdit(bookingId: ID, who: string): Promise<ApiResult<true>> {
  const b = bookings().find((x) => x.id === bookingId);
  if (b && b.editingBy === who) {
    b.editingBy = null;
    b.editingUntil = null;
  }
  return ok(true);
}

// ── one answer for "why can I not sell this?" (§61.14) ──────────────────────
/**
 * The single explanation every surface reads from. A slot that looks free but
 * refuses a sale is the most confusing thing an operator meets, so the answer
 * always names the mechanism AND the way forward.
 */
export function explainUnavailable(args: {
  product: Product;
  date: ISODate;
  slotStart?: string | null;
  remaining: number;
  /** Places the customer is trying to take. */
  wanted?: number;
}): Unavailability | null {
  const { product, date, slotStart, remaining, wanted = 1 } = args;

  if (isSessionLocked(product.id, date, slotStart)) {
    const h = blockingHold(product.id, date, slotStart);
    return {
      reason: "session_locked",
      message: `This session is closed for sales${h ? ` — ${h.heldFor}` : ""}. Release it from Holds to sell again.`,
      holdId: h?.id,
    };
  }

  if (isPastLocked(slotStart ?? `${date}T12:00:00`)) {
    return {
      reason: "past_date",
      message: "This date is closed for editing. Change the window in Settings if you need to.",
    };
  }

  if (remaining >= wanted) return null;

  const held = heldPlaces(product.id, date, slotStart);
  if (held > 0 && remaining + held >= wanted) {
    const h = blockingHold(product.id, date, slotStart);
    return {
      reason: "held_back",
      message: h
        ? `${held} ${held === 1 ? "place is" : "places are"} held for ${h.heldFor}. Release the hold to sell them.`
        : `${held} places are held back. Release the hold to sell them.`,
      holdId: h?.id,
    };
  }

  return {
    reason: "sold_out",
    message:
      remaining === 0
        ? "This session is sold out."
        : `Only ${remaining} ${remaining === 1 ? "place" : "places"} left — not enough for ${wanted}.`,
  };
}
