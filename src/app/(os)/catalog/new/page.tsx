"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { CatalogChooser } from "../_components/CatalogChooser";

/** Add to the catalog: the chooser, on a page of its own. One page, two groups
 *  (what repeats on a schedule, what happens on a date), one card style. */
export default function NewCatalogItemPage() {
  const t = useTranslations("catalog");
  return (
    /* The way back is the page's own back link, in the standard header row,
       rather than a hand-placed anchor with its own line-height and margin. */
    <PageShell title={t("chooser.title")} description={t("chooser.description")} back={{ href: "/catalog", label: t("title") }}>
      <div className="pb-hero">
        <CatalogChooser />
      </div>
    </PageShell>
  );
}
