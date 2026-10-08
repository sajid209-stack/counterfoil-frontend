"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations } from "@/lib/api";
import { ItemForm } from "../_components/ItemForm";

/**
 * Adding an item.
 *
 * No opening count here, deliberately. A number typed on a creation form is a
 * number with no reason behind it, and the ledger is the only record there is —
 * so the item is created and the first thing its own page offers is Receive
 * stock, which asks how many arrived and why. One rule, one place, no
 * exception for the first day.
 */
export default function NewInventoryItemPage() {
  const t = useTranslations("inventory");
  const router = useRouter();
  const toast = useToast();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 50 }), []);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);

  return (
    <PageShell title={t("newTitle")} description={t("newDescription")} back={{ href: "/inventory", label: t("backToList") }}>
      <ItemForm
        locations={locations}
        onSaved={(id) => {
          toast.success(t("toast.created"));
          router.push(`/inventory/${id}`);
        }}
      />
    </PageShell>
  );
}
