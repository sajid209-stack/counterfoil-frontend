"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, TicketCard, type TicketCardData } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, listTickets } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function PrintTicketsPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const business = opQ.data?.name ?? "Counterfoil";

  const order = orderQ.data;
  const tickets = ticketsQ.data?.data ?? [];
  const ready = !orderQ.loading && !ticketsQ.loading && !opQ.loading;

  // Auto-open the browser print dialog once, when everything is loaded.
  const printed = useRef(false);
  useEffect(() => {
    if (ready && tickets.length > 0 && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready, tickets.length]);

  const cardFor = (code: string): TicketCardData => {
    const ticket = tickets.find((x) => x.code === code)!;
    const line = order?.lines.find((l) => l.id === ticket.lineId);
    const seat = line?.booking
      ? [line.booking.resourceName, line.booking.providerName, line.booking.startTime].filter(Boolean).join(" · ")
      : undefined;
    return {
      business,
      productName: line?.productName ?? ticket.tierName,
      tierName: line && line.tierName !== line.productName ? ticket.tierName : undefined,
      dateLabel: formatDate(ticket.validFor),
      seatOrResource: seat || undefined,
      admitsLabel: (ticket.admits ?? 1) > 1 ? t("admits", { count: ticket.admits ?? 1 }) : undefined,
      code: ticket.code,
      gateHint: t("gateHint"),
      referenceLabel: t("referenceLabel"),
    };
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-section py-section">
      {/* Screen-only toolbar — hidden when printing */}
      <div className="mb-major flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-inline text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
        </button>
        <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => window.print()}>{t("print")}</Button>
      </div>

      {ready && tickets.length === 0 ? (
        <EmptyState title={t("noTickets")} />
      ) : (
        <div className="flex flex-col items-center gap-major print:gap-0">
          {tickets.map((tk) => (
            <div key={tk.id} className="w-full max-w-sm print:mb-8 print:break-after-page">
              <TicketCard data={cardFor(tk.code)} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
