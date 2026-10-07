"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Landmark } from "lucide-react";
import { Button, DateRangePicker, formatRange } from "@/components/ui";
import { PageAction, PageShell } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { formatClockOf, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  getFinanceExtras,
  getFinanceSummary,
  listFinanceActivity,
  listLocations,
  type FinanceDay,
  type FinanceFilter,
} from "@/lib/api";
import { Balances } from "./_components/Balances";
import { ActivityTable, FILTERS, FilterSegments, SearchBox } from "./_components/Activity";
import { LineDrawer } from "./_components/LineDrawer";
import { DepositDialog, WithdrawDialog } from "./_components/MoneyDialogs";
import { useLineText, type DisplayRow } from "./_components/lineParts";

const PAGE = 10;

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
/** The range a link carries, named as a preset when it is one. */
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

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venue";

/**
 * Finances — the venue's money with Counterfoil as one balance. One row of
 * four tiles (available, unsettled, withdrawn and deposited in the table's
 * dates, with Withdraw and Deposit on the tiles they change), then the
 * transaction history as a table of days that open to their lines. The
 * venue is the one in the bar; the filters live in the address, so a view can
 * be shared.
 */
export default function FinancesPage() {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { id, location, pending } = useActiveLocation(locations);
  // Keyed on the venue, so switching it starts every query and every open row afresh.
  return (
    <Suspense fallback={null}>
      <FinancesView key={id} locationId={id} venueName={location?.name ?? ""} pending={pending} />
    </Suspense>
  );
}

