"use client";

import { useTranslations } from "next-intl";
import { ProductPageView } from "@/components/productPage/ProductPageView";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { StorefrontMissing } from "../Chrome";

/**
 * One booking, ready to buy — the item's page inside the flow it was reached
 * through. The page itself is `ProductPageView`, the one renderer of an item's
 * page (the storefront, the item's own link and the Page designer all draw
 * it); this only finds the item in the flow and picks the frame: the venue's
 * header on a storefront, the slim one on an item's own link.
 */
export function ProductScreen({ productId }: { productId: string }) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");

  const product = flow.products.find((p) => p.id === productId);
  if (!product) return <StorefrontMissing title={t("missingBookingTitle")} message={t("missingBookingBody")} />;

  return <ProductPageView product={product} mode="live" chrome={flow.link ? "link" : "storefront"} />;
}
