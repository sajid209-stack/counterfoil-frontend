"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getResource, listLocations } from "@/lib/api";
import { ResourceForm } from "../_components/ResourceForm";

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const res = useApiQuery(() => getResource(params.id), [params.id]);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  if (!res.loading && (res.error || !res.data)) {
    return (
      <PageShell title={t("resources.fallbackTitle")}>
        <EmptyState title={t("resources.notFoundTitle")} action={<Button onClick={() => router.push("/settings/resources")}>{t("resources.backButton")}</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={res.data?.name ?? t("resources.fallbackTitle")}
      actions={res.data ? (res.data.outOfService ? <StatusPill tone="danger">{t("resources.outOfService")}</StatusPill> : <StatusPill status={res.data.status} />) : undefined}
    >
      <Link href="/settings/resources" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("resources.backToResources")}
      </Link>
      {res.loading || locs.loading || !res.data ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <ResourceForm mode="edit" resource={res.data} locations={locs.data?.data ?? []} />
      )}
    </PageShell>
  );
}
