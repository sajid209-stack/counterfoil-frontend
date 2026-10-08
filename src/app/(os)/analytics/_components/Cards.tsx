"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { AreaChart, Button, HeatmapChart, formatRange, type ChartPoint } from "@/components/ui";
import type { AnalyticsOverview, TimePoint } from "@/lib/api";
import { useEnumLabels } from "@/lib/labels";
import { formatClock, formatDay, formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { csvCell, major, num, pad2, percent, saveCsv } from "./helpers";
import {
  BarList,
  CardSkeleton,
  Change,
  Col,
  ColumnBars,
  Empty,
  Figure,
  Grid,
  Group,
  GroupHeading,
  MiniMultiples,
  PairLegend,
  PairedBars,
  Pulse,
  Section,
  Segmented,
  SplitBar,
  StackedColumns,
  TableTwin,
  type MiniPanel,
  type PairRow,
} from "./Parts";

/* ── The cards, grouped the way a manager asks ─────────────────────────────
 *
 * Sales (what came in, and from what, where and how), Visitors (who was
 * booked, who came, who they are), Timing (when it is busy, how far ahead and
 * how full) and VAT. A group is a small heading and a grid of cards; each card
 * is a question, an answer and one small chart, with an "i" saying what it
 * counts. Where two cards sit side by side they are stacks of cards in two
 * columns, so a tall card (ticket types) does not leave a hollow one beside it.
 */

/** A big figure over a line saying what it is, with its change. */
function Headline({ value, label, change, was }: { value: React.ReactNode; label: string; change?: React.ReactNode; was?: string }) {
  return (
    <div className="mb-comfortable">
      <p className="type-figure text-xl font-semibold">
        {value}
        {change}
      </p>
      <p className="text-[0.75rem] text-muted">
        {label}
        {was && ` · ${was}`}
      </p>
    </div>
  );
}

/** A label over a figure, in a definition list. */
function Stat({ label, value, change }: { label: string; value: string; change?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.75rem] text-muted">{label}</dt>
      <dd className="type-figure text-xl font-semibold">
        {value}
        {change}
      </dd>
    </div>
  );
}

/** What each colour means, where colour is the only way to tell two series apart. */
function SwatchLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <p data-chart-legend className="mb-comfortable flex flex-wrap items-center gap-x-section gap-y-inline text-[0.75rem] text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-tight">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.color }} />
          <span className="text-fg">{i.label}</span>
        </span>
      ))}
    </p>
  );
}