function FinancesView({ locationId, venueName, pending }: { locationId: string; venueName: string; pending: boolean }) {
  const t = useTranslations("finances");
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  const wide = useMediaQuery(MD);
  const describe = useLineText();

  const [range, setRange] = useState(() => rangeFrom(sp.get("from"), sp.get("to")));
  const [filter, setFilter] = useState<FinanceFilter>(() => {
    const f = sp.get("filter");
    return FILTERS.includes(f as FinanceFilter) ? (f as FinanceFilter) : "all";
  });
  const [search, setSearch] = useState(() => sp.get("q") ?? "");
  const [q, setQ] = useState(() => (sp.get("q") ?? "").trim());
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // The view is the address: replace, never push, so Back is not a trail of keystrokes.
  useEffect(() => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (range.preset !== "30d") {
      p.set("from", range.from);
      p.set("to", range.to);
    }
    if (q) p.set("q", q);
    const s = p.toString();
    router.replace(s ? `/finances?${s}` : "/finances", { scroll: false });
  }, [filter, range, q, router]);

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const summaryQ = useApiQuery(() => getFinanceSummary(locationId, range.from, range.to), [locationId, range.from, range.to, nonce]);
  const summary = pending ? undefined : summaryQ.data;
  const extrasQ = useApiQuery(() => getFinanceExtras(locationId), [locationId, nonce]);
  const extras = pending ? undefined : extrasQ.data;

  // Activity: days, newest first, loaded a page at a time.
  const [days, setDays] = useState<FinanceDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedFor, setLoadedFor] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const pages = useRef(1);
  const lastKey = useRef("");
  const key = `${range.from}|${range.to}|${filter}|${q}`;
  const want = `${key}|${nonce}`;
  useEffect(() => {
    if (pending) return;
    if (key !== lastKey.current) {
      pages.current = 1;
      lastKey.current = key;
    }
    let alive = true;
    // Refreshing after a withdrawal reloads every page already on screen.
    listFinanceActivity(locationId, { from: range.from, to: range.to, filter, search: q, page: 1, pageSize: pages.current * PAGE }).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setDays(res.data.days);
        setTotal(res.data.total);
      }
      setLoadedFor(want);
    });
    return () => {
      alive = false;
    };
  }, [locationId, range.from, range.to, filter, q, nonce, pending, key, want]);
  const loading = pending || loadedFor !== want;

  const more = async () => {
    setLoadingMore(true);
    const next = pages.current + 1;
    const res = await listFinanceActivity(locationId, { from: range.from, to: range.to, filter, search: q, page: next, pageSize: PAGE });
    setLoadingMore(false);
    if (res.ok) {
      pages.current = next;
      setDays((d) => [...d, ...res.data.days]);
      setTotal(res.data.total);
    }
  };

  // Today and the first day open; the rest closed, until someone chooses.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const isOpen = (date: string, i: number) => openMap[date] ?? (date === DEMO_TODAY || i === 0);
  const allOpen = days.length > 0 && days.every((d, i) => isOpen(d.date, i));
  const toggleAll = () => setOpenMap(Object.fromEntries(days.map((d) => [d.date, !allOpen])));

  const [row, setRow] = useState<DisplayRow | null>(null);
  const [dialog, setDialog] = useState<"withdraw" | "deposit" | null>(null);

  const filtered = filter !== "all" || q !== "" || range.preset !== "30d";
  const clearFilters = () => {
    setFilter("all");
    setSearch("");
    setQ("");
    const [from, to] = PRESETS[3].range();
    setRange({ preset: "30d", from, to });
  };

  const viewPayouts = () => {
    setFilter("payouts");
    document.getElementById("fin-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Exactly what is on screen: the same filter, range and search, every day. */
  const downloadStatement = async () => {
    const res = await listFinanceActivity(locationId, { from: range.from, to: range.to, filter, search: q, page: 1, pageSize: 100000 });
    if (!res.ok) return;
    const head = ["Date", "Time", "Type", "Description", "Reference", "Status", "Amount"];
    const body = res.data.days.flatMap((d) =>
      d.lines.map((l) => {
        const x = describe(l);
        return [d.date, formatClockOf(l.at), l.kind, x.ref ? `${x.text} · ${x.ref}` : x.text, l.reference ?? l.orderReference ?? "", l.status, (l.amount / 100).toFixed(2)]
          .map(cell)
          .join(",");
      }),
    );
    // A byte-order mark so a spreadsheet reads Bangla descriptions correctly.
    const blob = new Blob(["﻿" + [head.join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finances-${slug(venueName)}-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets = PRESETS.map((p) => ({ value: p.value, label: t(`period.${p.value}`), range: p.range }));
  const periodLabel = PRESETS.some((p) => p.value === range.preset) ? t(`period.${range.preset}` as "period.30d") : formatRange(range.from, range.to);
  const bold = (chunks: React.ReactNode) => <span className="font-semibold text-fg">{chunks}</span>;

  const parts = summary
    ? [
        t.rich("summary.in", { amount: formatMoney(summary.period.moneyIn), b: bold }),
        t.rich("summary.fees", { amount: formatMoney(summary.period.fees), b: bold }),
        t.rich("summary.refunds", { amount: formatMoney(summary.period.refunds), b: bold }),
        t.rich("summary.paidOut", { amount: formatMoney(summary.period.paidOut), b: bold }),
      ]
    : [];

  return (
    <PageShell title={t("title")}>
      <div className="flex flex-col gap-section">
        <Balances
          summary={summary}
          extras={extras}
          onWithdraw={() => setDialog("withdraw")}
          onDeposit={() => setDialog("deposit")}
          onViewPayouts={viewPayouts}
          periodLabel={periodLabel}
        />

        <section aria-labelledby="fin-activity-title" id="fin-activity" className="card-surface scroll-mt-24">
          <div className="p-card pb-0">
            <div className="flex flex-wrap items-center justify-between gap-tight">
              <h2 id="fin-activity-title" className="text-base font-semibold tracking-[-0.4px]">{t("activity.title")}</h2>
              <div className="flex flex-wrap items-center gap-tight">
                <Button variant="secondary" size="sm" onClick={toggleAll} disabled={days.length === 0}>
                  {t(allOpen ? "activity.collapseAll" : "activity.expandAll")}
                </Button>
                <Button variant="secondary" size="sm" icon={<Download size={15} strokeWidth={1.5} />} onClick={() => void downloadStatement()}>
                  {t("activity.download")}
                </Button>
                {/* The page's ⋯ menu held this one link, in a row of its own
                    under the bar. It is a way to the bank this table's payouts
                    go to, so it sits with the table. A phone keeps the glyph. */}
                <PageAction label={t("menu.bank")} icon={<Landmark size={15} strokeWidth={1.5} />} onClick={() => router.push("/settings/payments")} />
              </div>
            </div>
            <p className="mt-inline min-h-5 text-[14px] text-muted">
              {summary && (
                <>
                  <span>{periodLabel}</span>
                  {parts.map((p, i) => (
                    <span key={i}>
                      {" · "}
                      {p}
                    </span>
                  ))}
                </>
              )}
            </p>
            <div className="mt-section flex flex-wrap items-center gap-tight pb-section">
              <FilterSegments value={filter} onChange={setFilter} />
              <DateRangePicker
                value={range}
                onChange={(r) => setRange({ preset: r.preset, from: r.from, to: r.to })}
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
                  previousMonth: tc("previousMonth"),
                  nextMonth: tc("nextMonth"),
                  days: (count) => t("range.days", { count }),
                  pickEnd: t("range.pickEnd"),
                }}
                className="w-full shrink-0 md:w-auto"
              />
              <SearchBox value={search} onChange={setSearch} />
            </div>
          </div>
          <div className="border-t border-hairline">
            <ActivityTable
              days={days}
              total={total}
              loading={loading}
              loadingMore={loadingMore}
              wide={wide}
              isOpen={isOpen}
              onToggle={(date, now) => setOpenMap((m) => ({ ...m, [date]: now }))}
              onPick={setRow}
              onMore={more}
              filtered={filtered}
              onClear={clearFilters}
            />
          </div>
        </section>
      </div>

      <LineDrawer row={row} locationId={locationId} onClose={() => setRow(null)} />
      {dialog === "withdraw" && summary && <WithdrawDialog locationId={locationId} summary={summary} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "deposit" && summary && <DepositDialog locationId={locationId} summary={summary} onClose={() => setDialog(null)} onDone={refresh} />}
    </PageShell>
  );
}
