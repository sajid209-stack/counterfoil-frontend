import { peekTicketCodeSettings } from "@/lib/api";
import { useTranslations } from "next-intl";
import type { TicketCardData, TicketField } from "@/components/ui/TicketCard";
import type { Order, Ticket } from "@/lib/api/types";
import { formatDay } from "@/lib/format";

export interface TicketLabels {
  date: string;
  time: string;
  where: string;
  seat: string;
  guests: string;
  holder: string;
  gateHint: string;
  reference: string;
  indexOf: (index: number, total: number) => string;
}

/** The words a printed ticket uses, in the reader's language. */
export function useTicketLabels(): TicketLabels {
  const t = useTranslations("ticket");
  return {
    date: t("dateLabel"),
    time: t("timeLabel"),
    where: t("whereLabel"),
    seat: t("seatLabel"),
    guests: t("guestsLabel"),
    holder: t("holderLabel"),
    gateHint: t("gateHint"),
    reference: t("referenceLabel"),
    indexOf: (index, total) => t("indexOf", { index, total }),
  };
}

/**
 * Every ticket an order issued, as the cards the print pages draw. Shared by
 * the tickets page and the tickets-and-receipt page, so the two can never
 * describe the same ticket differently.
 */
export function ticketCards(order: Order | undefined, tickets: Ticket[], business: string, labels: TicketLabels): { id: string; data: TicketCardData }[] {
  const sorted = [...tickets].sort((a, b) => a.code.localeCompare(b.code));
  /* Read once for the whole order rather than per ticket: every ticket in one
     print job carries the same code, and a setting read twice is a setting
     that can differ halfway down a page. */
  const codes = peekTicketCodeSettings();
  return sorted.map((ticket, index) => {
    const line = order?.lines.find((l) => l.id === ticket.lineId);
    const booking = line?.booking;
    const admits = ticket.admits ?? 1;

    // A printed ticket outlives the week it was sold in, so the date states its year — appended
    // rather than asked of Intl, whose en-GB form with a year puts a comma after the weekday.
    const day = booking?.date ?? ticket.validFor;
    const fields: TicketField[] = [{ label: labels.date, value: `${formatDay(day, { weekday: true })} ${day.slice(0, 4)}` }];
    if (booking?.startTime) fields.push({ label: labels.time, value: booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime });
    const productName = line?.productName ?? ticket.tierName;
    // Nothing on a ticket says the same thing twice: a court booked as "Badminton Court" does not
    // also need "Where: Badminton Court", and "Day Pass Bundle" does not need the tier "Bundle".
    const says = (text: string) => productName.toLowerCase().includes(text.toLowerCase());
    const where = booking?.resourceName ?? booking?.providerName;
    if (where && !says(where)) fields.push({ label: labels.where, value: where });
    /* The seat, which the sale now records. A ticket for a seated performance
       that does not say which seat is one the holder cannot use at the door. */
    if (booking?.seatLabel) fields.push({ label: labels.seat, value: booking.seatLabel });
    if (admits > 1) fields.push({ label: labels.guests, value: String(admits) });
    if (order?.customerName) fields.push({ label: labels.holder, value: order.customerName });

    return {
      id: ticket.id,
      data: {
        business,
        productName,
        tierName: line && !says(ticket.tierName) ? ticket.tierName : undefined,
        fields,
        indexLabel: sorted.length > 1 ? labels.indexOf(index + 1, sorted.length) : undefined,
        code: ticket.code,
        /* What this venue's own scanner can read — see Settings, Ticket
           codes. Read here rather than passed down from four print pages
           that would each have to remember. */
        codeStyle: codes.print,
        showCode: codes.showText,
        gateHint: labels.gateHint,
        referenceLabel: labels.reference,
      },
    };
  });
}