export function Cards({ o, venueName }: { o: AnalyticsOverview; venueName: string }) {
  const t = useTranslations("analytics");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const enumL = useEnumLabels();
  const wide = useMediaQuery(MD);
  const [showAllCap, setShowAllCap] = useState(false);
  const [chanView, setChanView] = useState<"share" | "time">("share");
  const [payView, setPayView] = useState<"share" | "time">("share");

  const empty = o.kpis.orders.value === 0;
  const showCompare = o.previous !== null;
  const nowText = formatRange(o.from, o.to);
  const rangeText = o.previous ? formatRange(o.previous.from, o.previous.to) : "";
  const change = (now: number, then: number | undefined, goodWhen: "up" | "down" = "up") => (
    <Change now={now} then={showCompare ? then : undefined} range={rangeText} goodWhen={goodWhen} />
  );
  /** The change as a sentence, for a tooltip and a screen reader. */
  const changeSentence = (now: number, then: number | undefined): string | undefined => {
    if (!showCompare || then === undefined) return undefined;
    if (then <= 0) return now > 0 ? t("change.newTitle", { range: rangeText }) : undefined;
    const p = Math.round(((now - then) / then) * 100);
    return p === 0 ? undefined : t(p > 0 ? "change.up" : "change.down", { pct: Math.abs(p), range: rangeText });
  };
  const guestsText = (n: number) => t("counts.guests", { n, c: num(n) });
  const ordersText = (n: number) => t("counts.orders", { n, c: num(n) });

  // ── points of a time series, named the way the revenue chart names them ──
  const pointLabel = (key: string) =>
    o.granularity === "hour"
      ? formatClock(key, { short: true })
      : o.granularity === "week"
        ? wide
          ? t("revenue.weekOf", { day: formatDay(key) })
          : formatDay(key)
        : formatDay(key);
  const pointTitle = (key: string) =>
    o.granularity === "hour"
      ? formatClock(key)
      : o.granularity === "week"
        ? t("revenue.weekOf", { day: formatDay(key) })
        : formatDay(key, { weekday: true });
  const chartPoints = (series: TimePoint[]): ChartPoint[] =>
    series.map((p) => ({
      label: pointLabel(p.key),
      title: pointTitle(p.key),
      value: p.value,
      compare: showCompare ? p.previous : undefined,
      compareTitle: !showCompare || p.previousKey === undefined ? undefined : pointTitle(p.previousKey),
    }));
  const tooltipDelta = (v: number, c: number) => {
    if (c <= 0) return v > 0 ? t("change.new") : null;
    const d = Math.round(((v - c) / c) * 100);
    return d === 0 ? null : `${d > 0 ? "▲" : "▼"}${Math.abs(d)}%`;
  };
  /** A series as a table for a screen reader: every tooltip value, in order. */
  const seriesTable = (caption: string, columns: { label: string; series: TimePoint[]; fmt: (n: number) => string }[]) => (
    <TableTwin
      caption={caption}
      head={[
        t("table.point"),
        ...columns.flatMap((c) => (showCompare ? [c.label, `${c.label} (${rangeText})`] : [c.label])),
      ]}
      rows={(columns[0]?.series ?? []).map((p, i) => [
        pointTitle(p.key),
        ...columns.flatMap((c) => {
          const q = c.series[i];
          return showCompare ? [c.fmt(q.value), q.previous === undefined ? "–" : c.fmt(q.previous)] : [c.fmt(q.value)];
        }),
      ])}
    />
  );
  const periodNames = { now: nowText, then: rangeText };

  // ── revenue over time ──
  const revenuePoints = chartPoints(o.revenue);

  // ── what sells ──
  const sells = o.topBookings.map((b) => ({
    key: String(b.productId),
    label: b.productId === "other" ? t("sells.other") : b.name,
    value: b.revenue,
    figure: <Figure main={formatMoney(b.revenue)} share={percent(b.share)} />,
    change: change(b.revenue, b.previousRevenue),
    muted: b.productId === "other",
  }));

  // ── ticket types ──
  const soldText = (n: number) => t("tickets.sold", { n, c: num(n) });
  const tickets: PairRow[] = o.ticketTypes.map((r) => {
    const other = r.productId === "other";
    const label = other ? t("sells.other") : r.tier && r.tier !== r.name ? `${r.name} · ${r.tier}` : r.name;
    const prev = showCompare ? r.previousRevenue : undefined;
    return {
      key: r.key,
      label,
      meta: soldText(r.quantity),
      value: r.revenue,
      previous: prev,
      figure: formatMoney(r.revenue),
      previousFigure: prev === undefined ? undefined : formatMoney(prev),
      change: change(r.revenue, r.previousRevenue),
      muted: other,
      now: `${formatMoney(r.revenue)} · ${soldText(r.quantity)}`,
      then: prev === undefined ? undefined : `${formatMoney(prev)} · ${soldText(r.previousQuantity ?? 0)}`,
      changeText: changeSentence(r.revenue, r.previousRevenue),
    };
  });

  // ── where sales come from ──
  const channels = o.channels.map((c) => ({
    key: c.channel,
    label: t(`channels.${c.channel}` as never),
    value: c.revenue,
    figure: (
      <>
        <span className="font-medium">{formatMoney(c.revenue)}</span>
        <span className="text-muted">
          {" · "}
          {ordersText(c.orders)}
          {" · "}
          {percent(c.share)}
        </span>
      </>
    ),
    change: change(c.revenue, c.previousRevenue),
  }));
  const miniPanel = (key: string, label: string, total: number, previousTotal: number | undefined, series: TimePoint[]): MiniPanel => ({
    key,
    label,
    total: formatMoney(total),
    change: change(total, previousTotal),
    points: series.map((p) => ({
      label: pointLabel(p.key),
      title: pointTitle(p.key),
      value: p.value,
      previous: showCompare ? p.previous : undefined,
      previousTitle: showCompare && p.previousKey !== undefined ? pointTitle(p.previousKey) : undefined,
    })),
  });
  const channelPanels = o.channelSeries.map((c, i) => miniPanel(c.channel, t(`channels.${c.channel}` as never), o.channels[i].revenue, o.channels[i].previousRevenue, c.series));

  // ── how people pay ──
  const pay = o.payments.map((p) => ({
    key: p.method,
    label: enumL.method(p.method),
    value: p.amount,
    figure: <Figure main={formatMoney(p.amount)} share={percent(p.share)} />,
    change: change(p.amount, p.previousAmount),
  }));
  const payPanels = o.paymentSeries.map((m, i) => miniPanel(m.method, enumL.method(m.method), o.payments[i].amount, o.payments[i].previousAmount, m.series));

  // ── counters ──
  const counterLabel = (c: AnalyticsOverview["counters"][number]) =>
    c.kind === "counter" ? c.name : c.kind === "other" ? t("sells.other") : t(`counters.${c.kind}` as never);
  const counters: PairRow[] = o.counters.map((c) => {
    const prev = showCompare ? c.previousRevenue : undefined;
    return {
      key: c.key,
      label: counterLabel(c),
      meta: ordersText(c.orders),
      value: c.revenue,
      previous: prev,
      figure: formatMoney(c.revenue),
      previousFigure: prev === undefined ? undefined : formatMoney(prev),
      change: change(c.revenue, c.previousRevenue),
      muted: c.kind === "other",
      quiet: c.orders === 0 && (c.previousOrders ?? 0) === 0 ? t("counters.noSales") : undefined,
      now: `${formatMoney(c.revenue)} · ${ordersText(c.orders)}`,
      then: prev === undefined ? undefined : `${formatMoney(prev)} · ${ordersText(c.previousOrders ?? 0)}`,
      changeText: changeSentence(c.revenue, c.previousRevenue),
    };
  });

  // ── visitors and check-ins ──
  const v = o.visitors;
  const ci = o.checkins;
  const rate = ci.due > 0 ? ci.total / ci.due : null;
  const prevRate = ci.previousDue !== null && ci.previousDue > 0 && ci.previousTotal !== null ? ci.previousTotal / ci.previousDue : null;
  const rateChange = (() => {
    if (rate === null || prevRate === null) return null;
    const d = Math.round((rate - prevRate) * 1000) / 10;
    if (d === 0) return null;
    const up = d > 0;
    const sentence = t(up ? "change.upPts" : "change.downPts", { pts: Math.abs(d), range: rangeText });
    return (
      <span data-change={up ? "up" : "down"} title={sentence} className={cn("ml-tight text-[0.75rem] font-medium", up ? "text-success" : "text-danger")}>
        <span aria-hidden>
          {up ? "▲" : "▼"} {t("kpi.pts", { value: Math.abs(d) })}
        </span>
        <span className="sr-only">{sentence}</span>
      </span>
    );
  })();

  // ── customers ──
  const g = o.guests;
  const gp = o.guestsPrevious;
  const named = g.newCustomers + g.returning;
  const customerPoints = o.customers.map((p) => ({
    label: pointLabel(p.key),
    title: pointTitle(p.key),
    parts: [p.returning, p.newCustomers],
    note:
      showCompare && p.previousKey !== undefined
        ? `${pointTitle(p.previousKey)}: ${t("customers.was", { newCount: p.previousNew ?? 0, returningCount: p.previousReturning ?? 0 })}`
        : undefined,
  }));

  // ── when it's busy ──
  const dayFmt = (style: "short" | "long") => (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 5, 1 + i, 12)));
  const shortDays = Array.from({ length: 7 }, (_, i) => dayFmt("short")(i));
  const longDays = Array.from({ length: 7 }, (_, i) => dayFmt("long")(i));
  const hours = o.heatmap.hours;
  const hourText = (h: number) => formatClock(`${pad2(h)}:00`, { short: true });
  const heatCells = o.heatmap.cells
    .map((c) => ({ row: c.weekday, col: hours.indexOf(c.hour), value: c.guests }))
    .filter((c) => c.col >= 0);
  const peak = heatCells.reduce<(typeof heatCells)[number] | null>((best, c) => (c.value > (best?.value ?? 0) ? c : best), null);

  // ── which time slots fill ──
  const ts = o.timeslots;
  const slotCell = (r: number, c: number) => ts.cells.find((x) => x.row === r && x.col === c);
  const slotCells = ts.cells.map((c) => ({ row: c.row, col: c.col, value: c.guests }));
  const slotPeak = ts.cells.reduce<(typeof ts.cells)[number] | null>((best, c) => (c.guests > (best?.guests ?? 0) ? c : best), null);
  const slotText = (r: number, c: number, n: number) => {
    const base = `${ts.rows[r].name} · ${formatClock(ts.times[c])}`;
    if (n <= 0) return `${base} · ${t("slots.none")}`;
    const fill = slotCell(r, c)?.fill;
    return `${base} · ${guestsText(n)}${fill === null || fill === undefined ? "" : ` (${t("slots.full", { pct: percent(fill) })})`}`;
  };

  // ── how full ──
  const cap = [...o.capacity].sort((a, b) => b.filled - a.filled);
  const capShown = showAllCap ? cap : cap.slice(0, 6);

  // ── how far ahead ──
  const lead = o.leadTime.map((l) => {
    const label = t(`lead.${l.bucket}` as never);
    return {
      key: l.bucket,
      label,
      value: l.share,
      figure: percent(l.share),
      ghost: showCompare ? l.previousShare : undefined,
      title:
        t("lead.share", { bucket: label, orders: ordersText(l.orders), pct: Math.round(l.share * 100) }) +
        (showCompare && l.previousShare !== undefined ? ` ${t("lead.was", { pct: percent(l.previousShare), range: rangeText })}` : ""),
    };
  });

  // ── the one figure a phone shows for a folded card ──
  const topChannel = [...o.channels].sort((a, b) => b.revenue - a.revenue)[0];
  const topCounter = [...o.counters].sort((a, b) => b.revenue - a.revenue)[0];
  const topPay = [...o.payments].sort((a, b) => b.amount - a.amount)[0];
  const topLead = [...lead].sort((a, b) => b.value - a.value)[0];
  const topTicket = [...tickets].sort((a, b) => b.value - a.value)[0];
  const sum = {
    sells: sells[0] ? `${sells[0].label} · ${formatMoney(sells[0].value)}` : undefined,
    tickets: topTicket && topTicket.value > 0 ? `${topTicket.label} · ${topTicket.figure}` : undefined,
    channels: topChannel && topChannel.revenue > 0 ? `${t(`channels.${topChannel.channel}` as never)} · ${percent(topChannel.share)}` : undefined,
    counters: topCounter && topCounter.revenue > 0 ? `${counterLabel(topCounter)} · ${formatMoney(topCounter.revenue)}` : undefined,
    pay: topPay ? `${enumL.method(topPay.method)} · ${percent(topPay.share)}` : undefined,
    visitors: v.total > 0 ? guestsText(v.total) : undefined,
    checkins:
      ci.total > 0
        ? `${t("checkins.headline", { came: num(ci.total), due: ci.due, dueC: num(ci.due) })}${rate !== null ? ` (${percent(rate)})` : ""}`
        : undefined,
    customers: named > 0 ? t("customers.n", { n: named, c: num(named) }) : undefined,
    guests: g.guests > 0 ? `${t("guests.arrived")} ${num(g.arrived)} · ${t("guests.noShows")} ${num(g.noShows)}` : undefined,
    busy: peak ? t("heat.busiest", { day: longDays[peak.row], time: hourText(hours[peak.col]) }) : undefined,
    slots: slotPeak
      ? t("slots.busiest", { name: ts.rows[slotPeak.row].name, time: formatClock(ts.times[slotPeak.col]), guests: guestsText(slotPeak.guests) })
      : undefined,
    lead: topLead && topLead.value > 0 ? `${topLead.label} · ${topLead.figure}` : undefined,
    full: cap[0] ? `${cap[0].name} · ${percent(cap[0].filled)}` : undefined,
    vat: o.tax.rows.length > 0 ? `${t("vat.vat")} ${formatMoney(o.tax.tax)}` : undefined,
  };

  // ── VAT ──
  const rate_ = (r: number) => `${Math.round(r * 1000) / 10}%`;
  const downloadVat = () => {
    const rows: (string | number)[][] = [
      [t("vat.class"), t("vat.rate"), t("vat.net"), t("vat.vat"), t("vat.gross"), t("vat.lines")],
      ...o.tax.rows.map((r) => [r.taxClass, rate_(r.rate), major(r.net), major(r.tax), major(r.gross), r.lineCount]),
      [t("vat.total"), "", major(o.tax.net), major(o.tax.tax), major(o.tax.gross), o.tax.rows.reduce((s, r) => s + r.lineCount, 0)],
    ];
    saveCsv(`vat-${venueName}-${o.from}_${o.to}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
  };
  const lines = o.tax.rows.reduce((s, r) => s + r.lineCount, 0);

  const emptyWithEarlier = (text: string, earlier: number | null, fmt: (n: number) => string) =>
    showCompare && earlier !== null && earlier > 0 ? `${text} ${t("earlier", { value: fmt(earlier), range: rangeText })}` : text;

  return (
    <>
      <GroupHeading id="sales">{t("sections.sales")}</GroupHeading>

      <Section id="revenue" pinned title={t("revenue.title")} sub={nowText} info={t("info.revenue")}>
        {empty ? (
          <Empty>{t("revenue.empty")}</Empty>
        ) : (
          <>
            <AreaChart
              points={revenuePoints}
              fmt={(x) => formatMoney(x)}
              fmtAxis={(x) => formatMoneyCompact(x)}
              height={wide ? 210 : 150}
              ticks={wide ? 4 : 2}
              valueLabel={showCompare ? nowText : t("revenue.series")}
              compareLabel={o.previous ? rangeText : t("revenue.previous")}
              compareDashed
              grid="solid"
              legend={false}
              tooltipDelta={tooltipDelta}
            />
            {seriesTable(t("revenue.title"), [{ label: t("revenue.series"), series: o.revenue, fmt: formatMoney }])}
          </>
        )}
      </Section>

      <Group>
      <Grid>
        <Col>
          <Section id="sells" title={t("sells.title")} summary={sum.sells} info={t("info.sells")} view={{ href: "/catalog", where: tn("catalog") }}>
            {sells.length === 0 ? <Empty>{t("sells.empty")}</Empty> : <BarList rows={sells} />}
          </Section>

          <Section id="channels" title={t("channels.title")} summary={sum.channels} info={t("info.channels")} view={{ href: "/orders", where: tn("orders") }}>
            {empty ? (
              <Empty>{t("channels.empty")}</Empty>
            ) : (
              <>
                <Segmented
                  value={chanView}
                  onChange={setChanView}
                  label={t("mode.label")}
                  options={[
                    { value: "share", label: t("mode.share") },
                    { value: "time", label: t("mode.time") },
                  ]}
                />
                {chanView === "share" ? (
                  <BarList rows={channels} />
                ) : (
                  <>
                    {showCompare && <PairLegend kind="line" {...periodNames} />}
                    <MiniMultiples panels={channelPanels} fmt={formatMoney} caption={(max) => t("mode.sameScale", { max })} />
                    {seriesTable(
                      t("channels.title"),
                      o.channelSeries.map((c) => ({ label: t(`channels.${c.channel}` as never), series: c.series, fmt: formatMoney })),
                    )}
                  </>
                )}
              </>
            )}
          </Section>
          <Section id="counters" title={t("counters.title")} summary={sum.counters} info={t("info.counters")} view={{ href: "/orders", where: tn("orders") }}>
            {empty ? <Empty>{t("counters.empty")}</Empty> : <PairedBars rows={counters} nowLabel={nowText} thenLabel={rangeText} />}
          </Section>
        </Col>

        <Col>
          <Section id="tickets" title={t("tickets.title")} summary={sum.tickets} info={t("info.tickets")} view={{ href: "/catalog", where: tn("catalog") }}>
            {tickets.length === 0 ? <Empty>{t("tickets.empty")}</Empty> : <PairedBars rows={tickets} nowLabel={nowText} thenLabel={rangeText} />}
          </Section>

          <Section id="pay" title={t("pay.title")} summary={sum.pay} info={t("info.pay")} view={{ href: "/finances", where: tn("finances") }}>
            {pay.length === 0 ? (
              <Empty>{t("pay.empty")}</Empty>
            ) : (
              <>
                <Segmented
                  value={payView}
                  onChange={setPayView}
                  label={t("mode.label")}
                  options={[
                    { value: "share", label: t("mode.share") },
                    { value: "time", label: t("mode.time") },
                  ]}
                />
                {payView === "share" ? (
                  <BarList rows={pay} />
                ) : (
                  <>
                    {showCompare && <PairLegend kind="line" {...periodNames} />}
                    <MiniMultiples panels={payPanels} fmt={formatMoney} caption={(max) => t("mode.sameScale", { max })} />
                    {seriesTable(
                      t("pay.title"),
                      o.paymentSeries.map((m) => ({ label: enumL.method(m.method), series: m.series, fmt: formatMoney })),
                    )}
                  </>
                )}
              </>
            )}
          </Section>
        </Col>
      </Grid>
      </Group>

      <GroupHeading id="visitors">{t("sections.visitors")}</GroupHeading>

      <Group>
      <Grid>
        <Section id="visitors" title={t("visitors.title")} summary={sum.visitors} info={t("info.visitors")} view={{ href: "/calendar", where: tn("calendar") }}>
          {v.total === 0 ? (
            <Empty>{emptyWithEarlier(t("visitors.empty"), v.previousTotal, guestsText)}</Empty>
          ) : (
            <>
              <Headline
                value={num(v.total)}
                label={t("visitors.label")}
                change={change(v.total, v.previousTotal ?? undefined)}
                was={showCompare && v.previousTotal !== null ? t("was", { value: guestsText(v.previousTotal), range: rangeText }) : undefined}
              />
              <AreaChart
                points={chartPoints(v.series)}
                fmt={guestsText}
                fmtAxis={num}
                height={wide ? 190 : 150}
                valueLabel={showCompare ? nowText : t("visitors.series")}
                compareLabel={rangeText}
                compareDashed
                grid="solid"
                integer
                legendKeys
                tooltipDelta={tooltipDelta}
              />
              {seriesTable(t("visitors.title"), [{ label: t("visitors.series"), series: v.series, fmt: guestsText }])}
            </>
          )}
        </Section>

        <Section id="checkins" title={t("checkins.title")} summary={sum.checkins} info={t("info.checkins")} view={{ href: "/calendar", where: tn("calendar") }}>
          {ci.total === 0 ? (
            <Empty>
              {emptyWithEarlier(t("checkins.empty"), ci.previousTotal, (n) => t("checkins.n", { n, c: num(n) }))}
              {ci.due > 0 && ` ${t("checkins.dueNone", { due: ci.due, dueC: num(ci.due) })}`}
            </Empty>
          ) : (
            <>
              <Headline
                value={
                  <>
                    {t("checkins.headline", { came: num(ci.total), due: ci.due, dueC: num(ci.due) })}
                    {rate !== null && <span className="font-normal text-muted"> ({percent(rate)})</span>}
                  </>
                }
                label={t("checkins.label")}
                change={rateChange}
                was={
                  showCompare && prevRate !== null && ci.previousDue !== null && ci.previousTotal !== null
                    ? t("checkins.was", { pct: percent(prevRate), came: num(ci.previousTotal), due: num(ci.previousDue), range: rangeText })
                    : undefined
                }
              />
              <AreaChart
                points={chartPoints(ci.series)}
                fmt={(n) => t("checkins.n", { n, c: num(n) })}
                fmtAxis={num}
                height={wide ? 190 : 150}
                valueLabel={showCompare ? nowText : t("checkins.series")}
                compareLabel={rangeText}
                compareDashed
                grid="solid"
                integer
                legendKeys
                tooltipDelta={tooltipDelta}
              />
              {seriesTable(t("checkins.title"), [{ label: t("checkins.series"), series: ci.series, fmt: (n) => t("checkins.n", { n, c: num(n) }) }])}
            </>
          )}
        </Section>

        <Section id="customers" title={t("customers.title")} summary={sum.customers} info={t("info.customers")} view={{ href: "/customers", where: tn("customers") }}>
          {named === 0 ? (
            <Empty>{emptyWithEarlier(t("customers.empty"), gp ? gp.newCustomers + gp.returning : null, (n) => t("customers.n", { n, c: num(n) }))}</Empty>
          ) : (
            <>
              <dl className="mb-comfortable grid grid-cols-3 gap-section">
                <Stat label={t("customers.new")} value={num(g.newCustomers)} change={change(g.newCustomers, gp?.newCustomers)} />
                <Stat label={t("customers.returning")} value={num(g.returning)} change={change(g.returning, gp?.returning)} />
                <Stat label={t("customers.all")} value={num(named)} change={change(named, gp ? gp.newCustomers + gp.returning : undefined)} />
              </dl>
              <SwatchLegend
                items={[
                  { label: t("customers.new"), color: "var(--chart-1)" },
                  { label: t("customers.returning"), color: "var(--chart-2)" },
                ]}
              />
              <StackedColumns
                points={customerPoints}
                series={[
                  { label: t("customers.returning"), color: "var(--chart-2)" },
                  { label: t("customers.new"), color: "var(--chart-1)" },
                ]}
                ariaLabel={t("customers.aria")}
                valueText={(s, n) => (s === 0 ? t("customers.returningN", { n, c: num(n) }) : t("customers.newN", { n, c: num(n) }))}
              />
              <TableTwin
                caption={t("customers.title")}
                head={[t("table.point"), t("customers.new"), t("customers.returning")]}
                rows={o.customers.map((p) => [pointTitle(p.key), p.newCustomers, p.returning])}
              />
            </>
          )}
        </Section>

        <Section id="guests" title={t("guests.title")} summary={sum.guests} info={t("info.guests")} view={{ href: "/calendar", where: tn("calendar") }} className="self-start">
          {g.guests === 0 ? (
            <Empty>{t("guests.empty")}</Empty>
          ) : (
            <div>
              <dl className="grid grid-cols-2 gap-section">
                <Stat label={t("guests.arrived")} value={num(g.arrived)} change={change(g.arrived, gp?.arrived)} />
                <Stat label={t("guests.noShows")} value={num(g.noShows)} change={change(g.noShows, gp?.noShows, "down")} />
              </dl>
              <SplitBar a={g.arrived} b={g.noShows} label={t("guests.attendance")} />
            </div>
          )}
        </Section>
      </Grid>
      </Group>

      <GroupHeading id="timing">{t("sections.timing")}</GroupHeading>

      <Group>
      <Section
        id="busy"
        title={t("heat.title")}
        summary={sum.busy}
        info={t("info.busy")}
        sub={
          peak ? (
            <>
              {t("heat.busiest", { day: longDays[peak.row], time: hourText(hours[peak.col]) })}
              {showCompare && ` · ${t("heat.periodOnly")}`}
            </>
          ) : showCompare ? (
            t("heat.periodOnly")
          ) : undefined
        }
        view={{ href: "/calendar", where: tn("calendar") }}
      >
        {!peak ? (
          <Empty>{t("heat.empty")}</Empty>
        ) : (
          <HeatmapChart
            rowLabels={shortDays}
            colLabels={hours.map(hourText)}
            cells={heatCells}
            cellText={(r, c, n) => t("heat.tip", { day: shortDays[r], time: hourText(hours[c]), guests: guestsText(n) })}
            ariaLabel={t("heat.aria")}
            hint={t("heat.hint")}
            caption={t("heat.caption")}
            legend={{ fewer: t("heat.fewer"), more: t("heat.more") }}
          />
        )}
      </Section>

      <Section
        id="timeslots"
        title={t("slots.title")}
        summary={sum.slots}
        info={t("info.timeslots")}
        sub={
          slotPeak ? (
            <>
              {t("slots.busiest", { name: ts.rows[slotPeak.row].name, time: formatClock(ts.times[slotPeak.col]), guests: guestsText(slotPeak.guests) })}
              {showCompare && ` · ${t("heat.periodOnly")}`}
            </>
          ) : showCompare ? (
            t("heat.periodOnly")
          ) : undefined
        }
        view={{ href: "/calendar", where: tn("calendar") }}
      >
        {!slotPeak ? (
          <Empty>{t("slots.empty")}</Empty>
        ) : (
          <HeatmapChart
            rowLabels={ts.rows.map((r) => r.name)}
            colLabels={ts.times.map((x) => formatClock(x, { short: true }))}
            cells={slotCells}
            cellText={slotText}
            ariaLabel={t("slots.aria")}
            hint={t("slots.hint")}
            caption={t("slots.caption")}
            legend={{ fewer: t("heat.fewer"), more: t("heat.more") }}
            labelEvery={1}
            rowLabelWidth={wide ? 176 : 120}
            colMinWidth={56}
            cellHeight={36}
            longRowLabels
            colMaxWidth={104}
          />
        )}
      </Section>

      <Grid>
        <Section id="lead" title={t("lead.title")} summary={sum.lead} info={t("info.lead")}>
          {empty ? <Empty>{t("lead.empty")}</Empty> : <ColumnBars items={lead} />}
        </Section>

        <Section id="full" title={t("full.title")} summary={sum.full} info={t("info.full")} view={{ href: "/calendar", where: tn("calendar") }}>
          {cap.length === 0 ? (
            <Empty>{t("full.empty")}</Empty>
          ) : (
            <>
              <BarList
                rows={capShown.map((c) => ({
                  key: c.productId,
                  label: c.name,
                  value: c.filled,
                  figure: <Figure main={t("full.of", { sold: num(c.sold), capacity: num(c.capacity) })} share={percent(c.filled)} />,
                  tick: showCompare ? c.previousFilled : undefined,
                  change:
                    showCompare && c.previousFilled !== undefined ? (
                      <span className="ml-tight text-[0.75rem] text-muted">{t("full.was", { pct: percent(c.previousFilled) })}</span>
                    ) : undefined,
                }))}
              />
              {cap.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllCap(!showAllCap)}
                  aria-expanded={showAllCap}
                  className="mt-comfortable flex min-h-11 items-center text-[0.8125rem] font-medium text-brand-foreground hover:underline sm:min-h-0"
                >
                  {showAllCap ? t("full.showFewer") : t("full.showAll", { n: cap.length })}
                </button>
              )}
            </>
          )}
        </Section>
      </Grid>
      </Group>

      <GroupHeading id="vat">{t("sections.vat")}</GroupHeading>

      <Group>
      <Section
        id="vat"
        title={t("vat.title")}
        sub={t("vat.note")}
        summary={sum.vat}
        actions={
          <Button variant="secondary" size="sm" icon={<Download size={16} strokeWidth={1.75} aria-hidden />} onClick={downloadVat} disabled={o.tax.rows.length === 0} className="shrink-0">
            {t("vat.download")}
          </Button>
        }
      >
        {o.tax.rows.length === 0 ? (
          <Empty>{t("vat.empty")}</Empty>
        ) : (
          <div className="scroll-x-hint -mx-card overflow-x-auto px-card">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-hairline text-[0.75rem] font-medium text-muted">
                  <th scope="col" className="py-tight pr-comfortable text-left font-medium">{t("vat.class")}</th>
                  <th scope="col" className="py-tight pr-comfortable text-right font-medium">{t("vat.rate")}</th>
                  <th scope="col" className="py-tight pr-comfortable text-right font-medium">{t("vat.net")}</th>
                  <th scope="col" className="py-tight pr-comfortable text-right font-medium">{t("vat.vat")}</th>
                  <th scope="col" className="py-tight pr-comfortable text-right font-medium">{t("vat.gross")}</th>
                  <th scope="col" className="py-tight text-right font-medium">{t("vat.lines")}</th>
                </tr>
              </thead>
              <tbody>
                {o.tax.rows.map((r) => (
                  <tr key={`${r.taxClass}-${r.rate}`} data-vat-row className="border-b border-hairline">
                    <th scope="row" className="py-comfortable pr-comfortable text-left font-normal">{enumL.tax(r.taxClass)}</th>
                    <td className="py-comfortable pr-comfortable text-right">{rate_(r.rate)}</td>
                    <td className="py-comfortable pr-comfortable text-right" data-net={r.net}>{formatMoney(r.net)}</td>
                    <td className="py-comfortable pr-comfortable text-right" data-vat={r.tax}>{formatMoney(r.tax)}</td>
                    <td className="py-comfortable pr-comfortable text-right" data-gross={r.gross}>{formatMoney(r.gross)}</td>
                    <td className="py-comfortable text-right">{num(r.lineCount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr data-vat-total className="font-semibold">
                  <th scope="row" className="py-comfortable pr-comfortable text-left font-semibold">{t("vat.total")}</th>
                  <td className="py-comfortable pr-comfortable" />
                  <td className="py-comfortable pr-comfortable text-right" data-net={o.tax.net}>{formatMoney(o.tax.net)}</td>
                  <td className="py-comfortable pr-comfortable text-right" data-vat={o.tax.tax}>{formatMoney(o.tax.tax)}</td>
                  <td className="py-comfortable pr-comfortable text-right" data-gross={o.tax.gross}>{formatMoney(o.tax.gross)}</td>
                  <td className="py-comfortable text-right">{num(lines)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>
      </Group>
    </>
  );
}

/** Shaped like the cards, for the first load only. */
export function Skeletons() {
  return (
    <>
      <div className="pt-tight" aria-hidden>
        <Pulse className="h-3 w-16" />
      </div>
      <CardSkeleton tall={210} />
      <div className="grid gap-section lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton tall={300} />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
      <div className="pt-tight" aria-hidden>
        <Pulse className="h-3 w-16" />
      </div>
      <div className="grid gap-section lg:grid-cols-2">
        <CardSkeleton tall={190} />
        <CardSkeleton tall={190} />
        <CardSkeleton tall={190} />
        <CardSkeleton rows={2} />
      </div>
      <div className="pt-tight" aria-hidden>
        <Pulse className="h-3 w-16" />
      </div>
      <CardSkeleton tall={7 * 30} />
      <CardSkeleton tall={150} />
      <div className="grid gap-section lg:grid-cols-2">
        <CardSkeleton tall={150} />
        <CardSkeleton rows={4} />
      </div>
    </>
  );
}
