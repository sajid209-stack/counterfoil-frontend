"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, RotateCcw, Search, SearchX, TicketCheck } from "lucide-react";
import { Button, DataTable, DateRangePicker, EmptyState, PageShell, Select, StatusPill, formatRange, useToast, type Column, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { formatClock, formatDateTime, formatDay } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  ISSUED_STATES,
  issuedTicketsCsv,
  listIssuedBookings,
  listIssuedTickets,
  listLocations,
  type IssuedQuery,
  type IssuedSortKey,
  type IssuedState,
  type IssuedTicket,
} from "@/lib/api";
import { MultiSelect } from "../expenses/_components/MultiSelect";

/* ── Dates ───────────────────────────────────────────────────────────────
   The same presets and the same default (last 30 days) Expenses uses, on the
   demo clock — never the wall clock, which the seed is nowhere near. */
const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthStart = (day: string) => `${day.slice(0, 8)}01`;
const lastMonth = (): [string, string] => {
  const end = shift(monthStart(DEMO_TODAY), -1);
  return [monthStart(end), end];
};
const PRESETS: { value: string; range: () => [string, string] }[] = [
  { value: "today", range: () => [DEMO_TODAY, DEMO_TODAY] },
  { value: "yesterday", range: () => [shift(DEMO_TODAY, -1), shift(DEMO_TODAY, -1)] },
  { value: "7d", range: () => [shift(DEMO_TODAY, -6), DEMO_TODAY] },
  { value: "30d", range: () => [shift(DEMO_TODAY, -29), DEMO_TODAY] },
  { value: "month", range: () => [monthStart(DEMO_TODAY), DEMO_TODAY] },
  { value: "lastmonth", range: lastMonth },
];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const rangeFrom = (from: string | null, to: string | null) => {
  if (from && to && ISO.test(from) && ISO.test(to) && from <= to) {
    const hit = PRESETS.find((p) => {
      const [a, b] = p.range();
      return a === from && b === to;
    });
    return { preset: hit?.value ?? "custom", from, to };
  }
  const [a, b] = PRESETS[3].range();
  return { preset: "30d", from: a, to: b };
};

const SORT_KEYS: IssuedSortKey[] = ["code", "state", "start", "customer", "booking", "variant", "issued", "order"];
type Dir = "asc" | "desc";
/** Dates read newest first; words and codes read A to Z. */
const firstDirection = (k: IssuedSortKey): Dir => (k === "issued" || k === "start" ? "desc" : "asc");
const PAGE_SIZES = [10, 20, 50, 100];

const listOf = <V extends string>(raw: string | null, allowed?: readonly V[]): V[] =>
  raw ? raw.split(",").filter((x): x is V => !!x && (!allowed || (allowed as readonly string[]).includes(x))) : [];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venue";

/** Unused is the only state that is still waiting to happen, so it is the quiet
 *  outline; the other three are tinted by what became of the ticket. */
const PILL: Record<IssuedState, { tone: PillTone; shape: "record" | "transaction" }> = {
  unused: { tone: "neutral", shape: "record" },
  part: { tone: "info", shape: "transaction" },
  used: { tone: "success", shape: "transaction" },
  void: { tone: "danger", shape: "transaction" },
};

/**
 * Issued orders — every ticket that has been issued, one row each.
 *
 * Orders answers "what did we sell"; this answers "what is out there, and has
 * it been used". It is the same sales read one ticket at a time: the booking
 * number is the code that scans, the status says whether it has been through
 * the gate, and a row opens the ticket's own record. The venue is the one in
 * the bar, and the view lives in the address so it can be shared.
 */
export default function IssuedOrdersPage() {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { id, location, pending } = useActiveLocation(locations);
  // Keyed on the venue: switching it starts every query afresh.
  return (
    <Suspense fallback={null}>
      <IssuedView key={id} locationId={id} venueName={location?.name ?? ""} pending={pending} />
    </Suspense>
  );
}

