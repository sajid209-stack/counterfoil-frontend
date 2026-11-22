"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/ui";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { ReceiptSheet } from "@/app/print/_components/ReceiptSheet";
import { usePrintOptions, useReceiptData } from "@/components/receipt/useReceiptData";

const PAPERS = ["80mm", "58mm", "a4"] as const;

export default function PrintReceiptPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const d = useReceiptData(params.orderId);
  const opts = usePrintOptions(d.operator, [...PAPERS]);
  const { ready, order } = d;

  // Open the print dialog once, when the receipt is whole. The toolbar stays live after it closes.
  const printed = useRef(false);
  useEffect(() => {
    if (ready && order && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready, order]);

  return (
    <main className="min-h-screen bg-surface px-section py-section print:min-h-0 print:bg-white print:p-0">
      <h1 className="sr-only">{t("receiptTitle")}</h1>
      <div className="mx-auto max-w-xl">
        <PrintToolbar
          options={{
            logo: { checked: opts.settings.showLogo, available: opts.hasLogo, onChange: opts.setLogo },
            paper: { value: opts.settings.paper, options: opts.papers, onChange: opts.setPaper },
          }}
        />
      </div>
      {!ready ? (
        <div aria-busy="true" className="mx-auto w-full max-w-xs"><Skeleton h={560} className="rounded-card" /></div>
      ) : !order ? (
        <EmptyState title={t("noTickets")} />
      ) : (
        <ReceiptSheet
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
        />
      )}
    </main>
  );
}
