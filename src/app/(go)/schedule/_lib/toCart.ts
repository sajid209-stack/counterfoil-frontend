import { applyResourceRate, freeGuides, isResourceFreeFor, type HoldView, type Product, type Resource, type Staff } from "@/lib/api";
import { productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { flexDurations } from "@/lib/sale/selection";
import { isFlexibleResource, slotISO, toMinutes } from "@/lib/schedule";
import type { OpenOption } from "@/app/(os)/calendar/_components/openSlots";
import type { CartEntry } from "../../_components/ProductSheet";
import { toTimeOfDay, type Column, type FreeBlock } from "./board";

/**
 * From the board straight into the sale.
 *
 * The board used to hand a tapped hour to the till's own booking sheet, which
 * then asked again for the date, the field and the time the cashier had just
 * pointed at. At a counter with a queue that is a second screen of questions
 * whose answers are already known. So a tapped hour becomes a cart line here,
 * built with the SAME price rules the sheet uses — `resolveProductPrice` for a
 * field's hour, the duration engine for a lane, and the lane's own rate on top
 * — so the long way round and the short way cannot sell different things.
 *
 * Anything the sheet would still ask (extras, the group size) is one tap on
 * the cart line, which reopens the sheet with this line loaded.
 *
 * A field sold in fixed hours stays one line per hour, as the OS calendar
 * books it: the availability engine reads a fixed-slot booking by its slot,
 * so a single two-hour line could leave its second hour looking free to the
 * next till. A lane sold by length is one line for the run — that is what a
 * lane booking IS.
 */

/** One tapped free hour on the board. */
export interface Pick {
  column: Column;
  block: FreeBlock;
}

const newId = () => `entry_${globalThis.crypto.randomUUID().slice(0, 8)}`;

/** The cheapest active ticket: what a bare "one, please" means, and the base
 *  every price rule and duration price is worked out from. */
export const basePriceOf = (p: Product) => {
  const tiers = p.tiers.filter((t) => t.active && !t.donation);
  return tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0;
};

/** The booking a tapped hour will be sold as: the one chosen in the bar, or
 *  the hour's own first (cheapest) option when it does not offer that one. */
export function optionFor(block: FreeBlock, productId: string | null): OpenOption {
  return block.options.find((o) => o.product.id === productId) ?? block.options[0];
}

/** Every booking any of the tapped hours could be sold as — the bar offers a
 *  choice only when this has more than one. */
export function productsIn(picks: Pick[]): Product[] {
  const out: Product[] = [];
  for (const p of picks) for (const o of p.block.options) if (!out.some((x) => x.id === o.product.id)) out.push(o.product);
  return out;
}

/** A run of hours on one place, sold as one booking: contiguous hours merge. */
export interface Span {
  column: Column;
  product: Product;
  start: number;
  end: number;
}

/** Group the picks by place and booking, then merge hours that touch. */
export function spansOf(picks: Pick[], productId: string | null): Span[] {
  const groups = new Map<string, { column: Column; product: Product; blocks: FreeBlock[] }>();
  for (const p of picks) {
    const product = optionFor(p.block, productId).product;
    const k = `${p.column.id}|${product.id}`;
    const g = groups.get(k) ?? { column: p.column, product, blocks: [] };
    g.blocks.push(p.block);
    groups.set(k, g);
  }
  const out: Span[] = [];
  for (const g of groups.values()) {
    const sorted = [...g.blocks].sort((a, b) => a.start - b.start);
    let cur: Span | null = null;
    for (const b of sorted) {
      if (cur && b.start === cur.end) cur.end = b.end;
      else {
        if (cur) out.push(cur);
        cur = { column: g.column, product: g.product, start: b.start, end: b.end };
      }
    }
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => a.start - b.start || a.column.name.localeCompare(b.column.name, undefined, { numeric: true }));
}

function resourceEntry(product: Product, resource: Resource | undefined, date: string, start: number, minutes: number, price: number): CartEntry {
  const time = toTimeOfDay(start);
  return {
    id: newId(),
    productId: product.id,
    productName: product.name,
    slotDate: date,
    slotTime: time,
    slotEnd: slotISO(date, toTimeOfDay(start + minutes)),
    resourceId: resource?.id,
    resourceLabel: resource?.name,
    /* No group size. The sheet opens on "Group of 2" because the cashier is
       looking at a stepper that says so; nobody tapping an hour on the board
       chose one, and a number nobody chose would be what check-in expects.
       Tapping the cart line sets it when it matters. */
    items: [],
    fixedPrice: price,
  };
}

/**
 * The cart lines for one span.
 *
 * A field sold in fixed hours is one line per hour, each at its own price —
 * 17:00 is the day rate and 18:00 the evening one, and a receipt that blended
 * them would be wrong about both. A lane sold by length is ONE line for the
 * whole run, priced by the duration engine (which blends a run that crosses
 * into the evening band), as long as that length is one the lane sells and
 * the lane is free for all of it; otherwise it is cut into the longest pieces
 * that are.
 */
export function entriesForSpan(span: Span, date: string): CartEntry[] {
  const { product, column } = span;
  const resource = column.resource;
  const base = basePriceOf(product);
  if (isFlexibleResource(product.bookingType)) {
    const allowed = flexDurations(product).filter((d) => d % 60 === 0).sort((a, b) => b - a);
    const out: CartEntry[] = [];
    let at = span.start;
    while (at < span.end) {
      const left = span.end - at;
      const time = toTimeOfDay(at);
      const d =
        allowed.find((m) => m <= left && (!resource || isResourceFreeFor(resource.id, date, time, m, product.bufferMinutes ?? 0))) ??
        Math.min(60, left);
      const price = applyResourceRate(productDurationPrice(product, date, time, d, base), d, resource);
      out.push(resourceEntry(product, resource, date, at, d, price));
      at += d;
    }
    return out;
  }
  const step = product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60;
  const out: CartEntry[] = [];
  for (let at = span.start; at < span.end; at += step) {
    const time = toTimeOfDay(at);
    const minutes = Math.min(step, span.end - at);
    const price = applyResourceRate(resolveProductPrice(product, date, time, base), minutes, resource);
    out.push(resourceEntry(product, resource, date, at, minutes, price));
  }
  return out;
}

/** Everything the tapped hours become, in board order. */
export function entriesFor(picks: Pick[], productId: string | null, date: string): CartEntry[] {
  return spansOf(picks, productId).flatMap((s) => entriesForSpan(s, date));
}

export const entryPrice = (e: CartEntry) => (e.fixedPrice ?? 0) + e.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

/** Does any of these need the signed safety form before it can be sold? */
export const needsWaiver = (products: Product[]) => products.some((p) => !!p.policies?.waiver);

/**
 * A resource hold turned back into what it was keeping.
 *
 * "Sell to Karim" should sell Karim exactly what was held for him — the same
 * place and the same hours — without anyone pointing at the board again.
 */
export function holdEntries(hold: HoldView, product: Product, resource: Resource | undefined, date: string): CartEntry[] {
  const start = hold.slotStart ? toMinutes(hold.slotStart.slice(11, 16)) : null;
  const end = hold.slotEnd ? toMinutes(hold.slotEnd.slice(11, 16)) : null;
  if (start == null || end == null || end <= start) return [];
  const column: Column = { id: resource?.id ?? "", name: resource?.name ?? "", kind: "resource", resource };
  return entriesForSpan({ column, product, start, end }, date);
}

/** Who leads a guided departure, when it has guides: the first one free. */
export function guideFor(product: Product, date: string, time: string, staff: Staff[]): Staff | null | undefined {
  if (!(product.schedule?.guideIds?.length)) return undefined; // no guide needed
  const id = freeGuides(product, date, time)[0];
  return id ? (staff.find((s) => s.id === id) ?? null) : null;
}

/** Tickets for one departure of a show or a tour. */
export function sessionEntry(
  product: Product,
  date: string,
  time: string,
  qty: Record<string, number>,
  guide: Staff | undefined,
): CartEntry {
  const tiers = product.tiers.filter((t) => t.active && !t.donation);
  const minutes = product.schedule?.sessionMinutes || product.schedule?.slotMinutes || 60;
  return {
    id: newId(),
    productId: product.id,
    productName: product.name,
    slotDate: date,
    slotTime: time,
    slotEnd: guide ? slotISO(date, toTimeOfDay(toMinutes(time) + minutes)) : undefined,
    resourceId: guide?.id,
    providerLabel: guide?.name,
    items: tiers.filter((t) => (qty[t.id] ?? 0) > 0).map((t) => ({ tierId: t.id, tierName: t.name, unitPrice: t.price, qty: qty[t.id] })),
  };
}
