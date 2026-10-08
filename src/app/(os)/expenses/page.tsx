"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Plus } from "lucide-react";
import { Button, DateRangePicker, FilterBar, FilterSearch, Modal, PageShell, formatRange, useToast, type FilterSpec } from "@/components/ui";
import { PageAction } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import { useActiveLocation } from "@/lib/activeLocation";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  EXPENSE_CATEGORIES,
  PAID_FROM,
  deleteExpense,
  expensesCsv,
  getExpenseSummary,
  listExpensePayees,
  listExpenses,
  listLocations,
  restoreExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseQuery,
  type ExpenseSortKey,
  type Location,
  type PaidFrom,
} from "@/lib/api";
import { ExpenseDrawer, type DrawerMode } from "./_components/ExpenseDrawer";
import { ExpenseTable, PAGE_SIZES, type Sort } from "./_components/ExpenseTable";
import { ChipChoices } from "./_components/ChipChoices";
import { Summary } from "./_components/Summary";
import { shortDate, useExpenseLabels } from "./_components/parts";

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
/** The range a link carries, named as a preset when it is one. The default is the last 30 days. */
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

const SORT_KEYS: ExpenseSortKey[] = ["date", "ref", "title", "category", "paidFrom", "items", "total", "recordedBy"];
/** Words read upward first; dates and money read biggest first. */
const firstDirection = (k: ExpenseSortKey): Sort["order"] => (["ref", "title", "category", "paidFrom", "recordedBy"].includes(k) ? "asc" : "desc");

const listOf = <V extends string>(raw: string | null, allowed: readonly V[]): V[] => (raw ? raw.split(",").filter((x): x is V => (allowed as readonly string[]).includes(x)) : []);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "venue";

/**
 * Expenses — what the venue spends, written down where it happened.
 *
 * A toolbar (search, the date range, one Filters button for category and how it
 * was paid, and the one create button), one summary card whose figures add up
 * exactly what the table lists, and the table — `DataTable`, the same one
 * Orders and Customers use. A row
 * opens its drawer to read or change it; the menu on a row edits, copies (for
 * a cost that comes round again) or deletes with an Undo.
 * The venue is the one in the bar, and the view lives in the address, so it can
 * be shared or bookmarked.
 */
export default function ExpensesPage() {
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { id, location, pending } = useActiveLocation(locations);
  // Keyed on the venue: switching it starts every query and every open panel afresh.
  return (
    <Suspense fallback={null}>
      <ExpensesView key={id} locationId={id} venueName={location?.name ?? ""} pending={pending} locations={locations} />
    </Suspense>
  );
}

