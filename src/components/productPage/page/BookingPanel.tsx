"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { BookingPicker } from "@/app/s/_components/flow/BookingPicker";
import { usePage } from "./context";
import { hasTicketOptions } from "./ticketRows";

/** Which ticket the panel opens with, and a counter that remounts it so a second
 *  "Choose" on a different card re-applies even when the panel is already open. */
export interface PanelPick {
  tierId?: string;
  n: number;
}

/**
 * The booking panel (docs/product-page.md §3.4): on a desktop, the right rail —
 * a sticky card holding the SAME `BookingPicker` the phone sheet uses, so there
 * is one set of questions for every look. The picker names what it asks
 * ("Choose your tickets" / "Choose your time") in its own heading and carries
 * its own total and buttons; this frame only makes it a card that stays in view
 * (`top: 88px`, clear of the 56px section bar) and no taller than the window, so
 * the buttons never scroll away.
 *
 * Money and the basket stay in the picker, untouched.
 */
export function BookingPanel({ panelRef, pick, onAdded }: { panelRef: RefObject<HTMLDivElement | null>; pick: PanelPick; onAdded: () => void }) {
  const ctx = usePage();
  const t = useTranslations("storefront");
  return (
    <aside
      ref={panelRef}
      aria-label={t("booking.panelLabel")}
      className="pg-card shadow-float sticky flex flex-col self-start overflow-hidden"
      style={{ top: 88, maxHeight: "calc(100dvh - 112px)" }}
    >
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <BookingPicker key={pick.n} product={ctx.product} preselectTierId={pick.tierId} compact={hasTicketOptions(ctx)} onAdded={onAdded} />
      </div>
    </aside>
  );
}
