"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listResources } from "@/lib/api";
import { ResourceForm } from "../_components/ResourceForm";

export default function NewResourcePage() {
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const existing = useApiQuery(() => listResources({ pageSize: 1 }), []);
  const defaultNoun = existing.data?.data[0]?.nounSingular ?? "Field";

  return (
    <PageShell title="Add resource" description="A space or piece of equipment guests can book.">
      <Link href="/settings/resources" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Resources
      </Link>
      {locs.loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <ResourceForm mode="create" locations={locs.data?.data ?? []} defaultNoun={defaultNoun} />
      )}
    </PageShell>
  );
}
