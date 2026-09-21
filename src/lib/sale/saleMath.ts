/* ── The v2 till's arithmetic ──────────────────────────────────────────────
 *
 * Everything here is PURE: items in, order lines and totals out. No React, no
 * store, no fetching. That is deliberate on two counts.
 *
 * 1. It is the piece the backend lane already has an opinion about. The
 *    engineering team's `checkout` takes `CheckoutLine[]` + an order discount;
 *    this file's whole job is to turn what a cashier assembled on screen into
 *    exactly that payload. When the mock is swapped for the real API, nothing
 *    in this file changes — which is the same contract `lib/orderMath` holds
 *    for the v1 till.
 *
 * 2. It is testable without a browser. The v1 till computes its totals inline
 *    in a 1,350-line component, so the only way to check the money is to look
 *    at it. This can be driven headlessly.
 *
 * The one rule that must not be broken: the SAME `CheckoutLine[]` that priced
 * the sticky footer is the array handed to `checkout()`. Building the payload
 * a second time at charge-time is how a till starts showing one number and
 * charging another.
 */

import { buildOrderLines, type LineInput } from "@/lib/orderMath";
import type { CreditPass, MemberBenefit, Operator, Product } from "@/lib/api";
import { slotISO, toMinutes } from "@/lib/schedule";
import { taxRateFor } from "@/lib/tax";

/** One configured thing in the sale.
 *
 *  Structurally identical to the v1 till's `CartEntry` — the selection
 *  patterns produce this shape and the order engine consumes it, so changing
 *  it here would only mean converting at both ends. The difference in v2 is
 *  where it LIVES: not in a cart panel, but as a block in the page. */
export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  slotDate?: string;
  slotTime?: string;
  slotEnd?: string;
  resourceId?: string;
  resourceLabel?: string;
  providerLabel?: string;
  items: { tierId: string; tierName: string; unitPrice: number; qty: number }[];
  /** A resolved span price (a lane hour, a duration) — overrides the items sum. */
  fixedPrice?: number;
  seatLabels?: string[];
  /** Group size for per-booking pricing ("Group of 6"). */
  partySize?: number;
  /** Custom-amount items carry their own rate; catalogue items read the product. */
  taxRatePct?: number;
  lineDiscountPct?: number;
  lineDiscountAmount?: number;
}

/** Everything the arithmetic needs that is not the items themselves. */
export interface SaleContext {
  products: Product[];
  operator: Operator | undefined;
  /** Cashier discount, already resolved to money. */
  manualDiscount?: number;
  /** A coupon the promotions engine authorised. */
  couponDiscount?: number;
  /** An active membership's entitlement, or null. */
  benefit?: MemberBenefit | null;
  /** Points spent × their value, already resolved to money. */
  pointsDiscount?: number;
  /** A credits pass being spent against eligible items. */
  pass?: CreditPass | null;
}

export const itemTotal = (e: SaleItem) =>
  (e.fixedPrice ?? 0) + e.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

/** People admitted, not lines. A Family tier admitting four counts as four;
 *  add-ons and per-provider premiums count as none. */
export function itemSeats(e: SaleItem, products: Product[]): number {
  if (e.fixedPrice != null) return e.partySize ?? 1;
  const p = products.find((x) => x.id === e.productId);
  const seats = e.items.reduce((s, i) => {
    const tier = p?.tiers.find((t) => t.id === i.tierId);
    if (tier) return s + i.qty * (tier.admits ?? 1);
    if (p?.sections?.some((sec) => sec.id === i.tierId)) return s + i.qty;
    return s;
  }, 0);
  return seats > 0 ? seats : e.items.reduce((s, i) => s + i.qty, 0);
}

export const itemSlotISO = (e: SaleItem) =>
  e.slotDate ? slotISO(e.slotDate, e.slotTime ?? "10:00") : undefined;

/** A credits pass covers eligible units oldest-item-first until it runs out.
 *  Returned as a map so the block can say "2 paid with pass" beside the row
 *  that was actually covered. */
export function passCoverage(items: SaleItem[], pass: CreditPass | null | undefined) {
  const map = new Map<string, number>(); // `${itemId}|${tierId}` → units covered
  if (!pass) return map;
  let left = pass.remaining;
  for (const e of items) {
    if (e.fixedPrice != null || !pass.productIds.includes(e.productId)) continue;
    for (const i of e.items) {
      if (left <= 0) break;
      if (i.unitPrice <= 0) continue;
      const c = Math.min(i.qty, left);
      map.set(`${e.id}|${i.tierId}`, c);
      left -= c;
    }
  }
  return map;
}

