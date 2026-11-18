"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, DatePicker, Select, type SelectOption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GoCard, TILE_CHOSEN, TILE_IDLE, TILE_OFF, Tile, TileGrid, tileClass } from "./Tiles";

/**
 * The booking sheets' shared pieces, composed from the till's card language
 * (Tiles.tsx): every choice its own rounded tile with an 8px gap, chosen =
 * orange, gone = the page colour with a line and struck text. They
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
      <span className={cn("w-full break-words text-base font-semibold leading-tight rail:font-medium", struck && "line-through", className)}>{label}</span>
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
    "relative flex min-h-14 w-full min-w-0 rounded-inner px-comfortable py-comfortable text-left rail:min-h-12 rail:px-3 rail:py-1.5 transition-colors duration-quick disabled:cursor-not-allowed",
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
      <TileGrid cols={3} className="rail:flex rail:flex-wrap">
        {shown.map((d) => {
          const on = value === d;
          const cap = caption?.(d) ?? null;
          return (
            <Tile key={d} selected={on} onClick={() => onChange(d)} className="min-h-16 rail:h-10 rail:min-h-10 rail:w-auto rail:flex-row rail:gap-1 rail:px-3">
              <span className="w-full break-words text-base font-semibold leading-tight rail:w-auto rail:whitespace-nowrap rail:font-medium">{label(d)}</span>
              <span aria-hidden className="hidden text-muted rail:inline">·</span>
              <span className={cn("mt-0.5 w-full break-words text-sm leading-tight rail:mt-0 rail:w-auto rail:whitespace-nowrap rail:text-sm", on ? "text-on-solid" : "text-muted")}>{sub(d)}</span>
              {cap && (
                <span className={cn("w-full truncate text-sm leading-tight rail:ml-1 rail:w-auto rail:whitespace-nowrap", on ? "text-on-solid" : cap.low ? "font-medium text-warning" : "text-muted")}>{cap.text}</span>
              )}
            </Tile>
          );
        })}
        {/* The calendar glyph sits IN the label line, before the words — the
            way a button carries its icon. Pinned in the corner it read as the
            chosen tick on the tiles beside it. While the calendar is open the
            tile shows the pressed ground, so it reads as the control that
            opened it. */}
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
          className={tileClass({ className: cn("min-h-16 rail:h-10 rail:min-h-10 rail:flex-row rail:px-3", pickerOpen && "bg-nav-selected rail:bg-nav-selected") })}
        >
          <span className="flex w-full items-center justify-center gap-1.5 text-base font-semibold leading-tight rail:w-auto rail:whitespace-nowrap rail:font-medium">
            <CalendarDays size={16} strokeWidth={2} aria-hidden className="shrink-0" />
            <span className="min-w-0 break-words">{labels.pick}</span>
          </span>
          <span className="mt-0.5 w-full break-words text-sm leading-tight text-muted rail:hidden">{tp("dateTiles.pickDay")}</span>
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
 * quiet line, something on the right. Chosen = orange; unavailable
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
      {lead}
      <span className={cn("min-w-0", !center && "flex-1")}>
        <span className="block break-words text-md font-semibold leading-snug rail:text-base rail:font-medium rail:leading-tight">{title}</span>
        {sub != null && <span className={cn("block break-words text-sm leading-snug rail:leading-tight", selected ? "text-on-solid" : "text-muted")}>{sub}</span>}
      </span>
      {trail != null && <span className={cn("shrink-0 whitespace-nowrap text-sm", selected ? "text-on-solid" : "text-fg-secondary")}>{trail}</span>}
    </button>
  );
}

export interface PersonChoice {
  id: string;
  name: string;
  /** "next free 4:00 PM", "busy". */
  sub?: string;
  /** "+৳500.00 extra", "Normal price". */
  trail?: string;
  /** Busy at the chosen time: listed, but cannot be chosen. */
  disabled?: boolean;
}

/** The "first free" option's mark: a soft round with people in it, so it sits
 *  in the avatar column without pretending to be a person. */
function AnyoneMark() {
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-fg ring-1 ring-inset ring-line">
      <Users size={18} strokeWidth={2} />
    </span>
  );
}

/**
 * Who does it: staff, a provider, a guide. One row showing the current choice
 * (avatar, name, when they are next free, what they add to the price) that
 * opens a list.
 *
 * A dropdown rather than a row per person because the team grows: three rows
 * are a list you read, eight push the start times — the next decision — off a
 * phone screen. The row keeps the same three facts the stacked cards gave, the
 * list carries them per person, and from five people the list grows a search
 * field (the kit `Select`'s threshold). Busy people stay in the list, greyed,
 * so "where is Nadia?" is answered rather than hidden.
 *
 * `any` adds the first option — "First free" — with the empty value.
 */
export function PersonSelect({
  label,
  value,
  onChange,
  people,
  any,
  placeholder,
}: {
  /** The heading above it, as the control's accessible name. */
  label: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  people: PersonChoice[];
  any?: { label: string; trail?: string };
  placeholder?: string;
}) {
  const tp = useTranslations("pos");
  const options: SelectOption[] = [
    ...(any ? [{ value: "", label: any.label, note: tp("personSelect.anySub"), trail: any.trail, lead: <AnyoneMark /> }] : []),
    ...people.map((p) => ({ value: p.id, label: p.name, note: p.sub, trail: p.trail, disabled: p.disabled, lead: <Avatar name={p.name} /> })),
  ];
  return (
    <Select
      size="row"
      aria-label={label}
      value={value ?? ""}
      onChange={(v) => onChange(v || undefined)}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={tp("personSelect.search")}
      emptyLabel={tp("personSelect.empty")}
      triggerClassName={cn("rounded-inner", TILE_IDLE)}
    />
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
      <span className="shrink-0 font-bold tabular-nums rail:font-semibold">{price}</span>
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

/** The foot on a desktop: 20px sides to match the body, a hairline above, 44px
 *  buttons that keep their own width and sit on the right (Hold / Back outlined,
 *  Add primary). The bar is the shared ActionBar and not ours to edit, so its
 *  parts are reached from here. */
export const FOOT_RAIL =
  "rail:border-t rail:border-line rail:px-5 rail:py-3 rail:[&>div:last-child]:justify-end rail:[&>div:last-child>button]:h-11 rail:[&>div:last-child>button]:flex-none rail:[&>div:last-child>button]:px-5 rail:[&>div:last-child>button]:text-base";

export function StickyFoot({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-section mt-7 rail:-mx-5 rail:mt-auto">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-5 bg-linear-to-t from-surface to-transparent rail:hidden" />
      {children}
    </div>
  );
}
