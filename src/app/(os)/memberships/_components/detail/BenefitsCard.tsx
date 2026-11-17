"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import type { MembershipTier } from "@/lib/api";
import { usePlanBenefits } from "../shared";

/** What the plan gives, read from the plan itself, with a way to edit it. */
export function BenefitsCard({ tier }: { tier: MembershipTier }) {
  const t = useTranslations("membershipDetail.benefits");
  const benefits = usePlanBenefits()(tier);
  return (
    <Card
      title={t("title")}
      actions={
        <Link href={`/memberships/plans/${tier.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-fg underline underline-offset-4 hover:no-underline md:min-h-0">
          {t("editPlan")}
        </Link>
      }
    >
      <div className="flex flex-col gap-comfortable">
        {tier.description && <p className="text-sm text-muted">{tier.description}</p>}
        <ul className="flex flex-col gap-tight">
          {benefits.map((line) => (
            <li key={line} className="flex items-start gap-tight text-base text-fg">
              <Check size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-success" />
              <span className="min-w-0 break-words">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
