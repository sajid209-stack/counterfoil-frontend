"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { LocationForm } from "../_components/LocationForm";

export default function NewLocationPage() {
  const t = useTranslations("settings");
  return (
    <PageShell title={t("locations.newTitle")} description={t("locations.newDescription")}>
      <Link href="/settings/locations" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("locations.title")}
      </Link>
      <LocationForm mode="create" />
    </PageShell>
  );
}
