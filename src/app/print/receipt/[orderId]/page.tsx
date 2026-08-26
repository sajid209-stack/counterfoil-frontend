"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder } from "@/lib/api";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";
import { formatDate } from "@/lib/format";

export default function PrintReceiptPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const o = orderQ.data;
  const business = opQ.data?.name ?? "Counterfoil";
  const ready = !orderQ.loading && !opQ.loading;

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
      ) : o ? (
        <div className="mx-auto w-full card-surface p-major print:border-0">
          <div className="mb-section text-center">
            <p className="type-h2 text-base">{business}</p>
            <p className="font-mono text-[12px] text-muted">{o.reference} · {formatDate(o.createdAt)}</p>
          </div>
          <OrderLinesDetail order={o} />
          <p className="mt-major text-center font-mono text-[10px] text-faint">{t("poweredBy")}</p>
        </div>
      ) : null}
    </main>
  );
}
