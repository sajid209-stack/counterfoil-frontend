"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listResources } from "@/lib/api";
import { ResourceForm } from "../_components/ResourceForm";

export default function NewResourcePage() {
  const t = useTranslations("settings");
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const existing = useApiQuery(() => listResources({ pageSize: 1 }), []);
  const defaultNoun = existing.data?.data[0]?.nounSingular ?? t("resources.defaultNoun");

  return (
    <PageShell title={t("resources.newTitle")} description={t("resources.newDescription")}>
      <Link href="/settings/resources" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("resources.backToResources")}
      </Link>
      {locs.loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <ResourceForm mode="create" locations={locs.data?.data ?? []} defaultNoun={defaultNoun} />
      )}
    </PageShell>
  );
}
