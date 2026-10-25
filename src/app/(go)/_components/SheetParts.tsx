"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { DatePicker } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GoCard, TILE_CHOSEN, TILE_IDLE, TILE_OFF, Tile, TileGrid, tileClass } from "./Tiles";

/**
 * The booking sheets' shared pieces, composed from the till's card language
 * (Tiles.tsx): every choice its own rounded tile with an 8px gap, chosen =
 * orange with a tick, gone = the page colour with a line and struck text. They
 * live here rather than in the kit because they are the till's drawing only —
 * the kit's DateStrip keeps its own look for the admin app.
 */

/** The two lines inside a tile. 13px floor: the shared Tile's `sub` is 12px, so
 *  the sheets pass children instead. */
export function TileText({
  label,
  sub,
  extra,
  selected = false,
  struck = false,
  className,
}: {
  label: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
  selected?: boolean;
  struck?: boolean;
  className?: string;
}) {
  return (
    <>
      <span className={cn("w-full break-words text-base font-semibold leading-tight", struck && "line-through", className)}>{label}</span>
      {sub != null && <span className={cn("mt-0.5 w-full break-words text-sm leading-tight", selected ? "text-on-solid" : "text-muted", struck && "line-through")}>{sub}</span>}
      {extra != null && <span className={cn("mt-0.5 w-full break-words text-sm font-medium leading-tight", selected ? "text-on-solid" : "text-fg")}>{extra}</span>}
    </>
  );
}

/** A tile drawn as a full-width ROW (the guide, the provider, a session): same
 *  three grounds as every tile, but laid out across instead of stacked, so it
 *  needs its own base rather than a class fighting the stacked one. */
export function rowTileClass({ selected, off, className }: { selected?: boolean; off?: boolean; className?: string }) {
  return cn(
    "relative flex min-h-14 w-full min-w-0 rounded-inner px-comfortable py-comfortable text-left transition-colors duration-quick disabled:cursor-not-allowed",
    selected ? TILE_CHOSEN : off ? TILE_OFF : TILE_IDLE,
    className,
  );
}

export interface DateTilesLabels {
  today: string;
  tomorrow: string;
  pick: string;
  previousMonth: string;
  nextMonth: string;
}

/** The days a sale can be for: separate tiles, then "More dates" with the
 *  calendar. A day picked from the calendar replaces the second tile. */
export function DateTiles({
  dates,
  value,
  onChange,
  today,
  tomorrow,
  min,
  labels,
  caption,
}: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  today: string;
  tomorrow: string;
  min?: string;
  labels: DateTilesLabels;
  caption?: (date: string) => { text: string; low?: boolean } | null;
}) {
  const tp = useTranslations("pos");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Always two day tiles (+ "More dates"): the first two open days, and a day
  // picked from the calendar takes the second tile's place, shown chosen.
  const shown = useMemo(() => {
    const base = dates.slice(0, 2);
    if (value && !base.includes(value)) return base.length >= 2 ? [base[0], value] : [...base, value];
    return base;
  }, [dates, value]);
  const label = (d: string) =>
    d === today ? labels.today : d === tomorrow ? labels.tomorrow : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" });
  const sub = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-tight">
      <TileGrid cols={3}>
        {shown.map((d) => {
          const on = value === d;
          const cap = caption?.(d) ?? null;
          return (
            <Tile key={d} selected={on} onClick={() => onChange(d)} className="min-h-16">
              <TileText label={label(d)} sub={sub(d)} selected={on} />
              {cap && (
                <span className={cn("w-full truncate text-sm leading-tight", on ? "text-on-solid" : cap.low ? "font-medium text-warning" : "text-muted")}>{cap.text}</span>
              )}
            </Tile>
          );
        })}
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
          className={tileClass({ className: "min-h-16" })}
        >
          <CalendarDays size={14} strokeWidth={2} aria-hidden className="absolute right-1.5 top-1.5 text-muted" />
          <TileText label={labels.pick} sub={tp("dateTiles.pickDay")} />
        </button>
      </TileGrid>
      {pickerOpen && (
        <GoCard className="overflow-hidden p-0">
          <DatePicker
            value={value}
            today={today}
            min={min}
            labels={{ previousMonth: labels.previousMonth, nextMonth: labels.nextMonth, today: labels.today }}
            shape="go"
            autoFocus
            onChange={(iso) => {
              onChange(iso);
              setPickerOpen(false);
            }}
          />
        </GoCard>
      )}
    </div>
  );
}

/**
 * One person or one option as a row-card: a picture or avatar, a bold name, a
 * quiet line, something on the right. Chosen = orange with a tick; unavailable
 * = the page colour with a line.
 */
export function OptionRow({
  selected,
  off = false,
  lead,
  title,
  sub,
  trail,
  onClick,
  disabled,
  center = false,
}: {
  selected: boolean;
  off?: boolean;
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  center?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={rowTileClass({ selected, off, className: cn("items-center gap-comfortable", center && "justify-center text-center") })}
    >
      {selected && <Check size={14} strokeWidth={2.5} aria-hidden className="absolute right-2 top-2" />}
      {lead}
      <span className={cn("min-w-0", !center && "flex-1")}>
        <span className="block break-words text-md font-semibold leading-snug">{title}</span>
        {sub != null && <span className={cn("block break-words text-sm leading-snug", selected ? "text-on-solid" : "text-muted")}>{sub}</span>}
      </span>
      {trail != null && <span className={cn("shrink-0 whitespace-nowrap text-sm", selected ? "text-on-solid" : "text-fg-secondary", selected ? "mr-5" : "")}>{trail}</span>}
    </button>
  );
}

/**
 * The footer's summary line: what is about to be added on the left, the money
 * on the right. 14px in full ink with the price bold — it is the line a cashier
 * reads back to the guest, so it is the one piece of the footer that must not
 * look like a footnote.
 */
export function FooterSummary({ lead, price }: { lead: ReactNode; price: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable text-base text-fg">
      <span className="min-w-0 flex-1">{lead}</span>
      <span className="shrink-0 font-bold tabular-nums">{price}</span>
    </div>
  );
}

/** Joins the parts of a summary with " · ", skipping anything empty. */
export function summaryLead(parts: (ReactNode | false | null | undefined | "")[]): ReactNode {
  const shown = parts.filter((p): p is ReactNode => p !== false && p != null && p !== "");
  return shown.map((p, i) => (
    <Fragment key={i}>
      {i > 0 ? " · " : null}
      {p}
    </Fragment>
  ));
}

/** The day, said the way it opens a sentence: "Today", "Thu 30 Jul". */
export const capitalFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The sheet's sticky foot. Content scrolls under it, so it carries a short fade
 * of the sheet's own ground above it (inside the scroller): rows run out into
 * the footer instead of being cut by a hard edge. The gap above it is larger
 * than the fade, so the last row at the end of the scroll is never tinted.
 */
/** A kit `Sheet` that becomes a centred dialog on a desktop (`rail:`) and stays
 *  a bottom sheet below it — for the small pickers (the sell date, the held
 *  list) that sit over the wall. */
export const SHEET_AS_DIALOG = "mx-auto rail:bottom-auto rail:top-1/2 rail:-translate-y-1/2 rail:animate-none rail:rounded-sheet";

export function StickyFoot({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-section mt-7 rail:mt-auto">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-5 bg-linear-to-t from-surface to-transparent" />
      {children}
    </div>
  );
}
