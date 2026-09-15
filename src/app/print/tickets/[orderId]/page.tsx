"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, TicketCard, type TicketCardData } from "@/components/ui";
import type { TicketField } from "@/components/ui/TicketCard";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getOrder, listTickets } from "@/lib/api";
import type { Ticket } from "@/lib/api/types";
import { formatDay } from "@/lib/format";

export default function PrintTicketsPage() {
  const t = useTranslations("ticket");
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderQ = useApiQuery(() => getOrder(params.orderId), [params.orderId]);
  const ticketsQ = useApiQuery(() => listTickets({ pageSize: 100, filters: { orderId: params.orderId } }), [params.orderId]);
  const opQ = useApiQuery(() => getOperator(), []);
  const business = opQ.data?.name ?? "Counterfoil";

  const order = orderQ.data;
  const tickets = [...(ticketsQ.data?.data ?? [])].sort((a, b) => a.code.localeCompare(b.code));
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

  const cardFor = (ticket: Ticket, index: number): TicketCardData => {
    const line = order?.lines.find((l) => l.id === ticket.lineId);
    const booking = line?.booking;
    const admits = ticket.admits ?? 1;

    // The facts a guest checks, each on its own line of the grid rather than run together.
    // A printed ticket outlives the week it was sold in, so the date states its year — appended
    // rather than asked of Intl, whose en-GB form with a year puts a comma after the weekday.
    const day = booking?.date ?? ticket.validFor;
    const fields: TicketField[] = [{ label: t("dateLabel"), value: `${formatDay(day, { weekday: true })} ${day.slice(0, 4)}` }];
    if (booking?.startTime) fields.push({ label: t("timeLabel"), value: booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime });
    const productName = line?.productName ?? ticket.tierName;
    // Nothing on a ticket says the same thing twice: a court booked as "Badminton Court" does not
    // also need "Where: Badminton Court", and "Day Pass Bundle" does not need the tier "Bundle".
    const says = (text: string) => productName.toLowerCase().includes(text.toLowerCase());
    const where = booking?.resourceName ?? booking?.providerName;
    if (where && !says(where)) fields.push({ label: t("whereLabel"), value: where });
    if (admits > 1) fields.push({ label: t("guestsLabel"), value: String(admits) });
    if (order?.customerName) fields.push({ label: t("holderLabel"), value: order.customerName });

    return {
      business,
      productName,
      tierName: line && !says(ticket.tierName) ? ticket.tierName : undefined,
      fields,
      indexLabel: tickets.length > 1 ? t("indexOf", { index: index + 1, total: tickets.length }) : undefined,
      code: ticket.code,
      gateHint: t("gateHint"),
      referenceLabel: t("referenceLabel"),
    };
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-section py-section print:max-w-none print:bg-white print:p-0">
      <h1 className="sr-only">{t("ticketsTitle")}</h1>

      {/* Screen-only toolbar — hidden when printing */}
      <div className="mb-major flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="flex min-h-[44px] items-center gap-inline text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
        </button>
        <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>

      {!ready ? (
        <div aria-busy="true" className="mx-auto h-[560px] w-full max-w-sm animate-pulse rounded-[20px] bg-card" />
      ) : tickets.length === 0 ? (
        <EmptyState title={t("noTickets")} />
      ) : (
        <div className="flex flex-col items-center gap-8 print:block">
          {tickets.map((ticket, i) => (
            // One ticket to a printed page, so each tears off and travels on its own.
            <div key={ticket.id} className="w-full max-w-sm print:mx-auto print:not-last:break-after-page">
              <TicketCard data={cardFor(ticket, i)} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
