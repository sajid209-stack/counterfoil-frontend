"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DetailCard, FactGrid } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { Location, Product } from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatClock, formatClockRange, formatDay, formatPriceShort } from "@/lib/format";
import { fromPriceOf } from "@/lib/price";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { comingUp, dayLoads, salesTotals, ticketSales, type TicketSalesRow } from "./overviewData";
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

const pctOf = (n: number, of: number) => (of > 0 ? Math.min(100, Math.round((n / of) * 100)) : 0);

/**
 * The Overview: ONE layout for every booking (docs/catalog.md §10.4).
 *
 * At a glance (what it costs from, how much of it has gone, the money taken),
 * Coming up (the next days, slots or dates and how full each is), Sales by
 * ticket, and its link. The figures are derived from the orders and the
 * availability engine — nothing is stored — and a booking with nothing to say
 * under a heading says so in a sentence rather than leaving an empty card.
 */
export function Overview({
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

  const from = useMemo(() => fromPriceOf(product, demoNow()), [product]);
  const rows = useMemo(() => ticketSales(product), [product]);
  const totals = useMemo(() => salesTotals(rows), [rows]);
  const days = useMemo(() => dayLoads(product), [product]);
  const upcoming = useMemo(() => comingUp(product, DEMO_TODAY), [product]);
  const onDate = days.length > 0;
  const many = days.length > 1;
  const soldPct = totals.capacity ? pctOf(totals.sold, totals.capacity) : 0;

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
                label: ti("overview.sold"),
                value:
                  totals.sold === 0 ? (
                    ti("overview.soldNone")
                  ) : totals.capacity !== null ? (
                    <>
                      <span className="tabular-nums">{ti("overview.soldOfTotal", { sold: totals.sold, cap: totals.capacity })}</span>
                      <Bar pct={soldPct} className="mt-tight" />
                    </>
                  ) : (
                    /* The label already says "Sold"; "52 sold" under it said it twice. */
                    <span className="tabular-nums">{totals.sold.toLocaleString()}</span>
                  ),
              },
              { key: "money", label: ti("overview.tookIn"), value: totals.taken > 0 ? formatPriceShort(totals.taken) : ti("overview.soldNone") },
            ]}
          />
          <p className="mt-section text-sm text-muted">{subtitle(product)}</p>
        </DetailCard>

        {(onDate || upcoming.length > 0) && (
        <DetailCard title={ti("overview.comingUp")}>
          {onDate ? (
            <ul className="divide-y divide-hairline">
              {days.map((d, i) => (
                <li key={d.id} className="flex flex-col gap-inline py-comfortable first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-section">
                  <span className="min-w-0 sm:w-56">
                    <span className="block text-base font-medium">
                      {many ? `${d.name?.trim() || ti("overview.dayN", { n: i + 1 })} · ` : ""}
                      {formatDay(d.date, { weekday: true })}
                    </span>
                    <span className="block text-sm text-muted">{d.endTime ? formatClockRange(d.startTime, d.endTime) : formatClock(d.startTime)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-inline">
                    <span className="flex items-baseline justify-between gap-tight text-sm tabular-nums">
                      <span>{d.cap !== null ? ti("overview.dayOf", { sold: d.sold, cap: d.cap }) : ti("overview.soldOnly", { count: d.sold })}</span>
                      {d.cap !== null && <span className="text-muted">{d.pct}%</span>}
                    </span>
                    {d.cap !== null && <Bar pct={d.pct} />}
                    {many && d.admits.length > 0 && <span className="text-sm text-muted">{ti("overview.admits", { names: d.admits.join(", ") })}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-hairline">
              {upcoming.map((r) => {
                const pct = pctOf(r.used, r.cap);
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
        )}

        <SalesByTicket allRows={rows} />
      </div>

      <ItsLink slug={slug} online={online} counter={counter} locations={locations} locationIds={locationIds} saved={saved} onSellOnline={onSellOnline} />
    </div>
  );
}

/** Each ticket: its price, how many have sold (of how many), and the money it
 *  took — read from the orders, with the ones sold before Counterfoil counted
 *  but carrying no money. A table from md, two-line rows on a phone. */
function SalesByTicket({ allRows }: { allRows: TicketSalesRow[] }) {
  const t = useTranslations("catalog");
  const ti = useTranslations("catalog.item");
  const wide = useMediaQuery(MD);
  /* A ticket nobody has bought is a row of zeros; say how many are left out. */
  const rows = allRows.filter((r) => r.sold > 0);
  const hidden = allRows.length - rows.length;
  const price = (n: number) => (n === 0 ? t("free") : formatPriceShort(n));
  const soldText = (r: TicketSalesRow, plain = false) =>
    r.quantity !== null ? t("soldOf", { sold: r.sold.toLocaleString(), cap: r.quantity.toLocaleString() }) : plain ? r.sold.toLocaleString() : ti("overview.soldOnly", { count: r.sold });
  const pct = (r: TicketSalesRow) => (r.quantity ? pctOf(r.sold, r.quantity) : 0);
  const extra = (r: TicketSalesRow) => (
    <>
      {r.opening > 0 && <span className="block text-sm text-muted">{ti("overview.before", { count: r.opening })}</span>}
      {r.salesEnd && <span className="block text-sm text-muted">{ti("overview.stops", { date: formatDay(r.salesEnd) })}</span>}
    </>
  );

  return (
    <section className="card-surface overflow-hidden" aria-labelledby="sales-by-ticket">
      <h2 id="sales-by-ticket" className="px-card pb-tight pt-card text-md font-semibold text-fg">{ti("overview.byTicket")}</h2>
      {allRows.length === 0 ? (
        <p className="px-card pb-card text-sm text-muted">{ti("overview.noTickets")}</p>
      ) : rows.length === 0 ? (
        <p className="px-card pb-card text-sm text-muted">{ti("overview.noSales", { count: hidden })}</p>
      ) : wide ? (
        <table className="w-full text-sm">
          <thead className="text-left text-sm text-muted">
            <tr className="border-b border-hairline">
              <th scope="col" className="px-card py-tight font-medium">{ti("overview.col.ticket")}</th>
              <th scope="col" className="py-tight pr-section text-right font-medium">{ti("overview.col.price")}</th>
              <th scope="col" className="py-tight pr-section font-medium">{ti("overview.col.sold")}</th>
              <th scope="col" className="py-tight pr-card text-right font-medium">{ti("overview.col.taken")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <td className="px-card py-comfortable">
                  <span className="block font-medium">{r.name}</span>
                  {extra(r)}
                </td>
                <td className="py-comfortable pr-section text-right tabular-nums">{price(r.price)}</td>
                <td className="w-52 py-comfortable pr-section">
                  <span className="flex items-baseline justify-between gap-tight text-sm tabular-nums">
                    <span>{soldText(r, true)}</span>
                    {r.quantity !== null && <span className="text-muted">{pct(r)}%</span>}
                  </span>
                  {r.quantity !== null && <Bar pct={pct(r)} className="mt-inline" />}
                </td>
                <td className="py-comfortable pr-card text-right tabular-nums">{formatPriceShort(r.taken)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <li key={r.id} className="px-card py-comfortable">
              <div className="flex items-baseline justify-between gap-tight">
                <span className="min-w-0 break-words font-medium">{r.name}</span>
                <span className="shrink-0 text-sm tabular-nums">{price(r.price)}</span>
              </div>
              <div className="mt-inline flex items-baseline justify-between gap-tight text-sm text-muted tabular-nums">
                <span>{soldText(r)}</span>
                <span>{formatPriceShort(r.taken)}</span>
              </div>
              {r.quantity !== null && <Bar pct={pct(r)} className="mt-inline" />}
              {extra(r)}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && hidden > 0 && <p className="border-t border-hairline px-card py-comfortable text-sm text-muted">{ti("overview.moreNoSales", { count: hidden })}</p>}
    </section>
  );
}
