"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { PlanForm } from "../../_components/plans/PlanForm";

/** A new plan: the editor with nothing in it, and a bar that says Add plan. */
export default function NewPlanPage() {
  const t = useTranslations("membershipPlans");
  return (
    <PageShell title={t("editor.titleNew")} back={{ href: "/memberships/plans", label: t("editor.backToPlans") }}>
      <PlanForm members={0} />
    </PageShell>
  );
}
