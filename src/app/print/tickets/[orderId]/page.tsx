"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, listTickets } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { TicketSheets } from "@/app/print/_components/TicketSheets";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";

export default function PrintTicketsPage() {
  const t = useTranslations("ticket");
  const labels = useTicketLabels();
  const params = useParams<{ orderId: string }>();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);

  const ready = !orderQ.loading && !ticketsQ.loading && !opQ.loading;
  const cards = ticketCards(orderQ.data, ticketsQ.data?.data ?? [], opQ.data?.name ?? "Counterfoil", labels);

  // Auto-open the browser print dialog once, when everything is loaded.
  const printed = useRef(false);
  useEffect(() => {
    if (ready && cards.length > 0 && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready, cards.length]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-section py-section print:max-w-none print:bg-white print:p-0">
      <h1 className="sr-only">{t("ticketsTitle")}</h1>
      <PrintToolbar />
      {!ready ? (
        <div aria-busy="true" className="mx-auto h-[420px] w-full max-w-sm animate-pulse rounded-[24px] bg-card" />
      ) : cards.length === 0 ? (
        <EmptyState title={t("noTickets")} />
      ) : (
        <TicketSheets cards={cards} />
      )}
    </main>
  );
}
