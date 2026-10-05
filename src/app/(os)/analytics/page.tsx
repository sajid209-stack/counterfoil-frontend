"use client";

import { Suspense, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import {
  AreaChart,
  Button,
  DateRangePicker,
  DeltaPill,
  HeatmapChart,
  PageShell,
  StatStrip,
  formatRange,
  type ChartPoint,
  type StatItem,
} from "@/components/ui";
import { Switch } from "@/app/(os)/settings/_components/SettingsKit";
import { analyticsCsv, getAnalyticsOverview, listLocations, type AnalyticsOverview } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClock, formatDay, formatMoney, formatMoneyCompact } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { BarList, CardSkeleton, ColumnBars, Empty, Figure, Pulse, Section, SplitBar } from "./_components/Parts";

/* ── The page, in the order a manager asks ─────────────────────────────────
 *
 * One line for the period and the comparison, a band of six figures, one hero
 * chart, then a grid of small cards that each answer one question and say so in
 * their title. The research is the obvious one (Stripe, Shopify and Square all
 * lead an analytics overview this way) and so is the discipline: a card is a
 * question, an answer and one small chart, and nothing in it is there because a
 * chart library could draw it.
 *
 * State (period, comparison) lives in the address, so a view is a link.
 */

const NOW = DEMO_TODAY;
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10);
const monthStart = (d: string) => `${d.slice(0, 8)}01`;
const lastMonth = (): [string, string] => {
  const end = shift(monthStart(NOW), -1);
  return [monthStart(end), end];
};

const PRESETS: { value: string; range: () => [string, string] }[] = [
  { value: "today", range: () => [NOW, NOW] },
  { value: "yesterday", range: () => [shift(NOW, -1), shift(NOW, -1)] },
  { value: "7d", range: () => [shift(NOW, -6), NOW] },
  { value: "30d", range: () => [shift(NOW, -29), NOW] },
  { value: "month", range: () => [monthStart(NOW), NOW] },
  { value: "lastmonth", range: lastMonth },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (n: number) => n.toLocaleString("en-US");
/** Whole percent from 10% up; one decimal below it, so a small share is not
 *  rounded to a "0%" that reads as nothing at all. */
const percent = (f: number) => {
  if (f <= 0) return "0%";
  if (f < 0.001) return "<0.1%";
  if (f < 0.1) return `${Math.round(f * 1000) / 10}%`;
  return `${Math.round(f * 100)}%`;
};
const pad2 = (n: number) => String(n).padStart(2, "0");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const major = (minor: number) => (minor / 100).toFixed(2);

function saveCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsInner />
    </Suspense>
  );
}

function AnalyticsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("analytics");
  const tc = useTranslations("common");

  // Address → state, once: a shared link opens on the same view.
  const [range, setRange] = useState(() => {
    const preset = params.get("preset") ?? "30d";
    const from = params.get("from");
    const to = params.get("to");
    if (preset === "custom" && from && to && ISO.test(from) && ISO.test(to) && from <= to) return { preset, from, to };
    const p = PRESETS.find((x) => x.value === preset) ?? PRESETS[3];
    const [f, e] = p.range();
    return { preset: p.value, from: f, to: e };
  });
  const [compare, setCompare] = useState(() => params.get("compare") !== "0");

  // State → address. replace, so the back button is not spammed.
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("preset", range.preset);
    if (range.preset === "custom") {
      p.set("from", range.from);
      p.set("to", range.to);
    }
    if (!compare) p.set("compare", "0");
    router.replace(`/analytics?${p.toString()}`, { scroll: false });
  }, [range, compare, router]);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: venueId, location } = useActiveLocation(locationsQ.data?.data ?? []);

  const q = useApiQuery(
    () =>
      venueId
        ? getAnalyticsOverview({ locationId: venueId, from: range.from, to: range.to, compare })
        : new Promise<Awaited<ReturnType<typeof getAnalyticsOverview>>>(() => {}),
    [venueId, range.from, range.to, compare],
  );
  // Content stays while a new period loads; a skeleton is for the first load.
  const o = q.data;
  const first = !o && !q.error;
  const venueName = location ? slugify(location.name) || location.id : venueId;

  const rangeLabels = {
    choose: t("range.choose"),
    custom: t("range.custom"),
    from: t("range.from"),
    to: t("range.to"),
    apply: t("range.apply"),
    cancel: t("range.cancel"),
    previousMonth: tc("previousMonth"),
    nextMonth: tc("nextMonth"),
    days: (count: number) => t("range.days", { count }),
    pickEnd: t("range.pickEnd"),
  };

  const downloadAll = () => {
    if (o) saveCsv(`analytics-${venueName}-${range.from}_${range.to}.csv`, analyticsCsv(o));
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-section gap-y-tight">
      <DateRangePicker
        value={range}
        onChange={(r) => setRange({ preset: r.preset, from: r.from, to: r.to })}
        presets={PRESETS.map((p) => ({ ...p, label: t(`presets.${p.value}` as never) }))}
        today={NOW}
        max={NOW}
        labels={rangeLabels}
        className="w-full shrink-0 md:w-auto"
      />
      <div className="flex min-w-0 flex-1 items-center gap-section">
        <div className="flex items-center gap-tight">
          <Switch checked={compare} onChange={setCompare} labelledBy="an-compare" />
          <span id="an-compare" onClick={() => setCompare(!compare)} className="cursor-pointer select-none text-[0.8125rem]">
            {t("toolbar.compare")}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={16} strokeWidth={1.75} aria-hidden />}
          onClick={downloadAll}
          disabled={!o}
          className="ml-auto max-md:w-11 max-md:px-0"
        >
          <span className="max-md:sr-only">{t("toolbar.download")}</span>
        </Button>
      </div>
    </div>
  );

  if (q.error && !o) {
    return (
      <PageShell title={t("title")} description={t("description")}>
        <div className="flex flex-col gap-section">
          {toolbar}
          <div className="card-surface p-card">
            <p className="text-[0.8125rem]">{t("error")}</p>
            <Button variant="secondary" size="sm" className="mt-comfortable" onClick={q.reload}>
              {t("retry")}
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        {toolbar}
        {o && compare && o.previous === null && <p className="text-[0.75rem] text-muted">{t("noCompare")}</p>}

        <StatStrip variant="band" columns={3} loading={first} items={o ? kpiItems(o, t, !compare) : placeholderItems(t)} />

        {first ? <Skeletons /> : o && <Cards o={o} compare={compare} venueName={venueName} />}
      </div>
    </PageShell>
  );

}

