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
import { listCounters, listDevices, type Device } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function DevicesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const counterName = (id: string | null) => (id ? countersQ.data?.data.find((c) => c.id === id)?.name ?? "—" : "Unpaired");

  const { data, loading } = useApiQuery(
    () => listDevices({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { status } }),
    [search, status, sort.key, sort.order, page],
  );

  const columns: Column<Device>[] = [
    { key: "name", header: "Name", sortable: true, render: (d) => <span className="font-medium">{d.name}</span> },
    { key: "counter", header: "Counter", render: (d) => counterName(d.counterId) },
    { key: "code", header: "Pairing code", render: (d) => <span className="font-mono text-[12px] text-neutral-600">{d.pairingCode}</span> },
    { key: "status", header: "Status", sortable: true, render: (d) => <StatusPill status={d.status} /> },
    { key: "lastSeen", header: "Last seen", render: (d) => <span className="text-neutral-600">{formatDateTime(d.lastSeenAt)}</span> },
  ];

  return (
    <PageShell
      title="Devices"
      description="Tablets paired to a counter for selling and scanning."
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/devices/new")}>Register a device</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(d) => d.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search devices…" className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink" />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No devices yet" message="Register a tablet to start selling on it." action={<Button onClick={() => router.push("/settings/devices/new")}>Register a device</Button>} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
