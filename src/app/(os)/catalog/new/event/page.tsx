"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { CATEGORIES, type CategoryId } from "@/lib/events/catalog";
import { EventWizard } from "../../_components/event/EventWizard";

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEvent />
    </Suspense>
  );
}

function NewEvent() {
  const t = useTranslations("events");
  const param = useSearchParams().get("category");
  const initial = CATEGORIES.some((c) => c.id === param) ? (param as CategoryId) : null;
  return (
    <PageShell title={t("newTitle")} description={t("newDescription")}>
      <EventWizard initialCategory={initial} />
    </PageShell>
  );
}
