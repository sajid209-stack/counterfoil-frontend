"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getRole, listStaff, type Role } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { useRoleSummary } from "../../_lib/roles";
import { RoleEditor } from "../_components/RoleEditor";

export default function RolePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const summary = useRoleSummary();
  const roleQ = useApiQuery(() => getRole(params.id), [params.id]);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  // The role as last saved here, so a rename shows in the page title at once.
  const [latest, setLatest] = useState<Role | null>(null);

  if (!roleQ.loading && (roleQ.error || !roleQ.data)) {
    return (
      <PageShell title={t("roles.fallbackTitle")}>
        <EmptyState
          title={t("roles.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/roles")}>{t("roles.backButton")}</Button>}
        />
      </PageShell>
    );
  }

  const role = latest?.id === params.id ? latest : roleQ.data;
  if (!role || staffQ.loading) {
    return (
      <PageShell title={t("roles.fallbackTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const staff = staffQ.data?.data ?? [];
  const yourRoleId = staff.find((s) => s.id === DEMO_STAFF_ID)?.roleId;

  return (
    <PageShell title={role.name} description={summary(role)}>
      <RoleEditor
        mode="edit"
        role={role}
        members={staff.filter((s) => s.roleId === role.id)}
        isYourRole={yourRoleId === role.id}
        onSaved={setLatest}
      />
    </PageShell>
  );
}
