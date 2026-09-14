"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, EmptyState, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getStaff,
  listCounters,
  listLocations,
  listRoles,
  listStaff,
  revokeInvite,
  updateStaff,
  type Staff,
  type StaffStatus,
} from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { countByRole } from "../../_lib/roles";
import { AccessSection } from "../_components/AccessSection";
import { MemberForm } from "../_components/MemberForm";

export default function MemberPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const toast = useToast();
  const memberQ = useApiQuery(() => getStaff(params.id), [params.id]);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  // The record as last written from this page, so a status change shows at once
  // without reloading the form out from under an edit in progress.
  const [latest, setLatest] = useState<Staff | null>(null);
  const [confirm, setConfirm] = useState<null | "suspend" | "revoke">(null);
  const [busy, setBusy] = useState(false);

  if (!memberQ.loading && (memberQ.error || !memberQ.data)) {
    return (
      <PageShell title={t("team.fallbackTitle")}>
        <EmptyState
          title={t("team.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/team")}>{t("team.backButton")}</Button>}
        />
      </PageShell>
    );
  }

  const member = latest?.id === params.id ? latest : memberQ.data;
  if (!member || rolesQ.loading || locationsQ.loading || countersQ.loading || staffQ.loading) {
    return (
      <PageShell title={t("team.fallbackTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const via = member.email ?? member.phone ?? "";
  const setStatus = async (status: StaffStatus) => {
    setBusy(true);
    const res = await updateStaff(member.id, { status });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest(res.data);
    toast.success(status === "suspended" ? t("team.suspendedToast", { name: member.name }) : t("team.reactivated", { name: member.name }));
  };

  // A revoked invite has no page to stay on, so this goes back to the team.
  const revoke = async () => {
    setBusy(true);
    const res = await revokeInvite(member.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("team.revoked", { name: member.name }));
    router.push("/settings/team");
  };

  return (
    <PageShell title={member.name} description={member.id === DEMO_STAFF_ID ? `${via} · ${t("team.youNote")}` : via}>
      <div className="flex max-w-3xl flex-col gap-section">
        <AccessSection
          member={member}
          busy={busy}
          onResend={() => toast.success(t("team.inviteResent", { who: via }))}
          onRevoke={() => setConfirm("revoke")}
          onReset={() => toast.success(t("team.resetSent", { who: via }))}
          onSuspend={() => setConfirm("suspend")}
          onReactivate={() => setStatus("active")}
        />
        <MemberForm
          mode="edit"
          staff={member}
          roles={rolesQ.data?.data ?? []}
          locations={locationsQ.data?.data ?? []}
          counters={countersQ.data?.data ?? []}
          staffCounts={countByRole(staffQ.data?.data ?? [])}
          onSaved={setLatest}
        />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "revoke" ? revoke() : setStatus("suspended"))}
        title={confirm === "revoke" ? t("team.revokeTitle", { name: member.name }) : t("team.suspendTitle", { name: member.name })}
        message={confirm === "revoke" ? t("team.revokeBody") : t("team.suspendBody")}
        confirmLabel={confirm === "revoke" ? t("team.revokeInvite") : t("team.suspend")}
        loading={busy}
      />
    </PageShell>
  );
}
