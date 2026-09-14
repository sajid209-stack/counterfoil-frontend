"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, getTaxConfig, listLocations } from "@/lib/api";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";
import { ReceiptFooter, ReceiptHeader } from "@/components/ReceiptParts";
import { formatDate } from "@/lib/format";

export default function PrintReceiptPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
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
      <div className="mb-major flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-inline text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
        </button>
        <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => window.print()}>{t("print")}</Button>
      </div>

      {ready && !o ? (
        <EmptyState title={t("noTickets")} />
      ) : o && ready ? (
        <div className="mx-auto w-full card-surface p-major print:border-0">
          <ReceiptHeader operator={opQ.data ?? { name: "Counterfoil" }} place={place} tax={taxQ.data}>
            <p className="mt-inline font-mono text-[12px] text-muted">{o.reference} · {formatDate(o.createdAt)}</p>
          </ReceiptHeader>
          <OrderLinesDetail order={o} />
          <ReceiptFooter message={opQ.data?.receiptFooter} />
        </div>
      ) : null}
    </main>
  );
}
