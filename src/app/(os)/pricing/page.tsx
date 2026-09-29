"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  DataTable,
  EmptyState,
  Select,
  PageShell,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listPriceRules, listProducts, type PriceRule } from "@/lib/api";

export default function PricingPage() {
  const t = useTranslations("pricing");
  const router = useRouter();
  const kindLabel: Record<PriceRule["kind"], string> = {
    standard: t("kindStandard"),
    peak: t("kindPeak"),
    off_peak: t("kindOffPeak"),
  };
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "name", order: "asc" });
  const [page, setPage] = useState(1);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const scope = (r: PriceRule) => {
    const p = r.productId ? productsQ.data?.data.find((x) => x.id === r.productId)?.name : t("allProducts");
    const l = r.locationId ? locationsQ.data?.data.find((x) => x.id === r.locationId)?.name : t("allLocations");
    return `${p ?? "—"} · ${l ?? "—"}`;
  };

  const { data, loading } = useApiQuery(
    () => listPriceRules({ page, pageSize: 10, search, sort: sort.key, order: sort.order, filters: { kind: kind || undefined } }),
    [search, kind, sort.key, sort.order, page],
  );

  const columns: Column<PriceRule>[] = [
    { key: "name", header: t("colName"), sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "scope", header: t("colAppliesTo"), render: (r) => <span className="text-[13px] text-muted">{scope(r)}</span> },
    { key: "channel", header: t("colChannel"), render: (r) => <span className="font-mono text-[12px] text-muted">{r.channel}</span> },
    { key: "kind", header: t("colKind"), render: (r) => kindLabel[r.kind] },
    {
      key: "adjustmentPct",
      header: t("colAdjustment"),
      sortable: true,
      align: "right",
      render: (r) => (
        <span className={`font-mono text-[13px] ${r.adjustmentPct > 0 ? "text-danger" : r.adjustmentPct < 0 ? "text-success" : "text-muted"}`}>
          {r.adjustmentPct > 0 ? "+" : ""}{r.adjustmentPct}%
        </span>
      ),
    },
    { key: "status", header: t("colStatus"), render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageShell title={t("title")} description={t("description")} primary={{ label: t("newRule"), onClick: () => router.push("/pricing/new") }}>
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={loading}
        onRowClick={(r) => router.push(`/pricing/${r.id}`)}
        sort={sort}
        onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("searchPlaceholder")}
                className="h-11 md:h-9 w-64 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <Select
              aria-label={t("allKinds")}
              value={kind}
              onChange={(v) => { setKind(v); setPage(1); }}
              triggerClassName="text-sm md:h-9"
              options={[
                { value: "", label: t("allKinds") },
                { value: "standard", label: t("kindStandard") },
                { value: "peak", label: t("kindPeak") },
                { value: "off_peak", label: t("kindOffPeak") },
              ]}
            />
          </div>
        }
        emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
        pagination={{ page, pageSize: 10, total: data?.page.total ?? 0, onPageChange: setPage }}
      />
    </PageShell>
  );
}
