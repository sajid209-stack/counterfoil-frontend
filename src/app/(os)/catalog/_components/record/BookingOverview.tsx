"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DetailCard, FactGrid } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Location, Product } from "@/lib/api";
import { bookingKindOf, bookingUse } from "@/lib/catalog";
import { formatClock, formatDay, formatPriceShort } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { comingUp, salesSince, thirtyDaysBefore } from "./overview";
import { ItsLink } from "./parts";
import type { OnlineChoice } from "../sell/SellChannels";

/** A slim fill bar. Ember from 90% — the app's "nearly full" language. */
export function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success-solid")} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * A booking's Overview: is it selling, when can people come and how full is it,
 * and where do they find it. A compact summary, not a report — the figures are
 * the ones a manager checks before touching anything else, derived from the
 * orders and the availability engine, and every other answer is one tab away.
 */
export function BookingOverview({
  product,
  online,
  slug,
  counter,
  locations,
  locationIds,
  saved,
  onSellOnline,
}: {
  product: Product;
  online: OnlineChoice;
  slug: string;
  counter: boolean;
  locations: Location[];
  locationIds: string[];
  saved: boolean;
  onSellOnline: () => void;
}) {
  const t = useTranslations("catalog");
  const ti = useTranslations("catalog.item");
  const subtitle = useBehaviourSubtitle();

  const prices = product.tiers.filter((x) => x.active).map((x) => x.price);
  const from = prices.length ? Math.min(...prices) : null;
  const use = useMemo(() => bookingUse(product, DEMO_TODAY), [product]);
  const sales = useMemo(() => salesSince(product.id, thirtyDaysBefore(DEMO_TODAY)), [product.id]);
  const upcoming = useMemo(() => comingUp(product, DEMO_TODAY), [product]);

  return (
    <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-section">
        <DetailCard title={ti("overview.glance")}>
          <FactGrid
            tone="primary"
            columns={3}
            facts={[
              { key: "from", label: t("col.from"), value: from === null ? ti("overview.noPrice") : from === 0 ? t("free") : formatPriceShort(from) },
              {
                key: "sold",
                label: ti("overview.last30"),
                value: sales.qty > 0 ? ti("overview.soldCount", { count: sales.qty }) : ti("overview.soldNone"),
              },
              { key: "money", label: ti("overview.tookIn"), value: sales.qty > 0 ? formatPriceShort(sales.net) : null },
            ]}
          />
          <p className="mt-section text-sm text-muted">{subtitle(product)}</p>
        </DetailCard>

        <DetailCard
          title={ti("overview.comingUp")}
          description={use ? ti(use.unit === "slots" ? "overview.next7Slots" : "overview.next7Places", { used: use.used, cap: use.cap, pct: use.pct }) : undefined}
        >
          {use && <Bar pct={use.pct} className="mb-section" />}
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">{ti(`overview.noDates.${bookingKindOf(product.bookingType)}`)}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {upcoming.map((r) => {
                const pct = r.cap ? Math.min(100, Math.round((r.used / r.cap) * 100)) : 0;
                return (
                  <li key={r.date} className="flex flex-col gap-inline py-comfortable first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-section">
                    <span className="min-w-0 sm:w-56">
                      <span className="block text-base font-medium">{formatDay(r.date, { weekday: true })}</span>
                      <span className="block text-sm text-muted">
                        {r.times > 0
                          ? ti("overview.times", { count: r.times, first: formatClock(r.first!) })
                          : r.first
                            ? ti("overview.firstFree", { time: formatClock(r.first) })
                            : ti(r.unit === "slots" ? "overview.slotsDay" : "overview.placesDay")}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-inline">
                      <span className="flex items-baseline justify-between gap-tight text-sm tabular-nums">
                        <span>{ti(r.unit === "slots" ? "overview.slotsTaken" : "overview.placesTaken", { used: r.used, cap: r.cap })}</span>
                        <span className="text-muted">{pct}%</span>
                      </span>
                      <Bar pct={pct} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DetailCard>
      </div>

      <ItsLink slug={slug} online={online} counter={counter} locations={locations} locationIds={locationIds} saved={saved} onSellOnline={onSellOnline} />
    </div>
  );
}
