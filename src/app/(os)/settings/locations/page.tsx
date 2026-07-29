"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    { key: "name", header: "Name", sortable: true, render: (l) => <span className="font-medium">{l.name}</span> },
    { key: "city", header: "City", sortable: true },
    { key: "hours", header: "Open days", align: "center", render: (l) => <span className="font-mono text-[13px]">{openDays(l)}/7</span> },
    { key: "status", header: "Status", sortable: true, render: (l) => <StatusPill status={l.status} /> },
    { key: "updatedAt", header: "Updated", render: (l) => <span className="text-neutral-600">{formatDate(l.updatedAt)}</span> },
  ];

  return (
    <PageShell
      title="Locations"
      description="Sites where you sell and admit — hours, timezone, status."
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/locations/new")}>
          New location
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search locations…"
                className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
              />
            </div>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No locations found" message="Adjust your search, or add a location." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
