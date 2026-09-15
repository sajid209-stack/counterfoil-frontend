"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, getTaxConfig, listLocations } from "@/lib/api";
import { PrintToolbar } from "@/app/print/_components/PrintToolbar";
import { ReceiptSheet } from "@/app/print/_components/ReceiptSheet";

export default function PrintReceiptPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  // The whole list rather than the one location: every query here starts
  // together, so the print dialog never opens on a header still missing its
  // address.
  const locQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const o = orderQ.data;
  const place = o ? locQ.data?.data.find((l) => l.id === o.locationId) ?? null : null;
  const ready = !orderQ.loading && !opQ.loading && !taxQ.loading && !locQ.loading;

  const printed = useRef(false);
  useEffect(() => {
    if (ready && o && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready, o]);

  return (
    <main className="mx-auto min-h-screen max-w-md bg-surface px-section py-section">
      <h1 className="sr-only">{t("receiptTitle")}</h1>
      <PrintToolbar />
      {ready && !o ? (
        <EmptyState title={t("noTickets")} />
      ) : o && ready ? (
        <ReceiptSheet order={o} operator={opQ.data ?? { name: "Counterfoil" }} place={place} tax={taxQ.data} footer={opQ.data?.receiptFooter} />
      ) : null}
    </main>
  );
}
