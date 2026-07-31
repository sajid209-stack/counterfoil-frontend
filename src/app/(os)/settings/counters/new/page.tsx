"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listProducts } from "@/lib/api";
import { CounterForm } from "../_components/CounterForm";

export default function NewCounterPage() {
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const prods = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const loading = locs.loading || prods.loading;

  return (
    <PageShell title="New counter" description="Add a point of sale at a location.">
      <Link href="/settings/counters" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Counters
      </Link>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-neutral-200" /><div className="h-4 w-2/3 rounded-xs bg-neutral-200" /><div className="h-4 w-1/2 rounded-xs bg-neutral-200" /></div>
      ) : (
        <CounterForm mode="create" locations={locs.data?.data ?? []} products={prods.data?.data ?? []} />
      )}
    </PageShell>
  );
}
