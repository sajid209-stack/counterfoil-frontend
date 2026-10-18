"use client";

import { Skeleton } from "@/components/ui";
import { FIGURES_SHOWN, FigureBand, type StatIconTone, type useFigureFold } from "@/components/ui/StatStrip";
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
  /** The soft round icon on the figure's card, and its tint (every width). */
  icon?: React.ReactNode;
  iconTone?: StatIconTone;
  /** Drawn at the end of the label row (an info button). */
  action?: React.ReactNode;
}

/**
 * A phone's figures: one card, two cells across, every figure on screen.
 *
 * It used to be a row of cards that scrolled sideways and snapped, on the
 * reasoning that four full-width cards cost ~800px. Both halves of that were
 * right and the answer was wrong: a sideways row hides the third and fourth
 * figures behind a gesture nobody makes, and its cards were cut mid-word at the
 * screen's edge. Two across in one card is ~140px, shows all four, and is the
 * same cell `StatStrip` draws for every other page (`FigureBand`), so the
 * dashboard's phone figures and a list page's cannot drift apart. **No figure
 * shrinks to fit** — a cut-off figure is a different number.
 *
 * `grid` is the other deliberate shape, for figures that are each a card of
 * their own (Finances' four balances, with an action on each): a 2 x 2 of
 * separate cards, the label on one line and the "i" beside the figure, so no
 * label wraps to make room for it.
 *
 * Both shapes fold to the first two figures on a phone (docs/mobile.md §4): the
 * caller orders `items` so the two that matter come first, and a "Show all N"
 * button names the rest.
 */
export function MetricStrip({
  items,
  loading = false,
  label,
  grid = false,
  fold,
}: {
  items: Metric[];
  loading?: boolean;
  label: string;
  grid?: boolean;
  /** `grid` only: the owner's fold (`useFigureFold`), so the cards after the first
   *  two wait on a phone until its "Show all" button opens them. The caller draws
   *  the button, because where it sits is part of the page's layout. */
  fold?: ReturnType<typeof useFigureFold>;
}) {
  if (!grid) {
    return (
      <FigureBand
        label={label}
        loading={loading}
        items={items.map(({ key, label: l, value, delta, context, contextTone, tone, icon, iconTone }) => ({ key, label: l, value, delta, context, contextTone, tone, icon, iconTone }))}
      />
    );
  }
  return (
    <div id={fold?.id} role="group" aria-label={label} className="grid grid-cols-2 gap-tight">
      {items.map((m, i) => (
        <div key={m.key} data-metric={m.key} className={cn("card-surface min-w-0 p-comfortable", fold?.folds && !fold.open && i >= FIGURES_SHOWN && "max-sm:hidden")}>
          {/* The same anatomy the desktop tile has: label and change on one line,
              the figure, then what the figure does not say on its own. */}
          <div className="flex min-h-[22px] items-start justify-between gap-tight">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap pt-0.5 text-xs font-medium leading-snug text-muted">
              {m.icon && <span aria-hidden className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-fg-secondary [&>svg]:h-4 [&>svg]:w-4">{m.icon}</span>}
              <span className="min-w-0 truncate">{m.label}</span>
            </p>
            {!loading && m.delta}
          </div>
          {loading ? (
            <Skeleton className="mt-tight h-6 w-24" />
          ) : (
            <div className="mt-inline flex items-center justify-between gap-tight">
              <p
                className={cn(
                  "type-figure whitespace-nowrap text-xl font-semibold leading-tight",
                  m.tone === "warning" && "text-warning",
                  m.tone === "danger" && "text-danger",
                )}
              >
                {m.value}
              </p>
              <span>{m.action}</span>
            </div>
          )}
          {!loading && m.context && <p className={cn("mt-inline text-xs leading-snug", m.contextTone ?? "text-muted")}>{m.context}</p>}
        </div>
      ))}
    </div>
  );
}
