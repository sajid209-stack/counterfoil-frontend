"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, LayoutGrid, PauseCircle, PlayCircle, RefreshCw, Repeat, UserRound, XCircle } from "lucide-react";
import {
  ActionMenu,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSearch,
  Select,
  StatusPill,
  useToast,
  type ActionMenuItem,
  type Column,
} from "@/components/ui";
import { PageAction, PagePrimaryButton, type PagePrimary } from "@/components/ui/PageShell";
import { MetaParts, PhoneRow } from "@/components/ui/PhoneRow";
import { QuickTabs } from "@/components/ui/QuickTabs";
import { SM, useMediaQuery } from "@/lib/useMedia";
import {
  pauseMembership,
  renewMembership,
  resumeMembership,
  setMembershipAutoRenew,
  type MembershipSummary,
  type MembershipTier,
  type MembershipView,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { MemberAvatar, Meter, STATUS_TONE, useEndsIn } from "../shared";
import { CancelDialog } from "./CancelDialog";
import type { ListTab } from "./Figures";

const TABS: ListTab[] = ["active", "ending", "ended", "paused", "cancelled"];
const EMPTY_KEY: Record<ListTab, string> = { active: "empty_active", ending: "empty_expiring", ended: "empty_lapsed", paused: "empty_paused", cancelled: "empty_cancelled" };

/**
 * The members list: quick tabs and search on the toolbar, one row per
 * membership, and a row menu that holds every action (no buttons on rows).
 * A status pill appears only for the exceptions: paused, ended, cancelled, or
 * an active membership that ends soon.
 */
export function MembersTable({
  rows,
  loading,
  summary,
  tiers,
  tab,
  onTab,
  search,
  onSearch,
  tierId,
  onTierId,
  primary,
  onChanged,
}: {
  rows: MembershipView[];
  loading: boolean;
  summary: MembershipSummary | undefined;
  tiers: MembershipTier[];
  tab: ListTab;
  onTab: (tab: ListTab) => void;
  search: string;
  onSearch: (value: string) => void;
  tierId: string;
  onTierId: (value: string) => void;
  primary: PagePrimary;
  onChanged: () => void;
}) {
  const t = useTranslations("membershipsList");
  const tm = useTranslations("memberships");
  const router = useRouter();
  const toast = useToast();
  const endsIn = useEndsIn();
  const sm = useMediaQuery(SM, true);
  const [cancelling, setCancelling] = useState<MembershipView | null>(null);

  const countOf: Record<ListTab, number> = {
    active: summary?.active ?? 0,
    ending: summary?.expiringSoon ?? 0,
    ended: summary?.lapsed ?? 0,
    paused: summary?.paused ?? 0,
    cancelled: summary?.cancelled ?? 0,
  };
  const tierName = tiers.find((x) => x.id === tierId)?.name ?? null;
  const filtered = search.trim() !== "" || tierId !== "";

  const run = async (go: () => Promise<{ ok: boolean }>, message: string) => {
    const res = await go();
    if (!res.ok) return toast.error(t("toast.failed"));
    toast.success(message);
    onChanged();
  };

  const actionsFor = (m: MembershipView): ActionMenuItem[] => {
    const icon = (I: typeof RefreshCw) => <I size={14} strokeWidth={1.5} />;
    const items: ActionMenuItem[] = [{ key: "open", label: t("row.open"), icon: icon(ExternalLink), onSelect: () => router.push(`/memberships/${m.id}`) }];
    if (m.effectiveStatus === "lapsed" || m.expiringSoon) {
      items.push({ key: "renew", label: t("row.renew"), icon: icon(RefreshCw), onSelect: () => run(() => renewMembership(m.id), t("toast.renewed")) });
    }
    if (m.effectiveStatus === "active") {
      items.push({ key: "pause", label: t("row.pause"), icon: icon(PauseCircle), onSelect: () => run(() => pauseMembership(m.id), t("toast.paused")) });
      items.push({
        key: "auto",
        label: m.autoRenew ? t("row.stopRenewing") : t("row.renewByItself"),
        icon: icon(Repeat),
        onSelect: () => run(() => setMembershipAutoRenew(m.id, !m.autoRenew), m.autoRenew ? t("toast.autoOff") : t("toast.autoOn")),
      });
    }
    if (m.effectiveStatus === "paused") {
      items.push({ key: "resume", label: t("row.startAgain"), icon: icon(PlayCircle), onSelect: () => run(() => resumeMembership(m.id), t("toast.resumed")) });
    }
    items.push({ key: "customer", label: t("row.openCustomer"), icon: icon(UserRound), onSelect: () => router.push(`/customers/${m.customerId}`) });
    if (m.effectiveStatus !== "cancelled") {
      items.push({ key: "cancel", label: t("row.cancel"), icon: icon(XCircle), destructive: true, separated: true, onSelect: () => setCancelling(m) });
    }
    return items;
  };

  /** A pill only when the membership is not simply active. */
  const pillOf = (m: MembershipView) => {
    if (m.effectiveStatus !== "active") return <StatusPill tone={STATUS_TONE[m.effectiveStatus]}>{tm(`status_${m.effectiveStatus}`)}</StatusPill>;
    if (m.expiringSoon) return <StatusPill tone="warning">{m.daysToExpiry === 0 ? t("endsToday") : t("endsIn", { count: m.daysToExpiry })}</StatusPill>;
    return null;
  };

  const tierOf = (m: MembershipView) => tiers.find((x) => x.id === m.tierId);

  const menu = (m: MembershipView) => (
    <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <ActionMenu items={actionsFor(m)} label={t("row.actions", { name: m.customerName })} />
    </span>
  );

  const columns: Column<MembershipView>[] = [
    {
      key: "member",
      header: t("col.member"),
      render: (m) => (
        <span className="flex min-w-0 items-center gap-comfortable py-inline">
          <MemberAvatar name={m.customerName} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base font-medium text-fg">{m.customerName}</span>
            <span className="truncate font-mono text-sm text-muted">{m.code}</span>
          </span>
        </span>
      ),
    },
    {
      key: "plan",
      header: t("col.plan"),
      render: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base text-fg">{m.tierName}</span>
          {m.members.length > 1 && <span className="text-sm text-muted">{t("forPeople", { count: m.members.length })}</span>}
        </span>
      ),
    },
    {
      key: "visits",
      header: t("col.visits"),
      render: (m) => {
        const total = tierOf(m)?.includedVisits;
        if (m.visitsLeft == null || total == null) return <span className="text-sm text-muted">{t("unlimited")}</span>;
        return (
          <span className="flex w-28 flex-col gap-inline">
            <span className="text-sm text-fg">{t("visitsOf", { left: m.visitsLeft, total })}</span>
            <Meter value={m.visitsLeft} max={total} tone={m.visitsLeft <= 1 ? "warning" : "fg"} label={t("visitsMeter")} />
          </span>
        );
      },
    },
    {
      key: "ends",
      header: t("col.ends"),
      render: (m) => (
        <span className="flex min-w-0 flex-col">
          {m.daysToExpiry > 3650 ? (
            <span className="text-base text-fg">{endsIn(m)}</span>
          ) : (
            <>
              <span className="flex items-center gap-inline text-base text-fg">
                {m.autoRenew && m.effectiveStatus === "active" && (
                  <span title={t("renewsByItself")} className="inline-flex text-muted">
                    <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
                    <span className="sr-only">{t("renewsByItself")}</span>
                  </span>
                )}
                {formatDate(m.expiresAt)}
              </span>
              <span className="text-sm text-muted">{endsIn(m)}</span>
            </>
          )}
        </span>
      ),
    },
    { key: "status", header: t("col.status"), render: (m) => pillOf(m) },
    { key: "actions", header: <span className="sr-only">{t("col.actions")}</span>, width: "3rem", render: menu },
  ];

  const tabsEl = (cls?: string) => (
    <QuickTabs
      label={t("tabs.label")}
      value={tab}
      onChange={onTab}
      className={cls}
      options={TABS.map((v) => ({
        value: v,
        label: t("tabs.withCount", { label: t(`tabs.${v === "ending" ? "ending" : v}`), count: countOf[v] }),
      }))}
    />
  );

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(m) => m.id}
        loading={loading}
        layout="fixed"
        height="page"
        minWidth="44rem"
        onRowClick={(m) => router.push(`/memberships/${m.id}`)}
        cardVariant="list"
        phoneInset={`calc(var(--spacing-gutter) + 36px + var(--spacing-comfortable))`}
        renderCard={(m) => (
          <PhoneRow
            lead={<MemberAvatar name={m.customerName} />}
            title={m.customerName}
            meta={<MetaParts parts={[m.tierName, endsIn(m)]} />}
            pill={pillOf(m)}
            action={<span onClick={(e) => e.stopPropagation()} className="flex"><ActionMenu items={actionsFor(m)} label={t("row.actions", { name: m.customerName })} /></span>}
          />
        )}
        toolbar={
          <FilterBar
            pill
            tabs={tabsEl()}
            lead={sm ? tabsEl("mx-0 border-b-0 px-0") : undefined}
            search={<FilterSearch value={search} onChange={onSearch} placeholder={tm("searchPlaceholder")} className="flex-1 md:flex-none" />}
            actions={
              <>
                <span className="max-md:hidden">
                  <PageAction label={t("plans")} icon={<LayoutGrid size={16} strokeWidth={1.5} />} onClick={() => router.push("/memberships/plans")} />
                </span>
                <PagePrimaryButton primary={primary} />
              </>
            }
            filters={[
              {
                key: "plan",
                label: t("planFilter.label"),
                active: tierName,
                onClear: () => onTierId(""),
                control: (
                  <Select
                    value={tierId || "all"}
                    onChange={(v) => onTierId(v === "all" ? "" : v)}
                    aria-label={t("planFilter.label")}
                    options={[{ value: "all", label: t("planFilter.all") }, ...tiers.map((x) => ({ value: x.id, label: x.name }))]}
                  />
                ),
              },
            ]}
          />
        }
        emptyState={
          filtered ? (
            <EmptyState
              title={t("empty.noMatchTitle")}
              message={t("empty.noMatchBody")}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    onSearch("");
                    onTierId("");
                  }}
                >
                  {search.trim() !== "" ? t("empty.clear") : t("empty.clearAll")}
                </Button>
              }
            />
          ) : (
            <EmptyState title={tm(EMPTY_KEY[tab])} message={tm("emptyMessage")} />
          )
        }
      />
      <CancelDialog
        membership={cancelling}
        onClose={() => setCancelling(null)}
        onDone={() => {
          setCancelling(null);
          onChanged();
        }}
      />
    </>
  );
}