function ExpensesView({ locationId, venueName, pending, locations }: { locationId: string; venueName: string; pending: boolean; locations: Location[] }) {
  const t = useTranslations("expenses");
  const labels = useExpenseLabels();
  const sp = useSearchParams();
  const wide = useMediaQuery(MD);
  const toast = useToast();

  const [range, setRange] = useState(() => rangeFrom(sp.get("from"), sp.get("to")));
  const [cats, setCats] = useState<ExpenseCategory[]>(() => listOf(sp.get("cat"), EXPENSE_CATEGORIES));
  const [paid, setPaid] = useState<PaidFrom[]>(() => listOf(sp.get("pay"), PAID_FROM));
  const [search, setSearch] = useState(() => sp.get("q") ?? "");
  const [q, setQ] = useState(() => (sp.get("q") ?? "").trim());
  const [sort, setSort] = useState<Sort>(() => {
    const k = sp.get("sort") as ExpenseSortKey | null;
    const key = k && SORT_KEYS.includes(k) ? k : "date";
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

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const query: ExpenseQuery = useMemo(
    () => ({ locationId, from: range.from, to: range.to, categories: cats, paidFrom: paid, search: q, sort: sort.key, order: sort.order }),
    [locationId, range.from, range.to, cats, paid, q, sort.key, sort.order],
  );
  const listQ = useApiQuery(() => listExpenses({ ...query, page, pageSize: size }), [query, page, size, nonce]);
  const sumQ = useApiQuery(() => getExpenseSummary(query), [query, nonce]);
  const payeesQ = useApiQuery(() => listExpensePayees(locationId), [locationId, nonce]);

  const rows = pending ? undefined : listQ.data?.data;
  const info = listQ.data?.page;
  // A page past the end is shown as the last one; the address says so too.
  const shownPage = info?.page ?? page;
  const summary = pending ? undefined : sumQ.data;

  // The view is the address: replace, never push, so Back is not a trail of keystrokes.
  useEffect(() => {
    const p = new URLSearchParams();
    if (range.preset !== "30d") {
      p.set("from", range.from);
      p.set("to", range.to);
    }
    if (cats.length) p.set("cat", cats.join(","));
    if (paid.length) p.set("pay", paid.join(","));
    if (q) p.set("q", q);
    if (sort.key !== "date" || sort.order !== "desc") {
      p.set("sort", sort.key);
      p.set("dir", sort.order);
    }
    if (shownPage > 1) p.set("page", String(shownPage));
    if (size !== 20) p.set("size", String(size));
    const s = p.toString();
    // The native history API, which the Next router listens to: no round trip to the
    // server for a view that is only a query string.
    window.history.replaceState(null, "", s ? `/expenses?${s}` : "/expenses");
  }, [range, cats, paid, q, sort, shownPage, size]);

  const filtered = range.preset !== "30d" || cats.length > 0 || paid.length > 0 || q !== "";
  const reset = () => {
    const [from, to] = PRESETS[3].range();
    setRange({ preset: "30d", from, to });
    setCats([]);
    setPaid([]);
    setSearch("");
    setQ("");
    setPage(1);
  };

  /* A legend row in the summary narrows the list to that category; pressing the
     only chosen one again clears it. */
  const pickCategory = (c: ExpenseCategory) => {
    setCats((cur) => (cur.length === 1 && cur[0] === c ? [] : [c]));
    setPage(1);
  };

  const onSort = (key: ExpenseSortKey) => {
    setSort((s) => (s.key === key ? { key, order: s.order === "asc" ? "desc" : "asc" } : { key, order: firstDirection(key) }));
    setPage(1);
  };

  // ── the drawer, and delete ──
  const [drawer, setDrawer] = useState<{ n: number; mode: DrawerMode; expense?: Expense } | null>(null);
  const open = (mode: DrawerMode, expense?: Expense) => setDrawer((d) => ({ n: (d?.n ?? 0) + 1, mode, expense }));
  const [doomed, setDoomed] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Stable: the dialog re-arms its focus handling whenever this changes. */
  const closeDoomed = useCallback(() => setDoomed(null), []);

  const [freshId, setFreshId] = useState("");
  const saved = (e: Expense, kind: "created" | "updated") => {
    setDrawer(null);
    refresh();
    setFreshId(e.id);
    setTimeout(() => setFreshId((id) => (id === e.id ? "" : id)), 3000);
    if (kind === "updated") {
      toast.success(t("toast.updated", { title: e.title }));
      return;
    }
    const needle = q.toLowerCase();
    const shown =
      e.locationId === locationId &&
      e.date >= range.from &&
      e.date <= range.to &&
      (cats.length === 0 || cats.includes(e.category)) &&
      (paid.length === 0 || paid.includes(e.paidFrom)) &&
      (!needle || e.title.toLowerCase().includes(needle) || (e.payee?.toLowerCase().includes(needle) ?? false) || e.ref.toLowerCase().includes(needle));
    if (e.locationId !== locationId) toast.success(t("toast.addedElsewhere", { title: e.title, venue: locations.find((l) => l.id === e.locationId)?.name ?? "" }));
    else toast.success(shown ? t("toast.added", { title: e.title, amount: formatMoney(e.total) }) : t("toast.addedHidden", { title: e.title }));
  };

  const confirmDelete = async () => {
    if (!doomed) return;
    setDeleting(true);
    const gone = doomed;
    const res = await deleteExpense(gone.id);
    setDeleting(false);
    setDoomed(null);
    if (!res.ok) {
      toast.error(t("toast.deleteFailed"));
      return;
    }
    setDrawer((d) => (d?.expense?.id === gone.id ? null : d));
    refresh();
    toast.success(t("toast.deleted", { title: gone.title }), {
      label: t("toast.undo"),
      run: () => {
        void restoreExpense(gone.id).then((r) => {
          if (r.ok) {
            refresh();
            toast.success(t("toast.restored", { title: gone.title }));
          }
        });
      },
    });
  };

  // ── the spreadsheet: exactly what is filtered, every page ──
  const downloadCsv = () => {
    const csv = expensesCsv(query, {
      headers: [t("csv.ref"), t("csv.date"), t("csv.title"), t("csv.payee"), t("csv.category"), t("csv.paidFrom"), t("csv.counter"), t("csv.items"), t("csv.total"), t("csv.by"), t("csv.note")],
      categories: Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, labels.category(c)])),
      paidFrom: Object.fromEntries(PAID_FROM.map((p) => [p, labels.paidFrom(p)])),
    });
    // A byte-order mark so a spreadsheet reads Bangla correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${slug(venueName)}-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets = PRESETS.map((p) => ({ value: p.value, label: t(`period.${p.value}` as "period.30d"), range: p.range }));
  const periodLabel = PRESETS.some((p) => p.value === range.preset) ? t(`period.${range.preset}` as "period.30d") : formatRange(range.from, range.to);

  /** What a filter says it is set to: the names while there are one or two, a count after. */
  const chosen = (names: string[]) => (names.length <= 2 ? names.join(", ") : t("toolbar.nChosen", { count: names.length }));
  const filters: FilterSpec[] = [
    {
      key: "category",
      label: t("toolbar.category"),
      control: (
        <ChipChoices
          label={t("toolbar.category")}
          value={cats}
          onChange={(v) => {
            setCats(v);
            setPage(1);
          }}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: labels.category(c) }))}
        />
      ),
      active: cats.length ? chosen(cats.map((c) => labels.category(c))) : null,
      onClear: () => {
        setCats([]);
        setPage(1);
      },
    },
    {
      key: "paid",
      label: t("toolbar.paidFrom"),
      control: (
        <ChipChoices
          label={t("toolbar.paidFrom")}
          value={paid}
          onChange={(v) => {
            setPaid(v);
            setPage(1);
          }}
          options={PAID_FROM.map((x) => ({ value: x, label: labels.paidFrom(x) }))}
        />
      ),
      active: paid.length ? chosen(paid.map((x) => labels.paidFrom(x))) : null,
      onClear: () => {
        setPaid([]);
        setPage(1);
      },
    },
  ];

  const download = (
    <Button variant="secondary" size="sm" icon={<Download size={15} strokeWidth={1.5} aria-hidden />} onClick={downloadCsv}>
      {t("toolbar.download")}
    </Button>
  );

  return (
    <PageShell title={t("title")} primary={wide ? undefined : { label: t("add"), onClick: () => open("new") }}>
      <div className="flex flex-col gap-section">
        {/* The row a list opens with: search, the date range (the one filter
            most visits change), and one Filters button holding the rest. What
            is set comes back as a chip beneath it. A phone puts the range and
            the statement on their own row under search and Filters. */}
        <FilterBar
          search={
            <FilterSearch
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder={t("toolbar.search")}
            />
          }
          lead={
            <div className="flex w-full items-center gap-tight md:w-auto">
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
                className="min-w-0 flex-1 md:w-auto md:flex-none"
              />
              {!wide && <PageAction label={t("toolbar.download")} icon={<Download size={15} strokeWidth={1.5} aria-hidden />} onClick={downloadCsv} />}
            </div>
          }
          filters={filters}
          actions={
            wide ? (
              <>
                {download}
                <Button size="sm" icon={<Plus size={16} strokeWidth={1.75} aria-hidden />} onClick={() => open("new")}>
                  {t("add")}
                </Button>
              </>
            ) : undefined
          }
        />

        <Summary summary={summary} loading={pending || sumQ.loading} periodLabel={periodLabel} selected={cats} onSelect={pickCategory} />

        <ExpenseTable
          rows={rows}
          total={info?.total ?? 0}
          page={shownPage}
          totalPages={info?.totalPages ?? 1}
          pageSize={size}
          loading={pending || listQ.loading}
          failed={!!listQ.error}
          sort={sort}
          filtered={filtered}
          freshId={freshId}
          actions={{ onOpen: (e) => open("edit", e), onCopy: (e) => open("copy", e), onDelete: setDoomed }}
          onSort={onSort}
          onPage={setPage}
          onPageSize={(n) => {
            setSize(n);
            setPage(1);
          }}
          onAdd={() => open("new")}
          onReset={reset}
          onRetry={() => {
            listQ.reload();
            sumQ.reload();
          }}
        />
      </div>

      {drawer && (
        <ExpenseDrawer
          key={drawer.n}
          mode={drawer.mode}
          expense={drawer.expense}
          locations={locations}
          locationId={locationId}
          payees={payeesQ.data ?? []}
          onClose={() => setDrawer(null)}
          onSaved={saved}
          onDelete={setDoomed}
          covered={doomed !== null}
          onUncover={closeDoomed}
        />
      )}

      <Modal
        open={!!doomed}
        onClose={closeDoomed}
        title={t("delete.title")}
        description={doomed ? t("delete.text", { title: doomed.title, amount: formatMoney(doomed.total), date: shortDate(doomed.date) }) : undefined}
        size="sm"
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={closeDoomed} disabled={deleting}>
              {t("delete.cancel")}
            </Button>
            <Button variant="destructive" loading={deleting} onClick={() => void confirmDelete()}>
              {t("delete.confirm")}
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
