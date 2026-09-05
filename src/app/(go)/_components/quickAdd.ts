import {
  applyResourceRate,
  getResourceMatrix,
  getSlots,
  isOpenOn,
  type Product,
  type Resource,
} from "@/lib/api";
import { isFlexibleResource, isResourceType, isSlotBased, needsSchedule, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import type { CartEntry } from "./ProductSheet";

/**
 * "Book now" — the obvious sale, in one tap.
 *
 * Most of what a counter sells has exactly one sensible answer: the next
 * departure, the first free field, one adult ticket. Making a cashier open a
 * sheet to confirm what the till already knows is a tap and a decision spent
 * on nothing.
 *
 * The rule this follows, and the reason it is safe: it offers a shortcut ONLY
 * where there is a single obvious choice. Anything that needs a real decision
 * — a seat, a therapist, a guide, a course, a waiver, a section, a bundle —
 * returns null and keeps the sheet, because a shortcut that guesses at a
 * decision is worse than the tap it saved. Nothing here is irreversible
 * either: it lands as a normal cart line the cashier can tap to change.
 */
export interface QuickPick {
  entry: Omit<CartEntry, "id">;
  /** For the confirmation — what was chosen, so a cashier can check it. */
  label: { time?: string; resource?: string; price: number };
}

export function quickPick(
  product: Product,
  date: string,
  nowMinutes: number,
  resources: Resource[],
): QuickPick | null {
  const bt = product.bookingType;

  // Decisions a shortcut must not make for anybody.
  if (product.layoutId) return null;                       // pick your seat
  if (bt === "BT-10" || bt === "BT-09") return null;        // therapist, guide
  if (bt === "BT-13" || bt === "BT-08" || bt === "BT-12") return null; // course, bundle, credits
  if ((product.sections?.length ?? 0) > 0 || bt === "BT-07") return null; // sections
  if (bt === "BT-14") return null;                          // passes issue elsewhere
  if (product.policies?.waiver) return null;                // must be signed for
  if (isFlexibleResource(bt)) return null;                  // the sheet's own "Start now" owns this

  const tiers = product.tiers.filter((t) => t.active && !t.donation);
  if (!tiers.length && !isResourceType(bt)) return null;
  // The cheapest active tier is the one a bare "one, please" means.
  const tier = [...tiers].sort((a, b) => a.price - b.price)[0];
  const basePrice = tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0;

  // ── a field, a court, a lane on fixed hours ────────────────────────────────
  if (isResourceType(bt)) {
    if (!isOpenOn(product, date)) return null;
    const minutes = product.schedule?.sessionMinutes ?? 60;
    for (const row of getResourceMatrix(product, date)) {
      if (row.resource.outOfService) continue;
      const slot = row.slots.find((s) => s.available && toMinutes(s.time) >= nowMinutes);
      if (!slot) continue;
      const price = applyResourceRate(
        resolveProductPrice(product, date, slot.time, basePrice),
        minutes,
        row.resource,
      );
      return {
        entry: {
          productId: product.id,
          productName: product.name,
          slotDate: date,
          slotTime: slot.time,
          slotEnd: endOf(date, slot.time, minutes),
          resourceId: row.resource.id,
          resourceLabel: row.resource.name,
          // The same default the sheet opens on, so the shortcut and the long
          // way round do not quietly sell different things.
          partySize:
            product.pricingBasis !== "per_person"
              ? Math.max(product.policies?.partyMin ?? 1, 2)
              : undefined,
          items: [],
          fixedPrice: price,
        },
        label: { time: slot.time, resource: row.resource.name, price },
      };
    }
    return null;
  }

  if (!tier) return null;

  // ── a timed session ───────────────────────────────────────────────────────
  if (isSlotBased(bt)) {
    if (!isOpenOn(product, date)) return null;
    const next = getSlots(product, date).find((s) => s.remaining > 0 && toMinutes(s.time) >= nowMinutes);
    if (!next) return null;
    const price = resolveProductPrice(product, date, next.time, tier.price);
    return {
      entry: {
        productId: product.id,
        productName: product.name,
        slotDate: date,
        slotTime: next.time,
        items: [{ tierId: tier.id, tierName: tier.name, unitPrice: price, qty: 1 }],
      },
      label: { time: next.time, price },
    };
  }

  // ── open entry, a date-range pass, a daily-capped day ─────────────────────
  const dated = needsSchedule(bt) || !!product.schedule?.dailyCapacity;
  return {
    entry: {
      productId: product.id,
      productName: product.name,
      slotDate: dated ? date : undefined,
      items: [{ tierId: tier.id, tierName: tier.name, unitPrice: tier.price, qty: 1 }],
    },
    label: { price: tier.price },
  };
}

/** The same composition ProductSheet's endISO uses. Written out rather than
 *  imported (it is not exported) but built from the SAME helpers, so the two
 *  cannot drift into different string formats for the same instant. */
const endOf = (date: string, time: string, minutes: number) =>
  slotISO(date, toTime(toMinutes(time) + minutes));
