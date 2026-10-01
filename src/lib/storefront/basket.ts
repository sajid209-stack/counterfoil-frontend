"use client";

/**
 * The guest's basket, on the storefront.
 *
 * One shape, two storage strategies: live pages persist it in sessionStorage
 * keyed by venue slug (so a guest can leave a booking page, look at another
 * one, and still find their basket); the editor's preview keeps it in plain
 * React state, which is ephemeral by design — a preview that survived a
 * reload would be a preview of nothing a real visitor ever did.
 *
 * The math is the app's own: `buildOrderLines` is the one engine every order
 * in the system is built by (the POS cart, checkout(), counter add-ons, the
 * seed generator). A basket that priced itself differently from the order it
 * becomes would be a storefront quoting one number and charging another.
 */
import { useState } from "react";
import { buildOrderLines, type LineInput, type OrderTotals } from "@/lib/orderMath";
import { taxRateFor } from "@/lib/tax";
import type { Minor, Operator, Product, TaxClass } from "@/lib/api/types";

export interface BasketTier {
  tierId: string;
  tierName: string;
  price: Minor; // unit price
  admits: number;
  qty: number;
  donation?: boolean;
  ageNote?: string;
}

export interface BasketLine {
  /** Unique within the basket — not an order line id, which does not exist
   *  until checkout. */
  id: string;
  productId: string;
  productName: string;
  taxClass?: TaxClass;
  date: string | null; // YYYY-MM-DD, null for a date-less booking
  startTime: string | null; // "HH:MM"
  endTime: string | null;
  resourceId: string | null;
  resourceName: string | null;
  tiers: BasketTier[];
}

export const lineQty = (line: BasketLine): number => line.tiers.reduce((s, t) => s + t.qty, 0);
export const lineSubtotal = (line: BasketLine): Minor => line.tiers.reduce((s, t) => s + t.price * t.qty, 0);
export const basketItemCount = (basket: BasketLine[]): number => basket.reduce((s, l) => s + lineQty(l), 0);

/** Every basket line, as the order engine's inputs — one per tier with a
 *  quantity, carrying the booking snapshot a receipt and a ticket both read. */
export function basketToLineInputs(basket: BasketLine[], products: Product[], operator: Operator | undefined): LineInput[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const inputs: LineInput[] = [];
  for (const line of basket) {
    if (lineQty(line) <= 0) continue;
    const product = byId.get(line.productId);
    // taxRateFor returns a PERCENT (15), and buildOrderLines wants a fraction (0.15).
    const taxRate = product ? taxRateFor(product, operator) / 100 : 0;
    for (const tier of line.tiers) {
      if (tier.qty <= 0) continue;
      inputs.push({
        productId: line.productId,
        productName: line.productName,
        tierId: tier.tierId,
        tierName: tier.tierName,
        admits: tier.admits,
        quantity: tier.qty,
        unitPrice: tier.price,
        taxClass: line.taxClass,
        taxRate,
        booking: line.date
          ? {
              date: line.date,
              startTime: line.startTime ?? undefined,
              endTime: line.endTime ?? undefined,
              resourceId: line.resourceId ?? undefined,
              resourceName: line.resourceName ?? undefined,
              guests: tier.admits,
            }
          : undefined,
      });
    }
  }
  return inputs;
}

/** The basket's totals, computed through the same engine an order is built
 *  from — so the figure on the basket page and the one on the receipt can
 *  never disagree. */
export function basketTotals(basket: BasketLine[], products: Product[], operator: Operator | undefined): OrderTotals {
  const inputs = basketToLineInputs(basket, products, operator);
  return buildOrderLines(inputs, 0, "PREVIEW").totals;
}

/** A single product's picked tiers, priced the same way, for the live total
 *  shown on the booking page before anything is added to the basket. */
export function draftTotals(tiers: BasketTier[], taxRate: number): OrderTotals {
  const inputs: LineInput[] = tiers
    .filter((t) => t.qty > 0)
    .map((t) => ({
      productId: "draft",
      productName: "draft",
      tierId: t.tierId,
      tierName: t.tierName,
      admits: t.admits,
      quantity: t.qty,
      unitPrice: t.price,
      taxRate,
    }));
  return buildOrderLines(inputs, 0, "DRAFT").totals;
}

const key = (slug: string) => `cf_basket_${slug}`;

function readBasket(slug: string): BasketLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBasket(slug: string, basket: BasketLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(slug), JSON.stringify(basket));
  } catch {
    /* a full sessionStorage is not this screen's problem to solve */
  }
}

/** The live basket: sessionStorage keyed by venue slug, so it survives a
 *  trip between the venue page, a booking page and the basket itself — all
 *  separate route loads — without a server behind any of it. */
export function useLiveBasket(slug: string): [BasketLine[], (updater: (b: BasketLine[]) => BasketLine[]) => void] {
  // A lazy initializer rather than an effect: each live route mounts once
  // for one slug and is torn down on navigation, so there is no "the slug
  // changed under a mounted component" case to resync for.
  const [basket, setBasketState] = useState<BasketLine[]>(() => readBasket(slug));

  const setBasket = (updater: (b: BasketLine[]) => BasketLine[]) => {
    setBasketState((prev) => {
      const next = updater(prev);
      writeBasket(slug, next);
      return next;
    });
  };

  return [basket, setBasket];
}

export const newLineId = () => `bl_${Math.random().toString(36).slice(2, 10)}`;