function Cards({ o, compare, venueName }: { o: AnalyticsOverview; compare: boolean; venueName: string }) {
  const t = useTranslations("analytics");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const enumL = useEnumLabels();
  const wide = useMediaQuery(MD);
  const [showAllCap, setShowAllCap] = useState(false);

  const empty = o.kpis.orders.value === 0;
  const showCompare = compare && o.previous !== null;

  // ── revenue over time ──
  const points: ChartPoint[] = o.revenue.map((p) => {
    const week = (key: string) => formatDay(key);
    const label =
      o.granularity === "hour"
        ? formatClock(p.key, { short: true })
        : o.granularity === "week"
          ? wide
            ? t("revenue.weekOf", { day: week(p.key) })
            : week(p.key)
          : formatDay(p.key);
    const title =
      o.granularity === "hour"
        ? formatClock(p.key)
        : o.granularity === "week"
          ? t("revenue.weekOf", { day: week(p.key) })
          : formatDay(p.key, { weekday: true });
    return { label, title, value: p.value, compare: showCompare ? p.previous : undefined };
  });

  // ── what sells ──
  const sells = o.topBookings.map((b) => ({
    key: String(b.productId),
    label: b.productId === "other" ? t("sells.other") : b.name,
    value: b.revenue,
    figure: <Figure main={formatMoney(b.revenue)} share={percent(b.share)} />,
    muted: b.productId === "other",
  }));

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
          {t("counts.orders", { n: c.orders, c: num(c.orders) })}
          {" · "}
          {percent(c.share)}
        </span>
      </>
    ),
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
  const guestsText = (n: number) => t("counts.guests", { n, c: num(n) });

  // ── how full ──
  const cap = [...o.capacity].sort((a, b) => b.filled - a.filled);
  const capShown = showAllCap ? cap : cap.slice(0, 6);

  // ── how people pay ──
  const pay = o.payments.map((p) => ({
    key: p.method,
    label: enumL.method(p.method),
    value: p.amount,
    figure: <Figure main={formatMoney(p.amount)} share={percent(p.share)} />,
  }));

  // ── how far ahead ──
  const lead = o.leadTime.map((l) => {
    const label = t(`lead.${l.bucket}` as never);
    return {
      key: l.bucket,
      label,
      value: l.share,
      figure: percent(l.share),
      title: t("lead.share", { bucket: label, orders: t("counts.orders", { n: l.orders, c: num(l.orders) }), pct: Math.round(l.share * 100) }),
    };
  });

  // ── guests ──
  const g = o.guests;

  // ── VAT ──
  const rate = (r: number) => `${Math.round(r * 1000) / 10}%`;
  const downloadVat = () => {
    const rows: (string | number)[][] = [
      [t("vat.class"), t("vat.rate"), t("vat.net"), t("vat.vat"), t("vat.gross"), t("vat.lines")],
      ...o.tax.rows.map((r) => [r.taxClass, rate(r.rate), major(r.net), major(r.tax), major(r.gross), r.lineCount]),
      [t("vat.total"), "", major(o.tax.net), major(o.tax.tax), major(o.tax.gross), o.tax.rows.reduce((s, r) => s + r.lineCount, 0)],
    ];
    saveCsv(`vat-${venueName}-${o.from}_${o.to}.csv`, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
  };
  const lines = o.tax.rows.reduce((s, r) => s + r.lineCount, 0);

  return (
    <>
      <Section id="revenue" title={t("revenue.title")} sub={formatRange(o.from, o.to)}>
        {empty ? (
          <Empty>{t("revenue.empty")}</Empty>
        ) : (
          <AreaChart
            points={points}
            fmt={(v) => formatMoney(v)}
            fmtAxis={(v) => formatMoneyCompact(v)}
            height={210}
            valueLabel={t("revenue.series")}
            compareLabel={t("revenue.previous")}
            compareDashed
          />
        )}
      </Section>

      <div className="grid gap-section lg:grid-cols-2">
        <Section id="sells" title={t("sells.title")} view={{ href: "/catalog", where: tn("catalog") }}>
          {sells.length === 0 ? <Empty>{t("sells.empty")}</Empty> : <BarList rows={sells} />}
        </Section>

        <Section id="channels" title={t("channels.title")} view={{ href: "/orders", where: tn("orders") }}>
          {empty ? <Empty>{t("channels.empty")}</Empty> : <BarList rows={channels} />}
        </Section>

        <Section
          id="busy"
          title={t("heat.title")}
          sub={peak ? t("heat.busiest", { day: longDays[peak.row], time: hourText(hours[peak.col]) }) : undefined}
          view={{ href: "/calendar", where: tn("calendar") }}
          className="lg:col-span-2"
        >
          {!peak ? (
            <Empty>{t("heat.empty")}</Empty>
          ) : (
            <HeatmapChart
              rowLabels={shortDays}
              colLabels={hours.map(hourText)}
              cells={heatCells}
              cellText={(r, c, v) => t("heat.tip", { day: shortDays[r], time: hourText(hours[c]), guests: guestsText(v) })}
              ariaLabel={t("heat.aria")}
              hint={t("heat.hint")}
              caption={t("heat.caption")}
              legend={{ fewer: t("heat.fewer"), more: t("heat.more") }}
            />
          )}
        </Section>

        <Section id="full" title={t("full.title")} view={{ href: "/calendar", where: tn("calendar") }}>
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

        <Section id="pay" title={t("pay.title")} view={{ href: "/finances", where: tn("finances") }}>
          {pay.length === 0 ? <Empty>{t("pay.empty")}</Empty> : <BarList rows={pay} />}
        </Section>

        <Section id="lead" title={t("lead.title")}>
          {empty ? <Empty>{t("lead.empty")}</Empty> : <ColumnBars items={lead} />}
        </Section>

        <Section id="guests" title={t("guests.title")} view={{ href: "/customers", where: tn("customers") }}>
          {g.guests === 0 && g.newCustomers + g.returning === 0 ? (
            <Empty>{t("guests.empty")}</Empty>
          ) : (
            <div className="flex flex-col gap-section">
              <div>
                <dl className="grid grid-cols-2 gap-section">
                  <Stat label={t("guests.arrived")} value={num(g.arrived)} />
                  <Stat label={t("guests.noShows")} value={num(g.noShows)} />
                </dl>
                <SplitBar a={g.arrived} b={g.noShows} label={t("guests.attendance")} />
              </div>
              <div>
                <dl className="grid grid-cols-2 gap-section">
                  <Stat label={t("guests.newCustomers")} value={num(g.newCustomers)} />
                  <Stat label={t("guests.returning")} value={num(g.returning)} />
                </dl>
                <SplitBar a={g.newCustomers} b={g.returning} label={t("guests.loyalty")} />
              </div>
            </div>
          )}
        </Section>
      </div>

      <section data-card="vat" aria-labelledby="an-vat" className="card-surface min-w-0 p-card">
        <div className="mb-comfortable flex items-start justify-between gap-tight">
          <div className="min-w-0">
            <h2 id="an-vat" className="text-base font-semibold tracking-[-0.4px]">
              {t("vat.title")}
            </h2>
            <p className="mt-inline text-[0.75rem] text-muted">{t("vat.note")}</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Download size={16} strokeWidth={1.75} aria-hidden />} onClick={downloadVat} disabled={o.tax.rows.length === 0} className="shrink-0">
            {t("vat.download")}
          </Button>
        </div>
        {o.tax.rows.length === 0 ? (
          <Empty>{t("vat.empty")}</Empty>
        ) : (
          <div className="scroll-x-hint -mx-card overflow-x-auto px-card">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.75rem] font-medium text-muted">
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
                    <td className="py-comfortable pr-comfortable text-right">{rate(r.rate)}</td>
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
      </section>
    </>
  );
}

