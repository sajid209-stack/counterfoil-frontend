"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getRole } from "@/lib/api";
import { RoleForm } from "../_components/RoleForm";

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const { data, loading, error } = useApiQuery(() => getRole(params.id), [params.id]);

  if (!loading && (error || !data)) {
    return (
      <PageShell title={t("roles.fallbackTitle")}>
        <EmptyState title={t("roles.notFoundTitle")} action={<Button onClick={() => router.push("/settings/roles")}>{t("roles.backButton")}</Button>} />
      </PageShell>
    );
  }

  return (
    <PageShell title={data?.name ?? t("roles.fallbackTitle")}>
      <Link href="/settings/roles" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("roles.backToRoles")}
      </Link>
      {loading || !data ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <RoleForm mode="edit" role={data} />
      )}
    </PageShell>
  );
}
