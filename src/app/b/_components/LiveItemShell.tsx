"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { StorefrontMissing } from "@/app/s/_components/Chrome";
import { SfRoot } from "@/app/s/_components/sf";
import { isListed } from "@/lib/productPage";
import { StorefrontFlowProvider, type StorefrontFlowData, type StorefrontFlowNav } from "@/lib/storefront/FlowProvider";
import { useLiveBasket } from "@/lib/storefront/basket";
import { useItemData } from "@/lib/storefront/useStorefrontData";

/**
 * The live half of an item's own link (`/b/<slug>`): the item, its venue, and
 * a basket that belongs to the LINK.
 *
 * Why the checkout lives under /b/<slug> and not under the venue's /s/<venue>
 * routes: a link-only item (a private event, a school group, a partner sale, a
 * poster's QR code) is not listed on the venue's page, and a visitor who is
 * sent a private link must never be sent on to a storefront that does not
 * show it. So the basket, the checkout and the confirmation are the SAME
 * screens the storefront uses, mounted here with a flow whose routes stay
 * inside /b/<slug>. The basket is kept per link, so it does not mix with the
 * venue's own.
 *
 * A link-only page also tells search engines to stay away. The route's server
 * metadata does it for the seeded data; this does it for whatever the browser's
 * store says, which is the only place a change made in this session exists.
 */
export function LiveItemShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("storefront");
  const { loading, page, resources, team, operator, now } = useItemData(slug);
  const [basket, setBasket] = useLiveBasket(`b:${slug}`);

  if (loading) {
    return (
      <SfRoot accent={null} className="px-gutter py-hero">
        <div aria-busy="true" className="mx-auto grid max-w-[1200px] grid-cols-1 gap-wide lg:grid-cols-2">
          <div className="space-y-section">
            <Skeleton h={24} w="33%" />
            <Skeleton h={56} w="83%" />
            <Skeleton h={96} />
          </div>
          <Skeleton className="aspect-[4/3] w-full" />
        </div>
      </SfRoot>
    );
  }
  /* One answer for unknown, draft, archived and counter-only: nothing leaks
     about what exists but is not for sale. */
  if (!page) {
    return (
      <>
        <meta name="robots" content="noindex, nofollow" />
        <StorefrontMissing title={t("itemMissingTitle")} message={t("itemMissingBody")} />
      </>
    );
  }

  const base = `/b/${page.slug}`;
  const nav: StorefrontFlowNav = {
    goVenue: () => router.push(base),
    goProduct: () => router.push(base),
    goBasket: () => router.push(`${base}/basket`),
    goCheckout: () => router.push(`${base}/checkout`),
    goDone: (result) => router.push(`${base}/done/${result.orderId ?? ""}`),
  };

  const data: StorefrontFlowData = {
    mode: "live",
    storefront: page.storefront,
    location: page.location,
    products: [page.product],
    unlistedIds: [],
    slugs: { [page.product.id]: page.slug },
    resources,
    team,
    now,
    operator,
    link: { slug: page.slug, itemName: page.product.name, venueSlug: page.listedOn },
  };

  return (
    <StorefrontFlowProvider data={data} nav={nav} basket={basket} setBasket={setBasket}>
      {!isListed(page.product) && <meta name="robots" content="noindex, nofollow" />}
      {children}
    </StorefrontFlowProvider>
  );
}
