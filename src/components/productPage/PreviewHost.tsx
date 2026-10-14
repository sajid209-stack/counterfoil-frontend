"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui";
import { getOperator, listLocations, listResources, listStaff, peekStorefrontsFor, slugOf } from "@/lib/api";
import type { Product, Storefront } from "@/lib/api/types";
import { demoNow } from "@/lib/schedule";
import { StorefrontFlowProvider, type StorefrontFlowData, type StorefrontFlowNav } from "@/lib/storefront/FlowProvider";
import type { BasketLine } from "@/lib/storefront/basket";
import { useApiQuery } from "@/lib/useApi";

const noop = () => {};
const NAV: StorefrontFlowNav = { goVenue: noop, goProduct: noop, goBasket: noop, goCheckout: noop, goDone: noop };

/**
 * A flow for a page drawn on its own — the Page designer's preview, which is
 * shown beside unsaved edits and has no route, no basket and no venue page
 * around it.
 *
 * Everything the page needs from a venue (its name, colour, contact and
 * address) is read from the store, and every action is inert: navigation does
 * nothing, and the booking picker's Add buttons return before they touch the
 * basket (`inert`). Nothing here writes.
 */
export function PreviewHost({ product, children }: { product: Product; children: React.ReactNode }) {
  const locQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const resQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const now = useMemo(() => demoNow(), []);
  const [basket, setBasket] = useState<BasketLine[]>([]);

  const locations = locQ.data?.data;
  const resources = resQ.data?.data;
  const team = staffQ.data?.data;
  const operator = opQ.data;

  const data = useMemo<StorefrontFlowData | null>(() => {
    const location = locations?.find((l) => l.id === product.locationIds[0]) ?? locations?.[0];
    if (!location) return null;
    const ts = new Date().toISOString();
    const storefront: Storefront = peekStorefrontsFor(location.id)[0] ?? {
      id: `sf_preview_${location.id}`,
      locationId: location.id,
      slug: "",
      published: false,
      featured: [],
      links: [],
      accent: null,
      createdAt: ts,
      updatedAt: ts,
    };
    return {
      mode: "preview",
      inert: true,
      storefront,
      location,
      products: [product],
      slugs: { [product.id]: slugOf(product) },
      resources: resources ?? [],
      team: team ?? [],
      now,
      operator,
    };
  }, [locations, resources, team, operator, product, now]);

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-section p-section">
        <Skeleton h={24} w="33%" />
        <Skeleton h={160} />
      </div>
    );
  }
  return (
    <StorefrontFlowProvider data={data} nav={NAV} basket={basket} setBasket={setBasket}>
      {children}
    </StorefrontFlowProvider>
  );
}
