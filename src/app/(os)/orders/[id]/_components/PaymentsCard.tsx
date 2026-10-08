"use client";

import { RotateCcw, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { OrderFees } from "@/components/OrderFees";
import { StatusPill } from "@/components/ui";
import type { Order } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { Quiet, Section } from "./Section";

/**
 * Payments and refunds, oldest first — what happened to the money, in the order
 * it happened, so the balance can be followed down the page like a statement.
 *
 * A refund is its own row, in danger and with the word as well as the minus
 * sign (colour is never the only carrier). A cash payment says what was handed
 * over and what went back as change. Underneath, as before, what Counterfoil's
 * own fee did to each payment (`OrderFees`).
 */
export function PaymentsCard({ o, className }: { o: Order; className?: string }) {
  const t = useTranslations("orders.pay");
  const enumL = useEnumLabels();
  const list = [...o.payments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return (
    <Section title={t("title")} className={className} id="order-payments">
      {list.length === 0 ? (
        <Quiet>{t("none")}</Quiet>
      ) : (
        <ol>
          {list.map((p) => {
            const refund = p.amount < 0;
            return (
              <li key={p.id} data-payment={p.id} data-amount={p.amount} className="flex items-start gap-comfortable border-b border-hairline py-comfortable first:pt-0 last:border-0 last:pb-0">
                <span aria-hidden className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", refund ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                  {refund ? <RotateCcw size={15} strokeWidth={1.75} /> : <Wallet size={15} strokeWidth={1.75} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-tight text-sm font-medium">
                    {refund ? t("refundVia", { method: enumL.method(p.method) }) : enumL.method(p.method)}
                    {p.status !== "confirmed" && <StatusPill tone={p.status === "failed" ? "danger" : "info"}>{enumL.status(p.status)}</StatusPill>}
                  </p>
                  <p className="text-[12px] text-muted">{formatDateTime(p.createdAt)}</p>
                  {p.reference && <p className="break-all font-mono text-[12px] text-muted">{p.reference}</p>}
                  {!refund && p.tendered != null && p.tendered > p.amount && (
                    <p className="text-[12px] tabular-nums text-muted">{t("tendered", { tendered: formatMoney(p.tendered), change: formatMoney(p.change ?? p.tendered - p.amount) })}</p>
                  )}
                </div>
                <p className={cn("shrink-0 text-sm font-medium tabular-nums", refund && "text-danger")}>{formatMoney(p.amount)}</p>
              </li>
            );
          })}
        </ol>
      )}
      <OrderFees orderId={o.id} />
    </Section>
  );
}
