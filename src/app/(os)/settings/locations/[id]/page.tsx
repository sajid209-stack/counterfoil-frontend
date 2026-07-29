"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getLocation } from "@/lib/api";
import { LocationForm } from "../_components/LocationForm";

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useApiQuery(() => getLocation(params.id), [params.id]);

  if (!loading && (error || !data)) {
    return (
      <PageShell title="Location">
        <EmptyState
          title="Location not found"
          action={<Button onClick={() => router.push("/settings/locations")}>Back to locations</Button>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={data?.name ?? "Location"}
      description={data ? `${data.city}, ${data.country}` : undefined}
      actions={data ? <StatusPill status={data.status} /> : undefined}
    >
      <Link href="/settings/locations" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Locations
      </Link>
      {loading || !data ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <LocationForm mode="edit" location={data} />
      )}
    </PageShell>
  );
}
