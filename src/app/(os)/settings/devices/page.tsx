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
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listDevices, type Device } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function DevicesPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const counterName = (id: string | null) => (id ? countersQ.data?.data.find((c) => c.id === id)?.name ?? "—" : t("devices.unpaired"));

  const { data, loading } = useApiQuery(
    () => listDevices({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { status } }),
    [search, status, sort.key, sort.order, page],
  );

  const columns: Column<Device>[] = [
    { key: "name", header: t("devices.colName"), sortable: true, render: (d) => <span className="font-medium">{d.name}</span> },
    { key: "counter", header: t("devices.colCounter"), render: (d) => counterName(d.counterId) },
    { key: "code", header: t("devices.colPairingCode"), render: (d) => <span className="font-mono text-[12px] text-muted">{d.pairingCode}</span> },
    { key: "status", header: t("devices.colStatus"), sortable: true, render: (d) => <StatusPill status={d.status} /> },
    { key: "lastSeen", header: t("devices.colLastSeen"), render: (d) => <span className="text-muted">{formatDateTime(d.lastSeenAt)}</span> },
  ];

  return (
    <PageShell
      title={t("devices.title")}
      description={t("devices.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/devices/new")}>{t("devices.register")}</Button>}
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("devices.searchPlaceholder")} className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse" />
            </div>
            <select aria-label={t("common.allStatuses")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">{t("common.allStatuses")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("devices.emptyTitle")} message={t("devices.emptyMessage")} action={<Button onClick={() => router.push("/settings/devices/new")}>{t("devices.register")}</Button>} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
