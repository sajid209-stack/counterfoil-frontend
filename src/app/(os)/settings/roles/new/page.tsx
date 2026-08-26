"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui";
import { RoleForm } from "../_components/RoleForm";

export default function NewRolePage() {
  const t = useTranslations("settings");
  return (
    <PageShell title={t("roles.newTitle")} description={t("roles.newDescription")}>
      <Link href="/settings/roles" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("roles.backToRoles")}
      </Link>
      <RoleForm mode="create" />
    </PageShell>
  );
}
