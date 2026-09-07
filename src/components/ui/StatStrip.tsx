"use client";

import { cn } from "@/lib/cn";

export interface StatItem {
  key: string;
  label: string;
  value: string;
  /** Draws the figure as a problem rather than a fact. */
  tone?: "warning";
  /** A qualifier on the figure — shown as the card's tooltip, not as a line. */
  note?: string | null;
}

/**
 * A row of figures describing whatever the page is currently filtered to.
 *
 * Extracted at the third use. The calendar and the orders list had each grown
 * their own copy of this — same card, same height, same phone behaviour — and
 * a third would have been the point at which they started drifting apart
 * instead of merely being duplicated.
 *
 * Two rules the copies agreed on and this keeps: the figures describe the
 * whole filtered set rather than the page on screen, and on a phone the row
 * scrolls rather than wrapping, because two rows of cards push the first row
 * of actual content off the bottom of the screen.
 */
export function StatStrip({
  items,
  compact = false,
  loading = false,
}: {
  items: StatItem[];
  compact?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        compact
          ? "-mx-comfortable flex gap-tight overflow-x-auto px-comfortable pb-inline [scrollbar-width:none]"
          : "grid grid-cols-2 gap-tight lg:grid-cols-4 lg:gap-comfortable",
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          title={item.note ?? undefined}
          className={cn(
            "card-surface flex min-h-[5.25rem] flex-col justify-center gap-tight px-comfortable py-comfortable",
            compact && "min-w-[10rem] shrink-0",
          )}
        >
          <span className="type-label truncate text-[12px] text-muted">{item.label}</span>
          {loading ? (
            <span className="h-7 w-24 animate-pulse rounded-xs bg-line" />
          ) : (
            <span
              className={cn(
                "text-2xl font-semibold tracking-tight tabular-nums",
                item.tone === "warning" && "text-warning",
              )}
            >
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
