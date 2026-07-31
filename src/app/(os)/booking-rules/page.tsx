"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  DataTable,
  EmptyState,
  PageShell,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookingRules, listLocations, listProducts, type BookingRule } from "@/lib/api";

export default function BookingRulesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const productName = (id: string | null) =>
    id ? (productsQ.data?.data.find((p) => p.id === id)?.name ?? "—") : "All products";
  const locationName = (id: string | null) =>
    id ? (locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—") : "All locations";

  const { data, loading } = useApiQuery(
    () => listBookingRules({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { status } }),
    [search, status, sort.key, sort.order, page],
  );

  const columns: Column<BookingRule>[] = [
    { key: "name", header: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "product", header: "Product", render: (r) => productName(r.productId) },
    { key: "location", header: "Location", render: (r) => locationName(r.locationId) },
    { key: "capacity", header: "Capacity", sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px]">{r.capacity}</span> },
    { key: "slot", header: "Slot", align: "right", render: (r) => <span className="font-mono text-[12px] text-muted">{r.slotMinutes}m</span> },
    { key: "days", header: "Days", align: "center", render: (r) => <span className="font-mono text-[12px] text-muted">{r.daysOfWeek.length}/7</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageShell title="Booking rules" description="Capacity, slot length, weekly pattern, and blackout dates per product and location.">
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search rules…"
                className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No booking rules" message="Capacity and slot rules will appear here." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
