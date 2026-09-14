"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getResource, listLocations, type Resource } from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { ResourceEditor } from "../_components/ResourceEditor";

export default function ResourcePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const resourceQ = useApiQuery(() => getResource(params.id), [params.id]);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  // The resource as last written here, so a rename or a status change shows at once.
  const [latest, setLatest] = useState<Resource | null>(null);

  if (!resourceQ.loading && (resourceQ.error || !resourceQ.data)) {
    return (
      <PageShell title={t("resources.fallbackTitle")}>
        <EmptyState
          title={t("resources.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/resources")}>{t("resources.backButton")}</Button>}
        />
      </PageShell>
    );
  }

  const resource = latest?.id === params.id ? latest : resourceQ.data;
  if (!resource || locationsQ.loading) {
    return (
      <PageShell title={t("resources.fallbackTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const locations = locationsQ.data?.data ?? [];
  const place = locations.find((l) => l.id === resource.locationId)?.name;

  return (
    <PageShell
      title={resource.name}
      description={[resource.nounSingular, place].filter(Boolean).join(" · ")}
      actions={
        resource.outOfService ? (
          <StatusPill tone="danger">{t("resources.outOfService")}</StatusPill>
        ) : resource.status !== "active" ? (
          <StatusPill status={resource.status} />
        ) : undefined
      }
    >
      <ResourceEditor mode="edit" resource={resource} locations={locations} onSaved={setLatest} />
    </PageShell>
  );
}
