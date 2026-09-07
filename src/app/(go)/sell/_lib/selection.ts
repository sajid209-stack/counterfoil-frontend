/* ── What one block of the sale is still deciding ──────────────────────────
 *
 * The v1 till keeps this state inside the sheet component, which means the
 * only way to know what a half-configured selection is worth is to render it.
 * Here the DRAFT is a plain object and turning a draft into a sale item is a
 * pure function, so the block, the sticky footer and the eventual payload all
 * read one answer.
 *
 * It also gives the page the sentence it needs for its call to action. A
 * footer that says "Continue" makes the cashier look up to find out what is
 * missing; `missingStep` names it, so the button can say "Choose a time".
 */

import {
  applyResourceRate,
  firstFreeResource,
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  isOwnerFree,
  isResourceFreeFor,
  type Product,
  type Resource,
  type Staff,
} from "@/lib/api";
import { resolveProductPrice } from "@/lib/pricing";
import { durationOptions, productDurationPrice } from "@/lib/duration";
import {
  DEMO_TODAY,
  isFlexibleResource,
  isDailyCapped,
  isGuided,
  isResourceType,
  needsSchedule,
  slotISO,
  slotTimesOn,
  toMinutes,
  toTime,
} from "@/lib/schedule";
import type { SaleItem } from "./saleMath";

/** Which selection systems this till can render inline so far.
 *
 *  Named rather than assumed: a pattern that is not here must SAY so, because
 *  a selection screen that silently omits the one question a booking type is
 *  run by would sell the wrong thing. The rest arrive in the next pass. */
export type Pattern =
  | "tiered"       // open entry, date pass, daily cap, credit packs — quantities
  | "sessions"     // fixed departures and shows, optionally with a guide
  | "resourceSlot" // fields, courts, lanes on the hour
  | "flexible"     // a lane by the hour — the duration engine
  | "provider"     // a therapist, a stylist — an appointment with a person
  | "course"       // a fixed series of dates; the only choice left is places
  | "sectioned"    // stalls and balcony — priced blocks, not a seat map
  | "seats"        // a named seat out of a layout
  | "unsupported";

export function patternOf(product: Product): Pattern {
  const bt = product.bookingType;
  // A layout wins over sections: a room with a seat map sells the SEAT, and
  // its sections are then only how those seats are priced.
  if (product.layoutId) return "seats";
  if ((product.sections?.length ?? 0) > 0) return "sectioned";
  if (bt === "BT-10") return "provider";
  if (bt === "BT-13") return "course";
  if (isFlexibleResource(bt)) return "flexible";
  if (isResourceType(bt)) return "resourceSlot";
  // A day-capped booking needs a schedule (to know which days it runs) but has
  // no sessions to choose between — the day's allowance IS the capacity. It
  // must not fall through to the session list, or it renders an empty list and
  // a call to action demanding a time it does not have.
  if (isDailyCapped(bt)) return "tiered";
  if (needsSchedule(bt)) return "sessions";
  return "tiered";
}

export interface Draft {
  productId: string;
  date: string;
  slotTime?: string;
  resourceId?: string;
  guideId?: string;
  /** Units per tier id. */
  qty: Record<string, number>;
  /** BT-02 sells a pass in lengths. */
  validityId?: string;
  /** BT-05: how long the lane is booked for. */
  durationMinutes?: number;
  /** BT-10: who takes the appointment. Undefined means "first available". */
  providerId?: string;
  /** BT-04: every slot picked, each carrying its own date — so a selection
   *  survives changing the day and a sale can span several. One booking line
   *  per entry. */
  slots?: { date: string; time: string; resourceId: string }[];
  /** BT-07: the seats picked, carried with the prices they were picked at.
   *  The seat map is fetched asynchronously by the UI, so the prices come
   *  down here rather than being looked up again in a pure resolver. */
  seats?: { label: string; categoryUid: string; categoryName: string; price: number }[];
}

/** The first day this product actually runs.
 *
 *  Opening a Friday-to-Sunday tour on a Wednesday shows an empty departure
 *  list under a date nobody chose, which reads as a fault in the till rather
 *  than as a closed day. */
export function firstOpenDate(product: Product, from = DEMO_TODAY): string {
  if (!needsSchedule(product.bookingType) && !isResourceType(product.bookingType)) return from;
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.parse(`${from}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (isOpenOn(product, d)) return d;
  }
  return from;
}

/** The next few days this product runs — the strip, before the calendar. */
export function openDates(product: Product, count = 5, from = DEMO_TODAY): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count && i < 60; i++) {
    const d = new Date(Date.parse(`${from}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (isOpenOn(product, d)) out.push(d);
  }
  return out;
}

