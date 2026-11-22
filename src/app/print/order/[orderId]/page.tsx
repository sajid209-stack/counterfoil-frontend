"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listTickets } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { TicketReceipt } from "@/app/print/_components/TicketReceipt";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";
import { usePrintOptions, useReceiptData } from "@/components/receipt/useReceiptData";

const PAPERS = ["80mm", "58mm"] as const;

/**
 * Print all: the receipt and every ticket on one strip of paper — what a
 * counter hands most guests in one tear-off, rather than a receipt and a stack
 * of separate tickets.
 */
export default function PrintOrderPage() {
  const t = useTranslations("ticket");
  const labels = useTicketLabels();
  const params = useParams<{ orderId: string }>();
  const d = useReceiptData(params.orderId);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opts = usePrintOptions(d.operator, [...PAPERS]);

  const { order } = d;
  const ready = d.ready && !ticketsQ.loading;
  const cards = ticketCards(order, ticketsQ.data?.data ?? [], d.operator?.name ?? "Counterfoil", labels);

  // Open the print dialog once, when the receipt and every ticket are loaded. The toolbar stays live after it closes.
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
    <main className="min-h-screen bg-surface px-section py-section [--page:var(--color-surface)] print:min-h-0 print:bg-white print:p-0">
      <h1 className="sr-only">{t("printAllTitle")}</h1>
      <div className="mx-auto max-w-xl">
        <PrintToolbar
          options={{
            logo: { checked: opts.settings.showLogo, available: opts.hasLogo, onChange: opts.setLogo },
            paper: { value: opts.settings.paper, options: opts.papers, onChange: opts.setPaper },
          }}
        />
      </div>
      {!ready ? (
        <div aria-busy="true" className="mx-auto w-full max-w-xs"><Skeleton h={640} className="rounded-card" /></div>
      ) : !order ? (
        <EmptyState title={t("orderNotFound")} />
      ) : (
        <TicketReceipt
          data={{
            order,
            operator: d.operator ?? { name: "Counterfoil" },
            place: d.place,
            tax: d.tax,
            settings: opts.settings,
            cashier: d.cashier,
            counter: d.counter,
            customerPhone: d.customerPhone,
          }}
          cards={cards}
        />
      )}
    </main>
  );
}
