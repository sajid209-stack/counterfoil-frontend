"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Pause, Play, Printer, RefreshCw, RefreshCwOff, UserRound } from "lucide-react";
import { ActionMenu, Button, PageShell, Skeleton, StatusPill, useToast, type ActionMenuItem } from "@/components/ui";
import { StatusScreen } from "@/components/screens";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  cancelMembership,
  getMembership,
  getMembershipTier,
  getOperator,
  pauseMembership,
  renewMembership,
  resumeMembership,
  setMembershipAutoRenew,
  setMembershipMembers,
  type ApiResult,
  type MembershipMember,
  type MembershipTier,
  type MembershipView,
} from "@/lib/api";
import { STATUS_TONE } from "../shared";
import { BenefitsCard } from "./BenefitsCard";
import { CancelDialog } from "./CancelDialog";
import { DetailsCard } from "./DetailsCard";
import { HistoryCard } from "./HistoryCard";
import { MembershipCard } from "./MembershipCard";
import { PeopleCard } from "./PeopleCard";
import { UsageCard } from "./UsageCard";

interface Loaded {
  membership: MembershipView;
  tier: MembershipTier;
  venue: string;
}

/** One membership: the card staff read out at the gate, its usage and people, and its record. */
export function MembershipDetail({ id }: { id: string }) {
  const t = useTranslations("membershipDetail");
  const tm = useTranslations("memberships");
  const router = useRouter();
  const toast = useToast();
  const wide = useMediaQuery(MD);

  const q = useApiQuery<Loaded>(async (): Promise<ApiResult<Loaded>> => {
    const m = await getMembership(id);
    if (!m.ok) return m;
    const tier = await getMembershipTier(m.data.tierId);
    if (!tier.ok) return tier;
    const op = await getOperator();
    return { ok: true, data: { membership: m.data, tier: tier.data, venue: op.ok ? op.data.name : "" } };
  }, [id]);

  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const back = { href: "/memberships", label: tm("title") };
  const data = q.data;

  if (!data) {
    return (
      <PageShell title={tm("title")} back={back}>
        {q.loading ? (
          <div aria-busy="true" className="grid items-start gap-major lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-section">
              <Skeleton h={224} className="max-w-md rounded-card" />
              <Skeleton h={120} className="rounded-card" />
              <Skeleton h={160} className="rounded-card" />
            </div>
            <div className="flex flex-col gap-section">
              <Skeleton h={320} className="rounded-card" />
              <Skeleton h={160} className="rounded-card" />
            </div>
          </div>
        ) : (
          <StatusScreen variant="notFound" framed homeHref="/memberships" homeLabel={tm("title")} title={t("notFound")} />
        )}
      </PageShell>
    );
  }

  const { membership: m, tier, venue } = data;
  const state = m.effectiveStatus;
  const live = state === "active";

  const run = async (action: () => Promise<{ ok: boolean; error?: { message: string } }>, message: string, after?: () => void) => {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error?.message ?? "");
      return;
    }
    toast.success(message);
    after?.();
    q.reload();
  };

  const canRenew = state === "lapsed" || m.expiringSoon;
  const renew = () => run(() => renewMembership(m.id), tm("renewed"));
  const pause = () => run(() => pauseMembership(m.id), tm("paused"), () => setCancelOpen(false));

  const menu: ActionMenuItem[] = [];
  if (live) menu.push({ key: "pause", label: tm("pause"), icon: <Pause size={14} strokeWidth={1.5} aria-hidden />, onSelect: pause });
  if (state === "paused") {
    menu.push({ key: "resume", label: tm("resume"), icon: <Play size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => run(() => resumeMembership(m.id), tm("resumed")) });
  }
  if (live || state === "paused") {
    menu.push(
      m.autoRenew
        ? { key: "stop", label: t("stopRenewing"), icon: <RefreshCwOff size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => run(() => setMembershipAutoRenew(m.id, false), t("stoppedRenewing")) }
        : { key: "auto", label: t("renewByItself"), icon: <RefreshCw size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => run(() => setMembershipAutoRenew(m.id, true), t("renewsByItself")) },
    );
  }
  menu.push({ key: "print", label: t("printCard"), icon: <Printer size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => window.print() });
  menu.push({ key: "customer", label: t("openCustomer"), icon: <UserRound size={14} strokeWidth={1.5} aria-hidden />, onSelect: () => router.push(`/customers/${m.customerId}`) });
  if (state !== "cancelled") {
    menu.push({ key: "cancel", label: t("cancelMembership"), icon: <Ban size={14} strokeWidth={1.5} aria-hidden />, destructive: true, separated: true, onSelect: () => setCancelOpen(true) });
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.code);
      toast.success(t("copied"));
    } catch {
      toast.error(m.code);
    }
  };

  const status =
    live && m.expiringSoon ? (
      <StatusPill tone="warning">{t("endsIn", { count: Math.max(0, m.daysToExpiry) })}</StatusPill>
    ) : (
      <StatusPill tone={STATUS_TONE[state]}>{tm(`status_${state}` as "status_active")}</StatusPill>
    );

  const label = t("more", { name: m.customerName });

  return (
    <PageShell
      title={m.customerName}
      back={back}
      status={status}
      primary={canRenew ? { label: tm("renew"), icon: <RefreshCw size={16} strokeWidth={1.5} aria-hidden />, onClick: renew, disabled: busy } : undefined}
      actions={
        wide ? (
          <div className="flex items-center gap-inline">
            {canRenew && (
              <Button icon={<RefreshCw size={16} strokeWidth={1.5} aria-hidden />} onClick={renew} loading={busy}>
                {tm("renew")}
              </Button>
            )}
            <ActionMenu label={label} items={menu} />
          </div>
        ) : (
          <div role="group" aria-label={label} className="flex min-w-48 flex-col items-stretch gap-inline">
            {menu.map((it) => (
              <div key={it.key} className="flex flex-col">
                {it.separated && <span aria-hidden className="my-inline border-t border-hairline" />}
                <Button variant={it.destructive ? "destructive" : "tertiary"} onClick={it.onSelect} disabled={it.disabled} icon={it.icon} className="justify-start">
                  {it.label}
                </Button>
              </div>
            ))}
          </div>
        )
      }
    >
      <div className="grid items-start gap-major lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-section">
          {/* The card and what is left on it read as one thing: side by side
              where there is room, so the card never sits beside empty space. */}
          <div className="grid items-start gap-section xl:grid-cols-2">
            <MembershipCard membership={m} venue={venue} />
            <UsageCard membership={m} tier={tier} />
          </div>
          {tier.maxMembers > 1 && (
            <PeopleCard
              key={m.updatedAt}
              members={m.members}
              max={tier.maxMembers}
              saving={busy}
              onSave={(next: MembershipMember[]) => run(() => setMembershipMembers(m.id, next), t("peopleSaved"))}
            />
          )}
          <BenefitsCard tier={tier} />
        </div>
        <div className="flex min-w-0 flex-col gap-section">
          <DetailsCard
            membership={m}
            tier={tier}
            onCopy={copy}
            onAutoRenew={(next) => run(() => setMembershipAutoRenew(m.id, next), next ? t("renewsByItself") : t("stoppedRenewing"))}
          />
          <HistoryCard membership={m} />
        </div>
      </div>

      {cancelOpen && (
        <CancelDialog
          membership={m}
          busy={busy}
          onClose={() => setCancelOpen(false)}
          onPause={pause}
          onStopRenewing={() => run(() => setMembershipAutoRenew(m.id, false), t("stoppedRenewing"), () => setCancelOpen(false))}
          onCancelNow={(reason) => run(() => cancelMembership(m.id, reason), tm("cancelled"), () => setCancelOpen(false))}
        />
      )}
    </PageShell>
  );
}
