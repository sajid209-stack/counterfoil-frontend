"use client";

import { formatPriceShort } from "@/lib/format";
import { usePage } from "./context";
import { buildTicketRows, priceSummary, usePrimaryLabel, useTicketUnit } from "./ticketRows";

/** Room the bar takes at the foot of the page, safe area included, which the
 *  page reserves so its last section is never under it. */
export const BOOK_BAR_H = 76;

/**
 * The phone and tablet's booking bar (docs/product-page.md §3.3): fixed to the
 * foot of the screen, "From ৳X" with its unit on the left and the one primary
 * action on the right, which opens the booking sheet. There is no booking panel
 * below the desktop width, so this is the way in.
 *
 * It sits at `z-40`, the layer the storefront's own basket bar uses — the two
 * are never on one page (the basket bar belongs to the venue page), and the
 * quick-add toast rises to `bottom-24`, above this bar.
 */
export function MobileBookBar() {
  const ctx = usePage();
  const label = usePrimaryLabel(ctx);
  const unitOf = useTicketUnit(ctx.product);
  const rows = buildTicketRows(ctx);
  const sum = priceSummary(rows);
  const price = sum.price;
  const noTickets = rows.length === 0;
  const unit = price !== null ? unitOf(sum.pt, price) : "";
  const muted = "var(--pg-muted)";

  return (
    <div
      data-pg-bookbar
      className="fixed inset-x-0 bottom-0 z-40 shadow-float"
      style={{
        background: "var(--pg-card)",
        borderTop: "1px solid var(--pg-line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="pg-container flex items-center justify-between gap-4" style={{ height: BOOK_BAR_H - 12, minHeight: BOOK_BAR_H - 12 }}>
        <div className="min-w-0 leading-tight">
          {price !== null ? (
            <>
              <p className="tnum truncate text-[20px] font-bold leading-6" style={{ color: "var(--pg-fg)" }}>
                {price > 0 && sum.many && (
                  <span className="mr-1.5 text-[13px] font-medium" style={{ color: muted }}>
                    {ctx.labels.from}
                  </span>
                )}
                {price === 0 ? ctx.labels.free : formatPriceShort(price)}
              </p>
              {unit && (
                <p className="truncate text-[13px] leading-[18px]" style={{ color: muted }}>
                  {unit}
                </p>
              )}
            </>
          ) : (
            !noTickets && (
              <p className="text-[16px] font-semibold" style={{ color: "var(--pg-fg)" }}>
                {ctx.labels.soldOut}
              </p>
            )
          )}
        </div>
        <button
          type="button"
          className="pg-btn shrink-0"
          disabled={!noTickets && price === null}
          onClick={() => ctx.book()}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
