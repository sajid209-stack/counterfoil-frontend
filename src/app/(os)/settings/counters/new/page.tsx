"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listProducts } from "@/lib/api";
import { CounterForm } from "../_components/CounterForm";

export default function NewCounterPage() {
  const t = useTranslations("settings");
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const prods = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const loading = locs.loading || prods.loading;

  return (
    <PageShell title={t("counters.newTitle")} description={t("counters.newDescription")}>
      <Link href="/settings/counters" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("counters.backToCounters")}
      </Link>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <CounterForm mode="create" locations={locs.data?.data ?? []} products={prods.data?.data ?? []} />
      )}
    </PageShell>
  );
}
