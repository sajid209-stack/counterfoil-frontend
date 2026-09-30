"use client";

import { cn } from "@/lib/cn";

/**
 * One thing on the sell screen.
 *
 * The wall is a grid of cells on ONE card, divided by hairlines — the same
 * drawing as the Schedule's board, where the owner's verdict was that it read
 * at a glance. Floating cards with gaps between them put the page colour
 * between every product, and a wall of twenty rounded cards is twenty shapes
 * to scan instead of one grid.
 *
 * Every tile answers in the same order, top to bottom, so a cashier's eye
 * learns where each answer sits: the picture, the name, the price, what it is,
 * and what it is doing right now. Two things change a tile's ground:
 *   · in the sale — a soft orange wash and a solid orange count in the corner,
 *     so a second tap can be seen to have landed;
 *   · nothing to sell — the page's own colour, the way closed time is drawn on
 *     the Schedule, so "not available" is a place on the wall and not a
 *     greyed button.
 * Orange as a FILL means "chosen" everywhere in the till, so the price is ink:
 * it is the loudest thing on the tile by size, not by colour.
 */
export function WallTile({
  onClick,
  ariaLabel,
  thumb,
  name,
  price,
  meta,
  live,
  count = 0,
  soldOut = false,
  soldOutLabel,
  flag,
  disabled,
}: {
  onClick: () => void;
  ariaLabel?: string;
  thumb?: React.ReactNode;
  name: React.ReactNode;
  price?: React.ReactNode;
  meta?: React.ReactNode;
  /** The live line: a coloured dot and a few words. */
  live?: { text: string; tone: "ok" | "low" | "none" } | null;
  /** How many of this are already in the sale. */
  count?: number;
  soldOut?: boolean;
  soldOutLabel?: string;
  /** A word for the corner when there is no count: "Limited". */
  flag?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-focus-inset
      className={cn(
        "relative flex min-h-[7.5rem] min-w-0 flex-col gap-tight border-b border-r border-line p-comfortable text-left transition-colors duration-quick sm:min-h-[9.25rem]",
        soldOut ? "bg-surface" : count > 0 ? "bg-ember/[0.06] active:bg-ember/15" : "bg-card hover:bg-muted-wash/60 active:bg-ember/10",
      )}
    >
      <span className="flex w-full items-start justify-between gap-tight">
        {thumb}
        {count > 0 ? (
          <span aria-hidden className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-ember-solid px-1.5 text-[0.875rem] font-semibold tabular-nums text-white">
            {count}
          </span>
        ) : soldOut ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-danger/10 px-tight py-inline text-[0.8125rem] font-medium text-danger">{soldOutLabel}</span>
        ) : flag ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-warning-wash px-tight py-inline text-[0.8125rem] font-medium text-warning">{flag}</span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-inline">
        <span className={cn("line-clamp-3 text-[0.9375rem] font-semibold leading-snug", soldOut && "text-muted")}>{name}</span>
        {price != null && <span className={cn("text-[1.125rem] font-bold leading-tight tabular-nums", soldOut ? "text-muted" : "text-fg")}>{price}</span>}
        {/* What it is: on a phone the sheet behind the tile says it, and the
            wall needs the rows. */}
        {meta && <span className="hidden text-[0.8125rem] leading-tight text-muted sm:line-clamp-2">{meta}</span>}
        {live && (
          <span
            className={cn(
              "flex items-center gap-inline text-[0.8125rem] leading-tight",
              live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-warning" : "text-success",
            )}
          >
            {/* A dot ahead of the words: across a wall the eye reads colour
                first, and the words carry it anyway. */}
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
            <span className="min-w-0 truncate">{live.text}</span>
          </span>
        )}
      </span>
    </button>
  );
}

/** A section heading across the whole wall — Event tickets, Shop. */
export function WallHeading({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="col-span-full flex min-h-11 items-center gap-tight border-b border-r border-line bg-surface px-comfortable text-[0.875rem] font-semibold text-muted">
      {icon}
      {children}
    </p>
  );
}
