"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/screens";
import { PageShell, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getProduct, listLocations, listProducts, listResources, listStaff, type Product } from "@/lib/api";
import { BookingRecord } from "../_components/record/BookingRecord";
import { EventRecord } from "../_components/record/EventRecord";

/**
 * One record page for every item in the catalog (docs/catalog.md §9.4).
 *
 * A booking and an event are both `/catalog/<id>`: the same header (state, kind,
 * one primary action), the same tabs, the same save bar. What differs is only
 * what a tab edits — a booking's schedule and prices, an event's days and
 * tickets — and that is decided here, once, by the record's type.
 */
export default function CatalogItemPage() {
  return (
    <Suspense>
      <Item />
    </Suspense>
  );
}

function Item() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("catalog");
  const ti = useTranslations("catalog.item");

  const prod = useApiQuery(() => getProduct(params.id), [params.id]);
  const locs = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const team = useApiQuery(() => listStaff({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const op = useApiQuery(() => getOperator(), []);

  /* What was last saved or switched on this page, so the header follows a
     change without a reload. */
  const [saved, setSaved] = useState<Product | null>(null);

  const loading = prod.loading || locs.loading || team.loading || resourcesQ.loading || productsQ.loading || op.loading;
  const product = saved && saved.id === params.id ? saved : prod.data;

  if (!loading && (prod.error || !product)) {
    return (
      <PageShell title={t("title")}>
        <StatusScreen variant="notFound" framed homeHref="/catalog" homeLabel={t("backButton")} title={ti("notFound")} body={ti("notFoundBody")} />
      </PageShell>
    );
  }

  if (loading || !product) {
    return (
      <PageShell title={t("title")}>
        <div aria-busy="true" className="flex flex-col gap-section">
          <Skeleton h={40} className="w-full max-w-md" />
          <Skeleton h={256} className="w-full rounded-card" />
        </div>
      </PageShell>
    );
  }

  const env = {
    locations: locs.data?.data ?? [],
    team: team.data?.data ?? [],
    resources: resourcesQ.data?.data ?? [],
    products: (productsQ.data?.data ?? []).filter((p) => p.id !== product.id && p.bookingType !== "BT-15"),
    currency: op.data?.currency ?? "BDT",
  };

  return product.bookingType === "BT-15" ? (
    <EventRecord key={product.id} product={product} env={env} onChanged={setSaved} />
  ) : (
    <BookingRecord key={product.id} product={product} env={env} onChanged={setSaved} />
  );
}
