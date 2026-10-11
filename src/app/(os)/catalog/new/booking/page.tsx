"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, listLocations, listProducts, listResources, listStaff } from "@/lib/api";
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
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);
  const loading = locs.loading || team.loading || resources.loading || productsQ.loading || op.loading;

  return (
    <PageShell title={t("pageTitle")} description={t("pageDescription")}>
      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-tight"><Skeleton h={16} w="33%" /><Skeleton h={16} w="66%" /><Skeleton h={16} w="50%" /></div>
      ) : (
        <ProductWizard
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
