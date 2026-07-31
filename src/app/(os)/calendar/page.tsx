"use client";

import { useMemo, useState } from "react";
import { EmptyState, PageShell, StatusPill, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookings, listLocations, listProducts, type Booking } from "@/lib/api";
import { formatDate } from "@/lib/format";

const NOW = new Date("2026-07-29T12:00:00+06:00");
const dayKey = (iso: string) => iso.slice(0, 10);
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export default function CalendarPage() {
  const [view, setView] = useState("month");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const locationName = (id: string) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—";

  const grouped = useMemo(() => {
    const all = (bookingsQ.data?.data ?? []).filter((b) => b.status === "confirmed");
    const now = NOW.getTime();
    const windowMs = view === "day" ? 1 : view === "week" ? 7 : 31;
    const from = now - (view === "month" ? 15 : 0) * 86400000;
    const to = now + windowMs * 86400000;
    const inWindow = all.filter((b) => {
      const t = Date.parse(b.slotStart);
      return t >= from && t <= to;
    });
    const map = new Map<string, Booking[]>();
    inWindow.forEach((b) => {
      const k = dayKey(b.slotStart);
      map.set(k, [...(map.get(k) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookingsQ.data, view]);

  const loading = bookingsQ.loading || productsQ.loading || locationsQ.loading;

  return (
    <PageShell title="Calendar" description="Confirmed bookings by slot — day, week, or month.">
      <Tabs
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={view}
        onChange={setView}
        className="mb-major"
      />

      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-neutral-200" /><div className="h-4 w-2/3 rounded-xs bg-neutral-200" /><div className="h-4 w-1/2 rounded-xs bg-neutral-200" /></div>
      ) : grouped.length === 0 ? (
        <EmptyState title="No bookings in this window" message="Try the month view for a wider range." />
      ) : (
        <div className="flex flex-col gap-section">
          {grouped.map(([date, items]) => (
            <div key={date} className="rounded-md border border-neutral-200 bg-white p-major">
              <div className="mb-tight flex items-center justify-between">
                <h2 className="type-h2 text-base">{formatDate(date)}</h2>
                <span className="font-mono text-[12px] text-neutral-400">{items.length} booking{items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="flex flex-col gap-inline">
                {items
                  .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
                  .map((b) => (
                    <div key={b.id} className="flex items-center gap-section border-t border-neutral-200 py-tight text-sm first:border-0">
                      <span className="w-14 font-mono text-[13px]">{time(b.slotStart)}</span>
                      <span className="flex-1">{productName(b.productId)}</span>
                      <span className="text-[12px] text-neutral-400">{locationName(b.locationId)}</span>
                      <span className="font-mono text-[12px] text-neutral-600">party {b.partySize}</span>
                      <StatusPill status="confirmed" />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
