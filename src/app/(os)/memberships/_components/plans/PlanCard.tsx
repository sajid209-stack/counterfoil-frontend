"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Card, StatusPill } from "@/components/ui";
import type { MembershipTier } from "@/lib/api";
import { usePlanBenefits, usePlanPrice } from "../shared";

export type PlanCardData = Pick<
  MembershipTier,
  "name" | "description" | "price" | "billingPeriod" | "includedVisits" | "discountBps" | "discountScope" | "guestPassesPerPeriod" | "maxMembers" | "autoRenew" | "status"
>;

/**
 * A plan as a member would read it. The Plans page draws one per plan and the
 * editor's preview draws the same one from the form, so what you type is what
 * the list will show. With an `href` it is a link; without, it is a plain card.
 */
export function PlanCard({ plan, members, href, fallbackName }: { plan: PlanCardData; members: number; href?: string; fallbackName: string }) {
  const t = useTranslations("membershipPlans");
  const price = usePlanPrice();
  const benefits = usePlanBenefits();
  const lines = benefits(plan);

  const card = (
    <Card interactive={!!href} className="flex h-full flex-col gap-comfortable">
      <div className="flex flex-wrap items-center gap-x-tight gap-y-inline">
        <h3 className="min-w-0 break-words text-md font-semibold text-fg">{plan.name.trim() || fallbackName}</h3>
        {plan.status !== "active" && <StatusPill tone="neutral">{t("card.notSelling")}</StatusPill>}
      </div>
      <p className="text-lg font-semibold tabular-nums text-fg">{price(plan)}</p>
      <p className="line-clamp-2 break-words text-sm text-muted">{plan.description.trim() || t("card.noDescription")}</p>
      <ul className="flex flex-col gap-inline">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-tight text-sm text-fg">
            <Check size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-fg-secondary" />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-auto flex flex-wrap items-center justify-between gap-x-section gap-y-inline border-t border-hairline pt-comfortable text-sm text-muted">
        <span>{t("card.members", { count: members })}</span>
        <span>{plan.billingPeriod === "lifetime" ? t("card.paidOnce") : plan.autoRenew ? t("card.renews") : t("card.oneTime")}</span>
      </p>
    </Card>
  );

  if (!href) return card;
  return (
    <Link href={href} className="block h-full rounded-card">
      {card}
    </Link>
  );
}
