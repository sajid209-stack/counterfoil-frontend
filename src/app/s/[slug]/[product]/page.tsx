"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LiveStorefrontShell } from "../../_components/flow/LiveFlowProvider";
import { ProductScreen } from "../../_components/flow/ProductScreen";
import { StorefrontMissing } from "../../_components/Chrome";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";

/** One booking, ready to buy — see `ProductScreen` for the screen itself.
 *  This file only resolves the slug in the URL to a product id. */
export default function StorefrontProductPage() {
  const params = useParams<{ slug: string; product: string }>();
  return (
    <LiveStorefrontShell slug={params.slug}>
      <ResolvedProduct productSlug={params.product} />
    </LiveStorefrontShell>
  );
}

function ResolvedProduct({ productSlug }: { productSlug: string }) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const product = flow.products.find((p) => flow.slugs[p.id] === productSlug);
  if (!product) return <StorefrontMissing title={t("missingBookingTitle")} message={t("missingBookingBody")} />;
  return <ProductScreen productId={product.id} />;
}
