import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { peekLocations } from "@/lib/api/locations";
import { demoItemAtSlug, productBySlug } from "@/lib/api/products";
import { isListed } from "@/lib/productPage";
import { readPublishedDoc } from "@/lib/server/publishedStore";
import type { PublishedSnapshot } from "@/lib/api/client";
import { LiveItemShell } from "../_components/LiveItemShell";
import { ItemScreen } from "../_components/ItemScreen";

/** Is there an item a visitor may book at this link? One answer for unknown, draft, archived and counter-only. */
const isAvailable = (slug: string): boolean => {
  const p = productBySlug(slug);
  if (p) return p.status === "active" && p.channels.includes("online");
  return demoItemAtSlug(slug);
};

/**
 * An item's own link: /b/<slug>.
 *
 * The same page as /s/<venue>/<item> (`ProductPageView`), in a slim frame with
 * no storefront around it. Anyone with the link can book, whether or not the
 * item is listed on the venue's page; a link-only item says `noindex, nofollow`
 * so a search engine that finds the address does not list it.
 *
 * Unknown, draft, archived and counter-only items all get the same bare title,
 * the same noindex and the same HTTP 404 (`notFound()`, rendered by this
 * segment's not-found.tsx), so nothing leaks about what exists but is not for sale.
 *
 * The server knows the seeded catalogue, the demo businesses and whatever has been
 * published (`lib/api/publish.ts`). Anything else answers 404, though the browser
 * that made it still draws it: see LocalItem.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("storefront");
  const p = productBySlug(slug);
  if (!p) {
    const doc = (await readPublishedDoc(slug)) as PublishedSnapshot | null;
    if (doc) {
      return {
        title: `${doc.product.name} · ${(doc.location as unknown as { name: string }).name}`,
        description: doc.product.page?.tagline || doc.product.description?.slice(0, 160) || undefined,
        // Published by a browser, with no account behind it: reachable by its link, not by search.
        robots: { index: false, follow: false },
      };
    }
  }
  if (!p || p.status !== "active" || !p.channels.includes("online")) {
    return { title: t("itemMissingTitle"), robots: { index: false, follow: false } };
  }
  const venue = peekLocations().find((l) => l.id === p.locationIds[0]) ?? peekLocations()[0];
  return {
    title: venue ? `${p.name} · ${venue.name}` : p.name,
    description: p.page?.tagline || p.description?.slice(0, 160) || undefined,
    robots: isListed(p) ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function ItemLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isAvailable(slug) && !(await readPublishedDoc(slug))) notFound();
  return (
    <LiveItemShell slug={slug}>
      <ItemScreen />
    </LiveItemShell>
  );
}
