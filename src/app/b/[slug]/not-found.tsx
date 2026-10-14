import { getTranslations } from "next-intl/server";
import { StorefrontMissing } from "@/app/s/_components/Chrome";

/**
 * What /b/<slug> shows, with HTTP 404, when there is nothing a visitor may book
 * at the link. The same design the page always drew for this (`StorefrontMissing`),
 * and the same words for an unknown address, a draft, an archived item and one
 * that is not sold online — so nothing leaks about what exists but is not for sale.
 */
export default async function ItemNotFound() {
  const t = await getTranslations("storefront");
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <StorefrontMissing title={t("itemMissingTitle")} message={t("itemMissingBody")} />
    </>
  );
}
