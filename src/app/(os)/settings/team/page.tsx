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
  useToast,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listRoles, listStaff, type Staff } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function StaffPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const toast = useToast();
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
      header: t("common.name"),
      sortable: true,
      render: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="font-mono text-[12px] text-faint">{s.email ?? s.phone ?? "—"}</div>
        </div>
      ),
    },
    { key: "role", header: t("common.role"), render: (s) => roleName(s.roleId) },
    { key: "locations", header: t("team.colLocations"), align: "center", render: (s) => <span className="font-mono text-[13px]">{s.locationIds.length}</span> },
    { key: "status", header: t("common.status"), sortable: true, render: (s) => <StatusPill status={s.status} /> },
    { key: "lastActiveAt", header: t("team.colLastActive"), sortable: true, render: (s) => <span className="text-muted">{formatDateTime(s.lastActiveAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(t("team.resetSent", { who: s.email ?? s.name }));
          }}
        >
          {t("team.resetPassword")}
        </Button>
      ),
    },
  ];

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";

  return (
    <PageShell
      title={t("team.title")}
      description={t("team.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/team/new")}>{t("team.addStaff")}</Button>}
    >
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(s) => s.id}
        loading={loading}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        onRowClick={(s) => router.push(`/settings/team/${s.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("team.searchPlaceholder")}
                className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select aria-label={t("team.allRoles")} value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">{t("team.allRoles")}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select aria-label={t("common.allStatuses")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">{t("common.allStatuses")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="invited">{t("common.invited")}</option>
              <option value="suspended">{t("common.suspended")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("team.emptyTitle")} message={t("team.emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
