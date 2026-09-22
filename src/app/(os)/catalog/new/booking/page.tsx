"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listCategories, listLocations, listProducts, listResources, listStaff } from "@/lib/api";
import { BOOKING_KINDS, type BookingKind } from "@/lib/catalog";
import { ProductWizard } from "../../_components/booking/ProductWizard";

export default function NewBookingPage() {
  return (
    <Suspense>
      <NewBooking />
    </Suspense>
  );
}

function NewBooking() {
  const t = useTranslations("catalog.wizard");
  const kindParam = useSearchParams().get("kind");
  const kind = (BOOKING_KINDS as string[]).includes(kindParam ?? "") ? (kindParam as BookingKind) : null;

  const cats = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);
  const loading = cats.loading || locs.loading || team.loading || resources.loading || productsQ.loading || op.loading;

  return (
    <PageShell title={t("pageTitle")} description={t("pageDescription")}>
      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : (
        <ProductWizard
          categories={cats.data?.data ?? []}
          locations={locs.data?.data ?? []}
          team={team.data?.data ?? []}
          resources={resources.data?.data ?? []}
          products={productsQ.data?.data ?? []}
          currency={op.data?.currency ?? "BDT"}
          kind={kind}
        />
      )}
    </PageShell>
  );
}
