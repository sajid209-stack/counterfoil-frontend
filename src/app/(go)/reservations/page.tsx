"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { EmptyState, Skeleton, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookings, listProducts } from "@/lib/api";
import { formatClockOf, formatDate } from "@/lib/format";

const TODAY = Date.parse("2026-07-29T00:00:00+06:00");

export default function GoBookingsPage() {
  const t = useTranslations("schedule");
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
        <p className="text-sm font-medium text-brand-foreground">{t("arrivalsGateLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("arrivalsTitle")}</h1>
      </div>
      <div className="relative">
        <Search size={18} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("arrivalsSearchPlaceholder")}
          placeholder={t("arrivalsSearchPlaceholder")}
          className="h-12 w-full rounded-full border border-line bg-card pl-10 pr-section text-base"
        />
      </div>

      {bookingsQ.loading ? (
        <div aria-busy="true" className="flex flex-col gap-tight"><Skeleton h={16} w="33%" className="rounded-full" /><Skeleton h={16} w="67%" className="rounded-full" /><Skeleton h={16} w="50%" className="rounded-full" /></div>
      ) : arrivals.length === 0 ? (
        <EmptyState title={t("noArrivals")} />
      ) : (
        <div className="flex flex-col gap-tight">
          {arrivals.slice(0, 40).map((b) => (
            <div key={b.id} className="flex items-center gap-section card-surface p-comfortable">
              <div className="text-center">
                <div className="whitespace-nowrap text-lg font-medium tabular-nums">{formatClockOf(b.slotStart)}</div>
                <div className="text-sm tabular-nums text-muted">{formatDate(b.slotStart)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-medium">{productName(b.productId)}</div>
                <div className="text-sm tabular-nums text-muted">{t("partyOf", { size: b.partySize })}</div>
              </div>
              <StatusPill status="confirmed" size="md" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
