"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getResourceMatrix, getSlots, listProducts, type Product } from "@/lib/api";
import { isResourceType, isSlotBased } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";

interface Row {
  time: string;
  label: string;
  state: string; // "OPEN" | "BOOKED" | "FULL" | "12/40"
  full: boolean;
  product: Product;
}

export default function SchedulePage() {
  const router = useRouter();
  const [date, setDate] = useState(TODAY);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of productsQ.data?.data ?? []) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, date)) {
          for (const s of r.slots) {
            out.push({ time: s.time, label: `${p.name} — ${r.resource.name}`, state: s.available ? formatMoney(resolveProductPrice(p, date, s.time, p.tiers[0]?.price ?? 0)) : "BOOKED", full: !s.available, product: p });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, date)) {
          out.push({ time: s.time, label: p.name, state: s.remaining <= 0 ? "FULL" : `${s.sold}/${s.capacity}`, full: s.remaining <= 0, product: p });
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [productsQ.data, date]);

  const sell = (p: Product) => {
    sessionStorage.setItem("pos_open_product", p.id);
    router.push("/pos");
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-10 rounded-sm border px-comfortable text-sm ${date === v ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div>
        <p className="type-label text-[13px] text-ember">Front of house</p>
        <h1 className="type-h1 mt-tight text-2xl">Schedule</h1>
      </div>
      <div className="flex gap-tight">
        {dateBtn(TODAY, "Today")}
        {dateBtn(TOMORROW, "Tomorrow")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-sm border border-neutral-200 bg-white px-comfortable text-sm" />
      </div>

      {productsQ.loading ? (
        <p className="text-[13px] text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No sessions" message="This day has no timed or resourced sessions." />
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-section border-b border-neutral-200 px-section py-tight last:border-0">
              <span className="w-14 font-mono text-sm">{r.time}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
              <span className={`font-mono text-[12px] ${r.full ? "text-neutral-400" : "text-neutral-600"}`}>{r.state}</span>
              {r.full ? (
                r.product.waitlistEnabled ? <Button size="sm" variant="secondary" onClick={() => sell(r.product)}>Waitlist</Button> : <span className="w-16 text-right font-mono text-[11px] text-neutral-400">—</span>
              ) : (
                <Button size="sm" onClick={() => sell(r.product)}>Sell</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
