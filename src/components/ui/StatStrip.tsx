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
  /** A line under the figure, where the figure alone does not say enough —
   *  a date says when, not which event. */
  sub?: string | null;
  /** A figure that is also a filter: pressing it shows the rows it counts.
   *  Opt-in; a card without one stays a plain figure. */
  onClick?: () => void;
  /** Whether that filter is the one applied. */
  pressed?: boolean;
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
          ? "-mx-gutter flex gap-section overflow-x-auto px-gutter pb-inline [scrollbar-width:none]"
          : "grid grid-cols-2 gap-section lg:[grid-template-columns:repeat(var(--stat-n),minmax(0,1fr))]",
      )}
      /* As many columns as there are figures, from lg — three figures in a
         four-column grid left a hole where the fourth would be. */
      style={{ "--stat-n": Math.min(items.length, 4) } as React.CSSProperties}
    >
      {items.map((item) => {
        const Tag = item.onClick ? "button" : "div";
        return (
        <Tag
          key={item.key}
          title={item.note ?? undefined}
          {...(item.onClick ? { type: "button" as const, onClick: item.onClick, "aria-pressed": !!item.pressed } : {})}
          className={cn(
            "card-surface flex min-h-[5.25rem] flex-col justify-start gap-tight p-card text-left",
            compact && "min-w-[10rem] shrink-0",
            item.onClick && "transition-colors duration-quick hover:border-strong",
            item.pressed && "border-inverse",
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
          {item.sub && !loading && <span className="-mt-inline truncate text-[12px] text-muted">{item.sub}</span>}
        </Tag>
        );
      })}
    </div>
  );
}
