"use client";

import { cn } from "@/lib/cn";

/**
 * The one place the till's two big buttons live.
 *
 * Every screen that moves a sale ends on the same pair, in the same places:
 * the "not now" action on the LEFT (Hold, Pause, Back), and the orange button
 * that moves the sale forward on the RIGHT (Add to sale → Take payment →
 * Complete sale → New sale). A cashier who cannot read the words learns
 * "orange, bottom right" once and works from that for every sale after it —
 * which is the whole of what the research says a till used under a queue has
 * to be: the next step always in the same place, reached without reading.
 *
 * It is one component rather than a pattern copied screen by screen because a
 * copied pattern drifts. The schedule's bar, the sell screen's bar, the cart's
 * footer and every sheet's footer are all this.
 */

const BASE =
  "inline-flex min-w-0 items-center justify-center gap-tight rounded-control px-comfortable text-md font-semibold transition-transform duration-quick active:scale-[0.98]";

/** The orange button. `grow` is its share of the row. */
export const primaryButton = (h = "h-13", grow = "flex-[1.4]") => `${BASE} ${h} ${grow} bg-ember-solid text-on-solid disabled:bg-line disabled:text-muted`;
/** The white one beside it. */
export const secondaryButton = (h = "h-13", grow = "flex-1") => `${BASE} ${h} ${grow} border-2 border-line bg-card text-fg disabled:opacity-50`;

export interface BarAction {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** The accessible name when the label is not the whole story. */
  ariaLabel?: string;
}

export function ActionBar({
  id,
  label,
  summary,
  children,
  secondary,
  primary,
  docked = "screen",
  className,
}: {
  id?: string;
  /** Names the bar for a screen reader. */
  label?: string;
  /** What is about to happen, stated before the buttons: the count on the
   *  left, the money on the right. */
  summary?: React.ReactNode;
  /** Anything that has to be answered before the orange button can work —
   *  what to sell a shared field as, a signed safety form. */
  children?: React.ReactNode;
  secondary?: BarAction | null;
  primary?: BarAction | null;
  /**
   * `screen` — floats above the tab bar (a landscape tablet has a rail
   * instead, so it sits on the floor there).
   * `dock` — the sale's own floating pill, sitting just above the tab bar's
   *   pill: two buttons on a card with nothing behind them and no slab reaching
   *   to the bottom of the screen. The page scrolls under it. The sell screen's
   *   bar is this.
   * `panel` — the foot of a sheet or a side panel, in the flow.
   */
  docked?: "screen" | "dock" | "panel";
  className?: string;
}) {
  const buttons = (secondary || primary) && (
    <div className="flex gap-tight">
      {secondary && (
        <button type="button" className={secondaryButton("h-13", primary ? "flex-1" : "flex-1")} onClick={secondary.onClick} disabled={secondary.disabled} aria-label={secondary.ariaLabel}>
          {secondary.icon}
          <span className="truncate">{secondary.label}</span>
        </button>
      )}
      {primary && (
        <button type="button" className={primaryButton("h-13", secondary ? "flex-[1.4]" : "flex-1")} onClick={primary.onClick} disabled={primary.disabled} aria-label={primary.ariaLabel}>
          {primary.icon}
          <span className="truncate">{primary.label}</span>
        </button>
      )}
    </div>
  );
  if (docked === "panel") {
    return (
      <section id={id} aria-label={label} className={cn("flex flex-col gap-tight border-t border-line bg-sheet px-section pb-[calc(12px+env(safe-area-inset-bottom))] pt-comfortable", className)}>
        {summary}
        {children}
        {buttons}
      </section>
    );
  }
  return (
    /* The wrapper positions; the section draws. Behind the section (below the
       tab pill, which is z-40) sits ONE opaque page-coloured block from the top
       of the bar to the bottom of the screen, with a soft fade above it, so the
       bar and the tab pill read as one piece of chrome and no card shows
       through the gaps. Where there is no tab pill (the landscape rail) there is
       no block. */
    <div
      className={cn(
        "fixed z-30",
        docked === "screen"
          ? /* Bottom in classes, not an inline style: an inline style beats
               `rail:`, and on a landscape tablet (no tab bar) the bar floated
               85px up for a tab bar that is not there. */
            "inset-x-tight bottom-[calc(84px+env(safe-area-inset-bottom))] sm:left-1/2 sm:right-auto sm:w-[30rem] sm:-translate-x-1/2 rail:bottom-comfortable"
          : /* z-30: under the tab bar (z-40). Its bottom edge is 8px above the
               pill's top (76px + 8 + the device inset); on a landscape tablet
               there is no bar, so it floats 12px off the floor. */
            "inset-x-comfortable bottom-[calc(84px+env(safe-area-inset-bottom))] mx-auto max-w-md rail:bottom-comfortable",
        className,
      )}
    >
      <ChromeBackdrop />
      <section
        id={id}
        aria-label={label}
        className={cn(
          "flex flex-col gap-tight",
          docked === "screen" ? "p-comfortable go-raised" : "rounded-full go-raised p-tight",
        )}
      >
        {summary}
        {children}
        {buttons}
      </section>
    </div>
  );
}

/**
 * The opaque page-colour block behind a docked bar and the tab pill: from the
 * bar's top edge to the bottom of the screen (the wrapper's `bottom` is the
 * pill's top plus 8px, so it reaches down by the same amount), full width, with
 * a 20px fade above. Put it first inside a `fixed` wrapper that has a z-index.
 * Not drawn on the landscape rail, which has no tab pill.
 */
export function ChromeBackdrop({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute -bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 top-0 -z-10 w-screen -translate-x-1/2 rail:hidden", className)}>
      <span className="absolute inset-0 bg-surface" />
      <span className="absolute inset-x-0 bottom-full h-5 bg-linear-to-t from-surface to-transparent" />
    </span>
  );
}

/** The summary line every bar opens with: what on the left, money on the right. */
export function BarSummary({ lead, sub, money, moneySub, trailing }: { lead: React.ReactNode; sub?: React.ReactNode; money?: React.ReactNode; moneySub?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-tight">
      <div className="min-w-0 flex-1">
        <p aria-live="polite" className="text-md font-semibold text-fg">{lead}</p>
        {sub && <p className="line-clamp-2 text-sm text-muted">{sub}</p>}
      </div>
      {money != null && (
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-fg">{money}</p>
          {moneySub && <p className="text-sm text-muted">{moneySub}</p>}
        </div>
      )}
      {trailing}
    </div>
  );
}