export function newDraft(product: Product): Draft {
  const validity = product.bookingType === "BT-02" ? product.validityOptions?.[0]?.id : undefined;
  const pattern = patternOf(product);
  return {
    productId: product.id,
    date: firstOpenDate(product),
    qty: {},
    validityId: validity,
    // The shortest sellable span is the default because it is the cheapest and
    // the commonest, not because it is first in the array.
    durationMinutes: pattern === "flexible" ? flexDurations(product)[0] : undefined,
  };
}

/** Re-open an item that is already in the sale, back into the draft it came
 *  from — so "Change" lands on the choices that were made, not on a blank. */
export function draftFrom(product: Product, items: SaleItem[]): Draft {
  const item = items[0];
  if (!item) return newDraft(product);
  const qty: Record<string, number> = {};
  for (const i of item.items) qty[i.tierId] = i.qty;
  const slots =
    patternOf(product) === "resourceSlot"
      ? items
          .filter((x) => x.slotDate && x.slotTime && x.resourceId)
          .map((x) => ({ date: x.slotDate!, time: x.slotTime!, resourceId: x.resourceId! }))
      : undefined;
  return {
    productId: product.id,
    date: item.slotDate ?? firstOpenDate(product),
    slotTime: item.slotTime,
    resourceId: item.resourceId,
    slots,
    seats: item.seatLabels?.length ? undefined : undefined,
    qty,
    validityId: product.bookingType === "BT-02" ? product.validityOptions?.[0]?.id : undefined,
  };
}

/** Providers without a configured schedule sell appointments on these hours —
 *  the same fallback the v1 sheet uses, so a spa configured either way offers
 *  the same times on both tills. */
const PROVIDER_DAY = {
  slotMinutes: 60, sessionMinutes: 60, startTime: "10:00", endTime: "19:00",
  capacityPerSession: 1, dailyCapacity: null, openDays: [0, 1, 2, 3, 4, 5, 6],
  guideIds: [], exceptions: [],
};

/** How long one appointment runs. */
export const providerMinutes = (product: Product) =>
  product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60;

/** The appointment times a provider product offers on a date. */
export const providerTimes = (product: Product, date: string) =>
  slotTimesOn(product.schedule ?? PROVIDER_DAY, date);

/** Who is actually free at a time, cheapest premium first — so "first
 *  available" costs the customer the least rather than whoever sorts first. */
export function freeProvidersAt(product: Product, date: string, time: string): string[] {
  const mins = providerMinutes(product);
  return (product.providerIds ?? [])
    .filter((pid) => isOwnerFree(pid, date, time, mins))
    .sort((a, b) => (product.providerPremiums?.[a] ?? 0) - (product.providerPremiums?.[b] ?? 0));
}

/** The lane hours a flexible product can start on. */
export const flexTimes = (product: Product, date: string) =>
  slotTimesOn(
    product.schedule ?? { ...PROVIDER_DAY, startTime: "06:00", endTime: "22:00" },
    date,
  );

/** Every duration this product sells, from its engine config. */
export const flexDurations = (product: Product) =>
  product.durationConfig ? durationOptions(product.durationConfig) : [60];

/** Why a start cannot be taken, or null when it can. The words are the
 *  caller's; this decides WHICH refusal applies. */
