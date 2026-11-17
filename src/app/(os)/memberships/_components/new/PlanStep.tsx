"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChoiceCard, Notice, Skeleton } from "@/components/ui";
import type { MembershipTier } from "@/lib/api";
import { usePlanBenefits, usePlanPrice } from "../shared";
import { StepCard } from "./StepCard";

/** Step 2: the plans on sale, as cards. */
export function PlanStep({
  tiers,
  loading,
  value,
  onChange,
}: {
  tiers: MembershipTier[];
  loading: boolean;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("membershipDetail.new.plan");
  const price = usePlanPrice();
  const benefits = usePlanBenefits();

  return (
    <StepCard n={2} title={t("title")} description={t("description")}>
      {loading ? (
        <div aria-busy="true" className="grid gap-tight sm:grid-cols-2">
          <Skeleton h={140} className="rounded-card" />
          <Skeleton h={140} className="rounded-card" />
        </div>
      ) : tiers.length === 0 ? (
        <Notice tone="info" action={{ label: t("create"), href: "/memberships/plans/new" }}>
          {t("none")}
        </Notice>
      ) : (
        <div role="group" aria-label={t("title")} className="grid gap-tight sm:grid-cols-2">
          {tiers.map((tier) => (
            <ChoiceCard key={tier.id} selected={value === tier.id} onClick={() => onChange(tier.id)} className="flex flex-col gap-comfortable p-comfortable pr-major">
              <span className="min-w-0">
                <span className="block break-words text-base font-semibold text-fg">{tier.name}</span>
                <span className="block text-sm text-muted">{price(tier)}</span>
              </span>
              <ul className="flex flex-col gap-inline">
                {benefits(tier).map((line) => (
                  <li key={line} className="flex items-start gap-tight text-sm text-fg">
                    <Check size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-success" />
                    <span className="min-w-0 break-words">{line}</span>
                  </li>
                ))}
              </ul>
            </ChoiceCard>
          ))}
        </div>
      )}
    </StepCard>
  );
}
