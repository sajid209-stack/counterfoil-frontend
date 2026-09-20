import { FEATURES } from "@/lib/features";
import { findTicketByCode, peekOrders, peekProducts, scanMembership, ticketAdmits, type Ticket } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";

/**
 * What the gate decides, as data.
 *
 * Kept apart from the screen for two reasons. The rules are the interesting
 * part and they belong somewhere they can be read and checked; and nothing
 * here knows a word of English, so the screen translates and formats. Reasons
 * are message KEYS, not sentences — the same discipline `posLiveState` follows
 * for the sell wall.
 *
 * Nothing here writes. Redeeming a ticket, admitting part of a group and
 * taking a balance are the screen's job, after the steward has seen the
 * verdict — a ticket marked used before anyone looked at the screen is a
 * guest through the gate on a scan nobody confirmed.
 */
export type Verdict = "admit" | "refuse" | "group" | "balance";

/** Why a scan was refused. A message key, resolved by the screen. */
export type RefuseReason = "notFound" | "alreadyRedeemed" | "voidRefunded";

export interface ScanOutcome {
  verdict: Verdict;
  /** What was scanned, as scanned. */
  code: string;
  /** The booking and tier, where the code resolved to something. */
  title: string;
  /** Refusals only. */
  reason?: RefuseReason;
  /** The moment a duplicate was first admitted — the one fact a steward
   *  facing a guest who says they have not been in actually needs. */
  usedAt?: string | null;
  /** The day the ticket is for, when that day has already gone. Stated, never
   *  enforced — see the note in `resolveScan`. */
  dated?: string | null;
  ticketId?: string;
  group?: { ticketId: string; tierName: string; admits: number; admitted: number };
  balance?: { orderId: string; ticketId: string; amount: number };
}

const outstanding = (orderId: string): { orderId: string; amount: number } | null => {
  const order = peekOrders().find((o) => o.id === orderId);
  if (!order) return null;
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const due = Math.max(0, order.total - paid);
  return due > 0 ? { orderId: order.id, amount: due } : null;
};

const label = (ticket: Ticket): string => {
  const product = peekProducts().find((p) => p.id === ticket.productId)?.name ?? "";
  return [product, ticket.tierName].filter(Boolean).join(" · ");
};

/** The gate's answer for one code. */
export async function resolveScan(raw: string): Promise<ScanOutcome> {
  const code = raw.trim();

  /* A membership card scans at the same gate as a ticket (§16.10), so the one
     input takes both. With memberships hidden a CF-M- code means nothing to
     this operator and falls through to the ticket path, where it is refused as
     an unknown code — the truth, rather than a card that half works. */
  if (FEATURES.memberships && /^cf-m-/i.test(code)) {
    const res = await scanMembership(code);
    if (!res.ok) return { verdict: "refuse", code, title: "", reason: "notFound" };
    const { membership, admitted } = res.data;
    return admitted
      ? { verdict: "admit", code: membership.code, title: `${membership.customerName} · ${membership.tierName}` }
      : { verdict: "refuse", code: membership.code, title: membership.tierName, reason: "notFound" };
  }

  const ticket = findTicketByCode(code);
  if (!ticket) return { verdict: "refuse", code, title: "", reason: "notFound" };
  if (ticket.status === "redeemed") {
    return { verdict: "refuse", code: ticket.code, title: label(ticket), reason: "alreadyRedeemed", usedAt: ticket.redeemedAt };
  }
  if (ticket.status === "void") {
    return { verdict: "refuse", code: ticket.code, title: label(ticket), reason: "voidRefunded" };
  }

  /* The gate does NOT check the date, and that is a decision rather than an
     omission. Two clocks disagree in this build: the demo is pinned to
     `DEMO_TODAY` while `checkout` stamps a ticket with the real wall-clock
     date, so a ticket sold at the till thirty seconds ago is "in the future"
     against the demo's today. A rule written on top of that refuses the
     product's own sell-then-admit loop — which is exactly what happened when
     one was tried, and what the walk-through caught.

     So a past date is STATED on the verdict, where a steward can see it and
     decide, and nothing is refused on a date. Enforcing it needs the seed and
     the clock to agree, which is the owner's open re-anchoring decision. */
  const dated = ticket.validFor < DEMO_TODAY ? ticket.validFor : null;

  const admits = ticketAdmits(ticket);
  const group = admits > 1 ? { ticketId: ticket.id, tierName: ticket.tierName, admits, admitted: ticket.admitted ?? 0 } : undefined;

  /* Tickets are issued at checkout whatever was actually paid, so a deposit
     booking turns up at the gate holding a valid one. Admitting it gives the
     balance away, so the gate asks first. */
  const owed = outstanding(ticket.orderId);
  if (owed) {
    return {
      verdict: "balance",
      code: ticket.code,
      title: label(ticket),
      dated,
      ticketId: ticket.id,
      balance: { orderId: owed.orderId, ticketId: ticket.id, amount: owed.amount },
      ...(group ? { group } : {}),
    };
  }

  if (group) return { verdict: "group", code: ticket.code, title: label(ticket), dated, ticketId: ticket.id, group };
  return { verdict: "admit", code: ticket.code, title: label(ticket), dated, ticketId: ticket.id };
}
