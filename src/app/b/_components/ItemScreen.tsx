"use client";

import { ProductScreen } from "@/app/s/_components/flow/ProductScreen";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";

/** The item at the end of a link: the only product in its flow. */
export function ItemScreen() {
  const flow = useStorefrontFlow();
  return <ProductScreen productId={flow.products[0].id} />;
}
