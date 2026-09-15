"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, getTaxConfig, listLocations, listTickets } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { ReceiptSheet } from "@/app/print/_components/ReceiptSheet";
import { TicketSheets } from "@/app/print/_components/TicketSheets";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";

/**
 * The whole hand-over in one print job: the receipt on its own page, then each
 * ticket on its own page — what a counter with a printer gives most guests.
 * The receipt and the tickets are the same components the single-purpose print
 * pages use, so the three can never print an order differently.
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
    <main className="mx-auto min-h-screen max-w-md bg-surface px-section py-section print:max-w-none print:bg-white print:p-0">
      <h1 className="sr-only">{t("printAllTitle")}</h1>
      <PrintToolbar />
      {!ready ? (
        <div aria-busy="true" className="mx-auto h-[520px] w-full animate-pulse rounded-[24px] bg-card" />
      ) : !order ? (
        <EmptyState title={t("orderNotFound")} />
      ) : (
        // Block, not flex, in print: Chrome does not break pages reliably inside a flex container.
        <div className="flex flex-col gap-wide print:block">
          <section aria-labelledby="print-receipt">
            <h2 id="print-receipt" className="mb-tight text-sm font-semibold text-fg print:hidden">
              {t("receiptTitle")}
            </h2>
            <ReceiptSheet
              order={order}
              operator={opQ.data ?? { name: "Counterfoil" }}
              place={place}
              tax={taxQ.data}
              footer={opQ.data?.receiptFooter}
              className={cards.length > 0 ? "print:break-after-page" : undefined}
            />
          </section>
          {cards.length > 0 && (
            <section aria-labelledby="print-tickets">
              <h2 id="print-tickets" className="mb-tight text-sm font-semibold text-fg print:hidden">
                {t("ticketsTitle")}
              </h2>
              <TicketSheets cards={cards} />
            </section>
          )}
        </div>
      )}
    </main>
  );
}
