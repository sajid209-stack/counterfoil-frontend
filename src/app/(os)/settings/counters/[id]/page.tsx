"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getCounter, listLocations, listProducts } from "@/lib/api";
import { CounterForm } from "../_components/CounterForm";

export default function CounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const counter = useApiQuery(() => getCounter(params.id), [params.id]);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const prods = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const loading = counter.loading || locs.loading || prods.loading;

  if (!counter.loading && (counter.error || !counter.data)) {
    return (
      <PageShell title="Counter">
        <EmptyState title="Counter not found" action={<Button onClick={() => router.push("/settings/counters")}>Back to counters</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={counter.data?.name ?? "Counter"}
      actions={counter.data ? <StatusPill status={counter.data.status} /> : undefined}
    >
      <Link href="/settings/counters" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Counters
      </Link>
      {loading || !counter.data ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <CounterForm mode="edit" counter={counter.data} locations={locs.data?.data ?? []} products={prods.data?.data ?? []} />
      )}
    </PageShell>
  );
}
