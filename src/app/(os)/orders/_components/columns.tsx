"use client";

import { useTranslations } from "next-intl";
import { MarketBadge, StatusPill, type Column } from "@/components/ui";
import {
  isVoidedOrder,
  orderDue,
  orderItemCount,
  orderMethodOf,
  orderNetPaid,
  type Order,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import type { Directory } from "../_lib/useReport";
import type { SalesLabels } from "../_lib/labels";

/** First click on a column: money, counts and dates read best biggest-first,
 *  names read best A to Z. */
export const firstDirection = (key: string): "asc" | "desc" =>
  ["createdAt", "total", "tax", "paid", "discount", "items"].includes(key) ? "desc" : "asc";

/**
 * The orders table: Order · Date · Customer · Channel · Counter · Staff ·
 * Total · Tax · Paid · Discount · Method · Status · Items.
 *
 * Money is Inter with tabular figures, right-aligned — `DataTable` sets a
 * right-aligned column in DM Mono unless told otherwise, and DM Mono is for
 * identifiers (the order reference), not for amounts. A cancelled or refunded
 * order's figures are muted: they are on the list so it can be found, and are
 * not in the totals above it, and the muted figures say so without a word.
 */
export function useOrderColumns(dir: Directory, labels: SalesLabels): Column<Order>[] {
  const t = useTranslations("orders");
  const money = (o: Order, amount: number) => (
    <span className={cn("whitespace-nowrap tabular-nums", isVoidedOrder(o) && "text-muted")}>{formatMoney(amount)}</span>
  );
  const dash = <span className="text-muted" aria-label={t("none")}>—</span>;

  return [
    {
      key: "reference",
      header: t("colReference"),
      sortable: true,
      render: (o) => <span className="whitespace-nowrap font-mono text-[13px]">{o.reference}</span>,
    },
    {
      key: "createdAt",
      header: t("colDate"),
      sortable: true,
      /* A report is read by date: the stamp, in 12-hour time. The phone's list
         keeps "55m ago", which is what a glance wants. */
      render: (o) => <span className="whitespace-nowrap text-[0.8125rem]">{formatDateTime(o.createdAt)}</span>,
    },
    {
      key: "customer",
      header: t("colCustomer"),
      sortable: true,
      render: (o) => (
        /* Truncated, not wrapped: a long name stacked to four lines and set the
           height of every row beside it. The whole name is on hover and on the
           order itself. */
        <span className={cn("block max-w-[11rem] truncate", !o.customerName && "text-muted")} title={o.customerName ?? undefined}>
          {o.customerName ?? t("walkIn")}
        </span>
      ),
    },
    {
      key: "channel",
      header: t("colChannel"),
      sortable: true,
      /* The counter is part of the answer: "Counter · Museum Group Desk", so a
         laptop that has the Counter column tucked away still says where it was
         sold. Truncated at a width the table can spare. */
      render: (o) => {
        const where = o.source ? o.source.marketplaceName : labels.soldAt(o);
        return (
          <span className="flex max-w-[11.5rem] items-center gap-inline whitespace-nowrap text-[0.8125rem]" title={where}>
            {o.source && <MarketBadge id={o.source.marketplaceId} />}
            <span className="min-w-0 truncate">{where}</span>
          </span>
        );
      },
    },
    {
      key: "counter",
      header: t("colCounter"),
      sortable: true,
      render: (o) => (o.counterId ? <span className="block max-w-[9rem] truncate text-[0.8125rem]" title={dir.counterName(o.counterId)}>{dir.counterName(o.counterId)}</span> : dash),
    },
    {
      key: "staff",
      header: t("colStaff"),
      sortable: true,
      render: (o) => (o.staffId ? <span className="block max-w-[9rem] truncate text-[0.8125rem]" title={dir.staffName(o.staffId)}>{dir.staffName(o.staffId)}</span> : dash),
    },
    { key: "total", header: t("colTotal"), sortable: true, align: "right", mono: false, render: (o) => money(o, o.total) },
    { key: "tax", header: t("colTax"), sortable: true, align: "right", mono: false, render: (o) => money(o, o.taxTotal ?? 0) },
    {
      key: "paid",
      header: t("colPaid"),
      sortable: true,
      align: "right",
      mono: false,
      render: (o) => {
        const due = orderDue(o);
        return (
          <span className="flex flex-col items-end">
            {money(o, orderNetPaid(o))}
            {/* A part-paid sale that said only what was paid would hide the
                number somebody has to go and collect. In words as well as
                colour, and only when there is one. */}
            {due > 0 && <span className="whitespace-nowrap text-[12px] tabular-nums text-warning">{t("dueLabel", { amount: formatMoney(due) })}</span>}
          </span>
        );
      },
    },
    { key: "discount", header: t("colDiscount"), sortable: true, align: "right", mono: false, render: (o) => money(o, o.discountTotal ?? 0) },
    {
      key: "method",
      header: t("colMethod"),
      sortable: true,
      render: (o) => <span className="whitespace-nowrap text-[0.8125rem]">{labels.method(orderMethodOf(o))}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      className: "whitespace-nowrap",
      render: (o) => <StatusPill status={o.status} />,
    },
    {
      key: "items",
      header: t("colItems"),
      sortable: true,
      align: "right",
      mono: false,
      render: (o) => <span className={cn("tabular-nums", isVoidedOrder(o) && "text-muted")}>{orderItemCount(o)}</span>,
    },
  ];
}

/** The phone's row: two lines. Who and how much, then which and when. It was
 *  six lines and 142px — five orders to a screen — and every extra line
 *  restated something the filters already cut by. */
export function OrderCard({ o, now }: { o: Order; now: Date }) {
  const t = useTranslations("orders");
  const due = orderDue(o);
  return (
    <div className="flex flex-col gap-inline">
      <div className="flex items-baseline justify-between gap-tight">
        <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", !o.customerName && "text-muted")}>{o.customerName ?? t("walkIn")}</span>
        <span className={cn("shrink-0 text-[13px] font-medium tabular-nums", isVoidedOrder(o) && "text-muted")}>{formatMoney(o.total)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-tight">
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
          <span className="font-mono">{o.reference}</span> · {formatRelative(o.createdAt, now)}
          {o.source && <> · {o.source.marketplaceName}</>}
          {due > 0 && <span className="text-warning"> · {t("dueLabel", { amount: formatMoney(due) })}</span>}
        </span>
        <StatusPill status={o.status} />
      </div>
    </div>
  );
}
