"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  PageShell,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listRoles, type Role } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function RolesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const { data, loading } = useApiQuery(
    () => listRoles({ page, pageSize: 10, search, sort: sort.key, order: sort.order }),
    [search, sort.key, sort.order, page],
  );

  const columns: Column<Role>[] = [
    { key: "name", header: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "permissions", header: "Permissions", align: "center", render: (r) => <span className="font-mono text-[13px]">{r.permissions.length}</span> },
    { key: "refund", header: "Refund limit", align: "right", render: (r) => <span className="font-mono text-[13px]">{r.refundLimit == null ? "Unlimited" : formatMoney(r.refundLimit)}</span> },
    { key: "discount", header: "Discount limit", align: "right", render: (r) => <span className="font-mono text-[13px]">{r.discountLimitPct == null ? "Unlimited" : `${r.discountLimitPct}%`}</span> },
  ];

  return (
    <PageShell
      title="Roles"
      description="Permission sets and refund/discount limits for staff."
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/roles/new")}>New role</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(r) => router.push(`/settings/roles/${r.id}`)}
        toolbar={
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search roles…"
              className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
            />
          </div>
        }
        emptyState={<EmptyState title="No roles found" message="Create a role to assign to staff." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
