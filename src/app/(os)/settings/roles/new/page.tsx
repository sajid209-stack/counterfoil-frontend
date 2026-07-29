"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { RoleForm } from "../_components/RoleForm";

export default function NewRolePage() {
  return (
    <PageShell title="New role" description="Define a permission set and limits.">
      <Link href="/settings/roles" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Roles
      </Link>
      <RoleForm mode="create" />
    </PageShell>
  );
}
