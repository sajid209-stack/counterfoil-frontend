"use client";

import type { AppliedPromotion, CreditPass } from "@/lib/api";
import type { AttachedCustomer } from "../CustomerPicker";
import type { CartEntry } from "../../_components/ProductSheet";

/**
 * The sale in progress, held across a navigation.
 *
 * `pos/layout.tsx` renders `PosScreen` only on `/pos` and `/pos/cart`, so the
 * component unmounts the moment a cashier taps Schedule, Scan or Check In —
 * and the whole sale went with it. Measured before this existed: add a ticket,
 * tap Schedule, tap Sell, and the till reads "0 items ৳0.00". Nothing said so.
 *
 * At a counter that is the worst class of bug there is: the guest is standing
 * there, the sale is gone, and the cashier has no way to know it happened
 * other than by noticing the total. It is also what made a floating cart
 * button meaningless — a button that leads to an emptied cart is worse than no
 * button.
 *
 * So the sale is written to sessionStorage whenever it changes and read back
 * when the till mounts. This is deliberately NOT a rewrite of where the sale
 * lives: the provider refactor is a change to the money path, and the routes
 * do not move when it happens. This is the same trick `park` has always used,
 * applied to the sale nobody parked.
 *
 * One rule matters more than the rest: **a completed sale must never come
 * back.** Both checkout paths clear this before they navigate, and so do park
 * and clear-all.
 */
export type LiveSale = {
  cart: CartEntry[];
  discountMode: "percent" | "amount";
  discountPct: number;
  discountAmt: number;
  discountReason: string;
  attached: AttachedCustomer | null;
  pass: CreditPass | null;
  coupon: AppliedPromotion | null;
  advance: number | null;
  pointsToSpend: number;
};

const KEY = "pos_live";

/**
 * sessionStorage fires no event in the tab that wrote it, so a change here is
 * announced. It is the same shape the sidebar-collapsed preference uses, for
 * the same reason: two places read this and they must not disagree.
 */
const CHANGED = "pos:live";

function announce() {
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* no window: nothing is listening either */
  }
}

/** Subscribe to the live sale changing. Returns the unsubscribe. */
export function onLiveSaleChange(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}

export function readLiveSale(): LiveSale | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LiveSale;
    /* A stored shape from an older build must not half-restore a sale. */
    return Array.isArray(v?.cart) ? v : null;
  } catch {
    return null;
  }
}

export function writeLiveSale(sale: LiveSale): void {
  try {
    /* An empty cart is not a sale worth holding, and leaving the key behind
       would resurrect an empty one over a genuinely fresh till. */
    if (sale.cart.length === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(sale));
    announce();
  } catch {
    /* Private mode, blocked storage: the till still works, it just cannot
       hold the sale across a tab change. Never throw at a counter. */
  }
}

export function clearLiveSale(): void {
  try {
    sessionStorage.removeItem(KEY);
    announce();
  } catch {
    /* as above */
  }
}

/**
 * What the floating cart button needs, and nothing more.
 *
 * Deliberately a COUNT rather than a total: a total would mean duplicating the
 * money engine outside the till, and two places that price a sale are two
 * places that can disagree about it. The count is a fact about the array.
 */
export function liveSaleCount(): number {
  return readLiveSale()?.cart.length ?? 0;
}

/**
 * Put lines into the sale from somewhere that is not the till.
 *
 * The Schedule books a tapped hour straight into the cart rather than sending
 * the cashier through the booking sheet a second time. The till is not mounted
 * while the Schedule is on screen, so the lines go where the till will look for
 * them when it mounts — the live sale — and everything else about the sale in
 * progress (its customer, its discount) is left exactly as it was.
 */
export function appendToLiveSale(entries: CartEntry[]): void {
  if (!entries.length) return;
  const sale = readLiveSale() ?? {
    cart: [],
    discountMode: "percent" as const,
    discountPct: 0,
    discountAmt: 0,
    discountReason: "",
    attached: null,
    pass: null,
    coupon: null,
    advance: null,
    pointsToSpend: 0,
  };
  writeLiveSale({ ...sale, cart: [...sale.cart, ...entries] });
}

/**
 * Where "New sale" goes after this sale is paid.
 *
 * A sale started from the Schedule should end back on the Schedule — the next
 * guest in that queue is asking about another hour, not browsing the sell
 * wall. Deliberately NOT cleared with the live sale: checkout clears the sale
 * before the completion screen opens, and that screen is the one that asks.
 * Parking or clearing the sale discards it, so an abandoned sale does not send
 * the next, unrelated one somewhere odd.
 */
const RETURN = "pos_return";

export function setReturnTo(path: string): void {
  try {
    sessionStorage.setItem(RETURN, path);
  } catch {
    /* the till still works; New sale just goes to the sell wall */
  }
}

/** Read it once and forget it. */
export function takeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN);
    sessionStorage.removeItem(RETURN);
    return v;
  } catch {
    return null;
  }
}
