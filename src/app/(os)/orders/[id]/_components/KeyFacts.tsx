"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { MarketBadge } from "@/components/ui";
import { isVoidedOrder, orderNetPaid, type Order } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Directory } from "../../_lib/useReport";
import type { SalesLabels } from "../../_lib/labels";

/**
 * An order on a phone, in the four things it is opened for: **how much**, **what
 * state it is in**, **who**, and **when** — one card, no labels.
 *
 * The state is said in words under the figure ("Paid in full", "Still due"),
 * because the status pill is up in the header row and a figure alone does not
 * say whether it was paid. Everything else about the sale is behind "Show more".
 */
export function KeyFacts({ o, due, dir, labels, className }: { o: Order; due: number; dir: Directory; labels: SalesLabels; className?: string }) {
  const t = useTranslations("orders");
  const tm = useTranslations("orders.money");
  const voided = isVoidedOrder(o);
  const lead = due > 0 ? due : orderNetPaid(o);
  const state = due > 0 ? tm("stillDue") : voided ? (o.status === "cancelled" ? tm("noteCancelled") : tm("noteRefunded")) : tm("settled");
  const name = o.customerName;
  const where = [dir.locationName(o.locationId), o.source ? o.source.marketplaceName : labels.soldAt(o)].filter(Boolean).join(" · ");

  return (
    <section aria-label={t("keyFacts")} data-keyfacts className={cn("card-surface min-w-0 p-card", className)}>
      <p className={cn("text-[0.8125rem]", due > 0 ? "font-medium text-warning" : "text-muted")}>{state}</p>
      <p
        data-figure={due > 0 ? "due" : "paid"}
        data-amount={lead}
        className={cn("mt-inline text-[1.75rem] font-semibold leading-tight tabular-nums", due > 0 && "text-warning", voided && due === 0 && "text-muted")}
      >
        {formatMoney(lead)}
      </p>
      <div className="mt-comfortable flex flex-col gap-inline">
        {name ? (
          o.customerId ? (
            <Link href={`/customers/${o.customerId}`} className="-my-2 inline-flex min-h-11 min-w-0 items-center gap-inline self-start py-2 text-[0.9375rem] font-medium text-fg">
              <span className="min-w-0 break-words">{name}</span>
              <ChevronRight size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
            </Link>
          ) : (
            <p className="min-w-0 break-words text-[0.9375rem] font-medium">{name}</p>
          )
        ) : (
          <p className="text-[0.9375rem] text-muted">{t("walkIn")}</p>
        )}
        <p className="flex flex-wrap items-center gap-x-inline text-[0.8125rem] text-muted">
          <span>{formatDateTime(o.createdAt)}</span>
          {where && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex min-w-0 items-center gap-inline">
                {o.source && <MarketBadge id={o.source.marketplaceId} />}
                <span className="min-w-0 break-words">{where}</span>
              </span>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