/** The sale, as the order lines it will become.
 *
 *  Mirrors the v1 till's `buildInputs` because the ORDER MODEL is the same —
 *  a line is a snapshot at time of sale, add-ons are child lines carrying
 *  their own product identity, and pass-covered units split into their own
 *  zero-price untaxed lines. Diverging here would mean two tills writing two
 *  different order shapes into one ledger. */
export function buildSaleLines(items: SaleItem[], ctx: SaleContext): LineInput[] {
  const { products, operator } = ctx;
  const byId = (id: string) => products.find((p) => p.id === id);
  const coverage = passCoverage(items, ctx.pass);
  const out: LineInput[] = [];

  for (const e of items) {
    const p = byId(e.productId);
    const ratePct = e.taxRatePct ?? (p ? taxRateFor(p, operator) : 0);
    const rate = ratePct / 100;
    const taxClass = e.taxRatePct != null ? (e.taxRatePct === 0 ? "exempt" : "standard") : (p?.taxClass ?? "standard");

    // A flat amount off an item lands pro rata across its sub-lines (the
    // booking and its add-ons) exactly as a percentage would, so the two ways
    // of typing a discount cannot produce two different orders.
    const base = itemTotal(e);
    const pct = e.lineDiscountAmount != null && base > 0
      ? Math.min(100, (Math.min(e.lineDiscountAmount, base) / base) * 100)
      : (e.lineDiscountPct ?? 0);
    const cut = (of: number) => (pct > 0 ? Math.round((of * pct) / 100) : 0);
    const addOnOf = (tierId: string) => p?.addOns?.find((a) => a.id === tierId);
    const seats = itemSeats(e, products);
    let parentIdx: number | null = null;

    if (e.fixedPrice != null) {
      parentIdx = out.length;
      const dur = e.slotTime && e.slotEnd
        ? toMinutes(e.slotEnd.slice(11, 16)) - toMinutes(e.slotTime)
        : undefined;
      out.push({
        productId: e.productId,
        productName: e.productName,
        tierName: e.resourceLabel ?? e.providerLabel ?? e.slotTime ?? e.productName,
        admits: seats,
        quantity: 1,
        unitPrice: e.fixedPrice,
        lineDiscount: cut(e.fixedPrice),
        taxClass,
        taxRate: rate,
        booking: e.slotDate
          ? {
              date: e.slotDate,
              startTime: e.slotTime,
              endTime: e.slotEnd?.slice(11, 16),
              resourceId: e.resourceId,
              resourceName: e.resourceLabel,
              providerName: e.providerLabel,
              guests: seats,
              durationMinutes: dur && dur > 0 ? dur : undefined,
            }
          : undefined,
      });
    }

    let bookingAttached = e.fixedPrice != null;
    for (const i of e.items) {
      if (addOnOf(i.tierId)) continue; // add-ons are appended below, as children
      const covered = coverage.get(`${e.id}|${i.tierId}`) ?? 0;
      const tier = p?.tiers.find((t) => t.id === i.tierId);
      const isPremium = i.tierId.startsWith("prem_");
      const push = (qty: number, unitPrice: number, byPass: boolean) => {
        const idx = out.length;
        const carry = !isPremium && !bookingAttached && !!e.slotDate;
        if (carry) bookingAttached = true;
        out.push({
          productId: e.productId,
          productName: e.productName,
          tierId: tier?.id,
          tierName: i.tierName,
          admits: isPremium ? 0 : (tier?.admits ?? 1),
          quantity: qty,
          unitPrice,
          lineDiscount: byPass ? 0 : cut(unitPrice * qty),
          taxClass: byPass ? "exempt" : taxClass,
          taxRate: byPass ? 0 : rate,
          parentIndex: isPremium && parentIdx != null ? parentIdx : undefined,
          booking: carry ? { date: e.slotDate!, startTime: e.slotTime, guests: seats } : undefined,
        });
        if (parentIdx == null && !isPremium) parentIdx = idx;
      };
      if (i.qty - covered > 0) push(i.qty - covered, i.unitPrice, false);
      if (covered > 0) push(covered, 0, true);
    }

    for (const i of e.items) {
      const a = addOnOf(i.tierId);
      if (!a) continue;
      out.push({
        productId: `addon_${a.id}`,
        productName: a.name,
        tierName: i.tierName,
        admits: 0,
        quantity: i.qty,
        unitPrice: i.unitPrice,
        lineDiscount: cut(i.unitPrice * i.qty),
        taxClass,
        taxRate: rate,
        parentIndex: parentIdx ?? undefined,
      });
    }
  }

  return out;
}