/** A label over a figure, in a definition list. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.75rem] text-muted">{label}</dt>
      <dd className="type-figure text-xl font-semibold">{value}</dd>
    </div>
  );
}

/** Six figures, with a change against the period before where there is one. */
function kpiItems(o: AnalyticsOverview, t: ReturnType<typeof useTranslations>, off: boolean): StatItem[] {
  const k = o.kpis;
  const since = t("vsPrev");
  const delta = (kpi: { value: number; previous: number | null }, goodWhen: "up" | "down" = "up") =>
    !off && kpi.previous !== null ? <DeltaPill now={kpi.value} then={kpi.previous} goodWhen={goodWhen} since={since} /> : undefined;
  return [
    {
      key: "revenue",
      label: t("kpi.revenue"),
      note: t("kpi.revenueNote"),
      value: (
        <>
          {formatMoney(k.revenue.value)}
          <span className="sr-only">. {t("kpi.revenueNote")}</span>
        </>
      ),
      delta: delta(k.revenue),
    },
    { key: "orders", label: t("kpi.orders"), value: num(k.orders.value), delta: delta(k.orders) },
    { key: "average", label: t("kpi.average"), value: formatMoney(k.averageOrder.value), delta: delta(k.averageOrder) },
    { key: "guests", label: t("kpi.guests"), value: num(k.guests.value), delta: delta(k.guests) },
    { key: "capacity", label: t("kpi.capacity"), value: percent(k.capacityFilled.value), delta: delta(k.capacityFilled) },
    { key: "refunds", label: t("kpi.refunds"), value: formatMoney(k.refunds.value), delta: delta(k.refunds, "down") },
  ];
}

function placeholderItems(t: ReturnType<typeof useTranslations>): StatItem[] {
  return ["revenue", "orders", "average", "guests", "capacity", "refunds"].map((k) => ({ key: k, label: t(`kpi.${k}` as never), value: "" }));
}

/** Shaped like the cards, for the first load only. */
function Skeletons() {
  return (
    <>
      <CardSkeleton tall={210} />
      <div className="grid gap-section lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton rows={3} />
        <CardSkeleton tall={7 * 30} className="lg:col-span-2" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton tall={150} />
        <CardSkeleton rows={4} />
      </div>
      <div className="card-surface p-card" aria-hidden>
        <Pulse className="mb-section h-4 w-48" />
        <Pulse className="h-24 w-full" />
      </div>
    </>
  );
}
