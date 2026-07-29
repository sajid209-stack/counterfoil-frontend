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
import { listLocations, listPriceRules, listProducts, type PriceRule } from "@/lib/api";

const KIND_LABEL: Record<PriceRule["kind"], string> = {
  standard: "Standard",
  peak: "Peak",
  off_peak: "Off-peak",
};

export default function PricingPage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const scope = (r: PriceRule) => {
    const p = r.productId ? productsQ.data?.data.find((x) => x.id === r.productId)?.name : "All products";
    const l = r.locationId ? locationsQ.data?.data.find((x) => x.id === r.locationId)?.name : "All locations";
    return `${p ?? "—"} · ${l ?? "—"}`;
  };

  const { data, loading } = useApiQuery(
    () => listPriceRules({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { kind: kind || undefined } }),
    [search, kind, sort.key, sort.order, page],
  );

  const columns: Column<PriceRule>[] = [
    { key: "name", header: "Name", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "scope", header: "Applies to", render: (r) => <span className="text-[13px] text-neutral-600">{scope(r)}</span> },
    { key: "channel", header: "Channel", render: (r) => <span className="font-mono text-[12px] text-neutral-600">{r.channel}</span> },
    { key: "kind", header: "Kind", render: (r) => KIND_LABEL[r.kind] },
    {
      key: "adjustmentPct",
      header: "Adjustment",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className={`font-mono text-[13px] ${r.adjustmentPct > 0 ? "text-danger" : r.adjustmentPct < 0 ? "text-success" : "text-neutral-600"}`}>
          {r.adjustmentPct > 0 ? "+" : ""}{r.adjustmentPct}%
        </span>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageShell title="Pricing" description="Peak / off-peak adjustments per product, location, and channel.">
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
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search price rules…"
                className="h-9 w-64 rounded-sm border border-neutral-200 pl-8 pr-comfortable text-sm outline-none focus:border-ink"
              />
            </div>
            <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink">
              <option value="">All kinds</option>
              <option value="standard">Standard</option>
              <option value="peak">Peak</option>
              <option value="off_peak">Off-peak</option>
            </select>
          </div>
        }
        emptyState={<EmptyState title="No price rules" message="Peak and off-peak adjustments will appear here." />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
