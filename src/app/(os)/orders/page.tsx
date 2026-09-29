"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  DataTable,
  EmptyState,
  FilterBar,
  Select,
  PageShell,
  StatStrip,
  StatusPill,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  isVoidedOrder,
  listLocations,
  listOrders,
  orderOutstanding,
  orderPaid,
  type Order,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { useActiveLocation } from "@/lib/activeLocation";
import { demoNow } from "@/lib/schedule";

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}

/** The ranges an orders list is actually asked for. */
type Range = "all" | "today" | "7d" | "30d";

function OrdersPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("orders");
  const enumL = useEnumLabels();
  /* One clock, the app's own — the same pinned demo instant the till and the
     calendar use, so "2h ago" here and "today" in the calendar agree. */
  const now = useMemo(() => demoNow(), []);

  // Deep-link from Customers: /orders?customer=Anika pre-filters the search.
  const [search, setSearch] = useState(params.get("customer") ?? "");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "createdAt", order: "desc" });
  const [page, setPage] = useState(1);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const channelLabel = (c: string) => (c === "counter" ? t("channelCounter") : c === "online" ? t("channelOnline") : c);
  /* A set filter comes back as a chip naming its VALUE, so a narrowed list
     says what narrowed it rather than which field was touched. */
  const rangeLabel = (r: Range) =>
    r === "today" ? t("rangeToday") : r === "7d" ? t("range7d") : r === "30d" ? t("range30d") : t("allRanges");

  /** Half-open [from, to) for the chosen range, in the API's own ISO shape. */
  const bounds = useMemo(() => {
    if (range === "all") return {};
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (range === "7d") start.setDate(start.getDate() - 6);
    if (range === "30d") start.setDate(start.getDate() - 29);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [range, now]);

  /* The venue comes from the bar, not from this page: it is the console's
     lens, and the page's own filters narrow within it. `listOrders` has taken
     a `locationId` filter since the customer work; the list simply never used
     it, so an operator with three venues read one list of all three with
     nothing saying so. */
  const { id: locationId } = useActiveLocation(locationsQ.data?.data ?? []);
  const filters = useMemo(
    () => ({ status: status || undefined, channel: channel || undefined, locationId: locationId || undefined, ...bounds }),
    [status, channel, locationId, bounds],
  );

  const { data, loading } = useApiQuery(
    () => listOrders({ page, pageSize: 12, search, sort: sort.key, order: sort.order, filters }),
    [search, filters, sort.key, sort.order, page],
  );

  /* The summary counts everything the filters match, not the page on screen.
     A second read of the same query with the page cap lifted — cheap against
     the mock, and the shape a real backend would serve as one aggregate
     endpoint rather than by shipping every row. */
  const summaryQ = useApiQuery(
    () => listOrders({ page: 1, pageSize: 1000, search, filters }),
    [search, filters],
  );
  const summary = useMemo(() => {
    const all = summaryQ.data?.data ?? [];
    const live = all.filter((o) => !isVoidedOrder(o));
    const collected = live.reduce((s, o) => s + orderPaid(o), 0);
    const outstanding = live.reduce((s, o) => s + orderOutstanding(o), 0);
    const gross = live.reduce((s, o) => s + o.total, 0);
    return {
      collected,
      outstanding,
      orders: all.length,
      average: live.length === 0 ? 0 : Math.round(gross / live.length),
      voided: all.length - live.length,
    };
  }, [summaryQ.data]);

  const columns: Column<Order>[] = [
    {
      key: "reference",
      header: t("colReference"),
      sortable: true,
      render: (o) => <span className="whitespace-nowrap font-mono text-[13px]">{o.reference}</span>,
    },
    {
      // The column the page was missing. Every order carries a name snapshot
      // and the search already matched it — the table just never showed it, so
      // an orders list read as a column of receipt numbers.
      key: "customer",
      header: t("colCustomer"),
      render: (o) => (
        // Truncated, not wrapped: "Mohammad Abdur Rahman Chowdhury" stacked to
        // four lines and set the height of every row beside it. The full name
        // is on hover and on the order itself, one click away.
        <span
          className={cn("block max-w-[14rem] truncate", !o.customerName && "text-muted")}
          title={o.customerName ?? undefined}
        >
          {o.customerName ?? t("walkIn")}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t("colDate"),
      sortable: true,
      render: (o) => (
        // Relative while it still means something, absolute after that, and
        // the exact stamp always one hover away.
        <span className="whitespace-nowrap text-muted" title={formatDateTime(o.createdAt)}>
          {formatRelative(o.createdAt, now)}
        </span>
      ),
    },
    {
      // Where and how, as one answer. Two columns for one idea cost the width
      // the customer column needed.
      key: "channel",
      /* The bar says which venue, so a column saying it on every row earns
         nothing — what it was really carrying was the channel. */
      header: t("colChannel"),
      render: (o) => <span className="truncate">{channelLabel(o.channel)}</span>,
    },
    {
      key: "items",
      header: t("colItems"),
      align: "center",
      render: (o) => (
        <span className="font-mono text-[13px]">{o.lines.reduce((s, l) => s + l.quantity, 0)}</span>
      ),
    },
    {
      key: "total",
      header: t("colTotal"),
      sortable: true,
      align: "right",
      render: (o) => {
        const due = orderOutstanding(o);
        return (
          <span className="flex flex-col items-end">
            <span className="font-mono text-[13px]">{formatMoney(o.total)}</span>
            {/* A partial sale that says only its total is hiding the number
                somebody has to go and collect. */}
            {due > 0 && !isVoidedOrder(o) && (
              <span className="whitespace-nowrap font-mono text-[12px] text-warning">
                {t("dueLabel", { amount: formatMoney(due) })}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      className: "whitespace-nowrap",
      render: (o) => <StatusPill status={o.status} />,
    },
  ];

  const resetPage = () => setPage(1);

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        <StatStrip
          loading={summaryQ.loading}
          items={[
            {
              key: "collected",
              label: t("statCollected"),
              value: formatMoney(summary.collected),
              // Cancelled and refunded orders are excluded from the money.
              note: summary.voided > 0 ? t("statExcluded", { count: summary.voided }) : null,
            },
            { key: "orders", label: t("statOrders"), value: String(summary.orders) },
            {
              key: "average",
              label: t("statAverage"),
              value: summary.orders === 0 ? "—" : formatMoney(summary.average),
            },
            {
              key: "outstanding",
              label: t("statOutstanding"),
              value: formatMoney(summary.outstanding),
              tone: summary.outstanding > 0 ? "warning" : undefined,
            },
          ]}
        />

        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          getRowId={(o) => o.id}
          loading={loading}
          sort={sort}
          onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "asc" ? "desc" : "asc" }))}
          onRowClick={(o) => router.push(`/orders/${o.id}`)}
          toolbar={
            /* Search stays out; the three selects fold into one button on a
               phone, with whatever is set coming back as a chip. Measured
               before: four stacked controls were 96px of a 735px screen, on
               top of a 238px figures band. */
            <FilterBar
              search={
                <div className="relative">
                  <Search size={16} strokeWidth={1.5} className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                    // The API has always matched the customer name too; the old
                    // placeholder said "by reference" and hid half the feature.
                    placeholder={t("searchPlaceholder")}
                    className="h-11 w-full min-w-0 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse md:h-9 md:w-72"
                  />
                </div>
              }
              filters={[
                {
                  key: "range",
                  label: t("filterDate"),
                  active: range === "all" ? null : rangeLabel(range),
                  onClear: () => { setRange("all"); resetPage(); },
                  control: (
                    <Select
                      aria-label={t("allRanges")}
                      value={range}
                      onChange={(v) => { setRange(v as Range); resetPage(); }}
                      options={[
                        { value: "all", label: t("allRanges") },
                        { value: "today", label: t("rangeToday") },
                        { value: "7d", label: t("range7d") },
                        { value: "30d", label: t("range30d") },
                      ]}
                    />
                  ),
                },
                {
                  key: "status",
                  label: t("filterStatus"),
                  active: status ? enumL.status(status) : null,
                  onClear: () => { setStatus(""); resetPage(); },
                  control: (
                    <Select
                      aria-label={t("allStatuses")}
                      value={status}
                      onChange={(v) => { setStatus(v); resetPage(); }}
                      options={[
                        { value: "", label: t("allStatuses") },
                        ...(["paid", "pending", "partial", "refunded", "cancelled"] as const).map((k) => ({
                          value: k,
                          label: enumL.status(k),
                        })),
                      ]}
                    />
                  ),
                },
                {
                  key: "channel",
                  label: t("filterChannel"),
                  active: channel ? channelLabel(channel) : null,
                  onClear: () => { setChannel(""); resetPage(); },
                  control: (
                    <Select
                      aria-label={t("allChannels")}
                      value={channel}
                      onChange={(v) => { setChannel(v); resetPage(); }}
                      options={[
                        { value: "", label: t("allChannels") },
                        { value: "counter", label: t("channelCounter") },
                        { value: "online", label: t("channelOnline") },
                      ]}
                    />
                  ),
                },
              ]}
            />
          }
          minWidth="58rem"
          cardVariant="list"
          renderCard={(o) => {
            const due = orderOutstanding(o);
            return (
              /* Two lines: who and how much, then which and when.
                 It was six lines and 142px — five orders to a phone screen —
                 and three of the six restated something the page can filter by
                 (the venue and the channel) or nobody scans a list for (the
                 item count). Both are on the order itself.
                 Who leads rather than the reference, because that is what a
                 person looking for an order remembers; the reference is beneath
                 it, where it is still readable and still searchable. */
              <div className="flex flex-col gap-inline">
                <div className="flex items-baseline justify-between gap-tight">
                  <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", !o.customerName && "text-muted")}>
                    {o.customerName ?? t("walkIn")}
                  </span>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums">{formatMoney(o.total)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-tight">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                    <span className="font-mono">{o.reference}</span> · {formatRelative(o.createdAt, now)}
                    {/* The one number somebody has to go and collect. In words
                        as well as colour, and only when there is one. */}
                    {due > 0 && !isVoidedOrder(o) && (
                      <span className="text-warning"> · {t("dueLabel", { amount: formatMoney(due) })}</span>
                    )}
                  </span>
                  <StatusPill status={o.status} />
                </div>
              </div>
            );
          }}
          emptyState={<EmptyState title={t("emptyTitle")} message={t("emptyMessage")} />}
          pagination={{ page, pageSize: 12, total: data?.page.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </PageShell>
  );
}