export function flexStartBlocked(
  product: Product,
  date: string,
  time: string,
  minutes: number,
  resourceId: string | undefined,
  nowMinutes: number,
): "past" | "closes" | "taken" | null {
  const cfg = product.durationConfig;
  const sch = product.schedule;
  const buffer = product.bufferMinutes ?? 0;
  const override = sch?.dayOverrides?.[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const closeMin = sch
    ? toMinutes(override?.endTime ?? sch.endTime) + (sch.sessionMinutes || 60)
    : Infinity;
  const start = toMinutes(time);
  if (date === DEMO_TODAY && start < nowMinutes + (cfg?.leadTimeMinutes ?? 0)) return "past";
  if ((cfg?.mustEndByClose ?? true) && start + minutes > closeMin) return "closes";
  const free = resourceId
    ? isResourceFreeFor(resourceId, date, time, minutes, buffer)
    : !!firstFreeResource(product, date, time, minutes);
  return free ? null : "taken";
}

export const activeTiersOf = (product: Product) => product.tiers.filter((t) => t.active);

export const ticketCount = (draft: Draft) =>
  Object.values(draft.qty).reduce((s, n) => s + (n || 0), 0);

/** Base price to price a span against — the cheapest active tier. */
export const basePriceOf = (product: Product) => {
  const prices = activeTiersOf(product).map((t) => t.price);
  return prices.length ? Math.min(...prices) : 0;
};

export interface Resolved {
  /** The lines this block would add. Empty until the draft answers every
   *  question its pattern asks; more than one when several slots are picked. */
  items: SaleItem[];
  /** What is still to decide, as a step key the page turns into a sentence. */
  missing:
    | "date" | "time" | "resource" | "guide" | "tickets"
    | "duration" | "provider" | "seats" | "unsupported"
    | null;
  /** What the block is worth right now, complete or not. */
  amount: number;
}

/**
 * A draft, resolved into the lines it would add.
 *
 * `id` is passed in rather than generated so that re-resolving a draft on every
 * keystroke does not mint a new identity each time — an item's id is what the
 * page tracks it by. Where a block yields several lines the id is suffixed, so
 * each line keeps a stable identity across renders.
 */
export function resolveDraft(
  product: Product,
  draft: Draft,
  id: string,
  ctx: { resources: Resource[]; team: Staff[] },
): Resolved {
  const pattern = patternOf(product);
  if (pattern === "unsupported") return { items: [], missing: "unsupported", amount: 0 };

  const tiers = activeTiersOf(product);
  const count = ticketCount(draft);

  /* ── Fixed slots on a resource (BT-04) ─────────────────────────────────
     A set, not a single choice. Picking an hour on Field 1 and another on
     Field 2 next Saturday is one sale, so each entry carries its own date and
     each becomes its own booking line — which is also what holds the capacity
     for every one of them rather than only the last. */
  if (pattern === "resourceSlot") {
    const picked = draft.slots ?? [];
    if (picked.length === 0) return { items: [], missing: "time", amount: 0 };
    const minutes = product.schedule?.sessionMinutes ?? 60;
    const lines = picked.map((sl, i) => {
      const row = getResourceMatrix(product, sl.date).find((r) => r.resource.id === sl.resourceId);
      const price = applyResourceRate(
        resolveProductPrice(product, sl.date, sl.time, basePriceOf(product)),
        minutes,
        row?.resource,
      );
      return {
        id: `${id}_${i}`,
        productId: product.id,
        productName: product.name,
        slotDate: sl.date,
        slotTime: sl.time,
        slotEnd: `${sl.date}T${toTime(toMinutes(sl.time) + minutes)}:00+06:00`,
        resourceId: sl.resourceId,
        resourceLabel: row?.resource.name,
        items: [],
        fixedPrice: price,
        partySize: product.policies?.partyMin ?? 1,
      } satisfies SaleItem;
    });
    return { items: lines, missing: null, amount: lines.reduce((a, l) => a + (l.fixedPrice ?? 0), 0) };
  }

  /* ── A lane by the hour (BT-05) ────────────────────────────────────────
     The duration engine prices the span: time bands, per-resource rates and
     deal durations all resolve inside `productDurationPrice`, so this asks
     for three answers and lets the engine do the arithmetic. */
  if (pattern === "flexible") {
    const minutes = draft.durationMinutes ?? flexDurations(product)[0];
    if (!draft.slotTime) return { items: [], missing: "time", amount: 0 };
    // "Any" lane resolves to the first free one at resolve time, so the
    // summary can name the lane the sale will actually take rather than
    // promising one and assigning another.
    const laneId = draft.resourceId ?? firstFreeResource(product, draft.date, draft.slotTime, minutes)?.id;
    if (!laneId) return { items: [], missing: "resource", amount: 0 };
    const lane = getResourceMatrix(product, draft.date).find((r) => r.resource.id === laneId)?.resource;
    const price = applyResourceRate(
      productDurationPrice(product, draft.date, draft.slotTime, minutes, basePriceOf(product)),
      minutes,
      lane,
    );
    return {
      amount: price,
      missing: null,
      items: [{
        id,
        productId: product.id,
        productName: product.name,
        slotDate: draft.date,
        slotTime: draft.slotTime,
        slotEnd: `${draft.date}T${toTime(toMinutes(draft.slotTime) + minutes)}:00+06:00`,
        resourceId: laneId,
        resourceLabel: lane?.name,
        items: [],
        fixedPrice: price,
        partySize: product.policies?.partyMin ?? 1,
      }],
    };
  }

  /* ── A named seat (BT-07) ──────────────────────────────────────────────
     Seats carry their own prices, so there are no tiers to count: the seat
     IS the ticket. Grouped by category so the order line reads "2 Stalls"
     rather than one line per chair. */
  if (pattern === "seats") {
    const chosen = draft.seats ?? [];
    const amount = chosen.reduce((sum, x) => sum + x.price, 0);
    if (chosen.length === 0) return { items: [], missing: "seats", amount: 0 };
    const byCat = new Map<string, { name: string; price: number; qty: number }>();
    for (const x of chosen) {
      const g = byCat.get(x.categoryUid) ?? { name: x.categoryName, price: x.price, qty: 0 };
      g.qty += 1;
      byCat.set(x.categoryUid, g);
    }
    return {
      amount,
      missing: null,
      items: [{
        id,
        productId: product.id,
        productName: product.name,
        items: Array.from(byCat, ([uid, g]) => ({
          tierId: uid, tierName: g.name, unitPrice: g.price, qty: g.qty,
        })),
        seatLabels: chosen.map((x) => x.label),
      }],
    };
  }

  // Every remaining pattern ends in quantities. Sections are counted the same
  // way tiers are, so one list serves both.

  const countable =
    pattern === "sectioned"
      ? (product.sections ?? []).map((x) => ({ id: x.id, name: x.name, price: x.price }))
      : tiers.map((t) => ({ id: t.id, name: t.name, price: t.price }));
  const priced = countable.map((x) => ({
    id: x.id,
    name: x.name,
    price: draft.slotTime
      ? resolveProductPrice(product, draft.date, draft.slotTime, x.price)
      : x.price,
  }));
  const validity = product.validityOptions?.find((v) => v.id === draft.validityId);
  const items = priced
    .filter((x) => (draft.qty[x.id] ?? 0) > 0)
    .map((x) => ({ tierId: x.id, tierName: x.name, unitPrice: x.price, qty: draft.qty[x.id] }));
  if (validity && (validity.priceDelta ?? 0) > 0 && count > 0) {
    items.push({
      tierId: `val_${validity.id}`,
      tierName: validity.label,
      unitPrice: validity.priceDelta ?? 0,
      qty: count,
    });
  }
  const amount = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  if (pattern === "sessions") {
    if (!draft.slotTime) return { items: [], missing: "time", amount };
    if (isGuided(product.bookingType)) {
      const free = freeGuides(product, draft.date, draft.slotTime);
      if (free.length > 0 && !draft.guideId) return { items: [], missing: "guide", amount };
    }
  }

  /* ── An appointment with a person (BT-10) ───────────────────────────────
     The premium is a LINE, not a different price: the treatment costs what it
     costs, and the senior therapist is an extra the receipt can show. */
  let assignedProviderId: string | undefined;
  if (pattern === "provider") {
    if (!draft.slotTime) return { items: [], missing: "time", amount };
    const free = freeProvidersAt(product, draft.date, draft.slotTime);
    assignedProviderId = draft.providerId ?? free[0];
    if (!assignedProviderId) return { items: [], missing: "provider", amount };
    const premium = product.providerPremiums?.[assignedProviderId] ?? 0;
    if (premium > 0 && count > 0) {
      const who = ctx.team.find((x) => x.id === assignedProviderId);
      items.push({
        tierId: `prem_${assignedProviderId}`,
        tierName: `${who?.name.split(" ")[0] ?? "Provider"} premium`,
        unitPrice: premium,
        qty: 1,
      });
    }
  }

  if (count === 0) return { items: [], missing: "tickets", amount };

  const owner = ctx.team.find((x) => x.id === (assignedProviderId ?? draft.guideId));
  const mins = providerMinutes(product);
  const dated =
    pattern === "provider" || pattern === "course" || needsSchedule(product.bookingType);
  return {
    // Recomputed: the provider premium is pushed onto `items` above, after the
    // first sum was taken.
    amount: items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
    missing: null,
    items: [{
      id,
      productId: product.id,
      productName: product.name,
      slotDate: dated ? draft.date : undefined,
      slotTime: draft.slotTime,
      slotEnd:
        pattern === "provider" && draft.slotTime
          ? `${draft.date}T${toTime(toMinutes(draft.slotTime) + mins)}:00+06:00`
          : undefined,
      resourceId: assignedProviderId ?? draft.guideId,
      resourceLabel: pattern === "provider" ? undefined : owner?.name,
      providerLabel: pattern === "provider" ? owner?.name : undefined,
      items,
    }],
  };
}

/** Sessions for a date, with everything already spoken for taken off. */
export function sessionRows(
  product: Product,
  date: string,
  seatsElsewhere: (productId: string, slotStart: string) => number,
  team: Staff[],
) {
  return getSlots(product, date).map((s) => {
    const left = s.remaining - seatsElsewhere(product.id, slotISO(date, s.time));
    const guided = isGuided(product.bookingType);
    const free = guided ? freeGuides(product, date, s.time) : [];
    const guideless = guided && (product.schedule?.guideIds?.length ?? 0) > 0 && free.length === 0;
    return {
      time: s.time,
      price: resolveProductPrice(product, date, s.time, basePriceOf(product)),
      capacity: s.capacity,
      left: Math.max(0, left),
      blockedReason: guideless ? "noGuide" : left <= 0 ? "soldOut" : null,
      meta: guided && free.length
        ? free.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean).join(" · ")
        : null,
      waitlist: left <= 0 && !!product.waitlistEnabled,
      freeGuideIds: free,
    };
  });
}

export const dailyLeft = (product: Product, date: string) => getDailyRemaining(product, date);
