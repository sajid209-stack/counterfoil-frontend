"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getCounter,
  listCategories,
  listDevices,
  listLocations,
  listPaymentAccounts,
  listProducts,
  type Counter,
} from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { CounterEditor } from "../_components/CounterEditor";

export default function CounterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const counterQ = useApiQuery(() => getCounter(params.id), [params.id]);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 200, filters: { counterId: params.id } }), [params.id]);
  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  // The counter as last written here, so a rename or a status change shows at once.
  const [latest, setLatest] = useState<Counter | null>(null);

  if (!counterQ.loading && (counterQ.error || !counterQ.data)) {
    return (
      <PageShell title={t("counters.fallbackTitle")}>
        <EmptyState
          title={t("counters.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/counters")}>{t("counters.backButton")}</Button>}
        />
      </PageShell>
    );
  }

  const counter = latest?.id === params.id ? latest : counterQ.data;
  const loading = locationsQ.loading || productsQ.loading || categoriesQ.loading || devicesQ.loading || accountsQ.loading;
  if (!counter || loading) {
    return (
      <PageShell title={t("counters.fallbackTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const locations = locationsQ.data?.data ?? [];
  const place = locations.find((l) => l.id === counter.locationId);

  return (
    <PageShell
      title={counter.name}
      description={place?.name}
      actions={counter.status !== "active" ? <StatusPill status={counter.status} /> : undefined}
    >
      <CounterEditor
        mode="edit"
        counter={counter}
        locations={locations}
        products={productsQ.data?.data ?? []}
        categories={categoriesQ.data?.data ?? []}
        devices={(devicesQ.data?.data ?? []).filter((d) => d.status !== "archived")}
        liveAccount={(accountsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled)}
        onSaved={setLatest}
      />
    </PageShell>
  );
}
