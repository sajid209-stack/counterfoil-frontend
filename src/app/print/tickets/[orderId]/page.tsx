"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, listTickets } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { TicketSheets } from "@/app/print/_components/TicketSheets";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";
import { usePrintOptions } from "@/components/receipt/useReceiptData";

export default function PrintTicketsPage() {
  const t = useTranslations("ticket");
  const labels = useTicketLabels();
  const params = useParams<{ orderId: string }>();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);

  const ready = !orderQ.loading && !ticketsQ.loading && !opQ.loading;
  // The logo prints at the top of every ticket, on the receipt's setting, with a switch for this print only.
  const opts = usePrintOptions(opQ.data ?? undefined, ["80mm"]);
  const cards = ticketCards(orderQ.data, ticketsQ.data?.data ?? [], opQ.data?.name ?? "Counterfoil", labels, opts.settings.showLogo ? opQ.data?.logo : null);

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
      <PrintToolbar options={{ logo: { checked: opts.settings.showLogo, available: opts.hasLogo, onChange: opts.setLogo } }} />
      {!ready ? (
        <div aria-busy="true" className="mx-auto w-full max-w-sm"><Skeleton h={420} className="rounded-card" /></div>
      ) : cards.length === 0 ? (
        <EmptyState title={t("noTickets")} />
      ) : (
        <TicketSheets cards={cards} />
      )}
    </main>
  );
}
