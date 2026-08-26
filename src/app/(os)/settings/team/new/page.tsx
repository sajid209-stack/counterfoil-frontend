"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, listRoles } from "@/lib/api";
import { StaffForm } from "../_components/StaffForm";

export default function NewStaffPage() {
  const t = useTranslations("settings");
  const roles = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const loading = roles.loading || locs.loading || counters.loading;

  return (
    <PageShell title={t("team.newTitle")} description={t("team.newDescription")}>
      <Link href="/settings/team" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("team.backToStaff")}
      </Link>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <StaffForm mode="create" roles={roles.data?.data ?? []} locations={locs.data?.data ?? []} counters={counters.data?.data ?? []} />
      )}
    </PageShell>
  );
}
