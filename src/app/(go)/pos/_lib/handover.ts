import type { Order, Ticket } from "@/lib/api/types";

/*
 * What the till hands its completion screen, in session storage.
 *
 * It carries the sale's own record — the reference and every ticket the sale
 * issued — so the screen draws the moment it opens and still has everything
 * after a reload, rather than asking the server again for what it has only
 * just been told.
 */

export interface CompleteTicket {
  code: string;
  name: string;
  tierName: string;
  /** The tier is only worth stating when it differs from the booking's own name. */
  showTier: boolean;
  admits: number;
  /** The court, lane or therapist the ticket is for, when there is one. */
  place: string | null;
  startTime: string | null;
  /** yyyy-mm-dd — the reservation's day, else the day the ticket is valid for. */
  date: string;
}

export interface ReceiptLine { name: string; qty: number; amount: number; child?: boolean }
export interface Receipt { lines: ReceiptLine[]; subtotal: number; lineDiscountTotal: number; orderDiscount: number; tax: number; total: number }

export interface CompleteInfo {
  orderId?: string;
  reference?: string;
  /** The first ticket's code; kept for the classic till, which reads this key too. */
  code: string;
  change: number;
  balance?: number;
  receipt?: Receipt;
  payments?: { method: string; amount: number; tendered?: number; change?: number }[];
  customer?: { name: string; phone: string | null; email?: string | null } | null;
  /** Absent on a handover written before tickets travelled with the sale. */
  tickets?: CompleteTicket[];
}

/** The tickets a sale issued, in code order, with the names they were sold under. */
export function ticketSnapshot(order: Order, tickets: Ticket[]): CompleteTicket[] {
  return [...tickets]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((ticket) => {
      const line = order.lines.find((l) => l.id === ticket.lineId);
      return {
        code: ticket.code,
        name: line?.productName ?? ticket.tierName,
        tierName: ticket.tierName,
        showTier: !!line && line.tierName !== line.productName,
        admits: ticket.admits ?? 1,
        place: line?.booking?.resourceName ?? line?.booking?.providerName ?? null,
        startTime: line?.booking?.startTime ?? null,
        date: line?.booking?.date ?? ticket.validFor,
      };
    });
}
