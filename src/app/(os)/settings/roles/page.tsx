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
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listRoles, type Role } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function RolesPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const { data, loading } = useApiQuery(
    () => listRoles({ page, pageSize: 10, search, sort: sort.key, order: sort.order }),
    [search, sort.key, sort.order, page],
  );

  const columns: Column<Role>[] = [
    { key: "name", header: t("common.name"), sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "permissions", header: t("roles.colPermissions"), align: "center", render: (r) => <span className="font-mono text-[13px]">{r.permissions.length}</span> },
    { key: "refund", header: t("roles.colRefundLimit"), align: "right", render: (r) => <span className="font-mono text-[13px]">{r.refundLimit == null ? t("common.unlimited") : formatMoney(r.refundLimit)}</span> },
    { key: "discount", header: t("roles.colDiscountLimit"), align: "right", render: (r) => <span className="font-mono text-[13px]">{r.discountLimitPct == null ? t("common.unlimited") : `${r.discountLimitPct}%`}</span> },
  ];

  return (
    <PageShell
      title={t("roles.title")}
      description={t("roles.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/roles/new")}>{t("roles.newRole")}</Button>}
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
            <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("roles.searchPlaceholder")}
              className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
            />
          </div>
        }
        emptyState={<EmptyState title={t("roles.emptyTitle")} message={t("roles.emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
