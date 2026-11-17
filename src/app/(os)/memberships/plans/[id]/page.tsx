"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, Notice, PageShell, Skeleton, useToast } from "@/components/ui";
import { StatusScreen } from "@/components/screens";
import { useApiQuery } from "@/lib/useApi";
import { archiveMembershipTier, getMembershipTier, membershipCountsByTier, membershipSummary, updateMembershipTier, type MembershipTier } from "@/lib/api";
import { PlanForm } from "../../_components/plans/PlanForm";

/** One plan: say how many members it touches, then the editor. */
export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("membershipPlans");
  const tm = useTranslations("memberships");
  const router = useRouter();
  const toast = useToast();
  const [stopping, setStopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<MembershipTier | null>(null);

  const planQ = useApiQuery(() => getMembershipTier(id), [id]);
  const summaryQ = useApiQuery(() => membershipSummary(), []);
  const countsQ = useApiQuery(() => membershipCountsByTier(), []);

  const plan = fresh ?? planQ.data;
  const back = { href: "/memberships/plans", label: t("editor.backToPlans") };

  if (!plan) {
    return (
      <PageShell title={t("list.title")} back={back}>
        {planQ.loading ? (
          <div aria-busy="true">
            <Skeleton h={160} />
          </div>
        ) : (
          <StatusScreen variant="notFound" framed homeHref="/memberships/plans" homeLabel={t("editor.backToPlans")} title={t("editor.notFound")} />
        )}
      </PageShell>
    );
  }

  const selling = plan.status !== "archived";
  const members = summaryQ.data?.byPlan.find((p) => p.tierId === plan.id)?.active ?? 0;
  const total = countsQ.data?.[plan.id] ?? 0;

  const stop = async () => {
    setBusy(true);
    const res = await archiveMembershipTier(plan.id);
    setBusy(false);
    setStopping(false);
    if (!res.ok) {
      toast.error(res.error.message || t("editor.actionFailed"));
      return;
    }
    toast.success(t("editor.stopped", { name: plan.name }));
    router.push("/memberships/plans");
  };

  const sellAgain = async () => {
    setBusy(true);
    const res = await updateMembershipTier(plan.id, { status: "active" });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message || t("editor.actionFailed"));
      return;
    }
    toast.success(t("editor.sellingAgain", { name: plan.name }));
    setFresh(res.data);
  };

  return (
    <PageShell
      title={plan.name}
      back={back}
      actions={
        selling ? (
          <Button variant="secondary" onClick={() => setStopping(true)}>
            {t("editor.stopSelling")}
          </Button>
        ) : (
          <Button variant="secondary" onClick={sellAgain} loading={busy}>
            {t("editor.sellAgain")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-section">
        {!selling && (
          <Notice tone="neutral" icon={null}>
            {t("editor.notSellingNotice")}
          </Notice>
        )}
        {members > 0 && <p className="text-sm text-muted">{t("editor.membersOnPlan", { count: members })}</p>}
        <PlanForm plan={plan} members={selling ? members : total} onSaved={setFresh} />
      </div>

      <ConfirmDialog
        open={stopping}
        onClose={() => setStopping(false)}
        onConfirm={stop}
        loading={busy}
        destructive
        title={t("editor.stopTitle", { name: plan.name })}
        message={tm("archiveMessage", { count: total })}
        confirmLabel={t("editor.stopSelling")}
      />
    </PageShell>
  );
}
