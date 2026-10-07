"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw, Search } from "lucide-react";
import { Button, DataTable, EmptyState, PageShell, useToast } from "@/components/ui";
import { NO_ONE, orderMethodOf } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { RefundRequests } from "@/components/RefundRequests";
import { OrderCard, firstDirection, useOrderColumns } from "./_components/columns";
import { OrdersPager } from "./_components/OrdersPager";
import { OrdersToolbar, type FacetOptions } from "./_components/OrdersToolbar";
import { SalesFigures } from "./_components/SalesFigures";
import { SummarySheet } from "./_components/SummarySheet";
import type { ChipOption } from "./_components/FilterChip";
import { downloadCsv, reportFileName, salesCsv, summaryCsv, type Tr } from "./_lib/csv";
import { CHANNELS, METHODS, STATUSES, activeCount, cleared, parseFilters, toSearch, type SalesFilters } from "./_lib/filters";
import { TOGGLEABLE, useHiddenColumns } from "./_lib/columns";
import { useSalesLabels } from "./_lib/labels";
import { useSalesReport } from "./_lib/useReport";

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}

/**
 * Orders — a sales report you can read, filter, export and print.
 *
 * The page is its address: every filter, the sort, the page and its size are in
 * the query string, so a filtered report is a link, and Reset, Back and a
 * reload all do what they say. The venue is the console's lens, from the bar;
 * the filters narrow within it. One person's orders (`?customerId=`, from the
 * customer page) ignore the venue and say so in a banner.
 *
 * The figures beside the search, the Summary, the CSV and the printouts all
 * come from `useSalesReport`, so they are one number said four ways.
 */
function OrdersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("orders");
  const toast = useToast();
  /* One clock, the app's own — the same pinned demo instant the till and the
     calendar use, so "2h ago" here and "today" in the calendar agree. */
  const now = useMemo(() => demoNow(), []);

  /* The filters, held here and mirrored to the address. The address is the
     record — a link, Back, a reload all read it — but it is not what the screen
     waits on: a tick that has to round-trip through the router before the chip
     shows it is a tick that two quick clicks can lose, the second computed from
     the page as it was before the first. So a change lands in state at once and
     is written to the address after it; and an address that changes by some
     other hand (Back, a link) is adopted, while one of our own landing is not. */
  const urlString = params.toString();
  const [f, setF] = useState<SalesFilters>(() => parseFilters(params));
  const [seenUrl, setSeenUrl] = useState(urlString);
  const [written, setWritten] = useState<string[]>([]);
  if (urlString !== seenUrl) {
    setSeenUrl(urlString);
    const mine = written.indexOf(urlString);
    if (mine >= 0) setWritten(written.slice(mine + 1));
    else {
      setF(parseFilters(params));
      setWritten([]);
    }
  }
  const latest = useRef(f);
  useEffect(() => {
    latest.current = f;
  }, [f]);

  const report = useSalesReport(f);
  const { dir, rows, summary } = report;
  const L = useSalesLabels(dir);
  const allColumns = useOrderColumns(dir, L);
  const cols = useHiddenColumns();
  const columns = useMemo(() => allColumns.filter((c) => !cols.hidden.includes(c.key)), [allColumns, cols.hidden]);

  const go = (next: SalesFilters) => {
    latest.current = next;
    setF(next);
    const qs = toSearch(next);
    setWritten((w) => [...w, qs]);
    /* The native History API, which Next integrates with `useSearchParams`:
       the address changes at once and without a trip to the server. `router.replace`
       asks the server for the new URL's payload, which on a busy dev machine
       took seconds to move an address the screen had already moved. */
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  /* A change to a filter, the sort or the size starts again at page one; only
     a move between pages keeps its place. It builds on the latest change, not
     on what was last drawn. */
  const set = (patch: Partial<SalesFilters>) => go({ ...latest.current, page: 1, ...patch });

  /* The search box types faster than the address should change, so it keeps its
     own text and writes to the address after a pause. When the address changes
     by some other route — Reset, Back — the box follows it, unless the change
     is the one this box just made. */
  const [draft, setDraft] = useState(f.q);
  const [seen, setSeen] = useState(f.q);
  const [pushed, setPushed] = useState(f.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  if (f.q !== seen) {
    setSeen(f.q);
    if (f.q !== pushed) setDraft(f.q);
  }
  const onSearch = (v: string) => {
    setDraft(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPushed(v);
      go({ ...latest.current, q: v, page: 1 });
    }, 250);
  };
  const reset = () => {
    clearTimeout(timer.current);
    setDraft("");
    go(cleared(latest.current));
  };

  /* ── What each filter offers ─────────────────────────────────────────────
     Taken from the venue's own orders, ignoring the other filters, so the
     choices do not shrink as you choose. A value that is already in the
     address stays on offer even if nothing matches it. */
  const options = useMemo<FacetOptions>(() => {
    const scope = report.scope;
    const ensure = (list: ChipOption[], chosen: string[], name: (v: string) => string) => [
      ...list,
      ...chosen.filter((v) => !list.some((o) => o.value === v)).map((v) => ({ value: v, label: name(v) })),
    ];
    const venueCounters = dir.counters.filter((c) => f.customerId || c.locationId === report.venueId).map((c) => ({ value: c.id, label: c.name }));
    const counters = [...venueCounters, ...(scope.some((o) => !o.counterId) ? [{ value: NO_ONE, label: L.counter(NO_ONE) }] : [])];
    const staffIds = [...new Set(scope.map((o) => o.staffId).filter((x): x is string => !!x))];
    const staff = [
      ...staffIds.map((id) => ({ value: id, label: dir.staffName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
      ...(scope.some((o) => !o.staffId) ? [{ value: NO_ONE, label: L.staff(NO_ONE) }] : []),
    ];
    const used = new Set<string>(scope.map(orderMethodOf));
    return {
      counters: ensure(counters, f.counters, L.counter),
      staff: ensure(staff, f.staff, L.staff),
      channels: CHANNELS.map((c) => ({ value: c, label: L.channel(c) })),
      methods: ensure(METHODS.filter((m) => used.has(m) || f.methods.includes(m)).map((m) => ({ value: m, label: L.method(m) })), f.methods, L.method),
      statuses: STATUSES.map((s) => ({ value: s, label: L.status(s) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.scope, report.venueId, dir.counters, dir.staffName, f.counters, f.staff, f.methods, f.customerId]);

  /* ── The page of rows on screen ───────────────────────────────────────── */
  const pages = Math.max(1, Math.ceil(rows.length / f.size));
  const page = Math.min(f.page, pages);
  const pageRows = useMemo(() => rows.slice((page - 1) * f.size, page * f.size), [rows, page, f.size]);
  const firstLoad = report.loading && report.scope.length === 0;

  /* ── Summary, Export, Print ───────────────────────────────────────────── */
  const [sheet, setSheet] = useState(false);
  const venueName = report.venue?.name ?? "";
  const filterText = L.describe(f, venueName).join(" · ");
  const tr: Tr = (key, values) => t(key as never, values as never);
  const context = () => ({ t: tr, L, dir, venueName, filterText, generated: formatDateTime(new Date().toISOString()) });
  const printHref = (kind: "summary" | "list") => `/print/orders/${kind}?${toSearch({ ...f, page: 1 }, { venue: report.venueId })}`;

  const onExport = () => {
    downloadCsv(reportFileName("sales", venueName, f, rows), salesCsv(rows, summary, context()));
    toast.success(t("exported", { count: rows.length }));
  };
  const onDownloadSummary = () => {
    downloadCsv(reportFileName("sales-summary", venueName, f, rows), summaryCsv(summary, context()));
    toast.success(t("summary.downloaded"));
  };

  const narrowed = activeCount(f) > 0;

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        {/* Refunds the counter has asked for come first: each one is a guest
            waiting on an answer. Nothing is drawn when none are waiting. */}
        <RefundRequests onDecided={() => report.reload()} />

        {f.customerId && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-x-section gap-y-tight rounded-md border border-line bg-card px-section py-tight">
            <p className="min-w-0 break-words text-sm text-fg">{f.customer ? t("forCustomer", { name: f.customer }) : t("forCustomerAnon")}</p>
            <Button variant="tertiary" size="sm" onClick={() => go({ ...latest.current, customerId: "", customer: "", page: 1 })}>
              {t("forCustomerClear")}
            </Button>
          </div>
        )}

        <OrdersToolbar
          f={f}
          set={set}
          options={options}
          labels={L}
          disabled={firstLoad}
          onSummary={() => setSheet(true)}
          onExport={onExport}
          onPrint={() => router.push(printHref("list"))}
          columns={{
            options: allColumns.filter((c) => TOGGLEABLE.includes(c.key as never)).map((c) => ({ value: c.key, label: String(c.header) })),
            value: TOGGLEABLE.filter((k) => !cols.hidden.includes(k)),
            onChange: (shown) => cols.set(TOGGLEABLE.filter((k) => !shown.includes(k))),
            onReset: () => cols.set(null),
          }}
        />

        {/* Search and Reset on the left, the figures for what is matched on the
            right — one quiet panel, not a band of cards. */}
        <section aria-label={t("figures.label")} className="card-surface flex flex-wrap items-center justify-between gap-x-major gap-y-section p-card">
          <div className="flex min-w-0 max-md:w-full items-center gap-tight">
            <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
              <Search size={16} strokeWidth={1.5} aria-hidden className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={draft}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("filterResults")}
                className="h-11 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none placeholder:text-muted focus:border-inverse md:h-9"
              />
            </div>
            <Button variant="secondary" size="sm" disabled={!narrowed} icon={<RotateCcw size={14} strokeWidth={1.5} />} onClick={reset} aria-label={t("reset")} className="max-md:w-11 max-md:px-0">
              <span className="max-md:sr-only">{t("reset")}</span>
            </Button>
          </div>
          <SalesFigures summary={summary} loading={firstLoad} />
        </section>

        <DataTable
          columns={columns}
          rows={pageRows}
          getRowId={(o) => o.id}
          loading={firstLoad}
          sort={{ key: f.sort, order: f.dir }}
          onSortChange={(key) => set(key === f.sort ? { dir: f.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: firstDirection(key) })}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          minWidth="62rem"
          height="page"
          cardVariant="list"
          renderCard={(o) => <OrderCard o={o} now={now} />}
          emptyState={
            <EmptyState
              title={t("emptyTitle")}
              message={t("emptyMessage")}
              action={narrowed ? <Button variant="secondary" onClick={reset}>{t("reset")}</Button> : undefined}
            />
          }
        />

        <OrdersPager
          page={page}
          size={f.size}
          total={rows.length}
          loading={firstLoad}
          onPage={(p) => go({ ...latest.current, page: p })}
          onSize={(size) => set({ size })}
        />
      </div>

      <SummarySheet
        open={sheet}
        onClose={() => setSheet(false)}
        summary={summary}
        labels={L}
        filterText={filterText}
        onDownload={onDownloadSummary}
        onPrint={() => router.push(printHref("summary"))}
      />
    </PageShell>
  );
}
