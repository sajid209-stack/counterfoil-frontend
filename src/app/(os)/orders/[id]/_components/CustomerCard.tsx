"use client";

import Link from "next/link";
import { ChevronRight, Mail, Phone, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { Customer, CustomerStats, Order } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { Section } from "./Section";

/**
 * The customer: their name (a link to their record), how to reach them, and how
 * much of a regular they are — or "Walk-in", with a way to add them.
 *
 * The record has a name, a phone and an email; it has no postal address, so
 * none is shown rather than an empty row implying one is missing. The name on
 * the order is a snapshot taken at the sale, so a customer renamed since still
 * reads as who bought it; the link goes to whoever they are now.
 *
 * Add customer is offered for a walk-in and for an online guest who was never
 * matched to a record — both are a sale that a customer's page does not know
 * about.
 */
export function CustomerCard({
  o,
  customer,
  stats,
  onAdd,
  className,
}: {
  o: Order;
  customer: Customer | undefined;
  stats: CustomerStats | undefined;
  onAdd: () => void;
  className?: string;
}) {
  const t = useTranslations("orders.cust");
  const linked = !!o.customerId;
  const name = customer?.name ?? o.customerName;
  const contact = "-my-2 flex min-h-11 items-center gap-tight py-2 text-sm text-fg underline-offset-2 hover:underline sm:my-0 sm:min-h-0 sm:py-0";

  return (
    <Section title={t("title")} className={className} id="order-customer">
      {name ? (
        <div className="flex flex-col gap-tight">
          <div className="flex items-start justify-between gap-tight">
            {linked ? (
              <Link
                href={`/customers/${o.customerId}`}
                className="-my-2 inline-flex min-h-11 min-w-0 items-center gap-inline py-2 text-base font-semibold text-brand-foreground underline underline-offset-2 sm:my-0 sm:min-h-0 sm:py-0"
              >
                <span className="min-w-0 break-words">{name}</span>
                <ChevronRight size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
              </Link>
            ) : (
              <p className="min-w-0 break-words text-base font-semibold">{name}</p>
            )}
          </div>
          {customer?.phone && (
            <a href={`tel:${customer.phone}`} className={contact}>
              <Phone size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              <span className="tabular-nums">{customer.phone}</span>
            </a>
          )}
          {customer?.email && (
            <a href={`mailto:${customer.email}`} className={contact}>
              <Mail size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              <span className="min-w-0 break-all">{customer.email}</span>
            </a>
          )}
          {linked && stats && (
            <p className="text-[13px] text-muted">
              {t("history", { count: stats.orders, spent: formatMoney(stats.spent) })}
              {customer?.createdAt ? ` · ${t("since", { date: formatDate(customer.createdAt) })}` : ""}
            </p>
          )}
          {linked ? (
            <Link
              href={`/orders?customerId=${o.customerId}&customer=${encodeURIComponent(name)}`}
              className="-my-2 inline-flex min-h-11 items-center self-start py-2 text-[13px] text-brand-foreground underline underline-offset-2 sm:my-0 sm:min-h-0 sm:py-0"
            >
              {t("allOrders")}
            </Link>
          ) : (
            <>
              <p className="text-[13px] text-muted">{t("notOnList")}</p>
              <Button variant="secondary" size="sm" icon={<UserPlus size={14} strokeWidth={1.5} />} onClick={onAdd} className="self-start">
                {t("add")}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-tight">
          <p className="text-base font-semibold text-muted">{t("walkIn")}</p>
          <p className="text-[13px] text-muted">{t("walkInNote")}</p>
          <Button variant="secondary" size="sm" icon={<UserPlus size={14} strokeWidth={1.5} />} onClick={onAdd} className="self-start">
            {t("add")}
          </Button>
        </div>
      )}
    </Section>
  );
}
