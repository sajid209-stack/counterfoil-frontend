"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DetailCard, FactGrid } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  dayFill,
  eventDays,
  eventSettlement,
  spansDays,
  tierDays,
  type EventRecord,
  type EventSettlement,
  type EventTier,
  type Location,
} from "@/lib/api";
import { dayName } from "@/lib/events/days";
import { formatClock, formatClockRange, formatDay, formatPriceShort } from "@/lib/format";
import { Bar } from "./BookingOverview";
import { ItsLink } from "./parts";
import type { OnlineChoice } from "../sell/SellChannels";

/** The settlement as a CSV an accountant can open: the ticket types, the days and where it was bought. */
export function settlementCsv(
  e: EventRecord,
  s: EventSettlement,
  tr: (key: string, values?: Record<string, string | number>) => string,
): string {
  const major = (m: number) => (m / 100).toFixed(2);
  const cell = (v: string | number) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const row = (xs: (string | number)[]) => xs.map(cell).join(",");
  const lines = [
    row([tr("colTicket"), tr("colPrice"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol"), tr("settle.faceValue"), tr("settle.refundedCol"), tr("settle.taken")]),
    ...s.tiers.map((x) => row([x.name, major(x.price), x.capacity, x.sold, x.unsold, major(x.faceValue), major(x.refundedAmount), major(x.net)])),
    row([tr("settle.total"), "", s.totals.capacity, s.totals.sold, s.totals.unsold, major(s.totals.faceValue), major(s.totals.refundedAmount), major(s.totals.net)]),
  ];
  if (s.days.length > 1) {
    lines.push("", row([tr("settle.byDay"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol")]));
    for (const d of s.days) lines.push(row([`${d.name} ${d.date}`, d.capacity, d.sold, d.unsold]));
  }
  if (s.byChannel.length) {
    lines.push("", row([tr("settle.byChannel"), tr("settle.sold"), tr("settle.taken")]));
    for (const c of s.byChannel) lines.push(row([tr(`settle.channel.${c.channel}`), c.sold, major(c.net)]));
  }
  return lines.join("\n");
}

/** Hand a CSV to the browser as a download. */
export function downloadCsv(name: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * An event's Overview: the sales record it has always had — how much of it has
 * gone, which tickets, each day's grouped capacity, where it was bought — with
 * the link on the side. Key facts first and quiet; what is only sometimes
 * needed folds behind a labelled row on a phone.
 */
export function EventOverview({
  e,
  online,
  slug,
  counter,
  locations,
  locationIds,
  saved,
  onSellOnline,
}: {
  e: EventRecord;
  online: OnlineChoice;
  slug: string;
  counter: boolean;
  locations: Location[];
  locationIds: string[];
  saved: boolean;
  onSellOnline: () => void;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("catalog");
  const tr = useTranslations("catalog.eventRecord");
  const wide = useMediaQuery(MD);

  const settlement = useMemo(
    () => eventSettlement(e, (n) => tr("days.nth", { n })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the translator is stable for a render's locale
    [e],
  );

  /* A two-day event used to read "Sat 24 Oct · 16:00–22:00" — the end time of
     a day this line does not name. It states the range of DAYS instead, and
     leaves the clock to the per-day list below, where it is true. */
  const multi = spansDays(e);
  const evDays = eventDays(e);
  const when = multi
    ? `${formatDay(evDays[0].date, { weekday: true })} – ${formatDay(evDays[evDays.length - 1].date, { weekday: true })}`
    : `${formatDay(e.startsAt.slice(0, 10), { weekday: true })} · ${e.endsAt ? formatClockRange(e.startsAt.slice(11, 16), e.endsAt.slice(11, 16)) : formatClock(e.startsAt.slice(11, 16))}`;
  const pctAll = settlement.totals.capacity ? Math.min(100, Math.round((settlement.totals.sold / settlement.totals.capacity) * 100)) : 0;

  return (
    <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-section">
        {/* The facts, first and quiet: when, where, how much of it has gone,
            and what that took. */}
        <DetailCard title={tc("item.overview.glance")}>
          <FactGrid
            tone="primary"
            columns={4}
            facts={[
              { key: "when", label: tr("when"), value: when, span: 2 },
              {
                key: "venue",
                label: tr("venue"),
                span: 2,
                value: (
                  <>
                    <span className="block">{e.venueName}</span>
                    {e.venueAddress && <span className="block text-sm font-normal text-muted">{e.venueAddress}</span>}
                  </>
                ),
              },
              {
                key: "sold",
                label: tr("settle.sold"),
                span: 2,
                value: (
                  <>
                    <span className="tabular-nums">{tr("days.soldOf", { sold: settlement.totals.sold.toLocaleString(), cap: settlement.totals.capacity.toLocaleString() })}</span>
                    <Bar pct={pctAll} className="mt-tight" />
                  </>
                ),
              },
              {
                key: "taken",
                label: tr("settle.taken"),
                span: 2,
                value: (
                  <>
                    <span className="tabular-nums">{formatPriceShort(settlement.totals.net)}</span>
                    {settlement.totals.refundedAmount > 0 && (
                      <span className="block text-sm font-normal text-muted">{tr("settle.refunded", { amount: formatPriceShort(settlement.totals.refundedAmount) })}</span>
                    )}
                  </>
                ),
              },
            ]}
          />
        </DetailCard>

        {/* Which tickets are selling — the breakdown the list's one bar
            cannot show, and the first thing a box office is asked. */}
        <section className="card-surface overflow-hidden" aria-labelledby="ev-tiers">
          <h2 id="ev-tiers" className="px-card pb-tight pt-card text-md font-semibold text-fg">{tc("editEvent.tabTickets")}</h2>
          {wide ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-card py-tight font-medium">{tr("colTicket")}</th>
                  <th scope="col" className="py-tight pr-section text-right font-medium">{tr("colPrice")}</th>
                  <th scope="col" className="py-tight pr-section font-medium">{tr("colSold")}</th>
                  <th scope="col" className="py-tight pr-card text-right font-medium">{tr("colRevenue")}</th>
                </tr>
              </thead>
              <tbody>
                {e.tiers.map((x) => {
                  const p = x.quantity ? Math.min(100, Math.round((x.sold / x.quantity) * 100)) : 0;
                  return (
                    <tr key={x.id} className="border-b border-hairline last:border-0">
                      <td className="px-card py-comfortable">
                        <span className="block font-medium">{x.name}</span>
                        <TierMeta e={e} x={x} multi={multi} evDays={evDays} tr={tr} />
                      </td>
                      <td className="py-comfortable pr-section text-right tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</td>
                      <td className="w-48 py-comfortable pr-section">
                        <span className="flex items-baseline justify-between gap-tight text-xs tabular-nums">
                          <span>{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                          <span className="text-muted">{p}%</span>
                        </span>
                        <Bar pct={p} className="mt-inline" />
                        {(x.opening ?? 0) > 0 && <span className="mt-inline block text-xs text-muted">{tr("tierOpening", { count: x.opening ?? 0 })}</span>}
                      </td>
                      {/* Money actually taken, from the order lines — never sold × today's price. */}
                      <td className="py-comfortable pr-card text-right tabular-nums">{formatPriceShort(x.taken ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* A phone does not get a table: one card of two-line rows — the
               ticket and its price, then what has sold and what it brought in. */
            <ul className="divide-y divide-hairline">
              {e.tiers.map((x) => (
                <li key={x.id} className="px-card py-comfortable">
                  <div className="flex items-baseline justify-between gap-tight">
                    <span className="min-w-0 break-words font-medium">{x.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</span>
                  </div>
                  <div className="mt-inline flex items-baseline justify-between gap-tight text-xs text-muted tabular-nums">
                    <span>{tc("soldOf", { sold: x.sold.toLocaleString(), cap: x.quantity.toLocaleString() })}</span>
                    <span>{formatPriceShort(x.taken ?? 0)}</span>
                  </div>
                  {(x.opening ?? 0) > 0 && <div className="mt-inline text-xs text-muted">{tr("tierOpening", { count: x.opening ?? 0 })}</div>}
                  <TierMeta e={e} x={x} multi={multi} evDays={evDays} tr={tr} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Each day, and how full it is.
            The figure that matters here is NOT the ticket count: a weekend
            pass is one ticket standing on two days, so Saturday's places are
            the Saturday passes AND every pass that covers it. Summing tickets
            instead would let a festival sell its Saturday twice. */}
        {multi && (
          <DetailCard title={tr("days.title")} fold summary={tr("days.count", { count: evDays.length })}>
            <ul className="grid gap-comfortable [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
              {evDays.map((d, i) => {
                const f = dayFill(e, d.id);
                /* Through `tierDays`, not a second hand-rolled copy of the same
                   rule — two implementations of "which tickets admit this day"
                   agree until the day one of them is changed. */
                const admits = e.tiers.filter((x) => tierDays(e, x).some((y) => y.id === d.id));
                return (
                  <li key={d.id} className="flex flex-col gap-inline rounded-control bg-muted-wash p-comfortable">
                    <span className="flex flex-wrap items-baseline justify-between gap-tight">
                      <span className="text-sm font-medium">{dayName(d, i, (n) => tr("days.nth", { n }))}</span>
                      <span className="text-xs text-muted tabular-nums">{formatDay(d.date, { weekday: true })}</span>
                    </span>
                    <span className="text-sm tabular-nums">{tr("days.soldOf", { sold: f.sold.toLocaleString(), cap: f.cap.toLocaleString() })}</span>
                    <Bar pct={f.pct} />
                    <span className="text-xs text-muted">{tr("days.admits", { names: admits.map((x) => x.name).join(", ") })}</span>
                  </li>
                );
              })}
            </ul>
          </DetailCard>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-section">
        <ItsLink slug={slug} online={online} counter={counter} locations={locations} locationIds={locationIds} saved={saved} onSellOnline={onSellOnline} />

        {/* The settlement. What a box office actually settles a show on:
            capacity against sold, what came in, what went back. */}
        <section className="card-surface overflow-hidden" aria-labelledby="ev-settle">
          <h2 id="ev-settle" className="px-card pb-tight pt-card text-md font-semibold text-fg">{tr("settle.title")}</h2>
          <dl className="divide-y divide-hairline">
            <SummaryRow label={tr("settle.capacity")} value={settlement.totals.capacity.toLocaleString()} />
            <SummaryRow label={tr("settle.sold")} value={settlement.totals.sold.toLocaleString()} sub={tr("settle.unsold", { count: settlement.totals.unsold })} />
            <SummaryRow label={tr("settle.faceValue")} value={formatPriceShort(settlement.totals.faceValue)} sub={tr("settle.faceValueNote")} />
            <SummaryRow
              label={tr("settle.taken")}
              value={formatPriceShort(settlement.totals.net)}
              sub={settlement.totals.refundedAmount > 0 ? tr("settle.refunded", { amount: formatPriceShort(settlement.totals.refundedAmount) }) : undefined}
            />
          </dl>
        </section>

        {settlement.byChannel.length > 0 && (
          <DetailCard title={tr("settle.byChannel")} fold summary={tr("settle.channels", { count: settlement.byChannel.length })}>
            <ul className="-mx-card divide-y divide-hairline text-sm">
              {settlement.byChannel.map((c) => (
                <li key={c.channel} className="flex items-baseline justify-between gap-tight px-card py-comfortable first:pt-0 last:pb-0">
                  <span>{tr(`settle.channel.${c.channel}`)}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {tr("settle.tickets", { count: c.sold })}
                    {c.channel !== "opening" && <span className="text-muted"> · {formatPriceShort(c.net)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {settlement.byChannel.some((c) => c.channel === "opening") && <p className="mt-comfortable text-xs text-muted">{tr("settle.openingNote")}</p>}
          </DetailCard>
        )}
      </div>
    </div>
  );
}

/** One row of the sales summary: the label, the figure, and a line under the
 *  figure only where there is something to say. */
function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-tight px-card py-comfortable">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right">
        <span className="text-base font-semibold tabular-nums">{value}</span>
        {sub && <span className={cn("block text-xs text-muted tabular-nums")}>{sub}</span>}
      </dd>
    </div>
  );
}

/** What stands under a ticket's name: which days it admits (multi-day events)
 *  and when it stops selling. Only drawn where there is something to say. */
function TierMeta({
  e,
  x,
  multi,
  evDays,
  tr,
}: {
  e: EventRecord;
  x: EventTier;
  multi: boolean;
  evDays: ReturnType<typeof eventDays>;
  tr: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {/* Which days it admits, stated under the name. Most ticket names say
          their own day, but an operator may name one "GA", and a box office
          reading this should not have to guess. */}
      {multi && (
        <span className="mt-inline block text-xs text-muted">
          {(() => {
            const mine = tierDays(e, x);
            return mine.length === evDays.length
              ? tr("days.admitsAll")
              : tr("days.admitsOn", { days: mine.map((d) => dayName(d, evDays.findIndex((y) => y.id === d.id), (n) => tr("days.nth", { n }))).join(" + ") });
          })()}
        </span>
      )}
      {x.salesEnd && <span className="block text-xs text-muted">{tr("salesEnd", { date: formatDay(x.salesEnd.slice(0, 10)) })}</span>}
    </>
  );
}
