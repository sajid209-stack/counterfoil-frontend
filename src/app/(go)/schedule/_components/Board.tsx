"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock, Plus, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPriceShort } from "@/lib/format";
import { toTimeOfDay, type Block, type Column, type Group } from "../_lib/board";

/** One hour. Tall enough that an hour is a thumb target on its own. */
export const HOUR_PX = 64;
const GUTTER = 48;
/** Five columns fit a 390px phone at this width — four lanes and the
 *  "No place set" column beside them — with "Lane 4" still whole and every
 *  cell well over the 44px thumb floor. */
const COL_MIN = 60;
const HEADER = 52;
/** The Go tab bar's clearance plus breathing room: what a phone keeps free
 *  under the board. A tablet held in landscape has a rail instead. */
const TAB_RESERVE = 96;
const RAIL = "(min-width: 64rem) and (orientation: landscape)";

/**
 * The board: hours down, places across — drawn as a GRID, the way a court or
 * turf scheduler draws it (CourtReserve, Playtomic, Square's side-by-side
 * calendar), not as a pile of cards.
 *
 * Every hour of every place is a cell, and the cells meet on hairlines. That
 * is the whole of the design change, and it is what the two complaints about
 * the first board were about: each hour had been a rounded card inset from
 * its neighbours, so the grey ground showed between every one of them and a
 * column of free hours read as a stack of pills rather than as a day.
 *
 * Three grounds, and no more:
 *   · white   — an hour you can sell. The cell IS the button: tap it and it
 *               turns solid orange with a tick. Tap more to take several.
 *   · orange  — booked, with the customer's name; striped with a lock when it
 *               is on hold; a show carries its seats left.
 *   · grey    — cannot be booked (gone, closed, between departures).
 *
 * The same thing is always in the same place: time on the left, places along
 * the top, now as a red line, and what the colours mean along the bottom.
 * That is a pattern a counter learns once and then works from memory.
 */
