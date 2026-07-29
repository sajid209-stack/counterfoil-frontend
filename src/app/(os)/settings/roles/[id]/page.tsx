"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getRole } from "@/lib/api";
import { RoleForm } from "../_components/RoleForm";

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error } = useApiQuery(() => getRole(params.id), [params.id]);

  if (!loading && (error || !data)) {
    return (
      <PageShell title="Role">
        <EmptyState title="Role not found" action={<Button onClick={() => router.push("/settings/roles")}>Back to roles</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell title={data?.name ?? "Role"}>
      <Link href="/settings/roles" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Roles
      </Link>
      {loading || !data ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <RoleForm mode="edit" role={data} />
      )}
    </PageShell>
  );
}
