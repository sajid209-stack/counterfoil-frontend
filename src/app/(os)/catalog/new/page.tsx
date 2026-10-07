"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { CatalogChooser } from "../_components/CatalogChooser";

/** Add to the catalog: the chooser, on a page of its own. `?kind=events`
 *  (from the Events view's Add button) leads with events. */
export default function NewCatalogItemPage() {
  return (
    <Suspense>
      <NewItem />
    </Suspense>
  );
}

function NewItem() {
  const t = useTranslations("catalog");
  const kind = useSearchParams().get("kind");
  return (
    /* The way back is the page's own back link, in the standard header row,
       rather than a hand-placed anchor with its own line-height and margin. */
    <PageShell
      title={t("chooser.title")}
      description={t("chooser.description")}
      back={{ href: kind ? `/catalog?kind=${kind}` : "/catalog", label: t("title") }}
    >
      <div className="pb-hero">
        <CatalogChooser lead={kind === "events" ? "events" : kind === "bookings" ? "bookings" : "all"} />
      </div>
    </PageShell>
  );
}
