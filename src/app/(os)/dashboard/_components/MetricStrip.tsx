"use client";

import { cn } from "@/lib/cn";

export interface Metric {
  key: string;
  label: string;
  value: React.ReactNode;
  /** A change against the period before. */
  delta?: React.ReactNode;
  /** The line under the figure — what the figure does not say on its own. */
  context?: React.ReactNode;
  /** A class for that line where it is a problem rather than a fact. */
  contextTone?: string;
  tone?: "warning" | "danger";
  /** Drawn at the end of the label row (an info button). */
  action?: React.ReactNode;
}

/**
 * A phone's figures: a row of compact cards that scroll sideways and snap,
 * where a desktop draws a band or four tiles.
 *
 * Shopify admin's phone home does this and for the reason this page measured:
 * four full-width cards were ~800px of a phone before the page's own subject.
 * Here four metrics are one 100px row. **No figure shrinks to fit** — a cut-off
 * figure is a different number — so each card is wide enough for a seven-digit
 * amount and the next card shows its edge, which is what says "there is more".
 *
 * It bleeds to the screen edges (negative gutter margins) so the cards scroll
 * off the edge of the glass rather than stopping short of it, and snaps with
 * the first card aligned to the gutter. The strip is a focusable region so a
 * keyboard can scroll it.
 *
 * `grid` is the other deliberate shape, for figures that are all wanted at once
 * (Finances' four balances): a 2 x 2 of the same cards, the label on one line
 * and the "i" beside the figure, so no label wraps to make room for it.
 */
export function MetricStrip({ items, loading = false, label, grid = false }: { items: Metric[]; loading?: boolean; label: string; grid?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={grid ? undefined : 0}
      className={
        grid
          ? "grid grid-cols-2 gap-tight"
          : "relative -mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-tight overflow-x-auto px-gutter pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
    >
      {items.map((m) => (
        <div key={m.key} data-metric={m.key} className={cn("card-surface p-comfortable", grid ? "min-w-0" : "w-[39vw] min-w-[9.5rem] max-w-[10.25rem] shrink-0 snap-start")}>
          {/* The same anatomy the desktop tile has: label and change on one line,
              the figure, then what the figure does not say on its own. */}
          <div className="flex min-h-[22px] items-start justify-between gap-tight">
            <p className="min-w-0 flex-1 pt-0.5 text-[12px] font-medium leading-snug text-muted">{m.label}</p>
            {!loading && m.delta}
            {!grid && m.action}
          </div>
          {loading ? (
            <span aria-hidden className="mt-tight block h-6 w-24 animate-pulse rounded-xs bg-line" />
          ) : (
            <div className="mt-inline flex items-center justify-between gap-tight">
              <p
                className={cn(
                  "type-figure whitespace-nowrap text-[1.25rem] font-semibold leading-tight",
                  m.tone === "warning" && "text-warning",
                  m.tone === "danger" && "text-danger",
                )}
              >
                {m.value}
              </p>
              {grid && m.action}
            </div>
          )}
          {!loading && m.context && <p className={cn("mt-inline text-[12px] leading-snug", m.contextTone ?? "text-muted")}>{m.context}</p>}
        </div>
      ))}
    </div>
  );
}
