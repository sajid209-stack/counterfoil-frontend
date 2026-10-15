"use client";

import type { Product } from "@/lib/api/types";
import { useOptionalStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { PreviewHost } from "./PreviewHost";
import { BookingPage } from "./page/BookingPage";

/**
 * An item's page, drawn — the ONE renderer for it, used by the storefront
 * (`/s/<venue>/<item>`), the item's own link (`/b/<slug>`) and the Page
 * designer's live preview in the Catalog, so what an operator approves is what
 * a customer reads. See docs/catalog.md §9.5.
 *
 * CONTRACT (the designer phase imports it). Keep these props stable.
 *
 *   product   the item, including an unsaved draft of its `page` in a preview.
 *   mode      "live" books through the storefront basket; "preview" draws the
 *             same page with every action inert and writes nothing.
 *   chrome    "storefront" inside the venue's storefront header, "link" with
 *             the slim header of an item's own link, "none" for the designer.
 *
 * One system: every booking, every one of the seven looks, is drawn by
 * `page/BookingPage` (docs/product-page.md).
 */
export interface ProductPageViewProps {
  product: Product;
  mode?: "live" | "preview";
  chrome?: "storefront" | "link" | "none";
}

export function ProductPageView({ product, mode = "live", chrome = "storefront" }: ProductPageViewProps) {
  const outer = useOptionalStorefrontFlow();
  /* A live page lives inside a flow (the venue's, or the item's own link) that
     owns the basket and the routes. Drawn on its own — the designer — or asked
     to preview, it brings an inert one: same page, nothing can navigate or
     write. */
  if (mode === "live" && outer) return <PageBody product={product} chrome={chrome} />;
  return (
    <PreviewHost product={product}>
      <PageBody product={product} chrome={chrome} />
    </PreviewHost>
  );
}

function PageBody({ product, chrome }: { product: Product; chrome: NonNullable<ProductPageViewProps["chrome"]> }) {
  return <BookingPage product={product} chrome={chrome} />;
}
