"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, listRoles, listStaff } from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { countByRole } from "../../_lib/roles";
import { MemberForm } from "../_components/MemberForm";

export default function InviteMemberPage() {
  const t = useTranslations("settings");
  const roles = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locations = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const counters = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const staff = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const loading = roles.loading || locations.loading || counters.loading || staff.loading;

  return (
    <PageShell title={t("team.inviteTitle")} description={t("team.inviteDesc")}>
      {loading ? (
        <SectionSkeleton />
      ) : (
        <MemberForm
          mode="create"
          roles={roles.data?.data ?? []}
          locations={locations.data?.data ?? []}
          counters={counters.data?.data ?? []}
          staffCounts={countByRole(staff.data?.data ?? [])}
        />
      )}
    </PageShell>
  );
}
