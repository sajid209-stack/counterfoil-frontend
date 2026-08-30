"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PauseCircle, PlayCircle, RefreshCw, Search, Settings2, XCircle } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  Tabs,
  useToast,
  type Column,
  type PillTone,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  cancelMembership,
  listMemberships,
  membershipCounts,
  pauseMembership,
  renewMembership,
  resumeMembership,
  type MembershipStatus,
  type MembershipView,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

type Tab = "active" | "expiring" | "lapsed" | "paused" | "cancelled";

const TONE: Record<MembershipStatus, PillTone> = {
  active: "success",
  lapsed: "danger",
  paused: "warning",
  cancelled: "neutral",
};

export default function MembershipsPage() {
  const t = useTranslations("memberships");
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState<MembershipView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filters = useMemo(
    () =>
      tab === "expiring"
        ? { expiringSoon: true }
        : { effectiveStatus: tab as MembershipStatus },
    [tab],
  );

  const listQ = useApiQuery(
    () => listMemberships({ pageSize: 500, search, filters }),
    [tab, search],
  );
  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data]);
  const countsQ = useApiQuery(() => membershipCounts(), [listQ.data]);
  const counts = countsQ.data ?? {
    active: 0, expiringSoon: 0, lapsed: 0, paused: 0, cancelled: 0,
  };

  const act = async (
    m: MembershipView,
    run: () => Promise<{ ok: boolean; error?: { message: string } }>,
    message: string,
  ) => {
    setBusy(m.id);
    const res = await run();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error?.message ?? "");
      return;
    }
    toast.success(message);
    listQ.reload();
  };

  const columns: Column<MembershipView>[] = [
    {
      key: "customer",
      header: t("colMember"),
      render: (m) => (
        <div className="min-w-0">
          <div className="break-words font-medium">{m.customerName}</div>
          <div className="font-mono text-[11px] text-faint">{m.code}</div>
        </div>
      ),
    },
    {
      key: "tier",
      header: t("colTier"),
      render: (m) => (
        <div className="min-w-0">
          <div className="break-words text-[13px]">{m.tierName}</div>
          {m.members.length > 1 && (
            <div className="text-[12px] text-muted">
              {t("namedPeople", { count: m.members.length })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      render: (m) => (
        <div className="flex flex-wrap items-center gap-inline">
          <StatusPill tone={TONE[m.effectiveStatus]}>
            {t(`status_${m.effectiveStatus}`)}
          </StatusPill>
          {m.expiringSoon && (
            <StatusPill tone="warning">{t("daysLeft", { count: m.daysToExpiry })}</StatusPill>
          )}
        </div>
      ),
    },
    {
      key: "visits",
      header: t("colVisits"),
      align: "right",
      render: (m) => (
        <span className="font-mono whitespace-nowrap text-[12px]">
          {m.visitsLeft == null ? t("unlimited") : t("visitsLeft", { count: m.visitsLeft })}
        </span>
      ),
    },
    {
      key: "expires",
      header: t("colExpires"),
      align: "right",
      render: (m) => (
        <span className="font-mono whitespace-nowrap text-[12px] text-muted">
          {formatDate(m.expiresAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      align: "right",
      render: (m) => (
        <div className="flex flex-wrap justify-end gap-inline">
          {(m.effectiveStatus === "lapsed" || m.expiringSoon) && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={14} strokeWidth={1.5} />}
              loading={busy === m.id}
              onClick={() => act(m, () => renewMembership(m.id), t("renewed"))}
            >
              {t("renew")}
            </Button>
          )}
          {m.effectiveStatus === "active" && (
            <Button
              size="sm"
              variant="tertiary"
              icon={<PauseCircle size={14} strokeWidth={1.5} />}
              loading={busy === m.id}
              onClick={() => act(m, () => pauseMembership(m.id), t("paused"))}
            >
              {t("pause")}
            </Button>
          )}
          {m.effectiveStatus === "paused" && (
            <Button
              size="sm"
              variant="secondary"
              icon={<PlayCircle size={14} strokeWidth={1.5} />}
              loading={busy === m.id}
              onClick={() => act(m, () => resumeMembership(m.id), t("resumed"))}
            >
              {t("resume")}
            </Button>
          )}
          {m.effectiveStatus !== "cancelled" && (
            <Button
              size="sm"
              variant="tertiary"
              icon={<XCircle size={14} strokeWidth={1.5} />}
              onClick={() => setCancelling(m)}
            >
              {t("cancelMembership")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const tabs = [
    { value: "active", label: t("tabActive"), count: counts.active },
    { value: "expiring", label: t("tabExpiring"), count: counts.expiringSoon },
    { value: "lapsed", label: t("tabLapsed"), count: counts.lapsed },
    { value: "paused", label: t("tabPaused"), count: counts.paused },
    { value: "cancelled", label: t("tabCancelled"), count: counts.cancelled },
  ];

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <Button
          variant="secondary"
          icon={<Settings2 size={16} strokeWidth={1.5} />}
          onClick={() => router.push("/settings/memberships")}
        >
          {t("manageTiers")}
        </Button>
      }
    >
      <div className="flex flex-col gap-section">
        <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(m) => m.id}
          loading={listQ.loading}
          onRowClick={(m) => router.push(`/customers/${m.customerId}`)}
          toolbar={
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.5}
                className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-72 max-w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
          }
          emptyState={<EmptyState title={t(`empty_${tab}`)} message={t("emptyMessage")} />}
        />
      </div>

      <CancelDialog
        membership={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          listQ.reload();
        }}
      />
    </PageShell>
  );
}

function CancelDialog({
  membership,
  onClose,
  onCancelled,
}: {
  membership: MembershipView | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const t = useTranslations("memberships");
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!membership) return;
    setSaving(true);
    const res = await cancelMembership(membership.id, reason);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    setReason("");
    toast.success(t("cancelled"));
    onCancelled();
  };

  return (
    <Modal
      open={!!membership}
      onClose={onClose}
      title={t("cancelTitle", { name: membership?.customerName ?? "" })}
      description={t("cancelDescription", { expires: formatDate(membership?.expiresAt) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("keepIt")}
          </Button>
          <Button variant="destructive" onClick={submit} loading={saving}>
            {t("cancelMembership")}
          </Button>
        </>
      }
    >
      <FormField
        label={t("cancelReason")}
        variant="textarea"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        help={t("cancelReasonHelp")}
      />
    </Modal>
  );
}
