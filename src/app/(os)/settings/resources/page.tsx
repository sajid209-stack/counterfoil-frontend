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
import { listLocations, listResources, ownerBusyDetailed, type Resource } from "@/lib/api";
import { toTime } from "@/lib/schedule";

const TODAY = "2026-07-29";
const NOW_MIN = 12 * 60;

export default function ResourcesPage() {
  const router = useRouter();
  const t = useTranslations("settings");

  // The same live derivation the POS lane cards use.
  const liveState = (r: Resource): { text: string; busy: boolean } => {
    if (r.outOfService) return { text: t("resources.outOfService"), busy: true };
    const spans = ownerBusyDetailed(r.id, TODAY);
    const current = spans.find((s) => s.start <= NOW_MIN && NOW_MIN < s.end);
    if (current) return { text: t("resources.inUseUntil", { time: toTime(current.end), label: current.label }), busy: true };
    const next = spans.find((s) => s.start > NOW_MIN);
    return { text: next ? t("resources.freeNext", { time: toTime(next.start) }) : t("resources.free"), busy: false };
  };

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

  const noun = data?.data[0]?.nounPlural ?? t("resources.fallbackNoun");

  const columns: Column<Resource>[] = [
    { key: "name", header: t("common.name"), sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "type", header: t("resources.colType"), render: (r) => r.nounSingular },
    { key: "location", header: t("common.location"), render: (r) => locationName(r.locationId) },
    {
      key: "now",
      header: t("resources.colRightNow"),
      render: (r) => {
        const s = liveState(r);
        return <span className={`font-mono text-[12px] ${s.busy ? "text-muted" : "text-success"}`}>{s.text}</span>;
      },
    },
    {
      key: "status",
      header: t("common.status"),
      sortable: true,
      render: (r) => (r.outOfService ? <StatusPill tone="danger">{t("resources.outOfService")}</StatusPill> : <StatusPill status={r.status} />),
    },
  ];

  return (
    <PageShell
      title={noun}
      description={t("resources.descriptionList")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/resources/new")}>{t("resources.addResource", { noun: data?.data[0]?.nounSingular ?? t("resources.fallbackNounSingular") })}</Button>}
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("resources.searchPlaceholder")} className="h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse" />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse">
              <option value="all">{t("common.allStatuses")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="inactive">{t("common.inactive")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("resources.emptyTitle")} message={t("resources.emptyMessage")} action={<Button onClick={() => router.push("/settings/resources/new")}>{t("resources.emptyAction")}</Button>} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
