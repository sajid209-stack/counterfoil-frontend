"use client";

import { useTranslations } from "next-intl";
import { StorefrontChrome } from "@/app/s/_components/Chrome";
import type { Product } from "@/lib/api/types";
import { isListed } from "@/lib/productPage";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { storefrontVars } from "@/lib/storefront/theme";

/**
 * The frame round an item's page: the venue's storefront header, the slim
 * header of the item's own link, or nothing (the designer draws its own).
 *
 * "none" still carries the storefront's light theme, scoped to the page, so the
 * same markup reads the same in the designer as it does to a customer.
 */
export function PageFrame({
  product,
  chrome,
  accent,
  bleed = false,
  children,
}: {
  product: Product;
  chrome: "storefront" | "link" | "none";
  /** This page's own colour, as a hex; absent means the venue's. */
  accent?: string | null;
  /** Full width, no page gutters: the event template draws its own. */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");

  if (chrome === "none") {
    return (
      <div className="sf" style={storefrontVars(accent ?? flow.storefront.accent)}>
        {children}
      </div>
    );
  }
  return (
    <StorefrontChrome
      variant={chrome}
      showMore={isListed(product)}
      accent={accent}
      bleed={bleed}
      storefront={flow.storefront}
      location={flow.location}
      poweredBy={t("poweredBy")}
    >
      {children}
    </StorefrontChrome>
  );
}
