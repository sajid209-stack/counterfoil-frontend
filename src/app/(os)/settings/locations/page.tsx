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
import { listLocations, type Location } from "@/lib/api";
import { formatDate } from "@/lib/format";

const openDays = (l: Location) =>
  l.openingHours.filter((h) => h.intervals.length > 0).length;

export default function LocationsPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const { data, loading } = useApiQuery(
    () =>
      listLocations({
        page,
        pageSize: 10,
        search,
        sort: sort.key,
        order: sort.order,
        filters: { status },
      }),
    [search, status, sort.key, sort.order, page],
  );

  const columns: Column<Location>[] = [
    { key: "name", header: t("common.name"), sortable: true, render: (l) => <span className="font-medium">{l.name}</span> },
    { key: "city", header: t("common.city"), sortable: true },
    { key: "hours", header: t("locations.openDays"), align: "center", render: (l) => <span className="font-mono text-[13px]">{openDays(l)}/7</span> },
    { key: "status", header: t("common.status"), sortable: true, render: (l) => <StatusPill status={l.status} /> },
    { key: "updatedAt", header: t("common.updated"), render: (l) => <span className="text-muted">{formatDate(l.updatedAt)}</span> },
  ];

  return (
    <PageShell
      title={t("locations.title")}
      description={t("locations.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/locations/new")}>
          {t("locations.new")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(l) => l.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(l) => router.push(`/settings/locations/${l.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("locations.searchPlaceholder")}
                className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select aria-label={t("common.allStatuses")}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
            >
              <option value="all">{t("common.allStatuses")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
              <option value="archived">{t("common.archived")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("locations.emptyTitle")} message={t("locations.emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
