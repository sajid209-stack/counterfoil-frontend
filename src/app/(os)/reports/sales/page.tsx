"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bookmark, ChevronDown, ChevronRight, Download, ListFilter, Plus, Search, Trash2, X } from "lucide-react";
import { DEMO_TODAY } from "@/lib/schedule";
import { AreaChart, BarChart, Button, DateRangePicker, DonutChart, HBarChart, LineChart, Modal, PageShell, StatusPill, Tabs, useToast, FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  getAnalytics,
  getSalesReport,
  getTaxReport,
  getTransactions,
  listCategories,
  listCounters,
  listLocations,
  listOrders,
  listProducts,
  listStaff,
  type SalesGroupBy,
  type TransactionQuery,
  type TransactionRow,
  type TxStatus,
} from "@/lib/api";
import { formatDay, formatMoney, formatMoneyCompact } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";

const NOW = "2026-07-29";
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10);

const PRESETS: { value: string; label: string; range: () => [string, string] }[] = [
  { value: "today", label: "Today", range: () => [NOW, NOW] },
  { value: "yesterday", label: "Yesterday", range: () => [shift(NOW, -1), shift(NOW, -1)] },
  { value: "7d", label: "Last 7", range: () => [shift(NOW, -6), NOW] },
  { value: "30d", label: "Last 30", range: () => [shift(NOW, -29), NOW] },
  { value: "month", label: "This month", range: () => ["2026-07-01", NOW] },
  { value: "lastmonth", label: "Last month", range: () => ["2026-06-01", "2026-06-30"] },
];

/** One CSV cell: quoted when it holds a comma, a quote or a line break, with
 *  quotes doubled — a customer called "Rahman, M." must not become two columns. */
const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");
const major = (minor: number) => (minor / 100).toFixed(2);

// The shared filter set — persists across tabs, encodes into the URL.
interface Filters {
  preset: string;
  from: string;
  to: string;
  locationId?: string;
  counterId?: string;
  staffId?: string;
  productId?: string;
  categoryId?: string;
  method?: string;
  status?: string;
  minA?: string;
  maxA?: string;
  channel?: string;
  customer?: string;
  q?: string;
}
const DEFAULTS: Filters = { preset: "30d", from: shift(NOW, -29), to: NOW };
type FilterKey = keyof Omit<Filters, "preset" | "from" | "to">;
const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: "locationId", label: "Location" },
  { key: "counterId", label: "Counter" },
  { key: "staffId", label: "Team member" },
  { key: "productId", label: "Booking" },
  { key: "categoryId", label: "Category" },
  { key: "method", label: "Payment method" },
  { key: "status", label: "Status" },
  { key: "minA", label: "Min amount" },
  { key: "maxA", label: "Max amount" },
  { key: "channel", label: "Channel" },
  { key: "customer", label: "Customer" },
];

const toQuery = (f: Filters): TransactionQuery => ({
  from: f.from,
  to: f.to,
  locationIds: f.locationId ? [f.locationId] : undefined,
  counterIds: f.counterId ? [f.counterId] : undefined,
  staffIds: f.staffId ? [f.staffId] : undefined,
  productIds: f.productId ? [f.productId] : undefined,
  categoryIds: f.categoryId ? [f.categoryId] : undefined,
  paymentMethods: f.method ? [f.method as TransactionQuery["paymentMethods"] extends (infer U)[] | undefined ? U : never] : undefined,
  status: f.status ? [f.status as TxStatus] : undefined,
  minAmount: f.minA ? Math.round(parseFloat(f.minA) * 100) : undefined,
  maxAmount: f.maxA ? Math.round(parseFloat(f.maxA) * 100) : undefined,
  customerId: f.customer || undefined,
  channel: (f.channel as "counter" | "online") || undefined,
  search: f.q || undefined,
});

export default function SalesReportPage() {
  return (
    <Suspense>
      <SalesReportInner />
    </Suspense>
  );
}

function SalesReportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const enumL = useEnumLabels();

  // URL → state on first load: a filtered view is shareable.
  const [filters, setFilters] = useState<Filters>(() => {
    const f: Filters = { ...DEFAULTS };
    params.forEach((v, k) => { (f as unknown as Record<string, string>)[k] = v; });
    if (f.preset !== "custom") {
      const p = PRESETS.find((x) => x.value === f.preset);
      if (p) [f.from, f.to] = p.range();
    }
    return f;
  });
  /* Opens on the summary, not on 146 individual receipts. A sales report is
     opened to find out how sales are going; the ledger is the raw material for
     that answer rather than the answer, and it is still one tab away — and
     still the tab a ?tab= link can point at. */
  const [tab, setTab] = useState(params.get("tab") ?? "summary");
  const [added, setAdded] = useState<FilterKey[]>(() => FILTER_DEFS.map((d) => d.key).filter((k) => !!(filters as unknown as Record<string, string | undefined>)[k]));

  // State → URL (replace, so back doesn't spam history).
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    router.replace(`/reports/sales?${p.toString()}`, { scroll: false });
  }, [filters, tab, router]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const removeFilter = (k: FilterKey) => { setAdded((a) => a.filter((x) => x !== k)); setFilters((f) => ({ ...f, [k]: undefined })); };
  const clearAll = () => { setAdded([]); setFilters((f) => ({ ...DEFAULTS, preset: f.preset, from: f.from, to: f.to, q: f.q })); };

  // Lookup data for filter controls.
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);

  // ── Outstanding — money owed on partly-paid orders (a "right now" view,
  //    independent of the date range). Ties to the partial-payments flow. ──
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 500 }), []);
  const outstanding = (ordersQ.data?.data ?? [])
    .filter((o) => o.status === "partial")
    .map((o) => ({ o, paid: o.payments.reduce((s, p) => s + p.amount, 0) }))
    .map((x) => ({ ...x, owed: Math.max(0, x.o.total - x.paid) }))
    .filter((x) => x.owed > 0)
    .sort((a, b) => b.owed - a.owed);
  const totalOwed = outstanding.reduce((s, x) => s + x.owed, 0);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);

  // Saved views — name a filter set, restore it later.
  const [views, setViews] = useState<{ name: string; qs: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("report_views") ?? "[]"); } catch { return []; }
  });
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveView = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    const next = [...views.filter((v) => v.name !== viewName.trim()), { name: viewName.trim() || t("savedViews.defaultName", { n: views.length + 1 }), qs: p.toString() }];
    setViews(next);
    localStorage.setItem("report_views", JSON.stringify(next));
    setSaveOpen(false); setViewName("");
    toast.success(t("savedViews.saved"));
  };
  const deleteView = (name: string) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    try {
      localStorage.setItem("report_views", JSON.stringify(next));
    } catch {
      /* private window: gone for this session only */
    }
  };
  const applyView = (qs: string) => {
    const p = new URLSearchParams(qs);
    const f: Filters = { ...DEFAULTS };
    p.forEach((v, k) => { (f as unknown as Record<string, string>)[k] = v; });
    setFilters(f);
    setAdded(FILTER_DEFS.map((d) => d.key).filter((k) => !!(f as unknown as Record<string, string | undefined>)[k]));
  };

  const query = useMemo(() => toQuery(filters), [filters]);

  /* Rows ticked for export. Held per tab and per scope: changing the dates, a
     filter or the grouping is asking a different question, so what was ticked
     for the old one lapses rather than following into a list it is not in.
     Kept by id across pages of the same scope, so ticking on page 1 and page 2
     exports both. */
  const [sel, setSel] = useState<{ sig: string; items: Map<string, unknown> }>({ sig: "", items: new Map() });

  // ── Transactions ──────────────────────────────────────────────────────────
  const [sort, setSort] = useState<{ field: "time" | "amount" | "status"; dir: "asc" | "desc" }>({ field: "time", dir: "desc" });
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const txQ = useApiQuery(
    () => getTransactions({ ...query, sort, cursor: String(cursor), limit: 25 }),
    [JSON.stringify(query), sort.field, sort.dir, cursor],
  );

  /* The whole range, not a page of it: a return is a total, and a report that
     covered only the first 25 rows would be a different number every time
     somebody paged. */
  const taxQ = useApiQuery(() => getTaxReport(query), [JSON.stringify(query)]);

  // ── Summary ──────────────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("product");
  const selSig = `${tab}|${JSON.stringify(query)}|${groupBy}`;
  const picked = sel.sig === selSig ? sel.items : EMPTY_SELECTION;
  const togglePick = (key: string, row: unknown) =>
    setSel(() => {
      const next = new Map(picked);
      if (next.has(key)) next.delete(key);
      else next.set(key, row);
      return { sig: selSig, items: next };
    });
  const pickMany = (entries: [string, unknown][], on: boolean) =>
    setSel(() => {
      const next = new Map(picked);
      for (const [k, v] of entries) {
        if (on) next.set(k, v);
        else next.delete(k);
      }
      return { sig: selSig, items: next };
    });
  const clearPicked = () => setSel({ sig: "", items: new Map() });
  const summaryQ = useApiQuery(
    () => getSalesReport({ from: filters.from, to: filters.to, groupBy, locationId: filters.locationId }),
    [filters.from, filters.to, groupBy, filters.locationId],
  );

  // ── Analytics ────────────────────────────────────────────────────────────
  const [gran, setGran] = useState<"auto" | "hour" | "day" | "week">("auto");
  const anQ = useApiQuery(
    () => getAnalytics({
      ...query,
      series: ["revenue", "hour_of_day", "day_of_week", "payment_mix", "capacity_utilisation", "no_show_rate", "lead_time", "top_products"],
      granularity: gran === "auto" ? undefined : gran,
      compareToPrevious: true,
    }),
    [JSON.stringify(query), gran],
  );

  const txCsv = (rows: TransactionRow[]) => [
    csvRow(["Time", "Reference", "Items", "Customer", "Staff", "Counter", "Method", "Net", "Status"]),
    ...rows.map((r) => csvRow([r.time, r.reference, r.itemsLabel, r.customer, r.staffName, r.counterName, r.method, major(r.net), r.status])),
  ].join("\n");
  type SummaryRow = NonNullable<typeof summaryQ.data>["rows"][number];
  const summaryCsv = (rows: SummaryRow[]) => [
    csvRow(["Name", "Tickets", "Gross", "Refunds", "Net"]),
    ...rows.map((r) => csvRow([r.label, r.ticketCount, major(r.gross), major(r.refunds), major(r.net)])),
  ].join("\n");
  type OwedRow = (typeof outstanding)[number];
  const owedCsv = (rows: OwedRow[]) => [
    csvRow(["Order", "Customer", "Placed", "Total", "Paid", "Owed"]),
    ...rows.map(({ o, paid, owed }) => csvRow([o.reference, o.customerName, o.createdAt.slice(0, 10), major(o.total), major(paid), major(owed)])),
  ].join("\n");

  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${filters.from}_${filters.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /** The whole tab as it is filtered — every row, not the page on screen. */
  const exportCsv = async () => {
    if (tab === "transactions") {
      const total = txQ.data?.total ?? 0;
      const all = total > (txQ.data?.rows.length ?? 0)
        ? await getTransactions({ ...query, sort, cursor: "0", limit: total })
        : null;
      download("transactions", txCsv(all?.ok ? all.data.rows : (txQ.data?.rows ?? [])));
    } else if (tab === "summary") {
      download(`summary-${groupBy}`, summaryCsv(summaryQ.data?.rows ?? []));
    } else if (tab === "outstanding") {
      download("outstanding", owedCsv(outstanding));
    } else if (tab === "tax") {
      /* Two blocks in one file, with a blank line between them: the rate
         breakdown is what goes on the return, and the period breakdown is what
         reconciles it against the ledger. An accountant wants both, and
         downloading them separately is two files to keep together. */
      const d = taxQ.data;
      download("tax", [
        `# ${d?.taxName ?? "Tax"} by rate`,
        csvRow(["Class", "Rate", "Net", "Tax", "Gross", "Lines"]),
        ...(d?.rows ?? []).map((r) => csvRow([r.taxClass, `${(r.rate * 100).toFixed(2)}%`, major(r.net), major(r.tax), major(r.gross), r.lineCount])),
        csvRow(["Total", "", major(d?.totals.net ?? 0), major(d?.totals.tax ?? 0), major(d?.totals.gross ?? 0), ""]),
        "",
        `# By ${d?.granularity ?? "day"}`,
        csvRow(["Period", "Net", "Tax", "Gross"]),
        ...(d?.periods ?? []).map((p) => csvRow([p.period, major(p.net), major(p.tax), major(p.gross)])),
      ].join("\n"));
    } else {
      const a = anQ.data ?? {};
      download("analytics", Object.entries(a).map(([series, pts]) => [`# ${series}`, csvRow(["Label", "Value", "Compare"]), ...(pts ?? []).map((p) => csvRow([p.label, p.value, p.compare]))].join("\n")).join("\n\n"));
    }
    toast.success(t("csvExported"));
  };

  /** Only the ticked rows, in the order they appear. */
  const exportPicked = () => {
    const rows = [...picked.values()];
    if (tab === "transactions") download("transactions-selected", txCsv(rows as TransactionRow[]));
    else if (tab === "summary") download(`summary-${groupBy}-selected`, summaryCsv(rows as SummaryRow[]));
    else if (tab === "outstanding") download("outstanding-selected", owedCsv(rows as OwedRow[]));
    toast.success(t("select.exported", { count: rows.length }));
  };

  /** Every transaction the filters match, across all pages. */
  const pickAllMatching = async () => {
    const total = txQ.data?.total ?? 0;
    const res = await getTransactions({ ...query, sort, cursor: "0", limit: total });
    if (res.ok) pickMany(res.data.rows.map((r) => [r.id, r]), true);
  };

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-tight text-[13px] outline-none focus:border-inverse";
  /* Inside a chip: no box of its own, as wide as what it says. */
  const chipCls = "h-11 md:h-9 min-w-0 max-w-[14rem] truncate bg-transparent pl-inline pr-0 text-[13px] font-medium outline-none [field-sizing:content]";
  const money = (v: number) => formatMoney(v);

  const filterControl = (k: FilterKey) => {
    const v = (filters as unknown as Record<string, string | undefined>)[k] ?? "";
    const on = (val: string) => set(k, val || undefined);
    switch (k) {
      case "locationId": return <select aria-label={t("filters.anyLocation")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyLocation")}</option>{(locationsQ.data?.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>;
      case "counterId": return <select aria-label={t("filters.anyCounter")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyCounter")}</option>{(countersQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
      case "staffId": return <select aria-label={t("filters.anyone")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyone")}</option>{(staffQ.data?.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>;
      case "productId": return <select aria-label={t("filters.anyProduct")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyProduct")}</option>{(productsQ.data?.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
      case "categoryId": return <select aria-label={t("filters.anyCategory")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyCategory")}</option>{(categoriesQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
      case "method": return <select aria-label={t("filters.anyMethod")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyMethod")}</option><option value="cash">{enumL.method("cash")}</option><option value="bkash">{enumL.method("bkash")}</option><option value="bangla_qr">{enumL.method("bangla_qr")}</option><option value="card_terminal">{enumL.method("card_terminal")}</option></select>;
      case "status": return <select aria-label={t("filters.anyStatus")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyStatus")}</option><option value="completed">{enumL.status("completed")}</option><option value="refunded">{enumL.status("refunded")}</option><option value="partly_refunded">{enumL.status("partly_refunded")}</option><option value="void">{enumL.status("void")}</option></select>;
      case "channel": return <select aria-label={t("filters.anyChannel")} data-filter={k} value={v} onChange={(e) => on(e.target.value)} className={chipCls}><option value="">{t("filters.anyChannel")}</option><option value="counter">{t("channel.counter")}</option><option value="online">{t("channel.online")}</option></select>;
      case "minA": return <input data-filter={k} type="number" inputMode="decimal" aria-label={t("filters.minA")} placeholder={t("filters.minPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${chipCls} w-20 placeholder:font-normal placeholder:text-muted`} />;
      case "maxA": return <input data-filter={k} type="number" inputMode="decimal" aria-label={t("filters.maxA")} placeholder={t("filters.maxPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${chipCls} w-20 placeholder:font-normal placeholder:text-muted`} />;
      case "customer": return <input data-filter={k} aria-label={t("filters.customer")} placeholder={t("filters.customerPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${chipCls} w-32 placeholder:font-normal placeholder:text-muted`} />;
    }
  };

  const card = "card-surface p-card";
  const chartSkeleton = <div className="h-36 animate-pulse rounded-sm bg-line/50" aria-busy="true" />;
  const emptyChart = <p className="flex h-36 items-center justify-center text-[13px] text-muted">{t("nothingInRange")}</p>;
  const hasData = (pts?: { value: number }[]) => (pts ?? []).some((p) => p.value > 0);

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex items-center gap-tight">
          {/* Saved views live with the page's other page-level actions, not in
              the filter line: they are a way to REACH a filter set, used now
              and then, and two controls for them sat in the bar every time. */}
          <PopoverMenu
            label={views.length ? t("views.buttonCount", { count: views.length }) : t("views.button")}
            icon={<Bookmark size={15} strokeWidth={1.5} />}
            align="right"
          >
            {(close) => (
              <div className="flex w-64 flex-col">
                {views.length === 0 ? (
                  <p className="px-comfortable py-tight text-[13px] text-muted">{t("views.empty")}</p>
                ) : (
                  <ul className="flex flex-col py-inline">
                    {views.map((v) => (
                      <li key={v.name} className="flex items-center">
                        <button type="button" onClick={() => { applyView(v.qs); close(); }} className="flex min-h-11 min-w-0 flex-1 items-center px-comfortable text-left text-[13px] hover:bg-muted-wash md:min-h-9">
                          <span className="truncate">{v.name}</span>
                        </button>
                        <button type="button" aria-label={t("views.delete", { name: v.name })} onClick={() => deleteView(v.name)} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-danger md:h-9 md:w-9">
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => { close(); setSaveOpen(true); }} className="flex min-h-11 items-center gap-tight border-t border-hairline px-comfortable text-left text-[13px] font-medium text-brand-foreground hover:bg-muted-wash md:min-h-9">
                  <Plus size={14} strokeWidth={1.5} /> {t("views.saveCurrent")}
                </button>
              </div>
            )}
          </PopoverMenu>
          <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={() => exportCsv()}>{t("exportCsv")}</Button>
        </div>
      }
    >
      {/* The shared filter line — one scope across every tab. Dates are ONE
          control; search is one field; each filter in use is one chip that is
          also its own control; "Filter" adds another. Nothing else. */}
      <div className="mb-section flex flex-wrap items-center gap-tight md:flex-nowrap">
        <DateRangePicker
          value={{ preset: filters.preset, from: filters.from, to: filters.to }}
          onChange={(r) => { setFilters((f) => ({ ...f, preset: r.preset, from: r.from, to: r.to })); setCursor(0); }}
          presets={PRESETS.map((p) => ({ ...p, label: t(`presets.${p.value}`) }))}
          today={DEMO_TODAY}
          max={DEMO_TODAY}
          labels={{
            choose: t("range.choose"),
            custom: t("custom"),
            from: t("range.from"),
            to: t("range.to"),
            apply: t("range.apply"),
            cancel: t("range.cancel"),
            previousMonth: tc("previousMonth"),
            nextMonth: tc("nextMonth"),
            days: (count) => t("range.days", { count }),
            pickEnd: t("range.pickEnd"),
          }}
          className="w-full shrink-0 md:w-auto"
        />
        <label className="relative min-w-0 flex-1 basis-40 md:w-60 md:flex-none md:basis-auto">
          <Search size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={filters.q ?? ""}
            onChange={(e) => { set("q", e.target.value || undefined); setCursor(0); }}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-11 w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-tight md:flex-1">
          {added.map((k) => (
            <span key={k} data-focus-host className="inline-flex h-11 max-w-full items-center rounded-full border border-line bg-card pl-comfortable text-[13px] focus-within:border-inverse focus-within:ring-2 focus-within:ring-ember/30 md:h-9">
              <span className="shrink-0 text-muted">{t(`filters.${k}`)}:</span>
              {filterControl(k)}
              <button type="button" aria-label={t("filters.remove", { label: t(`filters.${k}`) })} onClick={() => { removeFilter(k); setCursor(0); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger md:h-9 md:w-9">
                <X size={14} strokeWidth={1.5} />
              </button>
            </span>
          ))}
          {added.length < FILTER_DEFS.length && (
            <PopoverMenu label={t("filterMenu")} icon={<ListFilter size={15} strokeWidth={1.5} />} align="auto" quiet>
              {(close) => (
                <ul className="flex w-56 flex-col py-inline">
                  {FILTER_DEFS.filter((d) => !added.includes(d.key)).map((d) => (
                    <li key={d.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setAdded((a) => [...a, d.key]);
                          close(false);
                          // Straight into the new chip's control: adding a filter
                          // and then having to find it to set it is two jobs.
                          requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-filter="${d.key}"]`)?.focus());
                        }}
                        className="flex min-h-11 w-full items-center px-comfortable text-left text-[13px] hover:bg-muted-wash md:min-h-9"
                      >
                        {t(`filters.${d.key}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverMenu>
          )}
          {added.length > 0 && (
            <button type="button" onClick={() => { clearAll(); setCursor(0); }} className="h-11 rounded-sm px-tight text-[13px] font-medium text-muted hover:text-fg md:h-9">
              {t("clearAll")}
            </button>
          )}
        </div>
      </div>

      <Tabs
        items={[{ value: "transactions", label: t("tabs.transactions") }, { value: "summary", label: t("tabs.summary") }, { value: "tax", label: t("tabs.tax") }, { value: "outstanding", label: t("tabs.outstanding") }, { value: "analytics", label: t("tabs.analytics") }]}
        value={tab}
        onChange={setTab}
        className="mb-section"
      />

      {tab === "transactions" && (
        <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
          <table className="table-inset w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-line">
                <th className="w-10 pl-comfortable">
                  <PageCheckbox
                    rows={(txQ.data?.rows ?? []).map((r) => [r.id, r] as [string, unknown])}
                    picked={picked}
                    onChange={pickMany}
                    label={t("select.page")}
                  />
                </th>
                <th className="w-8" />
                {([
                  ["time", t("columns.time"), true], ["reference", t("columns.reference"), false], ["items", t("columns.items"), false], ["customer", t("columns.customer"), false],
                  ["staff", t("columns.staff"), false], ["counter", t("columns.counter"), false], ["method", t("columns.method"), false], ["amount", t("columns.net"), true], ["status", t("columns.status"), true],
                ] as const).map(([key, label, sortable]) => (
                  <th key={key} className={`type-label whitespace-nowrap px-comfortable py-tight text-left text-[12px] text-muted ${key === "amount" ? "text-right" : ""}`}>
                    {sortable ? (
                      <button type="button" onClick={() => setSort((s) => ({ field: key as typeof s.field, dir: s.field === key && s.dir === "desc" ? "asc" : "desc" }))} className="min-h-11 uppercase tracking-wide hover:text-fg md:min-h-0">
                        {label}{sort.field === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txQ.loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line"><td colSpan={11} className="px-comfortable py-comfortable"><div className="h-4 animate-pulse rounded-xs bg-line" /></td></tr>
              ))}
              {!txQ.loading && (txQ.data?.rows ?? []).map((r: TransactionRow) => (
                <FragmentRow
                  key={r.id}
                  r={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onOpen={() => router.push(`/orders/${r.id}`)}
                  selected={picked.has(r.id)}
                  onSelect={() => togglePick(r.id, r)}
                />
              ))}
              {!txQ.loading && (txQ.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={11} className="px-comfortable py-hero text-center text-[13px] text-muted">{t("transactions.empty")}</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-card py-tight">
            <span className="text-[12px] tabular-nums text-muted">{txQ.data ? t("transactions.pageRange", { from: cursor + 1, to: cursor + txQ.data.rows.length, total: txQ.data.total }) : t("transactions.loadingRange")}</span>
            <div className="flex gap-tight">
              <Button size="sm" variant="secondary" disabled={cursor === 0} onClick={() => setCursor(Math.max(0, cursor - 25))}>{t("transactions.previous")}</Button>
              <Button size="sm" variant="secondary" disabled={!txQ.data?.cursor} onClick={() => setCursor(cursor + 25)}>{t("transactions.next")}</Button>
            </div>
          </div>
        </div>
      )}

      {tab === "outstanding" && (
        <div className="flex flex-col gap-section">
          <div className="grid gap-section sm:grid-cols-2">
            <div className="card-surface p-card">
              <p className="type-label text-[12px] text-muted">{t("outstanding.totalOwed")}</p>
              <p className="mt-tight font-mono text-3xl tabular-nums text-warning">{formatMoney(totalOwed)}</p>
            </div>
            <div className="card-surface p-card">
              <p className="type-label text-[12px] text-muted">{t("outstanding.count")}</p>
              <p className="mt-tight font-mono text-3xl tabular-nums">{outstanding.length}</p>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
            <table className="table-inset w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-10 pl-comfortable">
                    <PageCheckbox rows={outstanding.map((x) => [x.o.id, x] as [string, unknown])} picked={picked} onChange={pickMany} label={t("select.page")} />
                  </th>
                  {([["reference", "left"], ["customer", "left"], ["time", "left"], ["total", "right"], ["paid", "right"], ["owed", "right"]] as const).map(([key, align]) => (
                    <th key={key} className={`type-label whitespace-nowrap px-comfortable py-tight text-[12px] text-muted text-${align}`}>{t(`outstanding.col.${key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordersQ.loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-line"><td colSpan={7} className="px-comfortable py-comfortable"><div className="h-4 animate-pulse rounded-xs bg-line" /></td></tr>
                ))}
                {!ordersQ.loading && outstanding.map((x) => { const { o, paid, owed } = x; return (
                  <tr key={o.id} aria-selected={picked.has(o.id)} onClick={() => router.push(`/orders/${o.id}`)} className={cn("cursor-pointer border-b border-line last:border-0", picked.has(o.id) ? "bg-ember/5 hover:bg-ember/10" : "hover:bg-subtle/60")}>
                    <td className="pl-comfortable" onClick={(e) => e.stopPropagation()}>
                      <label className="flex h-11 w-8 cursor-pointer items-center md:h-9">
                        <input type="checkbox" checked={picked.has(o.id)} onChange={() => togglePick(o.id, x)} aria-label={t("select.row", { ref: o.reference })} className="h-4 w-4 accent-[var(--color-ember)]" />
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-comfortable py-tight font-mono text-[12px]">{o.reference}</td>
                    <td className="px-comfortable py-tight">{o.customerName ?? <span className="text-muted">—</span>}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight font-mono text-[12px] text-muted">{o.createdAt.slice(0, 10)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums">{formatMoney(o.total)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums text-muted">{formatMoney(paid)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums font-medium text-warning">{formatMoney(owed)}</td>
                  </tr>
                ); })}
                {!ordersQ.loading && outstanding.length === 0 && (
                  <tr><td colSpan={7} className="px-comfortable py-hero text-center text-[13px] text-muted">{t("outstanding.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "summary" && (() => {
        const s = summaryQ.data?.summary;
        const d = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? t("summary.new") : t("summary.none")) : `${cur >= prev ? "▲" : "▼"} ${Math.abs(((cur - prev) / prev) * 100).toFixed(0)}%`);
        return (
          <>
            {/* One column under 420px, and the figure steps down a size on a
                phone. Measured at 390: a 141px tile against a 158px number, so
                "৳502,445.00" rendered as "৳502,4" with no ellipsis — a
                DIFFERENT number, shown with nothing to say anything was
                missing. Same defect the dashboard hero was fixed for; these
                tiles never got the treatment. */}
            <div className="mb-section grid grid-cols-1 gap-section min-[420px]:grid-cols-2 lg:grid-cols-4">
              {([["gross", t("summary.gross"), s?.gross, s?.prevGross], ["refunds", t("summary.refunds"), s?.refunds, undefined], ["net", t("summary.net"), s?.net, s?.prevNet], ["tickets", t("summary.tickets"), s?.ticketCount, s?.prevTicketCount]] as const).map(([key, label, v, pv]) => (
                <div key={key} className={card}>
                  <p className="type-label text-[12px] text-muted">{label}</p>
                  <p className="mt-tight whitespace-nowrap font-mono text-xl tabular-nums sm:text-2xl">{v == null ? "—" : key === "tickets" ? String(v) : formatMoney(v as number)}</p>
                  {pv != null && v != null && <p className="mt-inline font-mono text-[12px] text-muted">{t("summary.vsPrev", { delta: d(v as number, pv as number) })}</p>}
                </div>
              ))}
            </div>
            <Tabs
              items={(["product", "category", "payment_method", "counter", "location", "staff", "hour"] as const).map((v) => ({ value: v, label: t(`groupBy.${v}`) }))}
              value={groupBy}
              onChange={(v) => setGroupBy(v as SalesGroupBy)}
              className="mb-section"
            />
            <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
              <table className="table-inset w-full text-sm">
                <thead><tr className="border-b border-line"><th className="w-10 pl-comfortable"><PageCheckbox rows={(summaryQ.data?.rows ?? []).map((r) => [String(r.key), r] as [string, unknown])} picked={picked} onChange={pickMany} label={t("select.page")} /></th>{[t("columns.name"), t("columns.tickets"), t("columns.gross"), t("columns.refunds"), t("columns.net"), t("columns.shareOfTotal")].map((h, i) => <th key={h} className={`type-label px-comfortable py-tight text-[12px] uppercase tracking-wide text-muted ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {(summaryQ.data?.rows ?? []).map((r) => (
                    <tr
                      key={String(r.key)}
                      aria-selected={picked.has(String(r.key))}
                      className={cn("h-12 cursor-pointer border-b border-line last:border-0", picked.has(String(r.key)) ? "bg-ember/5 hover:bg-ember/10" : "hover:bg-subtle")}
                      onClick={() => {
                        // Row click filters the Transactions tab — same scope, drilled.
                        if (groupBy === "product") { set("productId", String(r.key)); setAdded((a) => a.includes("productId") ? a : [...a, "productId"]); }
                        else if (groupBy === "payment_method") { set("method", String(r.key)); setAdded((a) => a.includes("method") ? a : [...a, "method"]); }
                        else if (groupBy === "counter") { set("counterId", String(r.key)); setAdded((a) => a.includes("counterId") ? a : [...a, "counterId"]); }
                        else if (groupBy === "location") { set("locationId", String(r.key)); setAdded((a) => a.includes("locationId") ? a : [...a, "locationId"]); }
                        else if (groupBy === "staff") { set("staffId", String(r.key)); setAdded((a) => a.includes("staffId") ? a : [...a, "staffId"]); }
                        else if (groupBy === "category") { set("categoryId", String(r.key)); setAdded((a) => a.includes("categoryId") ? a : [...a, "categoryId"]); }
                        setTab("transactions"); setCursor(0);
                      }}
                    >
                      <td className="pl-comfortable" onClick={(e) => e.stopPropagation()}>
                        <label className="flex h-11 w-8 cursor-pointer items-center md:h-9">
                          <input type="checkbox" checked={picked.has(String(r.key))} onChange={() => togglePick(String(r.key), r)} aria-label={t("select.row", { ref: r.label })} className="h-4 w-4 accent-[var(--color-ember)]" />
                        </label>
                      </td>
                      <td className="min-w-0 max-w-64 truncate px-comfortable font-medium">{r.label}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{r.ticketCount}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.gross)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums text-danger">{r.refunds ? `−${formatMoney(r.refunds)}` : "—"}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.net)}</td>
                      <td className="px-comfortable text-right font-mono text-[12px] text-muted">{(r.shareOfTotal * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {tab === "tax" && (() => {
        const d = taxQ.data;
        const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)}%`;
        const periodLabel = (p: string) =>
          d?.granularity === "month"
            ? new Date(`${p}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
            : new Date(`${p}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        return (
          <div className="flex flex-col gap-section">
            {/* What a return is filed against: who is registered, for what, and
                over which dates. A page of figures with none of that on it is
                a page somebody has to annotate by hand. */}
            <div className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-comfortable">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-[-0.4px]">{t("tax.heading", { name: d?.taxName ?? "" })}</h2>
                  <p className="mt-inline text-[13px] text-muted">
                    {t("tax.rangeLine", { from: filters.from, to: filters.to, orders: d?.orderCount ?? 0 })}
                  </p>
                </div>
                <p className="text-[13px] text-muted">
                  {d?.registrationNumber
                    ? t("tax.registered", { number: d.registrationNumber })
                    : t("tax.notRegistered")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-section min-[420px]:grid-cols-3">
              {([["net", t("tax.net"), d?.totals.net], ["tax", t("tax.collected", { name: d?.taxName ?? "" }), d?.totals.tax], ["gross", t("tax.gross"), d?.totals.gross]] as const).map(([key, label, v]) => (
                <div key={key} className={card}>
                  <p className="type-label text-[12px] text-muted">{label}</p>
                  <p className="mt-tight whitespace-nowrap font-mono text-xl tabular-nums sm:text-2xl">{v == null ? "—" : formatMoney(v)}</p>
                  {/* Only where something actually went back. A line of zeroes
                      on a return invites a second look at nothing. */}
                  {key === "tax" && !!d?.refunded.tax && (
                    <p className="mt-inline font-mono text-[12px] text-muted">{t("tax.afterRefunds", { amount: formatMoney(d.refunded.tax) })}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
              <table className="table-inset w-full text-sm">
                <caption className="px-card pb-tight pt-comfortable text-left text-[13px] font-medium">{t("tax.byRate")}</caption>
                <thead>
                  <tr className="border-b border-line">
                    {[t("tax.colClass"), t("tax.colRate"), t("tax.colNet"), t("tax.colTax"), t("tax.colGross"), t("tax.colLines")].map((h, i) => (
                      <th key={h} className={`type-label px-comfortable py-tight text-[12px] uppercase tracking-wide text-muted ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(d?.rows ?? []).map((r) => (
                    <tr key={`${r.taxClass}-${r.rate}`} className="h-12 border-b border-line last:border-0">
                      <td className="px-comfortable font-medium">{t(`tax.class.${r.taxClass}`)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{pct(r.rate)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.net)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.tax)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.gross)}</td>
                      <td className="px-comfortable text-right font-mono text-[12px] text-muted tabular-nums">{r.lineCount}</td>
                    </tr>
                  ))}
                  {!!d?.rows.length && (
                    <tr className="h-12 border-t border-strong font-medium">
                      <td className="px-comfortable">{t("tax.total")}</td>
                      <td />
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(d.totals.net)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(d.totals.tax)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(d.totals.gross)}</td>
                      <td />
                    </tr>
                  )}
                  {d && d.rows.length === 0 && (
                    <tr><td colSpan={6} className="px-comfortable py-section text-center text-[13px] text-muted">{t("nothingInRange")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {!!d?.periods.length && (
              <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
                <table className="table-inset w-full text-sm">
                  <caption className="px-card pb-tight pt-comfortable text-left text-[13px] font-medium">
                    {t(d.granularity === "month" ? "tax.byMonth" : "tax.byDay")}
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      {[t("tax.colPeriod"), t("tax.colNet"), t("tax.colTax"), t("tax.colGross")].map((h, i) => (
                        <th key={h} className={`type-label px-comfortable py-tight text-[12px] uppercase tracking-wide text-muted ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.periods.map((p) => (
                      <tr key={p.period} className="h-12 border-b border-line last:border-0">
                        <td className="whitespace-nowrap px-comfortable">{periodLabel(p.period)}</td>
                        <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(p.net)}</td>
                        <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(p.tax)}</td>
                        <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(p.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Said out loud rather than left for somebody to discover: the
                model records a refund on the line with no date of its own, so
                it reduces the period the SALE falls in. */}
            <p className="text-[13px] text-muted">{t("tax.refundNote")}</p>
          </div>
        );
      })()}

      {tab === "analytics" && (() => {
        const a = anQ.data;
        return (
          <div className="flex flex-col gap-section">
            <div className={card}>
              <div className="mb-tight flex items-center justify-between">
                <p className="type-label text-[12px] text-muted">{t("charts.revenueOverTime")} <span className="normal-case text-muted">{t("charts.revenueOverTimeNote")}</span></p>
                <select aria-label={t("charts.auto")} value={gran} onChange={(e) => setGran(e.target.value as typeof gran)} className={selectCls}>
                  <option value="auto">{t("charts.auto")}</option><option value="hour">{t("charts.hourly")}</option><option value="day">{t("charts.daily")}</option><option value="week">{t("charts.weekly")}</option>
                </select>
              </div>
              {/* AreaChart, not LineChart. The sales report's headline figure was
                  drawn by the sparkline component — no gridlines, no y-axis, and
                  its period labels sitting two pixels off the bottom edge where
                  the previous-period line runs through them. You could see the
                  shape of the month and not read a single value off it. The
                  charted component was already in the module, used by the
                  dashboard and by nothing here. */}
              {anQ.loading ? chartSkeleton : hasData(a?.revenue) ? (
                <AreaChart
                  points={a!.revenue!}
                  fmt={money}
                  fmtAxis={(v) => formatMoneyCompact(v)}
                  height={300}
                  valueLabel={t("charts.revenueOverTime")}
                  compareLabel={t("charts.revenueOverTimeNote")}
                />
              ) : emptyChart}
            </div>

            <div className="grid gap-section lg:grid-cols-3">
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.salesByHour")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.hour_of_day) ? <BarChart points={a!.hour_of_day!} fmt={money} /> : emptyChart}
              </div>
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.salesByDay")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.day_of_week) ? <BarChart points={a!.day_of_week!} fmt={money} /> : emptyChart}
              </div>
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.paymentMix")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.payment_mix) ? <DonutChart points={a!.payment_mix!} fmt={money} /> : emptyChart}
              </div>
            </div>

            {/* The distinctive ones — only a system that owns the sale AND the scan can draw these. */}
            <div className="grid gap-section lg:grid-cols-3">
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.capacityUtilisation")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.capacity_utilisation) ? <LineChart points={a!.capacity_utilisation!} fmt={(v) => `${v}%`} height={120} /> : emptyChart}
              </div>
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.noShowRate")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.no_show_rate) ? <LineChart points={a!.no_show_rate!} fmt={(v) => `${v}%`} height={120} /> : emptyChart}
              </div>
              <div className={card}>
                <p className="type-label mb-tight text-[12px] text-muted">{t("charts.leadTime")}</p>
                {anQ.loading ? chartSkeleton : hasData(a?.lead_time) ? <BarChart points={a!.lead_time!} fmt={(v) => (v === 1 ? t("charts.bookings", { count: v }) : t("charts.bookingsPlural", { count: v }))} /> : emptyChart}
              </div>
            </div>

            <div className={card}>
              <p className="type-label mb-tight text-[12px] text-muted">{t("charts.topProducts")}</p>
              {anQ.loading ? chartSkeleton : hasData(a?.top_products) ? <HBarChart points={a!.top_products!} fmt={money} /> : emptyChart}
            </div>
          </div>
        );
      })()}

      {/* The selection's own bar, floating where the hand already is: ticking
          row 18 must not mean scrolling back up to find what to do with it. */}
      {picked.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-gutter md:bottom-section">
          <div role="region" aria-label={t("select.region")} className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-tight rounded-md border border-line bg-card px-comfortable py-tight shadow-lg">
            <span className="text-[13px] font-medium">{t("select.count", { count: picked.size })}</span>
            {tab === "transactions" && (txQ.data?.total ?? 0) > picked.size && (
              <button type="button" onClick={pickAllMatching} className="min-h-11 rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:underline md:min-h-8">
                {t("select.allMatching", { count: txQ.data?.total ?? 0 })}
              </button>
            )}
            <span className="flex-1" />
            <Button size="sm" icon={<Download size={15} strokeWidth={1.5} />} onClick={exportPicked}>
              {t("select.export", { count: picked.size })}
            </Button>
            <Button size="sm" variant="tertiary" onClick={clearPicked}>{t("select.clear")}</Button>
          </div>
        </div>
      )}

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title={t("savedViews.modalTitle")} footer={<><Button variant="secondary" onClick={() => setSaveOpen(false)}>{t("savedViews.cancel")}</Button><Button onClick={saveView}>{t("savedViews.saveButton")}</Button></>}>
        <FormField label={t("savedViews.nameLabel")} placeholder={t("savedViews.namePlaceholder")} value={viewName} onChange={(e) => setViewName(e.target.value)} help={t("savedViews.help")} />
      </Modal>
    </PageShell>
  );
}

function FragmentRow({ r, expanded, onToggle, onOpen, selected, onSelect }: { r: TransactionRow; expanded: boolean; onToggle: () => void; onOpen: () => void; selected: boolean; onSelect: () => void }) {
  const t = useTranslations("reports");
  const enumL = useEnumLabels();
  const time = r.time.slice(11, 16);
  const day = r.time.slice(0, 10);
  // "Mixed" is a visible bucket — split tender is never allocated across lines.
  const tone: Record<TxStatus, "success" | "danger" | "warning" | "neutral"> = {
    completed: "success",
    refunded: "danger",
    partly_refunded: "warning",
    void: "neutral",
  };
  return (
    <>
      <tr aria-selected={selected} className={cn("h-12 cursor-pointer border-b border-line", selected ? "bg-ember/5 hover:bg-ember/10" : "hover:bg-subtle")} onClick={onOpen}>
        <td className="pl-comfortable" onClick={(e) => e.stopPropagation()}>
          <label className="flex h-11 w-8 cursor-pointer items-center md:h-9">
            <input type="checkbox" checked={selected} onChange={onSelect} aria-label={t("select.row", { ref: r.reference })} className="h-4 w-4 accent-[var(--color-ember)]" />
          </label>
        </td>
        <td className="pl-tight"><button type="button" aria-label={t("transactions.lines")} aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex h-11 w-11 items-center justify-center text-muted hover:text-fg md:h-8 md:w-8">{expanded ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} />}</button></td>
        <td className="whitespace-nowrap px-comfortable text-[13px] tabular-nums">{formatDay(day)}, {time}</td>
        <td className="whitespace-nowrap px-comfortable font-mono text-[12px]">{r.reference}</td>
        <td className="min-w-0 max-w-36 truncate px-comfortable" title={r.itemsLabel}>{r.itemsLabel}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted" title={r.customer ?? undefined}>{r.customer ?? "—"}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted" title={r.staffName ?? undefined}>{r.staffName ?? "—"}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted" title={r.counterName ?? undefined}>{r.counterName ?? "—"}</td>
        <td className="whitespace-nowrap px-comfortable text-[12px]">{enumL.method(r.method)}</td>
        <td className="whitespace-nowrap px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.net)}</td>
        <td className="px-comfortable"><StatusPill tone={tone[r.status]}>{enumL.status(r.status)}</StatusPill></td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-subtle">
          <td />
          <td />
          <td colSpan={9} className="max-w-xl px-comfortable py-tight">
            {/* F11 §8 — same detail structure as the order page. */}
            <OrderLinesDetail compact order={{
              lines: r.lines,
              subtotal: r.lines.reduce((s, l) => s + (l.subtotal ?? l.unitPrice * l.quantity), 0),
              lineDiscountTotal: r.lines.reduce((s, l) => s + (l.lineDiscount ?? 0), 0),
              orderDiscount: r.lines.reduce((s, l) => s + (l.allocatedOrderDiscount ?? 0), 0),
              discountTotal: r.lines.reduce((s, l) => s + (l.lineDiscount ?? 0) + (l.allocatedOrderDiscount ?? 0), 0),
              taxTotal: r.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0),
              total: r.lines.reduce((s, l) => s + (l.total ?? l.unitPrice * l.quantity), 0),
              payments: [],
            }} />
          </td>
        </tr>
      )}
    </>
  );
}

const EMPTY_SELECTION: Map<string, unknown> = new Map();

/** The header box: ticks or clears every row on screen, and reads as partly
 *  ticked when some are. `indeterminate` has no attribute, so it is set here. */
function PageCheckbox({
  rows,
  picked,
  onChange,
  label,
}: {
  rows: [string, unknown][];
  picked: Map<string, unknown>;
  onChange: (entries: [string, unknown][], on: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const on = rows.filter(([k]) => picked.has(k)).length;
  const all = rows.length > 0 && on === rows.length;
  const some = on > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <label className="flex h-11 w-8 cursor-pointer items-center md:h-9">
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        disabled={rows.length === 0}
        onChange={() => onChange(rows, !all)}
        aria-label={label}
        aria-checked={some ? "mixed" : all}
        className="h-4 w-4 accent-[var(--color-ember)]"
      />
    </label>
  );
}

/** A button that opens a small panel beneath it — the filter picker and the
 *  saved views. Closes on outside click and Escape, and hands focus back. */
function PopoverMenu({
  label,
  icon,
  align = "left",
  quiet = false,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  /** `auto` opens toward whichever side has room — the filter button sits
   *  mid-row on a desk and at the right edge of a phone's row. */
  align?: "left" | "right" | "auto";
  /** Dashed and muted: an action that adds, not a value that is set. */
  quiet?: boolean;
  children: (close: (refocus?: boolean) => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">(align === "right" ? "right" : "left");
  /* Focus goes back to the button after closing — asked for through state so
     that the close handed to the panel never touches a ref itself. */
  const [refocus, setRefocus] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = (back = true) => {
    setOpen(false);
    if (back) setRefocus((n) => n + 1);
  };
  useEffect(() => {
    if (refocus) btn.current?.focus();
  }, [refocus]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>("[data-menu] button")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          if (align === "auto" && !open) {
            // 240 is the widest panel this opens (w-56) plus its shadow.
            const r = e.currentTarget.getBoundingClientRect();
            setSide(r.left + 240 > window.innerWidth - 16 ? "right" : "left");
          }
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-11 items-center gap-inline whitespace-nowrap rounded-sm px-comfortable text-[13px] font-medium transition-colors duration-quick md:h-9",
          quiet ? "border border-dashed border-line text-muted hover:border-strong hover:text-fg" : "border border-line bg-card text-fg hover:border-strong",
        )}
      >
        {icon}
        {label}
        <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>
      {open && (
        <div data-menu className={cn("absolute top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-line bg-card shadow-lg", (align === "auto" ? side : align) === "right" ? "right-0" : "left-0")}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
