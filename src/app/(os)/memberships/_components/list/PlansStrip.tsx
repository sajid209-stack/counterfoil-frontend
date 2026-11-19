"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { ChoiceCard, Skeleton } from "@/components/ui";
import type { MembershipSummary, MembershipTier } from "@/lib/api";
import { Meter, usePlanPrice } from "../shared";

/**
 * One compact card per plan, under the figures. A card filters the list to that
 * plan (press again to clear); its bar is the plan's share of active members.
 * The last, quiet, dashed card makes a new plan. Scrolls sideways on a phone.
 */
export function PlansStrip({
  tiers,
  summary,
  selected,
  onSelect,
}: {
  tiers: MembershipTier[] | undefined;
  summary: MembershipSummary | undefined;
  selected: string;
  onSelect: (tierId: string) => void;
}) {
  const t = useTranslations("membershipsList.strip");
  const price = usePlanPrice();
  const total = summary?.active ?? 0;

  return (
    <section aria-labelledby="ms-plans" className="flex flex-col gap-comfortable">
      <div className="flex items-center justify-between gap-comfortable">
        <h2 id="ms-plans" className="text-md font-semibold text-fg">
          {t("heading")}
        </h2>
        <Link href="/memberships/plans" className="inline-flex min-h-11 min-w-11 items-center justify-end text-sm text-fg-secondary underline underline-offset-4 hover:text-fg hover:no-underline md:min-h-0 md:min-w-0">
          {t("seeAll")}
        </Link>
      </div>
      <div role="group" aria-label={t("label")} className="no-scrollbar -mx-gutter flex gap-tight overflow-x-auto px-gutter pb-inline md:mx-0 md:px-0">
        {!tiers || !summary ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-56 shrink-0 rounded-card" />)
        ) : (
          <>
            {tiers.map((tier) => {
              const active = summary.byPlan.find((p) => p.tierId === tier.id)?.active ?? 0;
              const pct = total > 0 ? Math.round((active / total) * 100) : 0;
              return (
                <ChoiceCard
                  key={tier.id}
                  selected={selected === tier.id}
                  onClick={() => onSelect(selected === tier.id ? "" : tier.id)}
                  className="flex w-56 shrink-0 flex-col gap-inline p-comfortable"
                >
                  <span className="truncate pr-section text-base font-semibold text-fg">{tier.name}</span>
                  <span className="truncate text-sm text-muted">{price(tier)}</span>
                  <span className="mt-tight text-sm text-fg-secondary">{t("members", { count: active })}</span>
                  <Meter value={active} max={total} label={t("share", { pct })} />
                </ChoiceCard>
              );
            })}
            <Link
              href="/memberships/plans/new"
              className="flex min-h-28 w-40 shrink-0 flex-col items-center justify-center gap-inline rounded-card border border-dashed border-line p-comfortable text-sm text-muted transition-colors duration-quick hover:border-strong hover:text-fg"
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              {t("newPlan")}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
