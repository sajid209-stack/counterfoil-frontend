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
import { listLocations, listResources, type Resource } from "@/lib/api";

export default function ResourcesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locationName = (id: string | null) => (id ? locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—" : "—");

  const { data, loading } = useApiQuery(
    () => listResources({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { status } }),
    [search, status, sort.key, sort.order, page],
  );

  const noun = data?.data[0]?.nounPlural ?? "Resources";

  const columns: Column<Resource>[] = [
    { key: "name", header: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "type", header: "Type", render: (r) => r.nounSingular },
    { key: "location", header: "Location", render: (r) => locationName(r.locationId) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => (r.outOfService ? <StatusPill tone="danger">Out of service</StatusPill> : <StatusPill status={r.status} />),
    },
  ];

  return (
    <PageShell
      title={noun}
      description="Spaces and equipment guests book — shared across products. Availability is computed per resource."
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/resources/new")}>Add {data?.data[0]?.nounSingular ?? "resource"}</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(r) => router.push(`/settings/resources/${r.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink" />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No resources yet" message="Add a field, court, lane or room that guests can book." action={<Button onClick={() => router.push("/settings/resources/new")}>Add resource</Button>} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
