"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState, PageShell, ResourceTimeline, StatusPill, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookings, listLocations, listProducts, listResources, ownerBusyDetailed, type Booking } from "@/lib/api";
import { formatDate } from "@/lib/format";

const NOW = new Date("2026-07-29T12:00:00+06:00");
const TODAY = "2026-07-29";
const dayKey = (iso: string) => iso.slice(0, 10);
const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const [view, setView] = useState("month");
  const [resourceDate, setResourceDate] = useState(TODAY);
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);

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
    <PageShell title={t("title")} description={t("description")}>
      <Tabs
        items={[
          { value: "day", label: t("tabDay") },
          { value: "week", label: t("tabWeek") },
          { value: "month", label: t("tabMonth") },
        ]}
        value={view}
        onChange={setView}
        className="mb-major"
      />

      {/* The day by resource — the same timeline the POS sheet shows, so the
          manager and the counter see the same picture. */}
      {view === "day" && (resourcesQ.data?.data.length ?? 0) > 0 && (
        <div className="mb-major rounded-md border border-line bg-card p-major">
          <div className="mb-section flex items-center justify-between">
            <h2 className="type-h2 text-base">{t("byResource", { noun: resourcesQ.data!.data[0].nounSingular.toLowerCase() })}</h2>
            <input type="date" value={resourceDate} onChange={(e) => setResourceDate(e.target.value)} className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse" />
          </div>
          <div className="flex flex-col gap-section">
            {resourcesQ.data!.data.map((r) => (
              <div key={r.id} className="grid items-center gap-tight sm:grid-cols-[8rem_1fr]">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  {r.outOfService && <p className="text-[11px] text-danger">{r.outOfServiceReason ? t("outOfServiceReason", { reason: r.outOfServiceReason }) : t("outOfService")}</p>}
                </div>
                <ResourceTimeline spans={ownerBusyDetailed(r.id, resourceDate)} openMin={6 * 60} closeMin={23 * 60} hatched={r.outOfService} />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : grouped.length === 0 ? (
        <EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />
      ) : (
        <div className="flex flex-col gap-section">
          {grouped.map(([date, items]) => (
            <div key={date} className="rounded-md border border-line bg-card p-major">
              <div className="mb-tight flex items-center justify-between">
                <h2 className="type-h2 text-base">{formatDate(date)}</h2>
                <span className="font-mono text-[12px] text-faint">{items.length === 1 ? t("bookingCount", { count: items.length }) : t("bookingCountPlural", { count: items.length })}</span>
              </div>
              <div className="flex flex-col gap-inline">
                {items
                  .sort((a, b) => a.slotStart.localeCompare(b.slotStart))
                  .map((b) => (
                    <div key={b.id} className="flex items-center gap-section border-t border-line py-tight text-sm first:border-0">
                      <span className="w-14 font-mono text-[13px]">{time(b.slotStart)}</span>
                      <span className="flex-1">{productName(b.productId)}</span>
                      <span className="text-[12px] text-faint">{locationName(b.locationId)}</span>
                      <span className="font-mono text-[12px] text-muted">{t("party", { size: b.partySize })}</span>
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
