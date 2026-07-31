"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, listRoles } from "@/lib/api";
import { StaffForm } from "../_components/StaffForm";

export default function NewStaffPage() {
  const roles = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const loading = roles.loading || locs.loading || counters.loading;

  return (
    <PageShell title="Add staff" description="Invite someone to sell, scan, or manage.">
      <Link href="/settings/team" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Staff
      </Link>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-neutral-200" /><div className="h-4 w-2/3 rounded-xs bg-neutral-200" /><div className="h-4 w-1/2 rounded-xs bg-neutral-200" /></div>
      ) : (
        <StaffForm mode="create" roles={roles.data?.data ?? []} locations={locs.data?.data ?? []} counters={counters.data?.data ?? []} />
      )}
    </PageShell>
  );
}
