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
import { listCounters, listLocations, type Counter } from "@/lib/api";

export default function CountersPage() {
  const router = useRouter();
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
    { key: "name", header: "Name", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "location", header: "Location", render: (c) => locationName(c.locationId) },
    {
      key: "products",
      header: "Products",
      render: (c) => (
        <span className="font-mono text-[12px] text-neutral-600">
          {c.allowedProductIds === "all" ? "All" : `${c.allowedProductIds.length} selected`}
        </span>
      ),
    },
    {
      key: "payments",
      header: "Payments",
      render: (c) => <span className="font-mono text-[11px] text-neutral-600">{c.allowedPaymentMethods.length}</span>,
    },
    { key: "status", header: "Status", sortable: true, render: (c) => <StatusPill status={c.status} /> },
  ];

  const selectCls = "h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink";

  return (
    <PageShell
      title="Counters"
      description="Points of sale at each location — allowed products and payment methods."
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/counters/new")}>New counter</Button>}
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search counters…"
                className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
              />
            </div>
            <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No counters found" message="Adjust your search, or add a counter." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
