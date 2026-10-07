"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button, DateRangePicker, DeltaPill, PageShell, StatStrip, formatRange, type StatItem } from "@/components/ui";
import { analyticsCsv, comparisonRange, getAnalyticsOverview, listLocations, type AnalyticsOverview } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";
import { formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { ComparePicker, type CompareValue } from "./_components/ComparePicker";
import { Cards, Skeletons } from "./_components/Cards";
import { num, percent, saveCsv, slugify } from "./_components/helpers";

/* ── The page, in the order a manager asks ─────────────────────────────────
 *
 * One line for the period and the comparison, a band of six figures, one hero
 * chart, then a grid of small cards that each answer one question and say so in
 * their title. The research is the obvious one (Stripe, Shopify and Square all
 * lead an analytics overview this way) and so is the discipline: a card is a
 * question, an answer and one small chart, and nothing in it is there because a
 * chart library could draw it.
 *
 * State (period, comparison) lives in the address, so a view is a link:
 * `preset` (and `from`/`to` for a drawn range), `cmp` = previous | year |
 * custom | none (and `cfrom`/`cto` for a drawn comparison). The first
 * version's `compare=0` and `compare=1` still open as none and previous.
 *
 * The default is Last 7 days against the 7 before. It is not Last 30 days,
 * because the demo ledger is 31 days long: 30 days against the 30 before
 * needs 60 days of records and could never compare, so the page would open on
 * a "no comparison" line. A venue with a year of orders can change this.
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
    const preset = params.get("preset") ?? "7d";
    const from = params.get("from");
    const to = params.get("to");
    if (preset === "custom" && from && to && ISO.test(from) && ISO.test(to) && from <= to) return { preset, from, to };
    const p = PRESETS.find((x) => x.value === preset) ?? PRESETS[2];
    const [f, e] = p.range();
    return { preset: p.value, from: f, to: e };
  });
  const [cmp, setCmp] = useState<CompareValue>(() => {
    const m = params.get("cmp");
    const cf = params.get("cfrom");
    const ct = params.get("cto");
    if (m === "custom" && cf && ct && ISO.test(cf) && ISO.test(ct) && cf <= ct) return { mode: "custom", from: cf, to: ct };
    if (m === "year" || m === "none" || m === "previous") return { mode: m };
    return { mode: params.get("compare") === "0" ? "none" : "previous" };
  });

  // State → address. replace, so the back button is not spammed.
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("preset", range.preset);
    if (range.preset === "custom") {
      p.set("from", range.from);
      p.set("to", range.to);
    }
    p.set("cmp", cmp.mode);
    if (cmp.mode === "custom" && cmp.from && cmp.to) {
      p.set("cfrom", cmp.from);
      p.set("cto", cmp.to);
    }
    router.replace(`/analytics?${p.toString()}`, { scroll: false });
  }, [range, cmp, router]);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id: venueId, location } = useActiveLocation(locationsQ.data?.data ?? []);

  const q = useApiQuery(
    () =>
      venueId
        ? getAnalyticsOverview({
            locationId: venueId,
            from: range.from,
            to: range.to,
            compare: cmp.mode,
            compareFrom: cmp.from,
            compareTo: cmp.to,
          })
        : new Promise<Awaited<ReturnType<typeof getAnalyticsOverview>>>(() => {}),
    [venueId, range.from, range.to, cmp.mode, cmp.from, cmp.to],
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
    <div className="flex flex-wrap items-center gap-x-comfortable gap-y-tight">
      <DateRangePicker
        value={range}
        onChange={(r) => setRange({ preset: r.preset, from: r.from, to: r.to })}
        presets={PRESETS.map((p) => ({ ...p, label: t(`presets.${p.value}` as never) }))}
        today={NOW}
        max={NOW}
        labels={rangeLabels}
        className="w-full shrink-0 md:w-auto"
      />
      <div className="flex min-w-0 flex-1 items-center gap-tight md:gap-comfortable">
        <ComparePicker
          value={cmp}
          from={range.from}
          to={range.to}
          ledgerStart={o?.ledgerStart}
          today={NOW}
          onChange={setCmp}
          calendarLabels={rangeLabels}
          className="min-w-0 flex-1 md:flex-none"
        />
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

  // A comparison that was asked for but could not be drawn, and what to offer instead.
  const asked = o !== undefined && o.compare !== "none";
  const prevAsk = o ? comparisonRange("previous", o.from, o.to) : null;
  const previousFits = !!(o && o.ledgerStart && prevAsk && prevAsk.from >= o.ledgerStart);

  const notices = o && (
    <>
      {o.previous && (
        <p data-legend className="flex flex-wrap items-center gap-x-section gap-y-inline text-[0.75rem] text-muted">
          <span className="flex items-center gap-tight">
            <svg width="20" height="4" aria-hidden className="shrink-0">
              <line x1="0" x2="20" y1="2" y2="2" stroke="var(--color-ember)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="sr-only">{t("legend.solid")} </span>
            <span className="font-medium tabular-nums text-fg">{formatRange(o.from, o.to)}</span>
          </span>
          <span className="flex items-center gap-tight">
            <svg width="20" height="4" aria-hidden className="shrink-0">
              <line x1="0" x2="20" y1="2" y2="2" stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            <span className="sr-only">{t("legend.dashed")} </span>
            <span className="tabular-nums text-fg">{formatRange(o.previous.from, o.previous.to)}</span>
          </span>
        </p>
      )}
      {asked && o.previous === null && (
        <p data-no-compare className="flex flex-wrap items-center gap-x-comfortable gap-y-tight text-[0.8125rem] text-muted">
          <span>{o.ledgerStart ? t("noCompare", { date: formatDay(o.ledgerStart) }) : t("noCompareEmpty")}</span>
          {previousFits && o.compare !== "previous" && (
            <Button variant="secondary" size="sm" onClick={() => setCmp({ mode: "previous" })}>
              {t("compareWithPrevious")}
            </Button>
          )}
        </p>
      )}
    </>
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
        {notices}

        <StatStrip variant="band" columns={3} wideColumns={6} loading={first} items={o ? kpiItems(o, t) : placeholderItems(t)} />

        {first ? <Skeletons /> : o && <Cards o={o} venueName={venueName} />}
      </div>
    </PageShell>
  );

}

/** Six figures; against the comparison, each carries its change and the figure it is measured against. */
function kpiItems(o: AnalyticsOverview, t: ReturnType<typeof useTranslations>): StatItem[] {
  const k = o.kpis;
  const since = o.previous ? t("vs", { range: formatRange(o.previous.from, o.previous.to) }) : undefined;
  type K = { value: number; previous: number | null };
  const delta = (kpi: K, goodWhen: "up" | "down" = "up") =>
    kpi.previous !== null ? <DeltaPill now={kpi.value} then={kpi.previous} goodWhen={goodWhen} since={since} /> : undefined;
  const was = (kpi: K, fmt: (n: number) => string) => (kpi.previous !== null ? t("vsValue", { value: fmt(kpi.previous) }) : undefined);
  /** Capacity is already a share, so its change is in points of it, not a relative percent. */
  const points = (kpi: K) => {
    if (kpi.previous === null) return undefined;
    const d = Math.round((kpi.value - kpi.previous) * 1000) / 10;
    if (d === 0) return undefined;
    const up = d > 0;
    return (
      <span title={since} className={cn("inline-flex shrink-0 items-center gap-inline rounded-full px-tight py-0.5 text-[0.75rem]", up ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
        {up ? "↗" : "↘"} {t("kpi.pts", { value: `${up ? "+" : "−"}${Math.abs(d)}` })}
        {since && <span className="sr-only">{` ${since}`}</span>}
      </span>
    );
  };
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
      context: was(k.revenue, formatMoney),
    },
    { key: "orders", label: t("kpi.orders"), value: num(k.orders.value), delta: delta(k.orders), context: was(k.orders, num) },
    { key: "average", label: t("kpi.average"), value: formatMoney(k.averageOrder.value), delta: delta(k.averageOrder), context: was(k.averageOrder, formatMoney) },
    { key: "guests", label: t("kpi.guests"), value: num(k.guests.value), delta: delta(k.guests), context: was(k.guests, num) },
    { key: "capacity", label: t("kpi.capacity"), value: percent(k.capacityFilled.value), delta: points(k.capacityFilled), context: was(k.capacityFilled, percent) },
    { key: "refunds", label: t("kpi.refunds"), value: formatMoney(k.refunds.value), delta: delta(k.refunds, "down"), context: was(k.refunds, formatMoney) },
  ];
}

function placeholderItems(t: ReturnType<typeof useTranslations>): StatItem[] {
  return ["revenue", "orders", "average", "guests", "capacity", "refunds"].map((k) => ({ key: k, label: t(`kpi.${k}` as never), value: "" }));
}
