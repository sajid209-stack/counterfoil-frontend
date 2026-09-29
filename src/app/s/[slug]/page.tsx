"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiQuery } from "@/lib/useApi";
import { getStorefrontPage, listResources, listStaff } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import { StorefrontMissing } from "../_components/Chrome";
import { StorefrontView } from "../_components/StorefrontView";

/**
 * A venue's public page.
 *
 * What it is for, stated plainly because it decides everything below: it
 * **publishes**, it does not sell. Online checkout is deferred in this project,
 * so a page that put a basket on screen would be promising a flow that does not
 * exist. It answers the three questions somebody has before they set out —
 * what is on, what it costs, and when you are open — and says where it is
 * bought. The contract is shaped so a basket can be added later without moving
 * any of this.
 */
export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const t = useTranslations("storefront");
  const now = useMemo(() => demoNow(), []);
  const q = useApiQuery(() => getStorefrontPage(params.slug), [params.slug]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);

  if (q.loading) {
    return (
      <div className="min-h-screen bg-surface px-gutter py-hero" aria-busy="true">
        <div className="mx-auto max-w-5xl animate-pulse space-y-section">
          <div className="h-8 w-2/3 rounded-sm bg-line" />
          <div className="h-4 w-1/2 rounded-sm bg-line" />
          <div className="h-44 rounded-md bg-line/60" />
        </div>
      </div>
    );
  }
  if (!q.data) return <StorefrontMissing title={t("missingTitle")} message={t("missingBody")} />;

  return (
    <StorefrontView
      {...q.data}
      resources={resourcesQ.data?.data ?? []}
      team={staffQ.data?.data ?? []}
      now={now}
    />
  );
}
