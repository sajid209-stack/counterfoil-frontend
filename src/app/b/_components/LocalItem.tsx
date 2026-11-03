"use client";

import { useParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { StorefrontMissing } from "@/app/s/_components/Chrome";
import { SfRoot } from "@/app/s/_components/sf";
import { productBySlug } from "@/lib/api/products";
import { ItemScreen } from "./ItemScreen";
import { LiveItemShell } from "./LiveItemShell";

const noSubscribe = () => () => {};

/**
 * The server only knows the seeded catalogue, so it answers 404 for an item made
 * in this browser. The status is right for everyone else, and stays: nothing leaks
 * about what exists. But the person who made the item must still reach it, so
 * before saying the page is unavailable, this asks the browser's own catalogue.
 *
 * The server draws a skeleton and not the message, or the operator's own page would
 * open by flashing "This page isn't available" first.
 */
export function LocalItem() {
  const { slug } = useParams<{ slug: string }>();
  const t = useTranslations("storefront");
  const known = useSyncExternalStore<boolean | null>(noSubscribe, () => productBySlug(slug) !== null, () => null);

  useEffect(() => {
    if (known) document.title = productBySlug(slug)?.name ?? document.title;
  }, [known, slug]);

  if (known === null) {
    return (
      <SfRoot accent={null} className="px-gutter py-hero">
        <div aria-busy="true" className="mx-auto max-w-[1200px] space-y-section">
          <Skeleton h={24} w="33%" />
          <Skeleton h={96} />
        </div>
      </SfRoot>
    );
  }
  if (!known) return <StorefrontMissing title={t("itemMissingTitle")} message={t("itemMissingBody")} />;
  return (
    <LiveItemShell slug={slug}>
      <ItemScreen />
    </LiveItemShell>
  );
}
