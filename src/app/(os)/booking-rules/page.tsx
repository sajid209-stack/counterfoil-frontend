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
import { listBookingRules, listLocations, listProducts, type BookingRule } from "@/lib/api";

export default function BookingRulesPage() {
  const t = useTranslations("bookingRules");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const productName = (id: string | null) =>
    id ? (productsQ.data?.data.find((p) => p.id === id)?.name ?? "—") : t("allProducts");
  const locationName = (id: string | null) =>
    id ? (locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—") : t("allLocations");

  const { data, loading } = useApiQuery(
    () => listBookingRules({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { status } }),
    [search, status, sort.key, sort.order, page],
  );

  const columns: Column<BookingRule>[] = [
    { key: "name", header: t("colName"), sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "product", header: t("colProduct"), render: (r) => productName(r.productId) },
    { key: "location", header: t("colLocation"), render: (r) => locationName(r.locationId) },
    { key: "capacity", header: t("colCapacity"), sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px]">{r.capacity}</span> },
    { key: "slot", header: t("colSlot"), align: "right", render: (r) => <span className="font-mono text-[12px] text-muted">{t("slotMinutes", { minutes: r.slotMinutes })}</span> },
    { key: "days", header: t("colDays"), align: "center", render: (r) => <span className="font-mono text-[12px] text-muted">{t("daysOfSeven", { count: r.daysOfWeek.length })}</span> },
    { key: "status", header: t("colStatus"), render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageShell title={t("title")} description={t("description")} actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/booking-rules/new")}>{t("newRule")}</Button>}>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={loading}
        onRowClick={(r) => router.push(`/booking-rules/${r.id}`)}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">{t("allStatuses")}</option>
              <option value="active">{t("statusActive")}</option>
              <option value="inactive">{t("statusInactive")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
