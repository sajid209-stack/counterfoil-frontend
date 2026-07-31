"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button, DataTable, PageShell, Tabs, useToast, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getSalesReport, listOrders, type SalesGroupBy, type SalesReportRow } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

const NOW = "2026-07-29";
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10);

const PRESETS: { value: string; label: string; range: () => [string, string] }[] = [
  { value: "today", label: "Today", range: () => [NOW, NOW] },
  { value: "yesterday", label: "Yesterday", range: () => [shift(NOW, -1), shift(NOW, -1)] },
  { value: "7d", label: "Last 7 days", range: () => [shift(NOW, -6), NOW] },
  { value: "30d", label: "Last 30 days", range: () => [shift(NOW, -29), NOW] },
  { value: "month", label: "This month", range: () => ["2026-07-01", NOW] },
];

const GROUPS: { value: SalesGroupBy; label: string }[] = [
  { value: "product", label: "Product" },
  { value: "category", label: "Category" },
  { value: "payment_method", label: "Payment" },
  { value: "counter", label: "Counter" },
  { value: "location", label: "Location" },
  { value: "staff", label: "Team member" },
  { value: "hour", label: "Hour of day" },
];

function delta(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "▲ new" : "—";
  const pct = ((cur - prev) / prev) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`;
}

export default function SalesReportPage() {
  const toast = useToast();
  const [preset, setPreset] = useState("30d");
  const [custom, setCustom] = useState<[string, string]>([shift(NOW, -29), NOW]);
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("product");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "net", order: "desc" });
  const [drill, setDrill] = useState<SalesReportRow | null>(null);

  const [from, to] = preset === "custom" ? custom : PRESETS.find((p) => p.value === preset)!.range();

  const report = useApiQuery(() => getSalesReport({ from, to, groupBy }), [from, to, groupBy]);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);

  const rows = useMemo(() => {
    const data = report.data?.rows ?? [];
    const dir = sort.order === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = (a as unknown as Record<string, number | string>)[sort.key];
      const bv = (b as unknown as Record<string, number | string>)[sort.key];
      return typeof av === "number" && typeof bv === "number" ? (av - bv) * dir : String(av).localeCompare(String(bv)) * dir;
    });
  }, [report.data, sort]);

  const s = report.data?.summary;

  const columns: Column<SalesReportRow>[] = [
    { key: "label", header: "Name", sortable: true, render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "ticketCount", header: "Tickets", sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px]">{r.ticketCount}</span> },
    { key: "gross", header: "Gross", sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px]">{formatMoney(r.gross)}</span> },
    { key: "refunds", header: "Refunds", sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px] text-danger">{r.refunds ? `−${formatMoney(r.refunds)}` : "—"}</span> },
    { key: "net", header: "Net", sortable: true, align: "right", render: (r) => <span className="font-mono text-[13px]">{formatMoney(r.net)}</span> },
    { key: "shareOfTotal", header: "% of total", align: "right", render: (r) => <span className="font-mono text-[12px] text-faint">{(r.shareOfTotal * 100).toFixed(0)}%</span> },
  ];

  // Drill-down transactions for the selected group row.
  const drillOrders = useMemo(() => {
    if (!drill) return [];
    const inWin = (ordersQ.data?.data ?? []).filter((o) => o.createdAt.slice(0, 10) >= from && o.createdAt.slice(0, 10) <= to);
    return inWin.filter((o) => {
      switch (groupBy) {
        case "product": return o.lines.some((l) => l.productId === drill.key);
        case "payment_method": return (o.payments[0]?.method ?? "cash") === drill.key;
        case "counter": return (o.counterId ?? "none") === drill.key;
        case "location": return o.locationId === drill.key;
        case "staff": return (o.staffId ?? "none") === drill.key;
        case "hour": return String(new Date(Date.parse(o.createdAt) + 6 * 3600000).getUTCHours()) === drill.key;
        default: return true; // category — approximate
      }
    }).slice(0, 50);
  }, [drill, ordersQ.data, from, to, groupBy]);

  const exportCsv = () => {
    const header = "Name,Tickets,Gross,Refunds,Net,Share";
    const lines = rows.map((r) => `"${r.label}",${r.ticketCount},${(r.gross / 100).toFixed(2)},${(r.refunds / 100).toFixed(2)},${(r.net / 100).toFixed(2)},${(r.shareOfTotal * 100).toFixed(1)}%`);
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sales-${groupBy}-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  };

  return (
    <PageShell
      title="Sales reports"
      description="Revenue, refunds and tickets over a date range, broken down any way you need."
      actions={<Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={exportCsv}>Export CSV</Button>}
    >
      <div className="mb-major flex flex-wrap items-center gap-tight">
        {PRESETS.map((p) => (
          <button key={p.value} type="button" onClick={() => setPreset(p.value)} className={`h-9 rounded-sm border px-comfortable text-sm ${preset === p.value ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{p.label}</button>
        ))}
        <button type="button" onClick={() => setPreset("custom")} className={`h-9 rounded-sm border px-comfortable text-sm ${preset === "custom" ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>Custom</button>
        {preset === "custom" && (
          <span className="flex items-center gap-inline">
            <input type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} className="h-9 rounded-sm border border-line px-comfortable text-sm" />
            <span className="text-faint">→</span>
            <input type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} className="h-9 rounded-sm border border-line px-comfortable text-sm" />
          </span>
        )}
      </div>

      <div className="mb-major grid grid-cols-2 gap-tight lg:grid-cols-4">
        <Card label="Gross" value={s ? formatMoney(s.gross) : "—"} delta={s ? delta(s.gross, s.prevGross) : ""} />
        <Card label="Refunds" value={s ? formatMoney(s.refunds) : "—"} />
        <Card label="Net" value={s ? formatMoney(s.net) : "—"} delta={s ? delta(s.net, s.prevNet) : ""} />
        <Card label="Tickets sold" value={s ? String(s.ticketCount) : "—"} delta={s ? delta(s.ticketCount, s.prevTicketCount) : ""} />
      </div>

      <Tabs items={GROUPS} value={groupBy} onChange={(v) => { setGroupBy(v as SalesGroupBy); setDrill(null); }} className="mb-section" />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => String(r.key)}
        loading={report.loading}
        sort={sort}
        onSortChange={(key) => setSort((st) => ({ key, order: st.key === key && st.order === "desc" ? "asc" : "desc" }))}
        onRowClick={(r) => setDrill(r)}
      />

      {drill && (
        <div className="mt-major">
          <div className="mb-tight flex items-center justify-between">
            <h2 className="type-h2 text-base">Transactions · {drill.label}</h2>
            <button type="button" onClick={() => setDrill(null)} className="text-[13px] text-faint hover:text-fg">Clear</button>
          </div>
          <div className="overflow-x-auto rounded-md border border-line bg-card">
            <table className="w-full text-sm">
              <tbody>
                {drillOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-comfortable py-tight font-mono text-[12px]">{o.reference}</td>
                    <td className="px-comfortable py-tight text-muted">{formatDateTime(o.createdAt)}</td>
                    <td className="px-comfortable py-tight text-right font-mono text-[13px]">{formatMoney(o.total)}</td>
                    <td className="px-comfortable py-tight text-right font-mono text-[11px] text-faint">{o.status}</td>
                  </tr>
                ))}
                {drillOrders.length === 0 && <tr><td className="px-comfortable py-major text-center text-[13px] text-faint">No transactions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Card({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="rounded-md border border-line bg-card p-section">
      <p className="type-label text-[12px] text-faint">{label}</p>
      <p className="mt-tight font-mono text-2xl">{value}</p>
      {delta && <p className="mt-inline font-mono text-[11px] text-faint">{delta} vs prev</p>}
    </div>
  );
}
