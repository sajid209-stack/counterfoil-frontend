"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The till's card language, taken from the sell wall and used on every POS
 * screen so the whole till reads as one calm surface.
 *
 *   · The page is the warm ground; every group sits on it as its OWN white
 *     card (`GoCard`), with a gap of page between cards — never a box inside
 *     a box, never a grid of cells joined by hairlines.
 *   · A choice (a date, a time, a length, a way to pay, a staff member, a
 *     More destination) is its own rounded tile (`Tile`, `ActionTile`) with
 *     an 8px gap around it. Tiles sit on the page or on the sheet's ground.
 *   · Chosen = a solid orange fill with white text and a small tick, the one
 *     meaning orange has as a fill in the till. Not available = the page's own
 *     colour, a line, no shadow and muted text — a place, not a greyed button.
 *   · Headings are 16px semibold, sentence case; no coloured eyebrows above
 *     them. Secondary text is 13px muted.
 */

/** A titled group: one white card on the page. */
export function GoCard({
  title,
  aside,
  children,
  className,
  bodyClassName,
  as: As = "section",
  ...rest
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <As className={cn("card-surface flex min-w-0 flex-col gap-comfortable p-card", className)} {...rest}>
      {(title || aside) && (
        <div className="flex min-w-0 items-center justify-between gap-comfortable">
          {title ? <h2 className="min-w-0 text-md font-semibold text-fg">{title}</h2> : <span />}
          {aside}
        </div>
      )}
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </As>
  );
}

/** A quiet section label above tiles that sit straight on a sheet or the page. */
export function TileLabel({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <p id={id} className={cn("text-md font-semibold text-fg", className)}>
      {children}
    </p>
  );
}

/** A grid of separate tiles with an 8px gap. */
export function TileGrid({ cols = 3, className, children, ...rest }: { cols?: 2 | 3 | 4 | 5; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const c = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[cols];
  return (
    <div className={cn("grid gap-tight", c, className)} {...rest}>
      {children}
    </div>
  );
}

export const TILE_BASE =
  "relative flex min-w-0 flex-col items-center justify-center rounded-inner px-tight py-tight text-center transition-colors duration-quick disabled:cursor-not-allowed";
export const TILE_IDLE = "bg-card text-fg shadow-card hover:bg-nav-hover active:bg-nav-selected";
export const TILE_CHOSEN = "bg-ember-solid text-on-solid shadow-none hover:bg-ember-hover active:bg-ember-active";
export const TILE_OFF = "bg-transparent text-muted shadow-none ring-1 ring-inset ring-line";

/** A caller's own height wins: the default is only added when none is passed,
 *  so two min-heights never compete on stylesheet order. */
const withHeight = (fallback: string, className?: string) => (className && /(^|\s|:)min-h-/.test(className) ? undefined : fallback);

/** Class string for a tile in a given state, for callers that need their own element. */
export function tileClass({ selected, off, className }: { selected?: boolean; off?: boolean; className?: string }) {
  return cn(TILE_BASE, withHeight("min-h-11", className), selected ? TILE_CHOSEN : off ? TILE_OFF : TILE_IDLE, className);
}

/**
 * One choice. `selected` draws the orange fill and the tick; `off` draws a
 * place that cannot be chosen (pass `struck` to strike the label too). The
 * caller decides the ARIA: pass `aria-pressed`, or `role="radio"` with
 * `aria-checked`, as the group needs. By default it is a toggle button.
 */
export function Tile({
  selected = false,
  off = false,
  struck = false,
  label,
  sub,
  className,
  children,
  ...rest
}: {
  selected?: boolean;
  off?: boolean;
  struck?: boolean;
  label?: ReactNode;
  sub?: ReactNode;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const ariaDefault = rest.role ? {} : { "aria-pressed": selected };
  return (
    <button type="button" {...ariaDefault} {...rest} className={tileClass({ selected, off, className })}>
      {selected && <Check size={14} strokeWidth={2.5} aria-hidden className="absolute right-1.5 top-1.5" />}
      {children ?? (
        <>
          {label != null && <span className={cn("text-base font-semibold leading-tight", struck && "line-through")}>{label}</span>}
          {sub != null && <span className={cn("mt-0.5 text-xs leading-tight", selected ? "text-on-solid" : "text-muted", struck && "line-through")}>{sub}</span>}
        </>
      )}
    </button>
  );
}

/**
 * An action with a picture: an icon in a soft round, a word under it. The
 * More sheet, print and send, ways to pay. `selected` fills it orange.
 */
export function ActionTile({
  icon,
  label,
  sub,
  selected = false,
  className,
  ...rest
}: {
  icon: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  selected?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(TILE_BASE, withHeight("min-h-[5.5rem]", className), "gap-tight", selected ? TILE_CHOSEN : TILE_IDLE, className)}
    >
      {selected && <Check size={14} strokeWidth={2.5} aria-hidden className="absolute right-1.5 top-1.5" />}
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-full [&_svg]:size-5",
          selected ? "bg-ember-active text-on-solid" : "bg-subtle text-fg",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight">{label}</span>
      {sub != null && <span className={cn("text-xs leading-tight", selected ? "text-on-solid" : "text-muted")}>{sub}</span>}
    </button>
  );
}
