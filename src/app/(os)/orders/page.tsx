"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  DataTable,
  EmptyState,
  PageShell,
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
import { MD, useMediaQuery } from "@/lib/useMedia";
import { demoNow } from "@/lib/schedule";
import { OrdersSummary } from "./_components/OrdersSummary";

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
  const compact = !useMediaQuery(MD, true);
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
  const locationName = (id: string) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? "—";

  const channelLabel = (c: string) => (c === "counter" ? t("channelCounter") : c === "online" ? t("channelOnline") : c);

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

  const filters = useMemo(
    () => ({ status: status || undefined, channel: channel || undefined, ...bounds }),
    [status, channel, bounds],
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
      key: "location",
      header: t("colLocation"),
      render: (o) => (
        <span className="flex min-w-0 max-w-[12rem] flex-col">
          <span className="truncate">{locationName(o.locationId)}</span>
          <span className="truncate text-[12px] text-muted">{channelLabel(o.channel)}</span>
        </span>
      ),
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

  const selectCls = "h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse";
  const resetPage = () => setPage(1);

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        <OrdersSummary
          collected={summary.collected}
          orders={summary.orders}
          average={summary.average}
          outstanding={summary.outstanding}
          compact={compact}
          loading={summaryQ.loading}
          labels={{
            collected: t("statCollected"),
            orders: t("statOrders"),
            average: t("statAverage"),
            outstanding: t("statOutstanding"),
            excluded: summary.voided > 0 ? t("statExcluded", { count: summary.voided }) : null,
          }}
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
            <div className="flex flex-wrap items-center gap-tight">
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
              <select aria-label={t("allRanges")} value={range} onChange={(e) => { setRange(e.target.value as Range); resetPage(); }} className={selectCls}>
                <option value="all">{t("allRanges")}</option>
                <option value="today">{t("rangeToday")}</option>
                <option value="7d">{t("range7d")}</option>
                <option value="30d">{t("range30d")}</option>
              </select>
              <select aria-label={t("allStatuses")} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={selectCls}>
                <option value="">{t("allStatuses")}</option>
                <option value="paid">{enumL.status("paid")}</option>
                <option value="pending">{enumL.status("pending")}</option>
                <option value="partial">{enumL.status("partial")}</option>
                <option value="refunded">{enumL.status("refunded")}</option>
                <option value="cancelled">{enumL.status("cancelled")}</option>
              </select>
              <select aria-label={t("allChannels")} value={channel} onChange={(e) => { setChannel(e.target.value); resetPage(); }} className={selectCls}>
                <option value="">{t("allChannels")}</option>
                <option value="counter">{t("channelCounter")}</option>
                <option value="online">{t("channelOnline")}</option>
              </select>
            </div>
          }
          minWidth="58rem"
          renderCard={(o) => {
            const due = orderOutstanding(o);
            return (
              /* An order has a natural shape — which one, who for, when and
                 where, then the money — and reads far better in it than as
                 five labelled pairs wrapped across a card. */
              <div className="flex flex-col gap-tight">
                <div className="flex items-start justify-between gap-tight">
                  <span className="font-mono text-[13px]">{o.reference}</span>
                  <StatusPill status={o.status} />
                </div>
                <span className={cn("break-words text-sm font-medium", !o.customerName && "text-muted")}>
                  {o.customerName ?? t("walkIn")}
                </span>
                <span className="text-[12px] text-muted">
                  {formatRelative(o.createdAt, now)} · {locationName(o.locationId)} · {channelLabel(o.channel)}
                </span>
                <div className="flex items-baseline justify-between gap-tight">
                  <span className="text-[12px] text-muted">
                    {t("itemCount", { count: o.lines.reduce((sum, l) => sum + l.quantity, 0) })}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono text-sm font-medium">{formatMoney(o.total)}</span>
                    {due > 0 && !isVoidedOrder(o) && (
                      <span className="font-mono text-[12px] text-warning">
                        {t("dueLabel", { amount: formatMoney(due) })}
                      </span>
                    )}
                  </span>
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
