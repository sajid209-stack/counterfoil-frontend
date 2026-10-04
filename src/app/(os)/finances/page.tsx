"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Landmark } from "lucide-react";
import { ActionMenu, DateRangePicker, PageShell, formatRange, type ActionMenuItem } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { formatClockOf, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  getFinanceSummary,
  listFinanceActivity,
  listLocations,
  peekFinanceLines,
  type FinanceDay,
  type FinanceFilter,
} from "@/lib/api";
import { Balances } from "./_components/Balances";
import { ActivityDays, FilterSegments, SearchBox } from "./_components/Activity";
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

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Finances — the venue's money with Counterfoil, as one balance. Two boxes
 * (what is still clearing, what is yours to withdraw), one place to act, and
 * the activity read like a bank statement. The venue is the one in the bar.
 */
export default function FinancesPage() {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  // Keyed on the venue, so switching it starts every query and every open row afresh.
  return <FinancesView key={id} locationId={id} pending={pending} />;
}

function FinancesView({ locationId, pending }: { locationId: string; pending: boolean }) {
  const t = useTranslations("finances");
  const tc = useTranslations("common");
  const router = useRouter();
  const wide = useMediaQuery(MD);
  const describe = useLineText();

  const [range, setRange] = useState({ preset: "30d", from: shift(DEMO_TODAY, -29), to: DEMO_TODAY });
  const [filter, setFilter] = useState<FinanceFilter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const summaryQ = useApiQuery(() => getFinanceSummary(locationId, range.from, range.to), [locationId, range.from, range.to, nonce]);
  const summary = pending ? undefined : summaryQ.data;

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

  const downloadStatement = () => {
    const rows = peekFinanceLines(locationId, range.from, range.to);
    const head = ["Date", "Time", "Type", "Description", "Reference", "Status", "Amount"];
    const body = rows.map((l) => {
      const d = describe(l);
      const date = new Date(l.at);
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return [day, formatClockOf(l.at), l.kind, d.ref ? `${d.text} · ${d.ref}` : d.text, l.reference ?? l.orderReference ?? "", l.status, (l.amount / 100).toFixed(2)]
        .map(cell)
        .join(",");
    });
    // A byte-order mark so a spreadsheet reads Bangla descriptions correctly.
    const blob = new Blob(["﻿" + [head.join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finances-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItems: ActionMenuItem[] = [
    { key: "csv", label: t("menu.statement"), icon: <Download size={16} strokeWidth={1.5} />, onSelect: downloadStatement },
    { key: "bank", label: t("menu.bank"), icon: <Landmark size={16} strokeWidth={1.5} />, onSelect: () => router.push("/settings/payments") },
  ];
  const menu = <ActionMenu label={t("more")} items={menuItems} />;

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
    <PageShell title={t("title")} actions={wide ? menu : undefined}>
      <div className="flex flex-col gap-section">
        <Balances summary={summary} onWithdraw={() => setDialog("withdraw")} onDeposit={() => setDialog("deposit")} menu={wide ? undefined : menu} />

        <section aria-labelledby="fin-activity" className="card-surface">
          <div className="p-card pb-0">
            <h2 id="fin-activity" className="text-base font-semibold tracking-[-0.4px]">{t("activity.title")}</h2>
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
            <ActivityDays
              days={days}
              total={total}
              loading={loading}
              loadingMore={loadingMore}
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
