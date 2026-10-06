"use client";

import { cn } from "@/lib/cn";

/**
 * One thing on the sell screen: a card of its own.
 *
 * The wall was one hairline grid of flat cells, the Schedule's drawing. On the
 * Schedule that works because every cell is the same kind of thing — an hour.
 * A wall of different things (a ticket, a lane, a bottle of water) read as one
 * slab, and the owner asked for separate cards. Square, Shopify POS, Toast and
 * Loyverse all draw the item grid the same way, and so does this: a card per
 * item, a gap between, the name large and plain, the price the biggest figure,
 * and one status line at the foot.
 *
 * Every card answers in the same order, top to bottom, so a cashier's eye
 * learns where each answer sits: the picture (with the count or a flag beside
 * it), the name, the price, what it is, and what it is doing right now. The
 * status line sits on the card's floor, so a row of cards lines its statuses up
 * even when the names run to different lengths. Two things change a card's
 * ground:
 *   · in the sale — a soft orange wash, an orange edge and a solid orange count
 *     in the corner, so a second tap can be seen to have landed;
 *   · nothing to sell — the page's own colour on a hairline, no shadow, the
 *     way closed time is drawn on the Schedule, so "not available" is a place
 *     on the wall and not a greyed button.
 * Orange as a FILL means "chosen" everywhere in the till, so the price is ink:
 * it is the loudest thing on the card by size, not by colour.
 */

/** The card's own drawing, shared with the tiles that are not products. */
export const WALL_CARD = "go-surface relative flex min-w-0 flex-col rounded-go text-left transition-colors duration-quick";

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
      data-wall-tile data-focus-inset
      className={cn(
        WALL_CARD,
        "min-h-[9.5rem] gap-tight p-comfortable sm:min-h-[10.5rem]",
        soldOut
          ? "bg-surface shadow-none dark:bg-surface"
          : count > 0
            ? "bg-ember/[0.06] ring-2 ring-inset ring-ember active:bg-ember/15"
            : "active:bg-ember/10 hover:bg-muted-wash/60",
        soldOut && "border border-line",
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
        <span className={cn("line-clamp-2 text-[1rem] font-semibold leading-snug", soldOut && "text-muted")}>{name}</span>
        {price != null && <span className={cn("text-[1.375rem] font-bold leading-tight tabular-nums", soldOut ? "text-muted" : "text-fg")}>{price}</span>}
        {/* What it is: on a phone the sheet behind the card says it, and the
            wall needs the rows. */}
        {meta && <span className="hidden text-[0.8125rem] leading-tight text-muted sm:line-clamp-2">{meta}</span>}
        {live && (
          <span
            className={cn(
              "mt-auto flex items-center gap-inline pt-inline text-[0.8125rem] leading-tight",
              live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-warning" : "text-success",
            )}
          >
            {/* A dot ahead of the words: across a wall the eye reads colour
                first, and the words carry it anyway. */}
            <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
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
    <p className="col-span-full flex min-h-11 items-center gap-tight px-inline pt-tight text-[0.875rem] font-semibold text-muted">
      {icon}
      {children}
    </p>
  );
}
