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
import { listRoles, listStaff, type Staff } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function StaffPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleId, setRoleId] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const roles = rolesQ.data?.data ?? [];
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";

  const { data, loading } = useApiQuery(
    () =>
      listStaff({
        page,
        pageSize: 10,
        search,
        sort: sort.key,
        order: sort.order,
        filters: { status: status || undefined, roleId: roleId || undefined },
      }),
    [search, status, roleId, sort.key, sort.order, page],
  );

  const columns: Column<Staff>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="font-mono text-[11px] text-neutral-400">{s.email ?? s.phone ?? "—"}</div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (s) => roleName(s.roleId) },
    { key: "locations", header: "Locations", align: "center", render: (s) => <span className="font-mono text-[13px]">{s.locationIds.length}</span> },
    { key: "status", header: "Status", sortable: true, render: (s) => <StatusPill status={s.status} /> },
    { key: "lastActiveAt", header: "Last active", sortable: true, render: (s) => <span className="text-neutral-600">{formatDateTime(s.lastActiveAt)}</span> },
  ];

  const selectCls = "h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink";

  return (
    <PageShell
      title="Staff"
      description="People who sell, scan, and manage — roles, locations, counters."
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/staff/new")}>Add staff</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(s) => s.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(s) => router.push(`/staff/${s.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search staff…"
                className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
              />
            </div>
            <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All roles</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No staff found" message="Adjust your search, or add a staff member." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