function IssuedView({ locationId, venueName, pending }: { locationId: string; venueName: string; pending: boolean; }) {
  const t = useTranslations("tickets.issued");
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [range, setRange] = useState(() => rangeFrom(sp.get("from"), sp.get("to")));
  const [states, setStates] = useState<IssuedState[]>(() => listOf(sp.get("st"), ISSUED_STATES));
  const [products, setProducts] = useState<string[]>(() => listOf<string>(sp.get("bk")));
  const [search, setSearch] = useState(() => sp.get("q") ?? "");
  const [q, setQ] = useState(() => (sp.get("q") ?? "").trim());
  const [sort, setSort] = useState<{ key: IssuedSortKey; order: Dir }>(() => {
    const k = sp.get("sort") as IssuedSortKey | null;
    const key = k && SORT_KEYS.includes(k) ? k : "issued";
    const d = sp.get("dir");
    return { key, order: d === "asc" || d === "desc" ? d : firstDirection(key) };
  });
  const [page, setPage] = useState(() => Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1));
  const [size, setSize] = useState(() => {
    const n = parseInt(sp.get("size") ?? "", 10);
    return PAGE_SIZES.includes(n) ? n : 20;
  });
  useEffect(() => {
    const timer = setTimeout(() => setQ((prev) => (prev === search.trim() ? prev : search.trim())), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const query: IssuedQuery = useMemo(
    () => ({ locationId, from: range.from, to: range.to, states, productIds: products, search: q, sort: sort.key, order: sort.order }),
    [locationId, range.from, range.to, states, products, q, sort.key, sort.order],
  );
  const listQ = useApiQuery(() => listIssuedTickets({ ...query, page, pageSize: size }), [query, page, size]);
  const bookingsQ = useApiQuery(() => listIssuedBookings(locationId), [locationId]);

  const rows = pending ? undefined : listQ.data?.data;
  const info = listQ.data?.page;
  const summary = listQ.data?.summary;
  // A page past the end is shown as the last one; the address says so too.
  const shownPage = info?.page ?? page;

  // The view is the address: replace, never push, so Back is not a trail of keystrokes.
  useEffect(() => {
    const p = new URLSearchParams();
    if (range.preset !== "30d") {
      p.set("from", range.from);
      p.set("to", range.to);
    }
    if (states.length) p.set("st", states.join(","));
    if (products.length) p.set("bk", products.join(","));
    if (q) p.set("q", q);
    if (sort.key !== "issued" || sort.order !== "desc") {
      p.set("sort", sort.key);
      p.set("dir", sort.order);
    }
    if (shownPage > 1) p.set("page", String(shownPage));
    if (size !== 20) p.set("size", String(size));
    const s = p.toString();
    window.history.replaceState(null, "", s ? `/issued-orders?${s}` : "/issued-orders");
  }, [range, states, products, q, sort, shownPage, size]);

  const filtered = range.preset !== "30d" || states.length > 0 || products.length > 0 || q !== "";
  const reset = () => {
    const [from, to] = PRESETS[3].range();
    setRange({ preset: "30d", from, to });
    setStates([]);
    setProducts([]);
    setSearch("");
    setQ("");
    setPage(1);
  };
  const onSort = (key: string) => {
    const k = key as IssuedSortKey;
    setSort((s) => (s.key === k ? { key: k, order: s.order === "asc" ? "desc" : "asc" } : { key: k, order: firstDirection(k) }));
    setPage(1);
  };

  const stateLabel = (s: IssuedState) => t(`state.${s}`);
  const startText = (r: IssuedTicket) => (r.startTime ? `${formatDay(r.startDate)}, ${formatClock(r.startTime)}` : formatDay(r.startDate));

  // The spreadsheet is exactly what is filtered, every page.
  const download = () => {
    const csv = issuedTicketsCsv(query, {
      headers: [t("csv.code"), t("csv.status"), t("csv.start"), t("csv.customer"), t("csv.booking"), t("csv.variant"), t("csv.issued"), t("csv.order")],
      state: stateLabel,
      walkIn: t("walkIn"),
      start: startText,
      issued: (r) => formatDateTime(r.issuedAt),
    });
    // A byte-order mark so a spreadsheet reads Bangla correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `issued-orders-${slug(venueName)}-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported", { count: summary?.issued ?? 0 }));
  };

  const presets = PRESETS.map((p) => ({ value: p.value, label: t(`period.${p.value}` as "period.30d"), range: p.range }));

  const columns: Column<IssuedTicket>[] = [
    {
      key: "code",
      header: t("col.code"),
      sortable: true,
      render: (r) => <span className="whitespace-nowrap font-mono text-[13px]">{r.code}</span>,
    },
    {
      key: "state",
      header: t("col.status"),
      sortable: true,
      render: (r) => (
        <StatusPill tone={PILL[r.state].tone} shape={PILL[r.state].shape}>
          {stateLabel(r.state)}
        </StatusPill>
      ),
    },
    {
      key: "start",
      header: t("col.start"),
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-[0.8125rem] tabular-nums">{startText(r)}</span>,
    },
    {
      key: "booking",
      header: t("col.booking"),
      sortable: true,
      render: (r) => (
        <span className="block min-w-0 max-w-[16rem] truncate font-medium" title={r.bookingName}>
          {r.bookingName}
        </span>
      ),
    },
    {
      key: "variant",
      header: t("col.variant"),
      sortable: true,
      render: (r) => (
        <span className="block min-w-0 max-w-[10rem]">
          <span className="block truncate text-[0.8125rem]" title={r.variantName}>{r.variantName}</span>
          {r.admits > 1 && r.state !== "void" && (
            <span className="block text-[12px] text-muted">{t("partOf", { used: r.used, total: r.admits })}</span>
          )}
        </span>
      ),
    },
    {
      key: "issued",
      header: t("col.issued"),
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-[0.8125rem] tabular-nums">{formatDateTime(r.issuedAt)}</span>,
    },
    {
      key: "order",
      header: t("col.order"),
      sortable: true,
      render: (r) => (
        <span className="block min-w-0 max-w-[11rem]">
          <Link
            href={`/orders/${r.orderId}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-mono text-[13px] text-brand-foreground underline-offset-2 hover:underline"
          >
            {r.orderReference}
          </Link>
          <span className="block truncate text-[12px] text-muted">{r.customerName ?? t("walkIn")}</span>
        </span>
      ),
    },
  ];

  /* The phone's row: what it is and where it stands on the first line, the
     code and its variant under it, then when. */
  const renderCard = (r: IssuedTicket) => (
    <div className="flex min-w-0 flex-col gap-inline">
      <div className="flex items-center justify-between gap-tight">
        <span className="min-w-0 truncate text-sm font-medium">{r.bookingName}</span>
        <StatusPill tone={PILL[r.state].tone} shape={PILL[r.state].shape} className="shrink-0">
          {stateLabel(r.state)}
        </StatusPill>
      </div>
      <span className="truncate text-[12px] text-muted">
        <span className="font-mono">{r.code}</span> · {r.variantName}
      </span>
      <span className="truncate text-[12px] text-muted">
        {startText(r)} · {formatDateTime(r.issuedAt)}
      </span>
    </div>
  );

  const summaryParts = summary
    ? [
        summary.issued > 0 ? t("sum.issued", { count: summary.issued }) : t("sum.none"),
        ...(summary.issued > 0 ? [t("sum.used", { count: summary.used })] : []),
        ...(summary.part > 0 ? [t("sum.part", { count: summary.part })] : []),
        ...(summary.void > 0 ? [t("sum.void", { count: summary.void })] : []),
      ]
    : [];

  const loading = pending || listQ.loading;
  const Icon = filtered ? SearchX : TicketCheck;

  return (
    <PageShell title={t("title")}>
      <div className="flex flex-col gap-section">
        <div className="flex flex-wrap items-center gap-tight">
          <DateRangePicker
            value={range}
            onChange={(r) => {
              setRange({ preset: r.preset, from: r.from, to: r.to });
              setPage(1);
            }}
            presets={presets}
            today={DEMO_TODAY}
            max={DEMO_TODAY}
            labels={{
              choose: t("range.choose"),
              custom: t("range.custom"),
              from: t("range.from"),
              to: t("range.to"),
              apply: t("range.apply"),
              cancel: t("range.cancel"),
              previousMonth: t("range.previousMonth"),
              nextMonth: t("range.nextMonth"),
              days: (count) => t("range.days", { count }),
              pickEnd: t("range.pickEnd"),
            }}
            className="w-full shrink-0 md:w-auto"
          />
          <div className="grid w-full grid-cols-2 gap-tight md:contents">
            <MultiSelect
              label={t("filters.status")}
              value={states}
              onChange={(v) => {
                setStates(v);
                setPage(1);
              }}
              options={ISSUED_STATES.map((s) => ({ value: s, label: stateLabel(s) }))}
              clearLabel={t("filters.clear")}
            />
            <MultiSelect
              label={t("filters.booking")}
              value={products}
              onChange={(v) => {
                setProducts(v);
                setPage(1);
              }}
              options={(bookingsQ.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              clearLabel={t("filters.clear")}
            />
          </div>
          <label className="relative min-w-[10rem] flex-1 basis-40 md:max-w-72">
            <Search size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-11 w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9"
            />
          </label>
          <div className="flex flex-wrap items-center gap-tight md:ml-auto">
            {filtered && (
              <Button variant="tertiary" size="sm" icon={<RotateCcw size={15} strokeWidth={1.5} aria-hidden />} onClick={reset}>
                {t("reset")}
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={<Download size={15} strokeWidth={1.5} aria-hidden />} onClick={download} disabled={!summary || summary.issued === 0}>
              {t("export")}
            </Button>
          </div>
        </div>

        {/* One quiet line, not a band of cards: the table is the point. */}
        <p className="text-[0.8125rem] tabular-nums text-muted" aria-live="polite">
          {summary ? summaryParts.join(" · ") : "…"}
          <span className="sr-only"> {formatRange(range.from, range.to)}</span>
        </p>

        {listQ.error && !rows ? (
          <div className="card-surface flex flex-col items-center gap-tight p-card py-major text-center">
            <p className="text-[15px] font-semibold">{t("error.title")}</p>
            <p className="text-[13px] text-muted">{t("error.text")}</p>
            <Button variant="secondary" icon={<RotateCcw size={15} strokeWidth={1.5} aria-hidden />} onClick={() => listQ.reload()} className="mt-tight">
              {t("error.retry")}
            </Button>
          </div>
        ) : (
          <div className={cn("flex flex-col gap-section transition-opacity", loading && rows && "opacity-60")} aria-busy={loading}>
            <DataTable
              columns={columns}
              rows={rows ?? []}
              getRowId={(r) => r.id}
              loading={!rows}
              sort={sort}
              onSortChange={onSort}
              onRowClick={(r) => router.push(`/tickets/${r.id}`)}
              minWidth="64rem"
              height="page"
              cardVariant="list"
              renderCard={renderCard}
              emptyState={
                <EmptyState
                  icon={<Icon size={30} strokeWidth={1.25} aria-hidden />}
                  title={filtered ? t("empty.filteredTitle") : t("empty.title")}
                  message={filtered ? t("empty.filteredText") : t("empty.text")}
                  action={
                    filtered ? (
                      <Button variant="secondary" onClick={reset}>
                        {t("reset")}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
            {rows && rows.length > 0 && info && (
              <Pager
                page={shownPage}
                totalPages={info.totalPages}
                pageSize={size}
                total={info.total}
                onPage={setPage}
                onPageSize={(n) => {
                  setSize(n);
                  setPage(1);
                }}
              />
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

/** Showing 1–20 of 64 · Show 20 · Previous · Page 1 of 4 · Next — the pager Orders and Expenses draw. */
function Pager({ page, totalPages, pageSize, total, onPage, onPageSize }: { page: number; totalPages: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const t = useTranslations("tickets.issued.page");
  const wide = useMediaQuery(MD);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "inline-flex h-11 items-center gap-inline rounded-sm border border-line px-comfortable text-[0.8125rem] font-medium text-fg transition-colors duration-quick hover:enabled:border-inverse disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60 md:h-9";
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-x-section gap-y-tight">
      <p className="text-[0.8125rem] tabular-nums text-muted" aria-live="polite">
        {t("showing", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-tight">
        <div className="flex items-center gap-tight">
          <span id="issued-size-label" className="text-[0.8125rem] text-muted">{t("show")}</span>
          <Select
            aria-labelledby="issued-size-label"
            size={wide ? "sm" : "md"}
            value={String(pageSize)}
            onChange={(v) => onPageSize(Number(v))}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </div>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} strokeWidth={1.5} aria-hidden />
          {t("previous")}
        </button>
        <span className="min-w-[5.5rem] text-center text-[0.8125rem] tabular-nums text-muted">{t("of", { page, total: totalPages })}</span>
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          {t("next")}
          <ChevronRight size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
