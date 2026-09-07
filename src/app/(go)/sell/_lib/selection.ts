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
  freeGuides,
  getDailyRemaining,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  type Product,
  type Resource,
  type Staff,
} from "@/lib/api";
import { resolveProductPrice } from "@/lib/pricing";
import {
  DEMO_TODAY,
  isFlexibleResource,
  isDailyCapped,
  isGuided,
  isResourceType,
  needsSchedule,
  slotISO,
} from "@/lib/schedule";
import type { SaleItem } from "./saleMath";

/** Which selection systems this till can render inline so far.
 *
 *  Named rather than assumed: a pattern that is not here must SAY so, because
 *  a selection screen that silently omits the one question a booking type is
 *  run by would sell the wrong thing. The rest arrive in the next pass. */
export type Pattern =
  | "tiered"       // open entry, date pass, daily cap — quantities, maybe a date
  | "sessions"     // fixed departures and shows, optionally with a guide
  | "resourceSlot" // fields, courts, lanes on the hour
  | "unsupported";

export function patternOf(product: Product): Pattern {
  const bt = product.bookingType;
  if (product.layoutId) return "unsupported";        // seat map
  if ((product.sections?.length ?? 0) > 0) return "unsupported";
  if (bt === "BT-10" || bt === "BT-12" || bt === "BT-13") return "unsupported";
  if (isFlexibleResource(bt)) return "unsupported";  // duration engine
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
  return {
    productId: product.id,
    date: firstOpenDate(product),
    qty: {},
    validityId: validity,
  };
}

/** Re-open an item that is already in the sale, back into the draft it came
 *  from — so "Change" lands on the choices that were made, not on a blank. */
export function draftFrom(product: Product, item: SaleItem): Draft {
  const qty: Record<string, number> = {};
  for (const i of item.items) qty[i.tierId] = i.qty;
  return {
    productId: product.id,
    date: item.slotDate ?? firstOpenDate(product),
    slotTime: item.slotTime,
    resourceId: item.resourceId,
    qty,
    validityId: product.bookingType === "BT-02" ? product.validityOptions?.[0]?.id : undefined,
  };
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
  /** Null until the draft answers every question this pattern asks. */
  item: SaleItem | null;
  /** What is still to decide, as a step key the page turns into a sentence. */
  missing: "date" | "time" | "resource" | "guide" | "tickets" | "unsupported" | null;
  /** What the block is worth right now, complete or not. */
  amount: number;
}

/**
 * A draft, resolved into the item it would add.
 *
 * `id` is passed in rather than generated so that re-resolving a draft on every
 * keystroke does not mint a new identity each time — an item's id is what the
 * page tracks it by.
 */
export function resolveDraft(
  product: Product,
  draft: Draft,
  id: string,
  ctx: { resources: Resource[]; team: Staff[] },
): Resolved {
  const pattern = patternOf(product);
  if (pattern === "unsupported") return { item: null, missing: "unsupported", amount: 0 };

  const tiers = activeTiersOf(product);
  const count = ticketCount(draft);

  if (pattern === "resourceSlot") {
    if (!draft.resourceId) return { item: null, missing: "resource", amount: 0 };
    if (!draft.slotTime) return { item: null, missing: "time", amount: 0 };
    const row = getResourceMatrix(product, draft.date).find((r) => r.resource.id === draft.resourceId);
    const minutes = product.schedule?.sessionMinutes ?? 60;
    const price = applyResourceRate(
      resolveProductPrice(product, draft.date, draft.slotTime, basePriceOf(product)),
      minutes,
      row?.resource,
    );
    const end = new Date(Date.parse(slotISO(draft.date, draft.slotTime)) + minutes * 60000);
    const endTime = `${String(end.getUTCHours() + 6).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`;
    return {
      amount: price,
      missing: null,
      item: {
        id,
        productId: product.id,
        productName: product.name,
        slotDate: draft.date,
        slotTime: draft.slotTime,
        slotEnd: `${draft.date}T${endTime}:00+06:00`,
        resourceId: draft.resourceId,
        resourceLabel: row?.resource.name,
        items: [],
        fixedPrice: price,
        partySize: product.policies?.partyMin ?? 1,
      },
    };
  }

  // Both remaining patterns end in quantities; sessions ask when first.
  const priced = tiers.map((t) => ({
    id: t.id,
    name: t.name,
    price: draft.slotTime
      ? resolveProductPrice(product, draft.date, draft.slotTime, t.price)
      : t.price,
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
    if (!draft.slotTime) return { item: null, missing: "time", amount };
    if (isGuided(product.bookingType)) {
      const free = freeGuides(product, draft.date, draft.slotTime);
      if (free.length > 0 && !draft.guideId) return { item: null, missing: "guide", amount };
    }
  }
  if (count === 0) return { item: null, missing: "tickets", amount };

  const guide = ctx.team.find((s) => s.id === draft.guideId);
  return {
    amount,
    missing: null,
    item: {
      id,
      productId: product.id,
      productName: product.name,
      slotDate: needsSchedule(product.bookingType) ? draft.date : undefined,
      slotTime: draft.slotTime,
      resourceId: draft.guideId,
      resourceLabel: guide?.name,
      items,
    },
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
