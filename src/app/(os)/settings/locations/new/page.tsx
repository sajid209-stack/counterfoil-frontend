"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { LocationEditor } from "../_components/LocationEditor";

export default function NewLocationPage() {
  const t = useTranslations("settings");
  return (
    <PageShell title={t("locations.newTitle")} description={t("locations.createDesc")}>
      <LocationEditor mode="create" />
    </PageShell>
  );
}
