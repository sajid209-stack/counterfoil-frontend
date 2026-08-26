"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getLocation } from "@/lib/api";
import { LocationForm } from "../_components/LocationForm";

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const { data, loading, error } = useApiQuery(() => getLocation(params.id), [params.id]);

  if (!loading && (error || !data)) {
    return (
      <PageShell title={t("locations.singular")}>
        <EmptyState
          title={t("locations.notFound")}
          action={<Button onClick={() => router.push("/settings/locations")}>{t("locations.backToList")}</Button>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={data?.name ?? t("locations.singular")}
      description={data ? `${data.city}, ${data.country}` : undefined}
      actions={data ? <StatusPill status={data.status} /> : undefined}
    >
      <Link href="/settings/locations" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("locations.title")}
      </Link>
      {loading || !data ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <LocationForm mode="edit" location={data} />
      )}
    </PageShell>
  );
}
