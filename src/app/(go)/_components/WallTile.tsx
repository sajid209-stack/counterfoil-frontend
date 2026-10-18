"use client";

import { useState } from "react";
import {
  Armchair,
  CalendarClock,
  Clock,
  CreditCard,
  GraduationCap,
  Layers,
  ChevronRight,
  MapPin,
  Plus,
  Ticket,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { BookingTypeCode } from "@/lib/api/types";

/**
 * One thing on the sell wall: an image-first card.
 *
 * The grocery apps taught everyone how to buy from a grid, and the till should
 * not make anyone learn it again: a large soft picture across the top of a
 * rounded white card, the name in bold with one quiet line under it, the price,
 * and a small round dark "+" at the bottom right. Calm comes from what is
 * left out — no border, no hairline between the cards, a gap of page around
 * every one — and from every card being the same shape.
 *
 * Every card answers in the same order, so a cashier's eye learns where each
 * answer sits:
 *   · the picture (a flag or "sold out" over its top-left, the count of what
 *     is already in the sale over its top-right);
 *   · the name — wraps to two lines, never one clipped line;
 *   · what it is doing right now ("4 of 4 free", "Starts 4 Aug") — quiet;
 *   · the price, the biggest figure, and the "+".
 *
 * An item with no photograph gets a soft panel the same shape with its glyph
 * centred — a card with a hole where the picture should be is the failure the
 * seed-photography pass already decided is worse than no photograph.
 *
 * The whole card is ONE button. The "+" is a drawing of what a tap does, not a
 * second control — nesting buttons would put two targets on one card and a
 * second tap-region inside the first. Two things change a card's ground:
 *   · in the sale — a soft orange wash, an orange ring and a solid orange count;
 *   · nothing to sell — the page's own colour, no shadow, no "+", a muted
 *     picture: "not available" is a place on the wall and not a greyed button.
 * Orange as a FILL means "chosen" everywhere in the till, so the price is ink.
 */

/** The card's own drawing, shared with the tiles that are not products. */
export const WALL_CARD = "card-surface relative flex min-w-0 flex-col text-left transition-colors duration-quick";

/** A booking's glyph, for a card with no photograph. Sized by the card. */
export function BookingGlyph({ bookingType }: { bookingType?: BookingTypeCode }) {
  switch (bookingType) {
    case "BT-03":
    case "BT-06":
      return <Clock strokeWidth={1.5} aria-hidden />;
    case "BT-04":
    case "BT-05":
      return <MapPin strokeWidth={1.5} aria-hidden />;
    case "BT-07":
      return <Armchair strokeWidth={1.5} aria-hidden />;
    case "BT-08":
      return <Layers strokeWidth={1.5} aria-hidden />;
    case "BT-09":
    case "BT-10":
      return <Users strokeWidth={1.5} aria-hidden />;
    case "BT-12":
      return <CreditCard strokeWidth={1.5} aria-hidden />;
    case "BT-13":
      return <GraduationCap strokeWidth={1.5} aria-hidden />;
    case "BT-14":
      return <CalendarClock strokeWidth={1.5} aria-hidden />;
    default:
      return <Ticket strokeWidth={1.5} aria-hidden />;
  }
}

/** The picture area: a photograph, or a soft panel with a glyph. */
function Media({ image, glyph, dim }: { image?: string; glyph?: React.ReactNode; dim: boolean }) {
  const [broken, setBroken] = useState(false);
  const showImage = !!image && !broken;
  return showImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see PROJECT_LOG)
    <img
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn("absolute inset-0 size-full object-cover", dim && "opacity-60 grayscale")}
    />
  ) : (
    /* A tint, not a grey: the card is white and `subtle` is a visibly warmer
       step off it. In dark `subtle` and `card` are the same value, so the line
       is what keeps the panel a panel there. */
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center bg-subtle text-fg-secondary ring-1 ring-inset ring-line [&_svg]:size-8"
    >
      {glyph}
    </span>
  );
}

