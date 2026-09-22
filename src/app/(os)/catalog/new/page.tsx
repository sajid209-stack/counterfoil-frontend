"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
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
    <PageShell title={t("chooser.title")} description={t("chooser.description")}>
      <Link href={kind ? `/catalog?kind=${kind}` : "/catalog"} className="mb-section inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg md:min-h-0">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("title")}
      </Link>
      <div className="pb-hero">
        <CatalogChooser lead={kind === "events" ? "events" : kind === "bookings" ? "bookings" : "all"} />
      </div>
    </PageShell>
  );
}
