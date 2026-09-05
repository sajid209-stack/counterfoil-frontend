"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Download, Plus, X } from "lucide-react";
import { BarChart, Button, DonutChart, HBarChart, LineChart, Modal, PageShell, StatusPill, Tabs, useToast, FormField } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getAnalytics,
  getSalesReport,
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
import { formatMoney } from "@/lib/format";
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
  const [tab, setTab] = useState(params.get("tab") ?? "transactions");
  const [added, setAdded] = useState<FilterKey[]>(() => FILTER_DEFS.map((d) => d.key).filter((k) => !!(filters as unknown as Record<string, string | undefined>)[k]));

  // State → URL (replace, so back doesn't spam history).
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
    router.replace(`/reports/sales?${p.toString()}`, { scroll: false });
  }, [filters, tab, router]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const setPreset = (preset: string) => {
    if (preset === "custom") setFilters((f) => ({ ...f, preset }));
    else { const [from, to] = PRESETS.find((p) => p.value === preset)!.range(); setFilters((f) => ({ ...f, preset, from, to })); }
  };
  const removeFilter = (k: FilterKey) => { setAdded((a) => a.filter((x) => x !== k)); setFilters((f) => ({ ...f, [k]: undefined })); };
  const clearAll = () => { setAdded([]); setFilters((f) => ({ ...DEFAULTS, preset: f.preset, from: f.from, to: f.to, q: f.q })); };
  const activeCount = added.filter((k) => (filters as unknown as Record<string, string | undefined>)[k]).length;

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
  const applyView = (qs: string) => {
    const p = new URLSearchParams(qs);
    const f: Filters = { ...DEFAULTS };
    p.forEach((v, k) => { (f as unknown as Record<string, string>)[k] = v; });
    setFilters(f);
    setAdded(FILTER_DEFS.map((d) => d.key).filter((k) => !!(f as unknown as Record<string, string | undefined>)[k]));
  };

  const query = useMemo(() => toQuery(filters), [filters]);

  // ── Transactions ──────────────────────────────────────────────────────────
  const [sort, setSort] = useState<{ field: "time" | "amount" | "status"; dir: "asc" | "desc" }>({ field: "time", dir: "desc" });
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const txQ = useApiQuery(
    () => getTransactions({ ...query, sort, cursor: String(cursor), limit: 25 }),
    [JSON.stringify(query), sort.field, sort.dir, cursor],
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<SalesGroupBy>("product");
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

  const exportCsv = () => {
    let name = "";
    let content = "";
    if (tab === "transactions") {
      name = "transactions";
      content = ["Time,Reference,Items,Customer,Staff,Counter,Method,Net,Status",
        ...(txQ.data?.rows ?? []).map((r) => `${r.time},"${r.reference}","${r.itemsLabel}","${r.customer ?? ""}","${r.staffName ?? ""}","${r.counterName ?? ""}",${r.method},${(r.net / 100).toFixed(2)},${r.status}`)].join("\n");
    } else if (tab === "summary") {
      name = `summary-${groupBy}`;
      content = ["Name,Tickets,Gross,Refunds,Net",
        ...(summaryQ.data?.rows ?? []).map((r) => `"${r.label}",${r.ticketCount},${(r.gross / 100).toFixed(2)},${(r.refunds / 100).toFixed(2)},${(r.net / 100).toFixed(2)}`)].join("\n");
    } else {
      name = "analytics";
      const a = anQ.data ?? {};
      content = Object.entries(a).map(([series, pts]) => [`# ${series}`, "Label,Value,Compare", ...(pts ?? []).map((p) => `"${p.label}",${p.value},${p.compare ?? ""}`)].join("\n")).join("\n\n");
    }
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${filters.from}_${filters.to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("csvExported"));
  };

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-tight text-[13px] outline-none focus:border-inverse";
  const money = (v: number) => formatMoney(v);

  const filterControl = (k: FilterKey) => {
    const v = (filters as unknown as Record<string, string | undefined>)[k] ?? "";
    const on = (val: string) => set(k, val || undefined);
    switch (k) {
      case "locationId": return <select aria-label={t("filters.anyLocation")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyLocation")}</option>{(locationsQ.data?.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>;
      case "counterId": return <select aria-label={t("filters.anyCounter")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyCounter")}</option>{(countersQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
      case "staffId": return <select aria-label={t("filters.anyone")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyone")}</option>{(staffQ.data?.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>;
      case "productId": return <select aria-label={t("filters.anyProduct")} value={v} onChange={(e) => on(e.target.value)} className={`${selectCls} max-w-48`}><option value="">{t("filters.anyProduct")}</option>{(productsQ.data?.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
      case "categoryId": return <select aria-label={t("filters.anyCategory")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyCategory")}</option>{(categoriesQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
      case "method": return <select aria-label={t("filters.anyMethod")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyMethod")}</option><option value="cash">{enumL.method("cash")}</option><option value="bkash">{enumL.method("bkash")}</option><option value="bangla_qr">{enumL.method("bangla_qr")}</option><option value="card_terminal">{enumL.method("card_terminal")}</option></select>;
      case "status": return <select aria-label={t("filters.anyStatus")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyStatus")}</option><option value="completed">{enumL.status("completed")}</option><option value="refunded">{enumL.status("refunded")}</option><option value="partly_refunded">{enumL.status("partly_refunded")}</option><option value="void">{enumL.status("void")}</option></select>;
      case "channel": return <select aria-label={t("filters.anyChannel")} value={v} onChange={(e) => on(e.target.value)} className={selectCls}><option value="">{t("filters.anyChannel")}</option><option value="counter">{t("channel.counter")}</option><option value="online">{t("channel.online")}</option></select>;
      case "minA": return <input type="number" placeholder={t("filters.minPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${selectCls} w-24`} />;
      case "maxA": return <input type="number" placeholder={t("filters.maxPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${selectCls} w-24`} />;
      case "customer": return <input placeholder={t("filters.customerPlaceholder")} value={v} onChange={(e) => on(e.target.value)} className={`${selectCls} w-40`} />;
    }
  };

  const card = "card-surface p-section";
  const chartSkeleton = <div className="h-36 animate-pulse rounded-sm bg-line/50" aria-busy="true" />;
  const emptyChart = <p className="flex h-36 items-center justify-center text-[13px] text-faint">{t("nothingInRange")}</p>;
  const hasData = (pts?: { value: number }[]) => (pts ?? []).some((p) => p.value > 0);

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={<Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={exportCsv}>{t("exportCsv")}</Button>}
    >
      {/* The shared filter bar — one scope across all three tabs. */}
      <div className="mb-section card-surface p-comfortable">
        <div className="flex flex-wrap items-center gap-tight">
          {PRESETS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPreset(p.value)} className={`h-11 md:h-9 rounded-sm border px-tight text-[13px] ${filters.preset === p.value ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{t(`presets.${p.value}`)}</button>
          ))}
          <button type="button" onClick={() => setPreset("custom")} className={`h-11 md:h-9 rounded-sm border px-tight text-[13px] ${filters.preset === "custom" ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{t("custom")}</button>
          {filters.preset === "custom" && (
            <span className="flex items-center gap-inline">
              <input aria-label={tc("dateFrom")} type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={selectCls} />
              <span className="text-faint">→</span>
              <input aria-label={tc("dateTo")} type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={selectCls} />
            </span>
          )}
          <input value={filters.q ?? ""} onChange={(e) => set("q", e.target.value || undefined)} placeholder={t("search")} className={`${selectCls} w-64`} />
          <span className="flex-1" />
          {views.length > 0 && (
            <select aria-label={t("savedViews.dropdown")} value="" onChange={(e) => { const v = views.find((x) => x.name === e.target.value); if (v) applyView(v.qs); }} className={selectCls}>
              <option value="">{t("savedViews.dropdown")}</option>
              {views.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setSaveOpen(true)} className="h-11 md:h-9 rounded-sm border border-line px-tight text-[13px] text-muted hover:text-fg">{t("savedViews.save")}</button>
        </div>
        <div className="mt-tight flex flex-wrap items-center gap-tight">
          {added.map((k) => (
            <span key={k} className="flex items-center gap-inline rounded-lg border border-line bg-subtle py-inline pl-tight pr-inline">
              <span className="text-[12px] uppercase tracking-wide text-faint">{t(`filters.${k}`)}</span>
              {filterControl(k)}
              <button type="button" aria-label={t("filters.remove", { label: t(`filters.${k}`) })} onClick={() => removeFilter(k)} className="text-faint hover:text-danger"><X size={14} strokeWidth={1.5} /></button>
            </span>
          ))}
          {added.length < FILTER_DEFS.length && (
            <select aria-label={t("addFilter")} value="" onChange={(e) => { const k = e.target.value as FilterKey; if (k) setAdded((a) => [...a, k]); }} className={`${selectCls} text-muted`}>
              <option value="">{t("addFilter")}</option>
              {FILTER_DEFS.filter((d) => !added.includes(d.key)).map((d) => <option key={d.key} value={d.key}>{t(`filters.${d.key}`)}</option>)}
            </select>
          )}
          {activeCount > 0 && <button type="button" onClick={clearAll} className="text-[13px] text-faint hover:text-danger">{t("clearAll")}</button>}
        </div>
      </div>

      <Tabs
        items={[{ value: "transactions", label: t("tabs.transactions") }, { value: "summary", label: t("tabs.summary") }, { value: "outstanding", label: t("tabs.outstanding") }, { value: "analytics", label: t("tabs.analytics") }]}
        value={tab}
        onChange={setTab}
        className="mb-section"
      />

      {tab === "transactions" && (
        <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-line">
                <th className="w-8" />
                {([
                  ["time", t("columns.time"), true], ["reference", t("columns.reference"), false], ["items", t("columns.items"), false], ["customer", t("columns.customer"), false],
                  ["staff", t("columns.staff"), false], ["counter", t("columns.counter"), false], ["method", t("columns.method"), false], ["amount", t("columns.net"), true], ["status", t("columns.status"), true],
                ] as const).map(([key, label, sortable]) => (
                  <th key={key} className={`type-label whitespace-nowrap px-comfortable py-tight text-left text-[12px] text-muted ${key === "amount" ? "text-right" : ""}`}>
                    {sortable ? (
                      <button type="button" onClick={() => setSort((s) => ({ field: key as typeof s.field, dir: s.field === key && s.dir === "desc" ? "asc" : "desc" }))} className="uppercase tracking-wide hover:text-fg">
                        {label}{sort.field === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txQ.loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line"><td colSpan={10} className="px-comfortable py-comfortable"><div className="h-4 animate-pulse rounded-xs bg-line" /></td></tr>
              ))}
              {!txQ.loading && (txQ.data?.rows ?? []).map((r: TransactionRow) => (
                <FragmentRow key={r.id} r={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} onOpen={() => router.push(`/orders/${r.id}`)} />
              ))}
              {!txQ.loading && (txQ.data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={10} className="px-comfortable py-hero text-center text-[13px] text-faint">{t("transactions.empty")}</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-comfortable py-tight">
            <span className="font-mono text-[12px] text-faint">{txQ.data ? t("transactions.pageRange", { from: cursor + 1, to: cursor + txQ.data.rows.length, total: txQ.data.total }) : t("transactions.loadingRange")}</span>
            <div className="flex gap-tight">
              <Button size="sm" variant="secondary" disabled={cursor === 0} onClick={() => setCursor(Math.max(0, cursor - 25))}>{t("transactions.previous")}</Button>
              <Button size="sm" variant="secondary" disabled={!txQ.data?.cursor} onClick={() => setCursor(cursor + 25)}>{t("transactions.next")}</Button>
            </div>
          </div>
        </div>
      )}

      {tab === "outstanding" && (
        <div className="flex flex-col gap-section">
          <div className="grid gap-tight sm:grid-cols-2">
            <div className="card-surface p-section">
              <p className="type-label text-[12px] text-faint">{t("outstanding.totalOwed")}</p>
              <p className="mt-tight font-mono text-3xl tabular-nums text-warning">{formatMoney(totalOwed)}</p>
            </div>
            <div className="card-surface p-section">
              <p className="type-label text-[12px] text-faint">{t("outstanding.count")}</p>
              <p className="mt-tight font-mono text-3xl tabular-nums">{outstanding.length}</p>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto card-surface scroll-x-hint">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {([["reference", "left"], ["customer", "left"], ["time", "left"], ["total", "right"], ["paid", "right"], ["owed", "right"]] as const).map(([key, align]) => (
                    <th key={key} className={`type-label whitespace-nowrap px-comfortable py-tight text-[12px] text-muted text-${align}`}>{t(`outstanding.col.${key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordersQ.loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-line"><td colSpan={6} className="px-comfortable py-comfortable"><div className="h-4 animate-pulse rounded-xs bg-line" /></td></tr>
                ))}
                {!ordersQ.loading && outstanding.map(({ o, paid, owed }) => (
                  <tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-subtle/60">
                    <td className="whitespace-nowrap px-comfortable py-tight font-mono text-[12px]">{o.reference}</td>
                    <td className="px-comfortable py-tight">{o.customerName ?? <span className="text-faint">—</span>}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight font-mono text-[12px] text-muted">{o.createdAt.slice(0, 10)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums">{formatMoney(o.total)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums text-muted">{formatMoney(paid)}</td>
                    <td className="whitespace-nowrap px-comfortable py-tight text-right font-mono tabular-nums font-medium text-warning">{formatMoney(owed)}</td>
                  </tr>
                ))}
                {!ordersQ.loading && outstanding.length === 0 && (
                  <tr><td colSpan={6} className="px-comfortable py-hero text-center text-[13px] text-faint">{t("outstanding.empty")}</td></tr>
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
            <div className="mb-section grid grid-cols-2 gap-tight lg:grid-cols-4">
              {([["gross", t("summary.gross"), s?.gross, s?.prevGross], ["refunds", t("summary.refunds"), s?.refunds, undefined], ["net", t("summary.net"), s?.net, s?.prevNet], ["tickets", t("summary.tickets"), s?.ticketCount, s?.prevTicketCount]] as const).map(([key, label, v, pv]) => (
                <div key={key} className={card}>
                  <p className="type-label text-[12px] text-faint">{label}</p>
                  <p className="mt-tight whitespace-nowrap font-mono text-2xl tabular-nums">{v == null ? "—" : key === "tickets" ? String(v) : formatMoney(v as number)}</p>
                  {pv != null && v != null && <p className="mt-inline font-mono text-[12px] text-faint">{t("summary.vsPrev", { delta: d(v as number, pv as number) })}</p>}
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
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line">{[t("columns.name"), t("columns.tickets"), t("columns.gross"), t("columns.refunds"), t("columns.net"), t("columns.shareOfTotal")].map((h, i) => <th key={h} className={`type-label px-comfortable py-tight text-[12px] uppercase tracking-wide text-muted ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {(summaryQ.data?.rows ?? []).map((r) => (
                    <tr
                      key={String(r.key)}
                      className="h-12 cursor-pointer border-b border-line last:border-0 hover:bg-subtle"
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
                      <td className="min-w-0 max-w-64 truncate px-comfortable font-medium">{r.label}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{r.ticketCount}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.gross)}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums text-danger">{r.refunds ? `−${formatMoney(r.refunds)}` : "—"}</td>
                      <td className="px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.net)}</td>
                      <td className="px-comfortable text-right font-mono text-[12px] text-faint">{(r.shareOfTotal * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {tab === "analytics" && (() => {
        const a = anQ.data;
        return (
          <div className="flex flex-col gap-tight">
            <div className={card}>
              <div className="mb-tight flex items-center justify-between">
                <p className="type-label text-[12px] text-muted">{t("charts.revenueOverTime")} <span className="normal-case text-faint">{t("charts.revenueOverTimeNote")}</span></p>
                <select aria-label={t("charts.auto")} value={gran} onChange={(e) => setGran(e.target.value as typeof gran)} className={selectCls}>
                  <option value="auto">{t("charts.auto")}</option><option value="hour">{t("charts.hourly")}</option><option value="day">{t("charts.daily")}</option><option value="week">{t("charts.weekly")}</option>
                </select>
              </div>
              {anQ.loading ? chartSkeleton : hasData(a?.revenue) ? <LineChart points={a!.revenue!} fmt={money} /> : emptyChart}
            </div>

            <div className="grid gap-tight lg:grid-cols-3">
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
            <div className="grid gap-tight lg:grid-cols-3">
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

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title={t("savedViews.modalTitle")} footer={<><Button variant="secondary" onClick={() => setSaveOpen(false)}>{t("savedViews.cancel")}</Button><Button onClick={saveView}>{t("savedViews.saveButton")}</Button></>}>
        <FormField label={t("savedViews.nameLabel")} placeholder={t("savedViews.namePlaceholder")} value={viewName} onChange={(e) => setViewName(e.target.value)} help={t("savedViews.help")} />
      </Modal>
    </PageShell>
  );
}

function FragmentRow({ r, expanded, onToggle, onOpen }: { r: TransactionRow; expanded: boolean; onToggle: () => void; onOpen: () => void }) {
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
      <tr className="h-12 cursor-pointer border-b border-line hover:bg-subtle" onClick={onOpen}>
        <td className="pl-tight"><button type="button" aria-label={t("transactions.lines")} onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex h-8 w-8 items-center justify-center text-faint hover:text-fg">{expanded ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} />}</button></td>
        <td className="whitespace-nowrap px-comfortable font-mono text-[12px] tabular-nums">{day} {time}</td>
        <td className="whitespace-nowrap px-comfortable font-mono text-[12px]">{r.reference}</td>
        <td className="min-w-0 max-w-56 truncate px-comfortable">{r.itemsLabel}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted">{r.customer ?? "—"}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted">{r.staffName ?? "—"}</td>
        <td className="min-w-0 max-w-32 truncate px-comfortable text-muted">{r.counterName ?? "—"}</td>
        <td className="whitespace-nowrap px-comfortable text-[12px]">{enumL.method(r.method)}</td>
        <td className="whitespace-nowrap px-comfortable text-right font-mono text-[13px] tabular-nums">{formatMoney(r.net)}</td>
        <td className="px-comfortable"><StatusPill tone={tone[r.status]}>{enumL.status(r.status)}</StatusPill></td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-subtle">
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
