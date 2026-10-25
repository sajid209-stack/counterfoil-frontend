"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Search } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listBookings, listOrders, listProducts } from "@/lib/api";
import { formatClockOf } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useActiveCounterNow } from "@/lib/activeCounter";
import { BookingGlyph } from "../_components/WallTile";
import { Thumb } from "../_components/Thumb";
import { GoPage, GoPageHeader } from "../_components/GoPage";

const TODAY = Date.parse("2026-07-29T00:00:00+06:00");

/**
 * Who is still to come. The guest's name leads (it is what a steward matches
 * against the person in front of them), the booking and party size sit under it
 * quietly, the reference is a small mono identifier, and a mark says whether
 * they are in. A row opens that party on Check-in.
 */
export default function GoBookingsPage() {
  const t = useTranslations("schedule");
  const tc = useTranslations("checkin");
  const [search, setSearch] = useState("");
  /* Only this counter's venue: Check-in is scoped the same way, so a row here
     always lands on a list that contains it. */
  const venueId = useActiveCounterNow().locationId;
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const productOf = (id: string) => productsQ.data?.data.find((p) => p.id === id);

  const arrivals = useMemo(() => {
    const orders = new Map((ordersQ.data?.data ?? []).map((o) => [o.id, o]));
    const q = search.trim().toLowerCase();
    return (bookingsQ.data?.data ?? [])
      .filter((b) => b.status === "confirmed" && Date.parse(b.slotStart) >= TODAY && (!venueId || b.locationId === venueId))
      .map((b) => {
        const order = orders.get(b.orderId);
        return { b, guest: order?.customerName?.trim() || "", reference: order?.reference ?? "" };
      })
      .filter(({ b, guest, reference }) => !q || [productName(b.productId), guest, reference].some((s) => s.toLowerCase().includes(q)))
      .sort((a, z) => a.b.slotStart.localeCompare(z.b.slotStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingsQ.data, productsQ.data, ordersQ.data, search, venueId]);

  return (
    <GoPage width="narrow">
    <main className="mx-auto flex max-w-160 flex-col gap-comfortable pb-section pt-tight rail:max-w-none rail:gap-section rail:py-0">
      <GoPageHeader title={t("arrivalsTitle")} className="mb-0! rail:mb-0!" />
      <div className="relative">
        <Search size={18} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("arrivalsSearchPlaceholder")}
          placeholder={t("arrivalsSearchPlaceholder")}
          className="h-12 w-full rounded-full bg-card pl-10 pr-section text-base shadow-card rail:rounded-md"
        />
      </div>

      {bookingsQ.loading ? (
        <div aria-busy="true" className="flex flex-col gap-tight"><Skeleton h={16} w="33%" className="rounded-full" /><Skeleton h={16} w="67%" className="rounded-full" /><Skeleton h={16} w="50%" className="rounded-full" /></div>
      ) : arrivals.length === 0 ? (
        <EmptyState title={t("noArrivals")} />
      ) : (
        <ul className="flex flex-col gap-comfortable rail:rounded-card rail:bg-card rail:shadow-card rail:gap-0 rail:overflow-hidden">
          {arrivals.slice(0, 40).map(({ b, guest, reference }) => {
            const p = productOf(b.productId);
            const isIn = (b.checkedIn ?? 0) >= b.partySize;
            const href = `/checkin?${new URLSearchParams({ q: reference || guest, date: b.slotStart.slice(0, 10) }).toString()}`;
            return (
              <li key={b.id} className="rail:border-t rail:border-line rail:first:border-t-0">
                <Link href={href} className="card-surface flex min-h-14 items-center gap-comfortable p-comfortable rail:rounded-none rail:bg-transparent rail:px-card rail:py-comfortable rail:shadow-none rail:hover:bg-nav-hover">
                  <Thumb image={p?.images?.[0]?.url} glyph={<BookingGlyph bookingType={p?.bookingType} />} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-md font-semibold text-fg">{guest || tc("walkInDefaultName")}</div>
                    <div className="text-sm text-muted">{productName(b.productId)} · {t("partyOf", { size: b.partySize })}</div>
                    {reference && <div className="font-mono text-sm text-muted">{reference}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-inline">
                    <span className="whitespace-nowrap text-md font-semibold tabular-nums">{formatClockOf(b.slotStart)}</span>
                    <span className={cn("inline-flex items-center gap-inline text-sm font-medium", isIn ? "text-success" : "text-muted")}>
                      {isIn && <Check size={14} strokeWidth={2} aria-hidden />}
                      {isIn ? tc("filterIn") : tc("filterNotIn")}
                    </span>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
    </GoPage>
  );
}
