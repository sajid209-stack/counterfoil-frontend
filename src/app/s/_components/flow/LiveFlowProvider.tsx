"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StorefrontFlowProvider, type StorefrontFlowData, type StorefrontFlowNav } from "@/lib/storefront/FlowProvider";
import { useLiveBasket } from "@/lib/storefront/basket";
import { useStorefrontData } from "@/lib/storefront/useStorefrontData";
import { StorefrontMissing } from "../Chrome";
import { SfRoot } from "../sf";

/**
 * The live surface's half of the flow: real routes (`router.push`), and the
 * basket in sessionStorage keyed by the venue's slug — so it survives moving
 * between the venue page, a booking page, the basket and checkout, which are
 * four separate route loads with nothing else in common.
 *
 * Every `/s/[slug]...` route is this component wrapped around one screen.
 */
export function LiveStorefrontShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("storefront");
  const { loading, page, resources, team, operator, now } = useStorefrontData(slug);
  const [basket, setBasket] = useLiveBasket(slug);

  if (loading) {
    return (
      <SfRoot accent={null} className="px-gutter py-hero">
        <div aria-busy="true" className="mx-auto grid max-w-[1200px] animate-pulse grid-cols-1 gap-wide lg:grid-cols-2">
          <div className="space-y-section">
            <div className="h-6 w-1/3 rounded-full bg-subtle" />
            <div className="h-14 w-5/6 rounded-[12px] bg-subtle" />
            <div className="h-24 w-full rounded-[12px] bg-subtle" />
          </div>
          <div className="aspect-[4/3] rounded-[20px] bg-subtle" />
        </div>
      </SfRoot>
    );
  }
  if (!page) return <StorefrontMissing title={t("missingTitle")} message={t("missingBody")} />;

  const nav: StorefrontFlowNav = {
    goVenue: () => router.push(`/s/${slug}`),
    goProduct: (id) => router.push(`/s/${slug}/${page.slugs[id]}`),
    goBasket: () => router.push(`/s/${slug}/basket`),
    goCheckout: () => router.push(`/s/${slug}/checkout`),
    goDone: (result) => router.push(`/s/${slug}/done/${result.orderId ?? ""}`),
  };

  const data: StorefrontFlowData = {
    mode: "live",
    storefront: page.storefront,
    location: page.location,
    products: page.products,
    slugs: page.slugs,
    resources,
    team,
    now,
    operator,
  };

  return (
    <StorefrontFlowProvider data={data} nav={nav} basket={basket} setBasket={setBasket}>
      {children}
    </StorefrontFlowProvider>
  );
}
