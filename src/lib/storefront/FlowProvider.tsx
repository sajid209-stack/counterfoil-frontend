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
  products: Product[];
  slugs: Record<string, string>;
  resources: Resource[];
  team: Staff[];
  now: Date;
  operator: Operator | undefined;
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
