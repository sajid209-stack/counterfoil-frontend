"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronRight, MapPin, Users } from "lucide-react";
import { peekLocations, peekProducts, peekResources, type Booking } from "@/lib/api";
import { formatClock, formatClockRange, formatDay } from "@/lib/format";
import { Panel } from "./Panel";

/**
 * What they have booked next — the first thing a person serving them wants.
 *
 * At most three, soonest first, each one a link to its order. The day and the
 * clock are read off the slot's own text rather than through a Date, so a
 * browser in another zone cannot move a booking onto the wrong day.
 */
export function ComingUp({ bookings }: { bookings: Booking[] }) {
  const t = useTranslations("customers");

  const rows = useMemo(() => {
    const products = new Map(peekProducts().map((p) => [p.id, p.name]));
    const resources = new Map(peekResources().map((r) => [r.id, r.name]));
    const locations = new Map(peekLocations().map((l) => [l.id, l.name]));
    return bookings.map((b) => ({
      id: b.id,
      orderId: b.orderId,
      what: products.get(b.productId) ?? "",
      day: formatDay(b.slotStart.slice(0, 10), { weekday: true }),
      time: b.slotEnd ? formatClockRange(b.slotStart.slice(11, 16), b.slotEnd.slice(11, 16)) : formatClock(b.slotStart.slice(11, 16)),
      where: (b.resourceId && resources.get(b.resourceId)) || locations.get(b.locationId) || "",
      party: b.partySize,
    }));
  }, [bookings]);

  return (
    <Panel title={t("comingUp")}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("nothingBooked")}</p>
      ) : (
        <ul className="-mx-comfortable flex flex-col">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-hairline last:border-0">
              <Link
                href={`/orders/${r.orderId}`}
                className="flex min-h-11 items-center gap-comfortable rounded-sm px-comfortable py-comfortable hover:bg-muted-wash"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-inline">
                  <span className="break-words text-sm font-medium text-fg">{r.what}</span>
                  <span className="flex items-center gap-tight text-[0.8125rem] text-muted">
                    <CalendarClock size={14} strokeWidth={1.6} aria-hidden className="shrink-0" />
                    <span className="min-w-0">
                      {r.day} · {r.time}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-comfortable gap-y-inline text-[0.8125rem] text-muted">
                    {r.where && (
                      <span className="flex min-w-0 items-center gap-tight">
                        <MapPin size={14} strokeWidth={1.6} aria-hidden className="shrink-0" />
                        <span className="min-w-0 break-words">{r.where}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-tight">
                      <Users size={14} strokeWidth={1.6} aria-hidden className="shrink-0" />
                      {t("partyOf", { count: r.party })}
                    </span>
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-inline text-[0.8125rem] font-medium text-brand-foreground">
                  {t("openOrder")}
                  <ChevronRight size={16} strokeWidth={1.6} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