export interface SaleTotals {
  lines: LineInput[];
  subtotal: number;
  lineDiscountTotal: number;
  /** What the cashier typed — the only portion the discount policy caps. */
  manualDiscount: number;
  couponDiscount: number;
  memberDiscount: number;
  pointsDiscount: number;
  /** Everything above, as the single order discount the engine allocates. */
  orderDiscount: number;
  discountTotal: number;
  tax: number;
  total: number;
  /** Units of a credits pass spent, and what they were worth. */
  creditsUsed: number;
  creditsValue: number;
  /** The combined cashier rate the policy is measured against. */
  manualEffectivePct: number;
}

/** The whole sale, priced.
 *
 *  Order of operations matters and is not arbitrary: line discounts first,
 *  then the cashier's manual discount, then a coupon, then the member rate,
 *  and points last — because points are bounded by what is still owed, so
 *  they can never create change due. */
export function priceSale(items: SaleItem[], ctx: SaleContext): SaleTotals {
  const lines = buildSaleLines(items, ctx);
  const preBase = lines.reduce((s, l) => s + l.unitPrice * l.quantity - (l.lineDiscount ?? 0), 0);

  const manualDiscount = Math.min(Math.max(0, preBase), Math.max(0, ctx.manualDiscount ?? 0));
  const couponDiscount = Math.min(ctx.couponDiscount ?? 0, Math.max(0, preBase - manualDiscount));

  // A member rate is an ENTITLEMENT, not a cashier discount — so it applies
  // only to what the tier actually covers, never to the sale of a membership
  // itself, and it must not count toward the manual-discount cap.
  const benefit = ctx.benefit ?? null;
  const covers = (productId: string) => {
    if (!benefit || productId.startsWith("membership_")) return false;
    if (benefit.productIds === null && benefit.categoryIds.length === 0) return true;
    if (benefit.productIds?.includes(productId)) return true;
    const cat = ctx.products.find((p) => p.id === productId)?.categoryId;
    return !!cat && benefit.categoryIds.includes(cat);
  };
  const memberBase = benefit
    ? lines.filter((l) => covers(l.productId)).reduce((s, l) => s + l.unitPrice * l.quantity - (l.lineDiscount ?? 0), 0)
    : 0;
  const memberDiscount = benefit ? Math.round((Math.max(0, memberBase) * benefit.discountBps) / 10000) : 0;

  const beforePoints = Math.max(0, preBase - manualDiscount - couponDiscount - memberDiscount);
  const pointsDiscount = Math.min(Math.max(0, ctx.pointsDiscount ?? 0), beforePoints);

  const orderDiscount = manualDiscount + couponDiscount + memberDiscount + pointsDiscount;
  const priced = buildOrderLines(lines, orderDiscount, "PREVIEW");

  const coverage = passCoverage(items, ctx.pass);
  let creditsUsed = 0;
  let creditsValue = 0;
  for (const e of items) {
    for (const i of e.items) {
      const c = coverage.get(`${e.id}|${i.tierId}`) ?? 0;
      creditsUsed += c;
      creditsValue += c * i.unitPrice;
    }
  }

  const subtotal = priced.totals.subtotal;
  return {
    lines,
    subtotal,
    lineDiscountTotal: priced.totals.lineDiscountTotal,
    manualDiscount,
    couponDiscount,
    memberDiscount,
    pointsDiscount,
    orderDiscount,
    discountTotal: priced.totals.discountTotal,
    tax: priced.totals.taxTotal,
    total: priced.totals.total,
    creditsUsed,
    creditsValue,
    manualEffectivePct: subtotal > 0 ? ((priced.totals.lineDiscountTotal + manualDiscount) / subtotal) * 100 : 0,
  };
}

/** A deposit policy holds part of an item back until arrival. */
export function itemBalance(e: SaleItem, products: Product[], pass?: CreditPass | null): number {
  const pol = products.find((p) => p.id === e.productId)?.policies;
  if (pol?.deposit !== "percent" || pol.depositPct <= 0) return 0;
  const coverage = passCoverage([e], pass);
  const covered = e.items.reduce((s, i) => s + (coverage.get(`${e.id}|${i.tierId}`) ?? 0) * i.unitPrice, 0);
  const payable = itemTotal(e) - covered;
  return Math.max(0, payable - Math.round((payable * pol.depositPct) / 100));
}
