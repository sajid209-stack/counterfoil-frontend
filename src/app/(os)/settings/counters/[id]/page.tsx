"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getCounter, listLocations, listProducts } from "@/lib/api";
import { CounterForm } from "../_components/CounterForm";

export default function CounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const counter = useApiQuery(() => getCounter(params.id), [params.id]);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const prods = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const loading = counter.loading || locs.loading || prods.loading;

  if (!counter.loading && (counter.error || !counter.data)) {
    return (
      <PageShell title={t("counters.fallbackTitle")}>
        <EmptyState title={t("counters.notFoundTitle")} action={<Button onClick={() => router.push("/settings/counters")}>{t("counters.backButton")}</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={counter.data?.name ?? t("counters.fallbackTitle")}
      actions={counter.data ? <StatusPill status={counter.data.status} /> : undefined}
    >
      <Link href="/settings/counters" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("counters.backToCounters")}
      </Link>
      {loading || !counter.data ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <CounterForm mode="edit" counter={counter.data} locations={locs.data?.data ?? []} products={prods.data?.data ?? []} />
      )}
    </PageShell>
  );
}
