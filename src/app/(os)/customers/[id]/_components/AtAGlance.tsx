"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import type { Customer, CustomerStats } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Panel } from "./Panel";

/**
 * The old six figure tiles, demoted to one quiet list: a label on the left, the
 * value on the right. Money and counts are what the page is least about, so
 * they take a few lines instead of a row of equal cards. Only one thing in it
 * asks for attention — a balance that is owed — and it is a link to the order.
 */
export function AtAGlance({
  customer,
  stats,
  owingOrderIds,
}: {
  customer: Customer;
  stats: CustomerStats;
  /** The orders that still have a balance, newest first. */
  owingOrderIds: string[];
}) {
  const t = useTranslations("customers");

  // One order owed goes straight to it; several go to the list for this person.
  const owesHref =
    owingOrderIds.length === 1
      ? `/orders/${owingOrderIds[0]}`
      : `/orders?customerId=${customer.id}&customer=${encodeURIComponent(customer.name)}`;

  /* Spent and Orders are the person's headline and always show. The rest say
     something only when they are not nothing - a row of "0" is filler. */
  const rows: { key: string; label: string; value: string }[] = [
    { key: "spent", label: t("statSpent"), value: formatMoney(stats.spent) },
    { key: "orders", label: t("statOrders"), value: String(stats.orders) },
    ...(stats.visits > 0 ? [{ key: "visits", label: t("statVisits"), value: String(stats.visits) }] : []),
    ...(stats.noShows > 0 ? [{ key: "noShows", label: t("statNoShows"), value: String(stats.noShows) }] : []),
  ];

  return (
    <Panel title={t("glanceTitle")}>
      <dl className="flex flex-col max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-section max-sm:gap-y-comfortable">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-comfortable border-b border-hairline py-tight first:pt-0 last:border-b-0 last:pb-0 max-sm:flex-col max-sm:items-start max-sm:gap-inline max-sm:border-0 max-sm:py-0">
            <dt className="text-base text-muted">{r.label}</dt>
            <dd data-glance={r.key} className="text-base font-medium tabular-nums text-fg">
              {r.value}
            </dd>
          </div>
        ))}
        {stats.outstanding > 0 && (
          <div className="flex items-baseline justify-between gap-comfortable py-tight last:pb-0 max-sm:col-span-2 max-sm:py-0">
            <dt className="text-base text-muted">{t("statOutstanding")}</dt>
            <dd data-glance="owes" className="text-base font-medium tabular-nums">
              <Link
                href={owesHref}
                className="inline-flex min-h-11 items-center gap-inline text-warning hover:underline md:min-h-0"
              >
                {formatMoney(stats.outstanding)}
                <ChevronRight size={14} strokeWidth={1.8} aria-hidden />
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}
