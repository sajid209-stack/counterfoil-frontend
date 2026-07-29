"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listLocations, listRoles } from "@/lib/api";
import { StaffForm } from "../_components/StaffForm";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const member = useApiQuery(() => getStaff(params.id), [params.id]);
  const roles = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const loading = member.loading || roles.loading || locs.loading || counters.loading;

  if (!member.loading && (member.error || !member.data)) {
    return (
      <PageShell title="Staff">
        <EmptyState title="Staff member not found" action={<Button onClick={() => router.push("/settings/team")}>Back to staff</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={member.data?.name ?? "Staff"}
      actions={member.data ? <StatusPill status={member.data.status} /> : undefined}
    >
      <Link href="/settings/team" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Staff
      </Link>
      {loading || !member.data ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <StaffForm mode="edit" staff={member.data} roles={roles.data?.data ?? []} locations={locs.data?.data ?? []} counters={counters.data?.data ?? []} />
      )}
    </PageShell>
  );
}
