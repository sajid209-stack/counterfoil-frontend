"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getLocation, listCounters, listResources, listStaff, type Location } from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { LocationEditor } from "../_components/LocationEditor";

export default function LocationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const locationQ = useApiQuery(() => getLocation(params.id), [params.id]);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 200, filters: { locationId: params.id } }), [params.id]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200, filters: { locationId: params.id } }), [params.id]);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500, filters: { locationId: params.id } }), [params.id]);
  // The location as last written here, so a rename or a status change shows at once.
  const [latest, setLatest] = useState<Location | null>(null);

  if (!locationQ.loading && (locationQ.error || !locationQ.data)) {
    return (
      <PageShell title={t("locations.singular")}>
        <EmptyState
          title={t("locations.notFound")}
          action={<Button onClick={() => router.push("/settings/locations")}>{t("locations.backToList")}</Button>}
        />
      </PageShell>
    );
  }

  const location = latest?.id === params.id ? latest : locationQ.data;
  if (!location || countersQ.loading || resourcesQ.loading || staffQ.loading) {
    return (
      <PageShell title={t("locations.singular")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={location.name}
      description={[location.addressLine1, location.city].filter(Boolean).join(", ")}
      actions={location.status !== "active" ? <StatusPill status={location.status} /> : undefined}
    >
      <LocationEditor
        mode="edit"
        location={location}
        counters={countersQ.data?.data ?? []}
        resources={resourcesQ.data?.data ?? []}
        teamCount={staffQ.data?.data.length ?? 0}
        onSaved={setLatest}
      />
    </PageShell>
  );
}