export function Board({
  group,
  nowMinutes,
  selected,
  focusKey,
  onFree,
  onBooking,
  onHold,
  onSession,
  onColumn,
  corner,
  hideKey = false,
  notice,
}: {
  group: Group;
  /** The day being shown — weekday and date — in the grid's own top-left
   *  corner, the way a calendar app heads its day column. The month is on the
   *  week strip above; "২৯ জুলাই" does not fit a 48px corner. */
  corner: [string, string];
  /** While the action bar is up it has the room the key would take: every
   *  hour it costs is one the cashier cannot see. */
  hideKey?: boolean;
  /** Something to say about the day that is not an hour — bookings with no
   *  place — drawn in the footer with the key, so it steps aside with the key
   *  when the bar comes up instead of pushing the board down on the first
   *  tap. */
  notice?: React.ReactNode;
  /** Null when the day shown is not today. */
  nowMinutes: number | null;
  /** Keys of the free hours that are currently taken for the sale. */
  selected: Set<string>;
  /** The hour tapped last, kept in view when the action bar arrives. */
  focusKey: string | null;
  onFree: (column: Column, block: Extract<Block, { type: "free" }>) => void;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
  onColumn: (column: Column) => void;
}) {
  const t = useTranslations("schedule");
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const hours: number[] = [];
  for (let m = group.from; m < group.to; m += 60) hours.push(m);
  const height = hours.length * HOUR_PX;
  const y = (m: number) => ((m - group.from) / 60) * HOUR_PX;
  const showNow = nowMinutes !== null && nowMinutes >= group.from && nowMinutes <= group.to;
  const hasSelection = selected.size > 0;

  /* The board fills the screen below the controls, like a calendar app, and
     scrolls inside itself. The page does not scroll at all on a phone: two
     scrolls, one inside the other, is the thing a thumb gets caught in, and
     scrolling the page would take the day and the places off screen exactly
     when the cashier is looking for an hour.

     Written onto the node rather than into state — how tall the board can be
     is a fact about the layout that has just happened, and a setState in an
     effect is an error here. When the action bar is up, the board ends above
     it so no hour is ever under a button. */
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bar = document.getElementById("sched-bar");
      const floor = 240;
      if (bar) {
        const limit = bar.getBoundingClientRect().top + window.scrollY - 12;
        el.style.height = `${Math.max(floor, limit - top)}px`;
        return;
      }
      const reserve = window.matchMedia(RAIL).matches ? 16 : TAB_RESERVE;
      /* …but never taller than the day itself: a four-hour day of shows
         left a white band under its last departure. */
      /* From the numbers this component drew, not from measuring the grid:
         at the moment this runs after a switch of group, the grid can still
         report the previous group's height. */
      const foot = el.querySelector<HTMLElement>("[data-board-foot]");
      const natural = HEADER + height + (foot && !foot.hidden ? foot.offsetHeight : 0) + 2;
      let h = Math.min(natural, Math.max(floor, window.innerHeight - top - reserve));
      el.style.height = `${h}px`;
      /* Whatever else the device keeps (a home indicator) shows up as the
         page still scrolling; take exactly that back. */
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0 && h - over >= Math.min(floor, natural)) {
        h -= over;
        el.style.height = `${h}px`;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // `height` follows from group.from/to, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection, group.key, group.from, group.to]);

  /* Keep the hour just tapped in view once the bar has taken its space. */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !focusKey) return;
    const cell = el.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`);
    if (!cell) return;
    const b = el.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    /* Land on a whole hour, so the row at the top of the board still carries
       its time — a slice of a row with no label is an hour nobody can name. */
    const snap = (v: number) => Math.max(0, Math.round(v / HOUR_PX) * HOUR_PX);
    if (c.bottom > b.bottom) el.scrollTop = snap(el.scrollTop + c.bottom - b.bottom + HOUR_PX / 2);
    else if (c.top < b.top + HEADER) el.scrollTop = snap(el.scrollTop - (b.top + HEADER - c.top));
  }, [focusKey, hasSelection]);

  /* Open where the counter is: an hour before now, or at the top of the day
     on any other date. A board that opens at 06:00 at lunchtime makes the
     cashier scroll past the morning to reach the thing they came for. */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = showNow ? Math.max(0, y((nowMinutes as number) - 60)) : 0;
    // Only when the group or the day changes, not on every reload of the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.key, group.from, nowMinutes === null]);

  /* Bookings that name no lane are real and take capacity, but a whole column
     of grey to show one of them cost a phone a fifth of its width and cut
     the booking to "Sab… Bo…". The page names them above the board instead. */
  const columns = group.columns.filter((c) => c.kind !== "unassigned");
  const cols = columns.length;
  const hourLines = `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX}px)`;

  return (
    <div ref={card} className="go-surface flex min-h-[240px] flex-col overflow-hidden rounded-go">
      <div
        ref={box}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        /* A flick settles on an hour, with its label under the place names. */
        style={{ scrollSnapType: "y proximity", scrollPaddingTop: HEADER }}
      >
        <div className="relative" style={{ minWidth: GUTTER + cols * COL_MIN }}>
          {/* Place names — pinned as the day scrolls under them. */}
          <div className="sticky top-0 z-20 flex border-b border-line bg-card" style={{ height: HEADER }}>
            <div className="sticky left-0 z-10 flex shrink-0 flex-col items-center justify-center bg-card text-center leading-tight" style={{ width: GUTTER }}>
              <span className="text-[0.8125rem] text-muted">{corner[0]}</span>
              <span className="text-[1rem] font-semibold tabular-nums leading-none text-fg">{corner[1]}</span>
            </div>
            {columns.map((c) => {
              const closed = !!c.resource?.outOfService;
              const name = c.kind === "unassigned" ? t("board.noPlace") : c.name;
              /* The whole header is the control, not a "⋯" beside the name:
                 at four lanes on a phone a menu button left "La…", and the
                 lane's number is exactly what a cashier who does not read
                 looks for. */
              const body = (
                <>
                  <span className="line-clamp-2 block w-full break-words text-[0.875rem] font-semibold leading-tight text-fg" title={name}>{name}</span>
                  {closed && (
                    <span className="mt-0.5 flex items-center justify-center gap-1 text-[0.8125rem] text-danger">
                      <Wrench size={12} strokeWidth={1.75} aria-hidden />
                      {t("board.closed")}
                    </span>
                  )}
                </>
              );
              return c.kind === "resource" ? (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onColumn(c)}
                  aria-label={t("board.placeMenu", { place: name })}
                  className="flex min-w-[60px] flex-1 flex-col items-center justify-center border-l border-hairline px-1 text-center hover:bg-muted-wash"
                >
                  {body}
                </button>
              ) : (
                <div key={c.id} className="flex min-w-[60px] flex-1 flex-col items-center justify-center border-l border-hairline px-1 text-center">
                  {body}
                </div>
              );
            })}
          </div>

          <div className="relative flex" style={{ height }}>
            {/* The hours. Each label sits at the top of its own row. */}
            <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-card" style={{ width: GUTTER, backgroundImage: hourLines }}>
              {hours.map((m) => (
                <div key={m} className="relative" style={{ height: HOUR_PX, scrollSnapAlign: "start" }}>
                  <span className="absolute left-1.5 top-1.5 text-[0.8125rem] font-semibold tabular-nums text-muted">{toTimeOfDay(m)}</span>
                </div>
              ))}
            </div>

            {columns.map((c) => {
              const list = group.blocks.get(c.id) ?? [];
              return (
                <div key={c.id} className="relative min-w-[60px] flex-1 border-l border-hairline bg-card">
                  {/* Time nobody can book is the grey ground. Everything else
                      is drawn on white — so there is no grey BETWEEN things,
                      only where there is nothing to be had. It is the PAGE's
                      colour, so closed time recedes behind what can be sold —
                      in dark too, where the page is darker than the card.
                      (`subtle` IS the card colour in dark, and closed time
                      looked exactly like time for sale.) */}
                  {deadRuns(list, group.from, group.to).map(([a, b]) => (
                    <div key={`dead|${a}`} aria-hidden className="absolute inset-x-0 bg-surface" style={{ top: y(a), height: y(b) - y(a) }} />
                  ))}
                  {list.map((b) =>
                    b.type === "free" ? (
                      <FreeCell
                        key={b.key}
                        block={b}
                        column={c}
                        top={y(Math.max(b.start, group.from))}
                        height={y(Math.min(b.end, group.to)) - y(Math.max(b.start, group.from))}
                        selected={selected.has(b.key)}
                        onFree={onFree}
                      />
                    ) : null,
                  )}
                  {/* Hour rules over the ground and the free cells, under
                      everything that is booked. */}
                  <div aria-hidden className="pointer-events-none absolute inset-0 z-[2]" style={{ backgroundImage: hourLines }} />
                  {list.map((b) =>
                    b.type === "free" ? null : (
                      <BlockView
                        key={b.key}
                        block={b}
                        column={c}
                        top={y(Math.max(b.start, group.from))}
                        height={Math.max(28, y(Math.min(b.end, group.to)) - y(Math.max(b.start, group.from)))}
                        onBooking={onBooking}
                        onHold={onHold}
                        onSession={onSession}
                      />
                    ),
                  )}
                </div>
              );
            })}

            {showNow && (
              <div aria-hidden className="pointer-events-none absolute right-0 z-[5]" style={{ top: y(nowMinutes as number) + 1, left: GUTTER - 6 }}>
                <div className="relative h-0.5 bg-danger">
                  <span className="absolute -left-0 -top-[5px] h-3 w-3 rounded-full bg-danger" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The key, drawn with the same grounds the board uses, always under
          it — the board scrolls, the key never does. */}
      <div data-board-foot hidden={hideKey} className="shrink-0 border-t border-line bg-card">
      {notice}
      <ul aria-label={t("board.keyLabel")} className="flex flex-wrap items-center gap-x-tight gap-y-1 px-comfortable py-tight text-[0.8125rem] text-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="flex h-4 w-5 items-center justify-center border border-line bg-card text-muted"><Plus size={11} strokeWidth={3} /></span>
          {t("board.keyFree")}
        </li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-4 w-5 border-l-[3px] border-l-ember-solid bg-ember/20" />{t("board.keyBooked")}</li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="flex h-4 w-5 items-center justify-center border border-dashed border-strong" style={{ background: "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 3px, var(--color-card) 3px 6px)" }}>
            <Lock size={9} />
          </span>
          {t("board.onHold")}
        </li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-4 w-5 border border-line bg-surface" />{t("board.keyClosed")}</li>
      </ul>
      </div>
    </div>
  );
}

/** The stretches of a column that nothing covers — not free, not booked, not
 *  held, no departure. That is the grey. */
function deadRuns(list: Block[], from: number, to: number): [number, number][] {
  const spans = list.map((b) => [Math.max(from, b.start), Math.min(to, b.end)] as const).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = from;
  for (const [a, b] of spans) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < to) out.push([at, to]);
  return out;
}

/** A free hour. The cell is the button — flush to its neighbours, no card. */
function FreeCell({
  block: b,
  column,
  top,
  height,
  selected,
  onFree,
}: {
  block: Extract<Block, { type: "free" }>;
  column: Column;
  top: number;
  height: number;
  selected: boolean;
  onFree: (column: Column, block: Extract<Block, { type: "free" }>) => void;
}) {
  const t = useTranslations("schedule");
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  return (
    <button
      type="button"
      data-key={b.key}
      aria-pressed={selected}
      onClick={() => onFree(column, b)}
      aria-label={t("board.freeAria", { place, time: b.time, price: formatPriceShort(b.price) })}
      data-focus-inset
      className={cn(
        "absolute inset-x-0 z-[1] flex flex-col items-center justify-center gap-0.5 transition-colors duration-quick",
        selected ? "bg-ember-solid text-white" : "bg-card text-fg hover:bg-ember/5 active:bg-ember/10",
      )}
      style={{ top, height }}
    >
      {selected ? (
        <Check size={20} strokeWidth={3} aria-hidden />
      ) : (
        <Plus size={18} strokeWidth={2.5} className="text-muted" aria-hidden />
      )}
      {height >= 48 && (
        <span className={cn("text-[0.8125rem] tabular-nums", selected ? "font-semibold" : "font-medium")}>{formatPriceShort(b.price)}</span>
      )}
    </button>
  );
}

function BlockView({
  block: b,
  column,
  top,
  height,
  onBooking,
  onHold,
  onSession,
}: {
  block: Exclude<Block, { type: "free" }>;
  column: Column;
  top: number;
  height: number;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
}) {
  const t = useTranslations("schedule");
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  const tall = height >= 52;
  /* A small inset so two bookings back to back read as two, and a small
     corner — a calendar block, not a card. */
  const frame = "absolute inset-x-[3px] z-[3] overflow-hidden rounded-sm text-left";
  const style = { top: top + 2, height: height - 3 };

  if (b.type === "booking") {
    const who = b.guest ?? t("board.walkIn");
    return (
      <button
        type="button"
        onClick={() => onBooking(column, b)}
        aria-label={t("board.bookedAria", { place, time: toTimeOfDay(b.start), who })}
        className={cn(
          frame,
          "border-l-[3px] px-tight py-1",
          b.noShow
            ? "border-l-muted bg-muted-wash text-muted line-through"
            : b.arrived
              ? "border-l-success bg-success-wash text-fg"
              : "border-l-ember-solid bg-ember/20 text-fg",
        )}
        style={style}
      >
        <span className="flex items-center gap-1 text-[0.8125rem] font-semibold leading-tight">
          {b.arrived && <Check size={13} strokeWidth={2.5} className="shrink-0 text-success" aria-hidden />}
          <span className="truncate">{who}</span>
        </span>
        {tall && <span className="block truncate text-[0.8125rem] leading-tight opacity-80">{b.product?.name ?? ""}</span>}
      </button>
    );
  }

  if (b.type === "hold") {
    return (
      <button
        type="button"
        onClick={() => onHold(column, b)}
        aria-label={t("board.heldAria", { place, time: toTimeOfDay(b.start), who: b.hold.heldFor })}
        className={cn(frame, "border border-dashed border-strong px-tight py-1 text-fg")}
        style={{
          ...style,
          background: "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 6px, var(--color-card) 6px 12px)",
        }}
      >
        <span className="flex items-center gap-1 text-[0.8125rem] font-semibold leading-tight">
          <Lock size={13} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
          <span className="truncate">{b.hold.heldFor}</span>
        </span>
        {tall && <span className="block truncate text-[0.8125rem] leading-tight text-muted">{t("board.onHold")}</span>}
      </button>
    );
  }

  // A show: seats left, and a bar that empties as it sells.
  const full = b.remaining <= 0;
  const disabled = b.past;
  const pct = b.capacity > 0 ? Math.max(0, Math.min(1, b.remaining / b.capacity)) : 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSession(column, b)}
      aria-label={t("board.sessionAria", { place, time: b.time, left: b.remaining })}
      className={cn(
        frame,
        "flex flex-col justify-start gap-0.5 border px-tight py-1",
        disabled ? "border-line bg-subtle text-muted" : full ? "border-line bg-muted-wash text-muted" : "border-line bg-card text-fg hover:border-ember",
      )}
      style={style}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[0.8125rem] font-semibold tabular-nums">{b.time}</span>
        {!full && !disabled && <Plus size={16} strokeWidth={2.5} className="shrink-0 text-muted" aria-hidden />}
      </span>
      {/* The number that decides a sale, in words and large enough to read
          at a glance. A bar beside it read as "full" when it was full of
          empty seats. */}
      {tall && (
        <span className={cn("truncate text-[0.9375rem] font-semibold leading-tight", !full && !disabled && pct <= 0.2 && "text-brand-foreground")}>
          {full ? t("board.full") : t("board.seatsLeft", { count: b.remaining })}
        </span>
      )}
      {tall && b.held.length > 0 && <span className="truncate text-[0.8125rem] leading-tight text-muted">{t("board.someHeld")}</span>}
    </button>
  );
}
