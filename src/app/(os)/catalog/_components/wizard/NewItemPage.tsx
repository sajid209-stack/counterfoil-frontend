"use client";

import { useTranslations } from "next-intl";
import { PageShell, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listLocations, listProducts, listResources, listStaff } from "@/lib/api";
import { AddWizard } from "./AddWizard";

/**
 * `/catalog/new`: the add wizard on a page of its own — it opens directly, with
 * no chooser in front of it (docs/catalog.md §10.3). "Add booking" is the way in,
 * and copying something you already sell is the row menu's Duplicate.
 *
 * Loads what the wizard needs before it opens (the venues to sell at, the
 * people and places a booking can use, the items a combo can hold) so the first
 * thing on screen is the first question, not a form that reflows.
 */
export function NewItemPage() {
  const t = useTranslations("catalog.addFlow");
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);
  const loading = locs.loading || team.loading || resources.loading || productsQ.loading || op.loading;

  return (
    <PageShell title={t("pageTitle")} description={t("pageDescription")} back={{ href: "/catalog", label: t("backLabel") }}>
      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-tight"><Skeleton h={16} w="33%" /><Skeleton h={16} w="66%" /><Skeleton h={16} w="50%" /></div>
      ) : (
        <AddWizard
          locations={locs.data?.data ?? []}
          team={team.data?.data ?? []}
          resources={resources.data?.data ?? []}
          products={productsQ.data?.data ?? []}
          currency={op.data?.currency ?? "BDT"}
        />
      )}
    </PageShell>
  );
}
