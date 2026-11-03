"use client";

import { useTranslations } from "next-intl";
import { StorefrontChrome } from "@/app/s/_components/Chrome";
import type { Product } from "@/lib/api/types";
import { productPageStyle, styleRootProps } from "@/lib/pageStyle/resolve";
import { isListed, pageOf } from "@/lib/productPage";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { ACCENT_HEX, storefrontVars } from "@/lib/storefront/theme";
import { lookOf, pageRootClass } from "./page/theme";

/**
 * The frame round an item's page: the venue's storefront header, the slim
 * header of the item's own link, or nothing (the designer draws its own).
 *
 * The header and footer follow the PAGE's colours, not the venue's. The page's
 * variables live on its own inner root, outside which the frame sits, so the
 * frame resolves the same style (`productPageStyle` is pure) and draws itself
 * inside a scope carrying those variables — a dark or warm page is never
 * framed in white.
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

  const page = pageOf(product);
  const resolved = productPageStyle({
    look: lookOf(page.look),
    page,
    brand: flow.storefront.style,
    venueAccent: flow.storefront.accent ? ACCENT_HEX[flow.storefront.accent] : null,
  });
  const { style } = styleRootProps(resolved);

  return (
    <StorefrontChrome
      variant={chrome}
      showMore={isListed(product)}
      accent={accent}
      bleed={bleed}
      storefront={flow.storefront}
      location={flow.location}
      poweredBy={t("poweredBy")}
      pageTheme={{ className: pageRootClass(resolved.colours.mode), style }}
    >
      {children}
    </StorefrontChrome>
  );
}
