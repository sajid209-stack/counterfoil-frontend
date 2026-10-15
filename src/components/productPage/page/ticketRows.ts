"use client";

import { useTranslations } from "next-intl";
import { isEventProduct } from "@/lib/api/events";
import { eventTicketStates, type EventTicketState } from "@/lib/storefront/pattern";
import type { PriceTier, Product } from "@/lib/api/types";
import type { PageCtx } from "./context";

/**
 * The ticket types of a booking, as the page states them — ONE reading of the
 * ledger shared by the ticket cards, the hero's "From" price and the phone bar,
 * so they cannot disagree about whether a ticket can still be bought.
 *
 * Availability is the booking picker's own rule (`eventTicketStates`): a ticket
 * stops when its own quantity does OR when any day it admits is full, so a
 * weekend pass can never be sold into a Saturday that has filled. It works for
 * every booking, not only events: a booking's tiers with no capacity read as
 * unlimited.
 */

export type TicketChip = "soldOut" | "ended" | "lastFew" | "popular";

export interface TicketRow {
  id: string;
  state: EventTicketState;
  /** The booking's own ticket type, for what the event view does not carry
   *  (people per ticket, age note, pay-what-you-want). */
  pt: PriceTier | undefined;
  /** The one state chip the card wears, most important first. */
  chip: TicketChip | null;
  /** Cannot be bought: sold out or its sales window has closed. */
  gone: boolean;
}

/** "Last few": a tenth of the stock or ten tickets, whichever is more. */
function isLastFew(s: EventTicketState): boolean {
  if (s.block || !Number.isFinite(s.remaining) || s.remaining <= 0) return false;
  const stock = s.tier.quantity;
  return s.remaining <= 10 || (stock > 0 && s.remaining <= stock * 0.1);
}

export function buildTicketRows(ctx: Pick<PageCtx, "ev" | "product" | "now">): TicketRow[] {
  const states = eventTicketStates(ctx.ev, ctx.now, null);
  /* "Most popular" is read off the ledger, never chosen: the best-selling ticket
     still on sale, and only when it is meaningfully ahead of the next. A badge
     that sits on whatever the operator wants to push is an advertisement wearing
     the clothes of a fact. (The rule the event templates already follow.) */
  const live = states.filter((s) => !s.block);
  const ranked = [...live].sort((a, b) => b.tier.sold - a.tier.sold);
  const popularId =
    ranked.length >= 3 && ranked[0].tier.sold >= Math.max(1, ranked[1].tier.sold * 1.25) ? ranked[0].tier.id : null;

  const rows = states.map<TicketRow>((state) => {
    const chip: TicketChip | null =
      state.block === "soldOut"
        ? "soldOut"
        : state.block === "ended"
          ? "ended"
          : isLastFew(state)
            ? "lastFew"
            : state.tier.id === popularId
              ? "popular"
              : null;
    return {
      id: state.tier.id,
      state,
      pt: ctx.product.tiers.find((x) => x.id === state.tier.id),
      chip,
      gone: !!state.block,
    };
  });
  /* What can be bought first; what cannot, last, in the order it was written. */
  return [...rows.filter((r) => !r.gone), ...rows.filter((r) => r.gone)];
}

/** The unit a price is quoted in: "per person", "for 4 people", "per hour". Kept
 *  honest — a flat-per-session booking says "per booking", not "per person". */
export function useTicketUnit(product: Product): (pt: PriceTier | undefined, price: number) => string {
  const t = useTranslations("storefront");
  return (pt, price) => {
    if (price === 0) return "";
    const admits = pt?.admits ?? 1;
    if (admits > 1) return t("pg.shell.forPeople", { count: admits });
    if (product.durationConfig?.pricingModel === "hourly") return t("pg.shell.perHour");
    if (product.pricingBasis === "per_booking") return t("pg.shell.perBooking");
    return t("pg.shell.perPerson");
  };
}

/** The cheapest ticket that can still be bought, and whether the page should
 *  say "From" (more than one price on offer) or state the single price.
 *
 *  A free ticket beside paid ones (a members-only pass, a child under five) is
 *  not what the event costs: a hero reading "Free" over ৳300 and ৳750 tickets
 *  misleads. So where paid tickets are on sale the price is the cheapest PAID
 *  one, and `freeToo` says some tickets are also free. */
export function priceSummary(rows: TicketRow[]): { price: number | null; pt: PriceTier | undefined; many: boolean; allEnded: boolean; freeToo: boolean } {
  const open = rows.filter((r) => !r.gone);
  if (open.length === 0) {
    return { price: null, pt: undefined, many: false, allEnded: rows.length > 0 && rows.every((r) => r.state.block === "ended"), freeToo: false };
  }
  const paid = open.filter((r) => r.state.tier.price > 0);
  const pool = paid.length ? paid : open;
  const cheapest = pool.reduce((a, b) => (b.state.tier.price < a.state.tier.price ? b : a));
  return {
    price: cheapest.state.tier.price,
    pt: cheapest.pt,
    many: new Set(open.map((r) => r.state.tier.price)).size > 1,
    allEnded: false,
    freeToo: paid.length > 0 && paid.length < open.length,
  };
}

/** Is the ticket-options section drawn? Only when there is something to choose
 *  between: two or more ticket types, or an on-a-date booking (a court by the
 *  hour is one decision, and the booking panel is the whole of it). */
export const hasTicketOptions = (ctx: Pick<PageCtx, "sections" | "ev" | "product">): boolean =>
  ctx.sections.includes("tickets") && ctx.ev.tiers.length > 0 && (isEventProduct(ctx.product) || ctx.ev.tiers.length >= 2);

/** The primary action's words: "Get tickets" where there are tickets to choose
 *  between or a date to be at, "Book now" for a single thing to book. */
export function usePrimaryLabel(ctx: Pick<PageCtx, "ev" | "product" | "labels">): string {
  const t = useTranslations("storefront");
  const eventLike = ctx.ev.tiers.length > 1 || isEventProduct(ctx.product);
  return eventLike ? ctx.labels.getTickets : t("pg.shell.bookNow");
}
