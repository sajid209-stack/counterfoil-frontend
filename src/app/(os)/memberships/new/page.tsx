"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { PageShell, Skeleton } from "@/components/ui";
import { NewMember } from "../_components/new/NewMember";

function Loading() {
  const t = useTranslations("membershipDetail.new");
  return (
    <PageShell title={t("title")}>
      <div aria-busy="true" className="mx-auto flex max-w-3xl flex-col gap-section">
        <Skeleton h={160} className="rounded-card" />
        <Skeleton h={200} className="rounded-card" />
      </div>
    </PageShell>
  );
}

export default function NewMemberPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewMember />
    </Suspense>
  );
}
