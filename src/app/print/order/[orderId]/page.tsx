"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, getTaxConfig, listLocations, listTickets } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { TicketReceipt } from "@/app/print/_components/TicketReceipt";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";

/**
 * Print all: the receipt and every ticket on one strip of paper — what a
 * counter hands most guests in one tear-off, rather than a receipt and a stack
 * of separate tickets.
 */
export default function PrintOrderPage() {
  const t = useTranslations("ticket");
  const labels = useTicketLabels();
  const params = useParams<{ orderId: string }>();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const locQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const order = orderQ.data;
  const place = order ? locQ.data?.data.find((l) => l.id === order.locationId) ?? null : null;
  const ready = !orderQ.loading && !ticketsQ.loading && !opQ.loading && !taxQ.loading && !locQ.loading;
  const cards = ticketCards(order, ticketsQ.data?.data ?? [], opQ.data?.name ?? "Counterfoil", labels);

  // Auto-open the browser print dialog once, when the receipt and every ticket are loaded.
  const printed = useRef(false);
  useEffect(() => {
    if (ready && order && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready, order]);

  return (
    // `--page` is resolved here, outside the paper, so the strip's notches are cut in the page's real colour in either theme.
    <main className="mx-auto min-h-screen max-w-md bg-surface px-section py-section [--page:var(--color-surface)] print:max-w-none print:bg-white print:p-0">
      <h1 className="sr-only">{t("printAllTitle")}</h1>
      <PrintToolbar />
      {!ready ? (
        <div aria-busy="true" className="mx-auto h-[640px] w-full max-w-[380px] animate-pulse rounded-[18px] bg-card" />
      ) : !order ? (
        <EmptyState title={t("orderNotFound")} />
      ) : (
        <TicketReceipt order={order} operator={opQ.data ?? { name: "Counterfoil" }} place={place} tax={taxQ.data} footer={opQ.data?.receiptFooter} cards={cards} />
      )}
    </main>
  );
}
