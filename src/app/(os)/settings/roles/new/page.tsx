"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { RoleEditor } from "../_components/RoleEditor";

export default function NewRolePage() {
  const t = useTranslations("settings");
  return (
    <PageShell title={t("roles.newTitle")} description={t("roles.createDesc")}>
      <RoleEditor mode="create" members={[]} isYourRole={false} />
    </PageShell>
  );
}
