"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useEnumLabels } from "@/lib/labels";

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
  const t = useTranslations("orders");
  const enumL = useEnumLabels();
  // Deep-link from Customers: /orders?customer=Anika pre-filters the search.
  const [search, setSearch] = useState(params.get("customer") ?? "");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locationName = (id: string) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—";

  const channelLabel = (c: string) => (c === "counter" ? t("channelCounter") : c === "online" ? t("channelOnline") : c);

  const { data, loading } = useApiQuery(
    () => listOrders({ page, pageSize: 12, search, sort: sort.key, order: sort.order, filters: { status: status || undefined, channel: channel || undefined } }),
    [search, status, channel, sort.key, sort.order, page],
  );

  const columns: Column<Order>[] = [
    { key: "reference", header: t("colReference"), sortable: true, render: (o) => <span className="font-mono text-[13px]">{o.reference}</span> },
    { key: "createdAt", header: t("colDate"), sortable: true, render: (o) => <span className="text-muted">{formatDateTime(o.createdAt)}</span> },
    { key: "location", header: t("colLocation"), render: (o) => locationName(o.locationId) },
    { key: "channel", header: t("colChannel"), render: (o) => <span className="font-mono text-[12px] text-muted">{channelLabel(o.channel)}</span> },
    { key: "items", header: t("colItems"), align: "center", render: (o) => <span className="font-mono text-[13px]">{o.lines.reduce((s, l) => s + l.quantity, 0)}</span> },
    { key: "total", header: t("colTotal"), sortable: true, align: "right", render: (o) => <span className="font-mono text-[13px]">{formatMoney(o.total)}</span> },
    { key: "status", header: t("colStatus"), sortable: true, render: (o) => <StatusPill status={o.status} /> },
  ];

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";

  return (
    <PageShell title={t("title")} description={t("description")}>
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("searchPlaceholder")}
                className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <select aria-label={t("allStatuses")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">{t("allStatuses")}</option>
              <option value="paid">{enumL.status("paid")}</option>
              <option value="pending">{enumL.status("pending")}</option>
              <option value="partial">{enumL.status("partial")}</option>
              <option value="refunded">{enumL.status("refunded")}</option>
              <option value="cancelled">{enumL.status("cancelled")}</option>
            </select>
            <select aria-label={t("allChannels")} value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">{t("allChannels")}</option>
              <option value="counter">{t("channelCounter")}</option>
              <option value="online">{t("channelOnline")}</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
        pagination={{ page, pageSize: 12, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
