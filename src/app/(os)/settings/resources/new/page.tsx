"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listResources } from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { ResourceEditor } from "../_components/ResourceEditor";

export default function NewResourcePage() {
  const t = useTranslations("settings");
  const locations = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const existing = useApiQuery(() => listResources({ pageSize: 1 }), []);

  return (
    <PageShell title={t("resources.newTitle")} description={t("resources.createDesc")}>
      {locations.loading || existing.loading ? (
        <SectionSkeleton />
      ) : (
        <ResourceEditor
          mode="create"
          locations={locations.data?.data ?? []}
          defaultNoun={existing.data?.data[0]?.nounSingular ?? "Field"}
        />
      )}
    </PageShell>
  );
}
