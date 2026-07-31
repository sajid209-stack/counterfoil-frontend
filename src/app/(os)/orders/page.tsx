"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  DataTable,
  EmptyState,
  PageShell,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listOrders, type Order } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}

function OrdersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Deep-link from Customers: /orders?customer=Anika pre-filters the search.
  const [search, setSearch] = useState(params.get("customer") ?? "");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locationName = (id: string) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—";

  const { data, loading } = useApiQuery(
    () => listOrders({ page, pageSize: 12, search, sort: sort.key, order: sort.order, filters: { status: status || undefined, channel: channel || undefined } }),
    [search, status, channel, sort.key, sort.order, page],
  );

  const columns: Column<Order>[] = [
    { key: "reference", header: "Reference", sortable: true, render: (o) => <span className="font-mono text-[13px]">{o.reference}</span> },
    { key: "createdAt", header: "Date", sortable: true, render: (o) => <span className="text-neutral-600">{formatDateTime(o.createdAt)}</span> },
    { key: "location", header: "Location", render: (o) => locationName(o.locationId) },
    { key: "channel", header: "Channel", render: (o) => <span className="font-mono text-[11px] text-neutral-600">{o.channel}</span> },
    { key: "items", header: "Items", align: "center", render: (o) => <span className="font-mono text-[13px]">{o.lines.reduce((s, l) => s + l.quantity, 0)}</span> },
    { key: "total", header: "Total", sortable: true, align: "right", render: (o) => <span className="font-mono text-[13px]">{formatMoney(o.total)}</span> },
    { key: "status", header: "Status", sortable: true, render: (o) => <StatusPill status={o.status} /> },
  ];

  const selectCls = "h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink";

  return (
    <PageShell title="Orders" description="Every sale — counter and online, across all locations.">
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(o) => o.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by reference…"
                className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
              />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All channels</option>
              <option value="counter">Counter</option>
              <option value="online">Online</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No orders found" message="Adjust your search or filters." />}
        pagination={{ page, pageSize: 12, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
