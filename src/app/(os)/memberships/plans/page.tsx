"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { ButtonLink, EmptyState, Notice, PageShell, Skeleton } from "@/components/ui";
import { RecordList, RecordRow } from "../../settings/_components/SettingsKit";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listMembershipTiers, membershipCountsByTier, membershipSummary } from "@/lib/api";
import { PlanCard } from "../_components/plans/PlanCard";
import { usePlanPrice } from "../_components/shared";

/**
 * What the business sells as a membership. Plans on sale are cards; plans that
 * are not selling sit below, quiet, still openable so they can be sold again.
 */
export default function MembershipPlansPage() {
  const t = useTranslations("membershipPlans");
  const price = usePlanPrice();
  const [showOld, setShowOld] = useState(false);

  const plansQ = useApiQuery(() => listMembershipTiers({ pageSize: 100 }), []);
  const oldQ = useApiQuery(() => listMembershipTiers({ pageSize: 100, filters: { status: "archived" } }), []);
  const summaryQ = useApiQuery(() => membershipSummary(), []);
  const countsQ = useApiQuery(() => membershipCountsByTier(), []);

  const plans = plansQ.data?.data ?? [];
  const old = oldQ.data?.data ?? [];
  const activeOf = (id: string) => summaryQ.data?.byPlan.find((p) => p.tierId === id)?.active ?? 0;
  const totalOf = (id: string) => countsQ.data?.[id] ?? 0;

  return (
    <PageShell
      title={t("list.title")}
      description={t("list.description")}
      back={{ href: "/memberships", label: t("list.back") }}
      primary={{ label: t("list.newPlan"), href: "/memberships/plans/new" }}
    >
      <div className="flex flex-col gap-major pb-hero">
        {plansQ.loading && (
          <div aria-busy="true" className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={240} />
            ))}
          </div>
        )}

        {!plansQ.loading && plansQ.error && <Notice tone="danger" icon={null} title={t("list.loadFailed")} />}

        {!plansQ.loading && !plansQ.error && plans.length === 0 && old.length === 0 && (
          <EmptyState
            title={t("list.emptyTitle")}
            message={t("list.emptyMessage")}
            action={<ButtonLink variant="primary" href="/memberships/plans/new">{t("list.newPlan")}</ButtonLink>}
          />
        )}

        {plans.length > 0 && (
          <ul className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <li key={p.id} className="min-w-0">
                <PlanCard plan={p} members={activeOf(p.id)} href={`/memberships/plans/${p.id}`} fallbackName={p.name} />
              </li>
            ))}
          </ul>
        )}

        {old.length > 0 && (
          <section className="flex flex-col gap-comfortable">
            <button
              type="button"
              aria-expanded={showOld}
              onClick={() => setShowOld((v) => !v)}
              className="flex min-h-11 items-center gap-tight self-start rounded-control text-base font-medium text-muted transition-colors duration-quick hover:text-fg"
            >
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-quick", showOld && "rotate-180")} />
              {t("list.notSellingCount", { count: old.length })}
            </button>
            {showOld && (
              <RecordList label={t("list.notSelling")}>
                {old.map((p) => (
                  <RecordRow
                    key={p.id}
                    href={`/memberships/plans/${p.id}`}
                    title={p.name}
                    meta={price(p)}
                    aside={t("card.members", { count: totalOf(p.id) })}
                  />
                ))}
              </RecordList>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}
