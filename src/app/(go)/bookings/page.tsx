"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookings, listProducts } from "@/lib/api";
import { formatDate } from "@/lib/format";

const TODAY = Date.parse("2026-07-29T00:00:00+06:00");
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export default function GoBookingsPage() {
  const [search, setSearch] = useState("");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";

  const arrivals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (bookingsQ.data?.data ?? [])
      .filter((b) => b.status === "confirmed" && Date.parse(b.slotStart) >= TODAY)
      .filter((b) => !q || productName(b.productId).toLowerCase().includes(q))
      .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingsQ.data, productsQ.data, search]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div>
        <p className="type-label text-[13px] text-ember">Gate</p>
        <h1 className="type-h1 mt-tight text-2xl">Arrivals</h1>
      </div>
      <div className="relative">
        <Search size={18} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product…"
          className="h-12 w-full rounded-sm border border-neutral-200 bg-white pl-10 pr-section text-sm outline-none focus:border-ink"
        />
      </div>

      {bookingsQ.loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-neutral-200" /><div className="h-4 w-2/3 rounded-xs bg-neutral-200" /><div className="h-4 w-1/2 rounded-xs bg-neutral-200" /></div>
      ) : arrivals.length === 0 ? (
        <EmptyState title="No upcoming arrivals" />
      ) : (
        <div className="flex flex-col gap-tight">
          {arrivals.slice(0, 40).map((b) => (
            <div key={b.id} className="flex items-center gap-section rounded-sm border border-neutral-200 bg-white p-comfortable">
              <div className="text-center">
                <div className="font-mono text-lg">{time(b.slotStart)}</div>
                <div className="font-mono text-[10px] text-neutral-400">{formatDate(b.slotStart)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{productName(b.productId)}</div>
                <div className="font-mono text-[11px] text-neutral-400">Party of {b.partySize}</div>
              </div>
              <StatusPill status="confirmed" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
