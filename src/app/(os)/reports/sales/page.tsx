"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button, PageShell, useToast, type Column, DataTable } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listOrders, listProducts, type Order } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];
const NOW = Date.parse("2026-07-29T23:59:59+06:00");
const DAY = 86400000;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-section">
      <p className="type-label text-[12px] text-neutral-400">{label}</p>
      <p className="mt-tight font-mono text-2xl">{value}</p>
    </div>
  );
}

export default function SalesReportPage() {
  const toast = useToast();
  const [range, setRange] = useState("30");
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const inRange = useMemo(() => {
    const cutoff = NOW - parseInt(range, 10) * DAY;
    return (ordersQ.data?.data ?? []).filter((o) => Date.parse(o.createdAt) >= cutoff);
  }, [ordersQ.data, range]);

  const agg = useMemo(() => {
    const settled = inRange.filter((o) => o.status === "paid" || o.status === "partial");
    const revenue = settled.reduce((s, o) => s + o.payments.reduce((a, p) => a + p.amount, 0), 0);
    const refunds = inRange.filter((o) => o.status === "refunded");
    const refundTotal = refunds.reduce((s, o) => s + o.total, 0);
    const byChannel = { counter: 0, online: 0 };
    settled.forEach((o) => (byChannel[o.channel] += o.total));
    const byProduct = new Map<string, number>();
    settled.forEach((o) => o.lines.forEach((l) => byProduct.set(l.productName, (byProduct.get(l.productName) ?? 0) + l.unitPrice * l.quantity)));
    const topProducts = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { revenue, orders: settled.length, refunds: refunds.length, refundTotal, byChannel, topProducts, avg: settled.length ? Math.round(revenue / settled.length) : 0 };
  }, [inRange]);

  const productCols: Column<[string, number]>[] = [
    { key: "name", header: "Product", render: (r) => r[0] },
    { key: "rev", header: "Revenue", align: "right", render: (r) => <span className="font-mono text-[13px]">{formatMoney(r[1])}</span> },
  ];

  const loading = ordersQ.loading || productsQ.loading || locationsQ.loading;

  return (
    <PageShell
      title="Sales reports"
      description="Revenue, orders, refunds, and top products over a date range."
      actions={
        <div className="flex items-center gap-tight">
          <select value={range} onChange={(e) => setRange(e.target.value)} className="h-9 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm outline-none focus:border-ink">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={() => toast.success("Export queued (mock).")}>Export</Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : (
        <div className="flex flex-col gap-section">
          <div className="grid grid-cols-2 gap-tight lg:grid-cols-4">
            <Stat label="Revenue" value={formatMoney(agg.revenue)} />
            <Stat label="Orders" value={String(agg.orders)} />
            <Stat label="Avg order" value={formatMoney(agg.avg)} />
            <Stat label={`Refunds (${agg.refunds})`} value={formatMoney(agg.refundTotal)} />
          </div>

          <div className="grid gap-section lg:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-white p-major">
              <h2 className="type-label mb-section text-[12px] text-neutral-600">By channel</h2>
              <div className="flex items-center justify-between border-b border-neutral-200 py-tight text-sm"><span>Counter</span><span className="font-mono">{formatMoney(agg.byChannel.counter)}</span></div>
              <div className="flex items-center justify-between py-tight text-sm"><span>Online</span><span className="font-mono">{formatMoney(agg.byChannel.online)}</span></div>
            </div>
            <div>
              <h2 className="type-label mb-section text-[12px] text-neutral-600">Top products</h2>
              <DataTable columns={productCols} rows={agg.topProducts} getRowId={(r) => r[0]} />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