export function WallTile({
  onClick,
  ariaLabel,
  image,
  glyph,
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
  opensSheet = false,
}: {
  onClick: () => void;
  ariaLabel?: string;
  /** The photograph's address. Absent (or broken) draws the glyph panel. */
  image?: string;
  /** What to draw on the panel when there is no photograph. */
  glyph?: React.ReactNode;
  /** @deprecated the previous card's 44px corner picture; drawn as the glyph. */
  thumb?: React.ReactNode;
  name: React.ReactNode;
  price?: React.ReactNode;
  /** What it is. Only from `sm`: on a phone the sheet behind the card says it. */
  meta?: React.ReactNode;
  /** The live line: a coloured dot and a few words. */
  live?: { text: string; tone: "ok" | "low" | "none" } | null;
  /** How many of this are already in the sale. */
  count?: number;
  soldOut?: boolean;
  soldOutLabel?: string;
  /** A word for the picture's corner when there is no count: "Limited". */
  flag?: string;
  disabled?: boolean;
  /** A tap opens a sheet to choose something, rather than adding the item:
   *  the round button draws a chevron instead of a "+". */
  opensSheet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-wall-tile
      data-focus-inset
      className={cn(
        WALL_CARD,
        "gap-1 p-1.5",
        soldOut
          ? "bg-surface shadow-none"
          : count > 0
            ? "bg-ember-wash ring-2 ring-inset ring-ember active:bg-muted-wash"
            : "active:bg-muted-wash hover:bg-muted-wash",
        soldOut && "border border-line",
      )}
    >
      {/* The picture: 4:3, the card's inset all round and a radius concentric
          with the card's (18 − 6 = 12). Everything over it is a chip with its
          own ground, so it reads over any photograph. */}
      <span className={cn("relative block w-full overflow-hidden rounded-md", image ? "aspect-[4/3]" : "aspect-[8/3]")}>
        <Media image={image} glyph={glyph ?? thumb} dim={soldOut} />
        {soldOut ? (
          <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate whitespace-nowrap rounded-full bg-danger-wash px-tight py-inline text-sm font-medium text-fg shadow-sm">{soldOutLabel}</span>
        ) : flag ? (
          <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-3rem)] truncate whitespace-nowrap rounded-full bg-warning-wash px-tight py-inline text-sm font-medium text-fg shadow-sm">{flag}</span>
        ) : null}
        {count > 0 && (
          <span aria-hidden className="absolute right-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-ember-solid px-inline text-base font-semibold tabular-nums text-on-solid shadow-sm">
            {count}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-inline px-tight pb-0.5 pt-0.5">
        <span className={cn("line-clamp-2 text-md font-semibold leading-snug", soldOut && "text-muted")}>{name}</span>
        {meta && <span className="hidden text-sm leading-snug text-muted sm:line-clamp-1 sm:block">{meta}</span>}
        {live && (
          <span
            className={cn(
              "flex items-start gap-inline text-sm leading-snug",
              live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-warning" : "text-muted",
            )}
          >
            {/* A dot ahead of the words: across a wall the eye reads colour
                first, and the words carry it anyway. */}
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full bg-current", live.tone === "ok" && "text-success")} aria-hidden />
            <span className="line-clamp-2 min-w-0">{live.text}</span>
          </span>
        )}
        <span className="mt-auto flex min-h-9 flex-wrap items-center justify-between gap-x-tight gap-y-inline pt-inline">
          {price != null ? (
            <span className={cn("shrink-0 whitespace-nowrap text-lg font-bold leading-none tabular-nums sm:text-xl", soldOut ? "text-muted" : "text-fg")}>{price}</span>
          ) : (
            <span />
          )}
          {/* A drawing of what a tap does. aria-hidden: the card is the button.
              Two different answers, drawn as two different things, in the same
              size and the same spot: "+" is SOLID ink (one tap adds it now);
              "›" is an OUTLINED round — card fill, a line, an ink glyph — (a
              sheet opens to choose something first). A cashier who does not
              read learns the difference by shape and weight, not by glyph. */}
          {!soldOut && (
            <span
              aria-hidden
              className={cn(
                "ml-auto flex size-9 shrink-0 items-center justify-center rounded-full max-[360px]:size-8",
                opensSheet ? "bg-card text-fg ring-1 ring-inset ring-strong" : "bg-inverse text-inverse-fg",
              )}
            >
              {opensSheet ? <ChevronRight size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** The "Other amount" row: a slim full-width card, not a wall-sized empty one. */
export function WallRow({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" data-wall-tile data-focus-inset onClick={onClick} className={cn(WALL_CARD, "col-span-full min-h-14 flex-row items-center gap-tight px-comfortable text-fg hover:bg-muted-wash active:bg-muted-wash")}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-fg-secondary">{icon}</span>
      <span className="min-w-0 flex-1 text-md font-medium">{children}</span>
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
    </button>
  );
}

/** A section heading across the whole wall — Event tickets, Shop. When it is a
 *  jump target (`id`, `tabIndex={-1}`) the caller scrolls to it and focuses it,
 *  so a screen reader lands on the section rather than on the button it left. */
export function WallHeading({
  icon,
  children,
  id,
  tabIndex,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  tabIndex?: number;
}) {
  return (
    <p
      id={id}
      tabIndex={tabIndex}
      className="col-span-full flex min-h-11 scroll-mt-3 items-center gap-tight px-inline pt-tight text-base font-semibold text-muted"
    >
      {icon}
      {children}
    </p>
  );
}
