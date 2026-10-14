/* When an event ticket is good for.
 *
 * A ticket for a booking is for the date on its booking snapshot. A ticket for
 * an EVENT has no snapshot (an event reserves nothing), so there was nothing to
 * read — and every reader fell back to `Ticket.validFor`, which is stamped from
 * the sale and so named the day the ticket was BOUGHT. A guest who bought a
 * weekend pass on 14 Oct was told it was for 14 Oct.
 *
 * This reads the answer from where it lives: the event's own days and the
 * ticket type's day scope. It sits on its own, importing only the product store
 * and the pure event model, so `orders.ts` can use it at issue time without a
 * cycle through `events.ts` (which imports orders).
 */
import { peekProducts } from "./products";
import { eventViewBase, isEventProduct, tierDays } from "./eventModel";
import type { EventDay } from "./events";

export interface EventTicketWhen {
  /** The days the ticket admits, in order. Always at least one. */
  days: EventDay[];
  /** "HH:MM" — when the first admitted day starts. */
  startTime?: string;
  /** "HH:MM" — only stated for a single day, where it is unambiguous. */
  endTime?: string;
}

/** Is this order line an event ticket, and when is it good for? Null for anything else. */
export function eventTicketWhen(productId: string, tierId?: string): EventTicketWhen | null {
  const products = peekProducts();
  let p = products.find((x) => x.id === productId && isEventProduct(x));
  // Lines written when events were a separate record carry an `evt_` prefix in front of the same id.
  if (!p && productId.startsWith("evt_")) p = products.find((x) => x.id === productId.slice(4) && isEventProduct(x));
  if (!p) return null;

  const ev = eventViewBase(p);
  const tier = ev.tiers.find((t) => t.id === tierId);
  const days = tierDays(ev, tier ?? {});
  if (!days.length) return null;

  const first = days[0];
  const eventStart = ev.startsAt.slice(11, 16);
  const startTime = first.startTime ?? (eventStart || undefined);

  let endTime: string | undefined;
  if (days.length === 1) {
    const isLast = ev.days?.length ? ev.days[ev.days.length - 1].id === first.id : true;
    const eventEnd = ev.endsAt && ev.endsAt.slice(0, 10) === first.date ? ev.endsAt.slice(11, 16) : undefined;
    endTime = first.endTime ?? (isLast ? eventEnd : undefined);
  }
  return { days, startTime, endTime };
}
