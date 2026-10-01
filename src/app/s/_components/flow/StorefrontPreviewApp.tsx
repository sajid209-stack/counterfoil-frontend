"use client";

/**
 * The whole guest journey, inside the editor's preview frame.
 *
 * Preview mode runs the SAME screens the live site does, through the SAME
 * `StorefrontFlowProvider` — only navigation is an internal state machine
 * (no URL exists inside the iframe's portalled content) and the basket is
 * plain React state (ephemeral on purpose: a draft being tried out has no
 * real order to protect). At "Pay" it shows the confirmation screen without
 * ever calling `checkout()` — labelled, subtly, "Preview — no real order was
 * made" — so the owner can click through the whole thing without minting
 * fictional bookings in the shared mock store.
 */
import { useState } from "react";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { StorefrontFlowProvider, type StorefrontFlowData, type StorefrontFlowNav } from "@/lib/storefront/FlowProvider";
import type { BasketLine } from "@/lib/storefront/basket";
import type { Location, Order, Product, Resource, Staff, Storefront, Ticket } from "@/lib/api/types";
import { StorefrontView } from "../StorefrontView";
import { ProductScreen } from "./ProductScreen";
import { BasketScreen } from "./BasketScreen";
import { CheckoutScreen } from "./CheckoutScreen";
import { ConfirmationScreen } from "./ConfirmationScreen";

type PreviewScreen =
  | { name: "venue" }
  | { name: "product"; productId: string }
  | { name: "basket" }
  | { name: "checkout" }
  | { name: "done"; order: Order; tickets: Ticket[] };

export function StorefrontPreviewApp({
  storefront,
  location,
  products,
  slugs,
  resources,
  team,
  now,
}: {
  storefront: Storefront;
  location: Location;
  products: Product[];
  slugs: Record<string, string>;
  resources: Resource[];
  team: Staff[];
  now: Date;
}) {
  const operatorQ = useApiQuery(() => getOperator(), []);
  const [screen, setScreen] = useState<PreviewScreen>({ name: "venue" });
  const [basket, setBasket] = useState<BasketLine[]>([]);

  const nav: StorefrontFlowNav = {
    goVenue: () => setScreen({ name: "venue" }),
    goProduct: (productId) => setScreen({ name: "product", productId }),
    goBasket: () => setScreen({ name: "basket" }),
    goCheckout: () => setScreen({ name: "checkout" }),
    goDone: (result) => setScreen({ name: "done", order: result.order, tickets: result.tickets }),
  };

  const data: StorefrontFlowData = {
    mode: "preview",
    storefront,
    location,
    products,
    slugs,
    resources,
    team,
    now,
    operator: operatorQ.data,
  };

  return (
    <StorefrontFlowProvider data={data} nav={nav} basket={basket} setBasket={setBasket}>
      {screen.name === "venue" && <StorefrontView />}
      {screen.name === "product" && <ProductScreen productId={screen.productId} />}
      {screen.name === "basket" && <BasketScreen />}
      {screen.name === "checkout" && <CheckoutScreen />}
      {screen.name === "done" && <ConfirmationScreen order={screen.order} tickets={screen.tickets} isPreview />}
    </StorefrontFlowProvider>
  );
}
