"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui";
import type { Customer, Order } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { Panel } from "./Panel";

const SHOWN = 5;

/** What an order was for: its first booking, and how many more came with it. */
function whatOf(o: Order): { first: string; more: number } {
  const lines = o.lines.filter((l) => !l.parentLineId);
  return { first: lines[0]?.productName ?? "", more: Math.max(0, lines.length - 1) };
}

/**
 * The last few orders, small, and the way to the rest.
 *
 * This replaces a full table as the page's centrepiece: money and history are
 * what the page is *not* mainly about, so they sit last, compact, behind a
 * link. The link goes to the orders list filtered to this person by id, across
 * every venue — a name search would also catch a namesake.
 */
export function RecentVisits({
  customer,
  orders,
  total,
}: {
  customer: Customer;
  /** Newest first. */
  orders: Order[];
  total: number;
}) {
  const t = useTranslations("customers");
  const rows = orders.slice(0, SHOWN);

  return (
    <Panel title={t("recent")}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("noOrdersTitle")}</p>
      ) : (
        <ul className="-mx-comfortable flex flex-col">
          {rows.map((o) => {
            const what = whatOf(o);
            return (
              <li key={o.id} className="border-b border-hairline last:border-0">
                <Link
                  href={`/orders/${o.id}`}
                  className="flex min-h-11 items-center gap-comfortable rounded-sm px-comfortable py-comfortable hover:bg-muted-wash"
                >
                  <span className="w-[5.5rem] shrink-0 text-[0.8125rem] text-muted">{formatDate(o.createdAt)}</span>
                  <span className="min-w-0 flex-1 break-words text-sm text-fg">
                    {what.first}
                    {what.more > 0 && <span className="text-muted"> {t("andMore", { count: what.more })}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-inline sm:flex-row sm:items-center sm:gap-comfortable">
                    <span className="whitespace-nowrap text-sm font-medium text-fg">{formatMoney(o.total)}</span>
                    <StatusPill status={o.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && (
        <Link
          href={`/orders?customerId=${customer.id}&customer=${encodeURIComponent(customer.name)}`}
          className="mt-tight inline-flex min-h-11 items-center gap-inline text-sm font-medium text-brand-foreground hover:underline"
        >
          {t("seeAllOrders", { count: total })}
          <ChevronRight size={16} strokeWidth={1.6} aria-hidden />
        </Link>
      )}
    </Panel>
  );
}
