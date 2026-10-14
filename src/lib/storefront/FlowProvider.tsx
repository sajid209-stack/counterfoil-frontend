"use client";

/**
 * The guest journey's one piece of shared state: what the venue is, what is
 * in the basket, and how to move between the screens.
 *
 * Live and preview are the same screens reading the same context — only HOW
 * navigation happens and WHERE the basket lives differ, and both of those
 * live in the two providers below rather than in the screens themselves.
 * `LiveFlowProvider` pushes real routes and keeps the basket in
 * sessionStorage; `PreviewFlowProvider` sets local screen state and keeps the
 * basket in memory, since a draft being edited has no order to protect.
 */
import { createContext, useContext, useMemo } from "react";
import type {
  Location,
  Operator,
  Order,
  Product,
  Resource,
  Staff,
  Storefront,
  Ticket,
} from "@/lib/api/types";
import {
  basketItemCount,
  basketTotals,
  newLineId,
  type BasketLine,
} from "./basket";

export interface StorefrontFlowData {
  mode: "live" | "preview";
  storefront: Storefront;
  location: Location;
  /** Everything a visitor can reach on this page, which includes link-only
   *  items (`unlistedIds`) so a basket and a checkout can price them. */
  products: Product[];
  /** The ones in `products` that are sold only by their link: never drawn on
   *  the venue page, never offered in its search. */
  unlistedIds?: string[];
  slugs: Record<string, string>;
  resources: Resource[];
  team: Staff[];
  now: Date;
  operator: Operator | undefined;
  /** Every action is a no-op: the Page designer's preview of the page. Distinct
   *  from `mode: "preview"`, which is the Storefront editor's click-through
   *  (that one works, in memory, and writes nothing). */
  inert?: boolean;
  /** Set when the page is an item's own link (`/b/<slug>`) rather than a page of
   *  a venue's storefront: where its basket, checkout and confirmation live,
   *  and whether (and where) the venue's storefront lists it. */
  link?: LinkFlow;
}

export interface LinkFlow {
  /** The item's own address: /b/<slug>. */
  slug: string;
  itemName: string;
  /** The venue's storefront address, when the item is listed on a published
   *  storefront. Null for a link-only item, which never sends a visitor to a
   *  page that does not list it. */
  venueSlug: string | null;
}

export interface DoneResult {
  /** Set in live mode; null in preview, where there is no real order. */
  orderId: string | null;
  order: Order;
  tickets: Ticket[];
}

export interface StorefrontFlowNav {
  goVenue: () => void;
  goProduct: (productId: string) => void;
  goBasket: () => void;
  goCheckout: () => void;
  /** Live pushes `/s/<slug>/done/<orderId>`, which re-fetches the real order.
   *  Preview has no such route, so it carries the order and tickets it was
   *  just handed straight into the confirmation screen's state. */
  goDone: (result: DoneResult) => void;
}

export interface StorefrontFlowCtx extends StorefrontFlowData, StorefrontFlowNav {
  basket: BasketLine[];
  itemCount: number;
  totals: ReturnType<typeof basketTotals>;
  addLine: (line: Omit<BasketLine, "id">) => void;
  updateLine: (id: string, patch: Partial<BasketLine>) => void;
  removeLine: (id: string) => void;
  clearBasket: () => void;
}

const Ctx = createContext<StorefrontFlowCtx | null>(null);

/** The flow when there is one; null on a page drawn on its own (the Page
 *  designer's preview), which supplies its own. */
export function useOptionalStorefrontFlow(): StorefrontFlowCtx | null {
  return useContext(Ctx);
}

export function useStorefrontFlow(): StorefrontFlowCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStorefrontFlow used outside a StorefrontFlowProvider");
  return v;
}

/** Shared by both providers — turns basket state + nav functions into the
 *  one context value every screen reads. */
export function StorefrontFlowProvider({
  data,
  nav,
  basket,
  setBasket,
  children,
}: {
  data: StorefrontFlowData;
  nav: StorefrontFlowNav;
  basket: BasketLine[];
  setBasket: (updater: (b: BasketLine[]) => BasketLine[]) => void;
  children: React.ReactNode;
}) {
  const value = useMemo<StorefrontFlowCtx>(() => {
    const addLine: StorefrontFlowCtx["addLine"] = (line) =>
      setBasket((b) => [...b, { ...line, id: newLineId() }]);
    const updateLine: StorefrontFlowCtx["updateLine"] = (id, patch) =>
      setBasket((b) => b.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const removeLine: StorefrontFlowCtx["removeLine"] = (id) =>
      setBasket((b) => b.filter((l) => l.id !== id));
    const clearBasket = () => setBasket(() => []);
    return {
      ...data,
      ...nav,
      basket,
      itemCount: basketItemCount(basket),
      totals: basketTotals(basket, data.products, data.operator),
      addLine,
      updateLine,
      removeLine,
      clearBasket,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, nav, basket]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
