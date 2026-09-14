"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCategories, listLocations, listPaymentAccounts, listProducts } from "@/lib/api";
import { SectionSkeleton } from "../../_components/SettingsKit";
import { CounterEditor } from "../_components/CounterEditor";

export default function NewCounterPage() {
  const t = useTranslations("settings");
  const locations = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const products = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const categories = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const accounts = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const loading = locations.loading || products.loading || categories.loading || accounts.loading;

  return (
    <PageShell title={t("counters.newTitle")} description={t("counters.createDesc")}>
      {loading ? (
        <SectionSkeleton />
      ) : (
        <CounterEditor
          mode="create"
          locations={locations.data?.data ?? []}
          products={products.data?.data ?? []}
          categories={categories.data?.data ?? []}
          liveAccount={(accounts.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled)}
        />
      )}
    </PageShell>
  );
}
