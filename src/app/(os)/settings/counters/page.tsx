"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  PageShell,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, type Counter } from "@/lib/api";

export default function CountersPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "—";

  const { data, loading } = useApiQuery(
    () =>
      listCounters({
        page,
        pageSize: 10,
        search,
        sort: sort.key,
        order: sort.order,
        filters: { status, locationId: locationId || undefined },
      }),
    [search, locationId, status, sort.key, sort.order, page],
  );

  const columns: Column<Counter>[] = [
    { key: "name", header: t("common.name"), sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "location", header: t("common.location"), render: (c) => locationName(c.locationId) },
    {
      key: "products",
      header: t("counters.colProducts"),
      render: (c) => (
        <span className="font-mono text-[12px] text-muted">
          {c.allowedProductIds === "all" ? t("counters.allProducts") : t("counters.selectedCount", { count: c.allowedProductIds.length })}
        </span>
      ),
    },
    {
      key: "payments",
      header: t("counters.colPayments"),
      render: (c) => <span className="font-mono text-[12px] text-muted">{c.allowedPaymentMethods.length}</span>,
    },
    { key: "status", header: t("common.status"), sortable: true, render: (c) => <StatusPill status={c.status} /> },
  ];

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";

  return (
    <PageShell
      title={t("counters.title")}
      description={t("counters.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/counters/new")}>{t("counters.newCounter")}</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(c) => c.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(c) => router.push(`/settings/counters/${c.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("counters.searchPlaceholder")}
                className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select aria-label={t("common.allLocations")} value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">{t("common.allLocations")}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select aria-label={t("common.allStatuses")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="all">{t("common.allStatuses")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
              <option value="archived">{t("common.archived")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("counters.emptyTitle")} message={t("counters.emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
