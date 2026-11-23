"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Check, HandCoins, Lock, Plus, RotateCcw, Wrench } from "lucide-react";
import { MarketBadge } from "@/components/ui";
import { pendingRefundFor, useRefundVersion } from "@/lib/api/refundRequests";
import { pendingWriteOffFor, useWriteOffVersion } from "@/lib/api/writeOffRequests";
import { pendingRescheduleFor, useRescheduleVersion } from "@/lib/api/rescheduleRequests";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMedia";
import { formatClock, formatClockMin, formatClockRange } from "@/lib/format";
import { freeRuns, QUARTER, runAt, snapDown, snapNearest, type Block, type Column, type Group } from "../_lib/board";
import { drawnSel, naturalSel, type DraftSel, type Ghost } from "../_lib/fluid";

/** One hour. Tall enough that an hour is a thumb target on its own. */
export const HOUR_PX = 64;
const GUTTER = 48;
/** An hour row's label: the number large, AM/PM under it. */
const clockParts = (m: number) => {
  const h24 = Math.floor(m / 60) % 24;
  return { h: h24 % 12 === 0 ? 12 : h24 % 12, ampm: h24 >= 12 ? "PM" : "AM" };
};
/** Five columns fit a 390px phone at this width — four lanes and the
 *  "No place set" column beside them — with "Lane 4" still whole and every
 *  cell well over the 44px thumb floor. */
const COL_MIN = 60;
const HEADER = 52;
/** The Go tab bar's clearance plus breathing room: what a phone keeps free
 *  under the board. A tablet held in landscape has a rail instead. */
const TAB_RESERVE = 96;
export const RAIL = "(min-width: 64rem) and (orientation: landscape)";
/* On a desktop (`rail`) the board is denser: 48px hours so ten or more fit a
   768px-tall screen, a 56px gutter that holds "10 AM" on one line, a 40px head
   (docs/pos-desktop.md section 8). */
const HOUR_RAIL = 48;
const GUTTER_RAIL = 56;
const HEADER_RAIL = 40;

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
 *   · white   — time you can sell, as free as the calendar it sits on: press and
 *               drag (mouse, pen), or tap and stretch the handles (touch), or
 *               Enter then Shift+Arrow (keyboard) — any length in quarter hours,
 *               stopping at the next booking. It is drawn as a solid orange block.
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
  deadBefore,
  sel,
  ghost,
  onSelect,
  onBooking,
  onHold,
  onSession,
  onColumn,
  corner,
  hideKey = false,
  notice,
  className,
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
  /** The first minute of this day that can still be sold (0 on a future day,
   *  now today, a whole day for a day gone). */
  deadBefore: number;
  /** The span drawn on the board, and what the draft block shows. */
  sel: DraftSel | null;
  ghost: Ghost | null;
  onSelect: (sel: DraftSel | null) => void;
  className?: string;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
  onColumn: (column: Column) => void;
}) {
  const t = useTranslations("schedule");
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const rail = useMediaQuery(RAIL);
  const hp = rail ? HOUR_RAIL : HOUR_PX;
  const gutter = rail ? GUTTER_RAIL : GUTTER;
  const header = rail ? HEADER_RAIL : HEADER;
  const hours: number[] = [];
  for (let m = group.from; m < group.to; m += 60) hours.push(m);
  const height = hours.length * hp;
  const y = (m: number) => ((m - group.from) / 60) * hp;
  const showNow = nowMinutes !== null && nowMinutes >= group.from && nowMinutes <= group.to;
  const hasSelection = sel !== null;
  const fluid = !group.isSessions;
  /* Where the drawn block is, kept for the layout effects below: the board
     scrolls to show it when the panel takes its room. */
  const shown = ghost && ghost.columnId ? ghost : sel && sel.columnId ? { ...sel, title: null as string | null } : null;
  const shownRef = useRef(shown);
  useLayoutEffect(() => {
    shownRef.current = shown;
  });
  const lastType = useRef<string>("mouse");
  const drag = useRef<
    | { kind: "draw"; col: Column; run: [number, number]; anchor: number; moved: boolean }
    | { kind: "top" | "bottom"; col: Column; run: [number, number]; start: number; end: number }
    | null
  >(null);
  const minuteAt = (el: Element, clientY: number) => group.from + ((clientY - el.getBoundingClientRect().top) / hp) * 60;
  const runsOf = (c: Column) => freeRuns(group, c, deadBefore ?? 0);

  /* Keep the drawn block in view when the panel takes its room (a tap near the
     bottom of the day, then the sheet rising over it). */
  const reveal = () => {
    const el = box.current;
    const g = shownRef.current;
    if (!el || !g || drag.current) return;
    const top = y(g.start);
    const bottom = y(g.end);
    const view = el.clientHeight - header;
    if (bottom > el.scrollTop + view) el.scrollTop = Math.min(top - 8, bottom - view + 24);
    else if (top < el.scrollTop) el.scrollTop = Math.max(0, top - 24);
  };
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
      /* With a panel beside it a desktop board is never shorter than the panel needs. */
      const roomy = hasSelection && window.matchMedia(RAIL).matches ? 560 : 0;
      const onRail = window.matchMedia(RAIL).matches;
      if (bar && !onRail) {
        const limit = bar.getBoundingClientRect().top + window.scrollY - 12;
        el.style.height = `${Math.max(floor, limit - top)}px`;
        return;
      }
      /* On a desktop the chosen-slot bar is a row in the flow under the board,
         so the board gives it its height (and a 12px gap). */
      const reserve = onRail ? 24 + (bar ? bar.offsetHeight + 12 : 0) : TAB_RESERVE;
      /* …but never taller than the day itself: a four-hour day of shows
         left a white band under its last departure. */
      /* From the numbers this component drew, not from measuring the grid:
         at the moment this runs after a switch of group, the grid can still
         report the previous group's height. */
      const foot = el.querySelector<HTMLElement>("[data-board-foot]");
      const noteEl = el.querySelector<HTMLElement>("[data-board-notice]");
      const natural = (onRail ? HEADER_RAIL : HEADER) + height + (foot && !foot.hidden ? foot.offsetHeight : 0) + (noteEl ? noteEl.offsetHeight : 0) + 2;
      let h = Math.min(Math.max(natural, roomy), Math.max(floor, window.innerHeight - top - reserve));
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
    /* On a phone the panel takes the lower half, so the board comes up to the top
       of the screen: the days and the tabs above it are not what is being worked on. */
    if (hasSelection && !window.matchMedia(RAIL).matches) {
      el.scrollIntoView({ block: "start", behavior: "instant" });
      fit();
    }
    window.addEventListener("resize", fit);
    /* The phone's panel changes height as the list folds and unfolds; the
       board ends above it, so it follows. */
    const panel = typeof ResizeObserver !== "undefined" ? document.getElementById("sched-bar") : null;
    const ro = panel ? new ResizeObserver(() => { fit(); reveal(); }) : null;
    if (panel && ro) ro.observe(panel);
    return () => {
      window.removeEventListener("resize", fit);
      ro?.disconnect();
    };
    // `height` follows from group.from/to, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection, group.key, group.from, group.to, rail]);

  useLayoutEffect(() => {
    reveal();
    // Only when a selection appears or moves to another column.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection, sel?.columnId, sel?.start, sel?.end]);

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
  const hourLines = `repeating-linear-gradient(to bottom, transparent 0, transparent ${hp - 1}px, var(--color-line) ${hp - 1}px, var(--color-line) ${hp}px)`;


  /* ── drawing on the board ─────────────────────────────────────────────────
     A mouse or a pen presses on empty time and drags: the span follows in
     quarter hours and stops where the free time stops. A finger cannot do that
     and still scroll, so a tap selects the column's natural length and the
     block's handles stretch it. A key takes a cell with Enter and stretches it
     with Shift+Arrow. */
  const beginDraw = (e: React.PointerEvent<HTMLDivElement>, c: Column) => {
    lastType.current = e.pointerType;
    if (e.pointerType === "touch" || e.button !== 0) return;
    const hit = (e.target as HTMLElement).closest("button");
    if (hit && !hit.hasAttribute("data-free")) return;
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    const m = snapDown(minuteAt(e.currentTarget, e.clientY));
    const run = runAt(runsOf(c), m);
    if (!run) {
      onSelect(null);
      return;
    }
    drag.current = { kind: "draw", col: c, run, anchor: m, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect({ columnId: c.id, start: m, end: Math.min(run[1], m + QUARTER) });
  };
  const moveDraw = (e: React.PointerEvent<HTMLDivElement>, c: Column) => {
    const d = drag.current;
    if (!d || d.kind !== "draw" || d.col.id !== c.id) return;
    const cur = snapDown(Math.min(d.run[1] - QUARTER, Math.max(d.run[0], minuteAt(e.currentTarget, e.clientY))));
    if (cur !== d.anchor) d.moved = true;
    onSelect(drawnSel(c, d.run, d.anchor, cur));
  };
  const endDraw = (e: React.PointerEvent<HTMLDivElement>, c: Column) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind !== "draw") return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    /* A click without a drag is not a quarter hour: it is the natural length. */
    if (!d.moved) onSelect(naturalSel(c, d.run, d.anchor));
  };
  const tapFree = (e: React.MouseEvent, c: Column, runs: [number, number][], cellStart: number) => {
    /* A mouse already acted on pointer-down; this is a finger or a key. */
    if (lastType.current !== "touch" && e.detail !== 0) return;
    const col = (e.currentTarget as HTMLElement).closest("[data-col]");
    const at = e.detail === 0 || !col ? cellStart : minuteAt(col, e.clientY);
    const m = snapDown(Math.max(at, cellStart));
    const run = runAt(runs, m);
    if (run) onSelect(naturalSel(c, run, m));
  };
  const keyFree = (e: React.KeyboardEvent, c: Column, runs: [number, number][]) => {
    if (!sel || sel.columnId !== c.id) return;
    const run = runAt(runs, sel.start);
    if (!run) return;
    if (e.shiftKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const end = Math.min(run[1], Math.max(sel.start + QUARTER, sel.end + (e.key === "ArrowDown" ? QUARTER : -QUARTER)));
      onSelect({ ...sel, end });
    }
  };
  const beginHandle = (e: React.PointerEvent, c: Column, which: "top" | "bottom", g: { start: number; end: number }) => {
    const run = runAt(runsOf(c), g.start);
    if (!run) return;
    e.stopPropagation();
    drag.current = { kind: which, col: c, run, start: g.start, end: g.end };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveHandle = (e: React.PointerEvent, c: Column) => {
    const d = drag.current;
    if (!d || d.kind === "draw" || d.col.id !== c.id) return;
    const colEl = (e.currentTarget as HTMLElement).closest("[data-col]");
    if (!colEl) return;
    const m = snapNearest(minuteAt(colEl, e.clientY));
    if (d.kind === "top") d.start = Math.max(d.run[0], Math.min(m, d.end - QUARTER));
    else d.end = Math.min(d.run[1], Math.max(m, d.start + QUARTER));
    onSelect({ columnId: c.id, start: d.start, end: d.end });
  };
  const endHandle = (e: React.PointerEvent) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div ref={card} data-fluid-board className={cn("card-surface flex min-h-[240px] flex-col overflow-hidden", className)}>
      {/* On a desktop what is not an hour (bookings with no place) is a quiet row above the board. */}
      {rail && notice ? <div data-board-notice className="shrink-0 border-b border-line">{notice}</div> : null}
      <div
        ref={box}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        /* A flick settles on an hour, with its label under the place names. */
        style={{ scrollSnapType: "y proximity", scrollPaddingTop: header }}
      >
        <div className="relative" style={{ minWidth: gutter + cols * COL_MIN }}>
          {/* Place names — pinned as the day scrolls under them. */}
          <div className="sticky top-0 z-20 flex border-b border-line bg-card" style={{ height: header }}>
            <div className="sticky left-0 z-10 flex shrink-0 flex-col items-center justify-center bg-card text-center leading-tight rail:flex-row rail:gap-1" style={{ width: gutter }}>
              <span className="text-sm text-muted rail:text-xs">{corner[0]}</span>
              <span className="text-md font-semibold tabular-nums leading-none text-fg rail:text-sm">{corner[1]}</span>
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
                  <span className="line-clamp-2 block w-full break-words text-base font-semibold leading-tight text-fg rail:line-clamp-1 rail:text-sm rail:font-medium" title={name}>{name}</span>
                  {closed && (
                    <span className="mt-0.5 flex items-center justify-center gap-1 text-sm text-danger">
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
                  className="flex min-w-[60px] flex-1 flex-col items-center justify-center border-l border-line px-1 text-center hover:bg-muted-wash"
                >
                  {body}
                </button>
              ) : (
                <div key={c.id} className="flex min-w-[60px] flex-1 flex-col items-center justify-center border-l border-line px-1 text-center">
                  {body}
                </div>
              );
            })}
          </div>

          <div className="relative flex" style={{ height }}>
            {/* The hours. Each label sits at the top of its own row. */}
            {/* On a desktop the gutter is drawn the way the OS calendar draws it:
                no rules of its own, each hour a quiet 12px label centred ON its
                rule (the first one below it, where the header would cut it). */}
            <div className="sticky left-0 z-10 shrink-0 border-r border-line bg-card" style={{ width: gutter, backgroundImage: rail ? undefined : hourLines }}>
              {hours.map((m, i) => (
                <div key={m} className="relative" style={{ height: hp, scrollSnapAlign: "start" }}>
                  {/* The hour in ink, large, with its AM/PM under it: this column is
                      what a cashier reads first to find a time, and the
                      muted 13px it used to be was the faintest thing on
                      the board. */}
                  <span className={cn("absolute right-2 top-0 hidden whitespace-nowrap text-xs leading-none tabular-nums text-muted rail:block", i > 0 && "-translate-y-1/2")}>{clockParts(m).h} {clockParts(m).ampm}</span>
                  <span className="absolute inset-x-0 top-1 flex flex-col items-center leading-none text-fg rail:hidden">
                    <span className="text-md font-bold tabular-nums">{clockParts(m).h}</span>
                    <span className="mt-0.5 text-sm font-semibold">{clockParts(m).ampm}</span>
                  </span>
                </div>
              ))}
            </div>

            {columns.map((c) => {
              const list = group.blocks.get(c.id) ?? [];
              const runs = fluid ? runsOf(c) : [];
              const covered: [number, number][] = [...runs, ...list.map((x) => [x.start, x.end] as [number, number])];
              const mine = shown && shown.columnId === c.id ? shown : null;
              return (
                <div
                  key={c.id}
                  data-col={c.id}
                  className="relative min-w-[60px] flex-1 border-l border-line bg-card"
                  onPointerDown={fluid ? (e) => beginDraw(e, c) : undefined}
                  onPointerMove={fluid ? (e) => moveDraw(e, c) : undefined}
                  onPointerUp={fluid ? (e) => endDraw(e, c) : undefined}
                  onPointerCancel={fluid ? () => { drag.current = null; } : undefined}
                  onClick={fluid ? (e) => { if (e.target === e.currentTarget && lastType.current === "touch") onSelect(null); } : undefined}
                >
                  {/* Time nobody can book is the grey ground. Everything else
                      is drawn on white — so there is no grey BETWEEN things,
                      only where there is nothing to be had. It is the PAGE's
                      colour, so closed time recedes behind what can be sold —
                      in dark too, where the page is darker than the card.
                      (subtle IS the card colour in dark, and closed time
                      looked exactly like time for sale.) */}
                  {deadRuns(covered, group.from, group.to).map(([a, b]) => (
                    <div key={`dead|${a}`} aria-hidden className="absolute inset-x-0 bg-surface" style={{ top: y(a), height: y(b) - y(a) }} />
                  ))}
                  {/* Free time, one focusable cell per hour of it. The pointer
                      draws across them (below); a keyboard or a finger takes
                      the cell. */}
                  {runs.flatMap(([ra, rb]) => {
                    const cells: React.ReactNode[] = [];
                    for (let h = Math.floor(ra / 60) * 60; h < rb; h += 60) {
                      const a = Math.max(ra, h, group.from);
                      const z = Math.min(rb, h + 60, group.to);
                      if (z <= a) continue;
                      cells.push(
                        <FreeCell
                          key={`free|${c.id}|${a}`}
                          column={c}
                          start={a}
                          top={y(a)}
                          height={y(z) - y(a)}
                          onTap={(e, start) => tapFree(e, c, runs, start)}
                          onKeys={(e) => keyFree(e, c, runs)}
                        />,
                      );
                    }
                    return cells;
                  })}
                  {/* Hour rules over the ground and the free cells, under
                      everything that is booked. */}
                  {/* ds-exception: z-1..3 layers live inside one column and must stay under the z-10 sticky gutter */}
                  <div aria-hidden className="pointer-events-none absolute inset-0 z-[2]" style={{ backgroundImage: hourLines }} />
                  {list.map((b) =>
                    b.type === "free" ? null : (
                      <BlockView
                        key={b.key}
                        block={b}
                        column={c}
                        top={y(Math.max(b.start, group.from))}
                        height={Math.max(28, y(Math.min(b.end, group.to)) - y(Math.max(b.start, group.from)))}
                        rail={rail}
                        onBooking={onBooking}
                        onHold={onHold}
                        onSession={onSession}
                      />
                    ),
                  )}
                  {mine && (
                    <DraftBlock
                      ghost={mine}
                      top={y(mine.start)}
                      height={y(mine.end) - y(mine.start)}
                      onHandle={(e, which) => beginHandle(e, c, which, mine)}
                      onMoveHandle={(e) => moveHandle(e, c)}
                      onEndHandle={(e) => endHandle(e)}
                    />
                  )}
                </div>
              );
            })}

            {showNow && (
              /* ds-exception: now-line sits above the in-column layers (z-1..3) but under the z-10 sticky gutter */
              <div aria-hidden className="pointer-events-none absolute right-0 z-[5]" style={{ top: y(nowMinutes as number) + 1, left: gutter - (rail ? 4 : 6) }}>
                <div className="relative h-0.5 bg-danger">
                  <span className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-danger rail:h-2 rail:w-2" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The key, drawn with the same grounds the board uses, always under
          it — the board scrolls, the key never does. */}
      <div data-board-foot hidden={hideKey} className="shrink-0 bg-card pb-inline rail:border-t rail:border-line rail:pb-0">
      {!rail && notice}
      {/* One line where it fits, wrapping at the items when it does not. Each
          item is told apart by SHAPE as well as colour: a plus (free), a stripe
          (booked), a stripe with a dot (marketplace), hatching (held), plain
          page colour (cannot be booked). */}
      <ul aria-label={t("board.keyLabel")} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-comfortable py-1.5 text-sm text-muted rail:gap-x-4 rail:py-1 rail:text-xs">
        <li className="flex items-center gap-1">
          <span aria-hidden className="flex h-4 w-4 items-center justify-center border border-line bg-card text-muted"><Plus size={11} strokeWidth={3} /></span>
          {t("board.keyFree")}
        </li>
        <li className="flex items-center gap-1"><span aria-hidden className="h-4 w-4 border-l-[3px] border-l-ember-solid bg-ember-wash" />{t("board.keyBooked")}</li>
        <li className="flex items-center gap-1">
          <span aria-hidden className="flex h-4 w-4 items-center justify-center border-l-[3px] border-l-market bg-market-wash"><span className="size-1.5 rounded-full bg-market" /></span>
          {t("board.keyMarket")}
        </li>
        <li className="flex items-center gap-1">
          <span aria-hidden className="flex h-4 w-4 items-center justify-center border border-dashed border-strong" style={{ background: "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 3px, var(--color-card) 3px 6px)" }}>
            <Lock size={9} />
          </span>
          {t("board.onHold")}
        </li>
        <li className="flex items-center gap-1"><span aria-hidden className="h-4 w-4 rounded-sm bg-ember-solid" />{t("fluid.keyDraft")}</li>
        <li className="flex items-center gap-1"><span aria-hidden className="h-4 w-4 border border-line bg-surface" />{t("board.keyClosed")}</li>
      </ul>
      </div>
    </div>
  );
}

/** The stretches of a column that nothing covers — not free, not booked, not
 *  held, no departure. That is the grey. */
function deadRuns(spans: [number, number][], from: number, to: number): [number, number][] {
  const sorted = spans.map(([a, b]) => [Math.max(from, a), Math.min(to, b)] as const).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = from;
  for (const [a, b] of sorted) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < to) out.push([at, to]);
  return out;
}

/** One hour (or what is left of it) of free time. It is the keyboard's and the
 *  finger's way in; the pointer draws across it from the column. */
function FreeCell({
  column,
  start,
  top,
  height,
  onTap,
  onKeys,
}: {
  column: Column;
  start: number;
  top: number;
  height: number;
  onTap: (e: React.MouseEvent, start: number) => void;
  onKeys: (e: React.KeyboardEvent) => void;
}) {
  const t = useTranslations("schedule");
  return (
    <button
      type="button"
      data-free
      data-key={`free|${column.id}|${start}`}
      onClick={(e) => onTap(e, start)}
      onKeyDown={onKeys}
      aria-label={t("board.freeAria", { place: column.name, time: formatClockMin(start) })}
      data-focus-inset
      className={cn(
        // ds-exception: in-column layer z-1 (free cells) under the z-10 sticky gutter
        "group/cell absolute inset-x-0 z-[1] flex items-center justify-center bg-card text-muted transition-colors duration-quick hover:bg-muted-wash active:bg-muted-wash",
      )}
      style={{ top, height, touchAction: "pan-y" }}
    >
      <Plus size={16} strokeWidth={2.5} aria-hidden className="opacity-0 group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" />
    </button>
  );
}

/**
 * The draft block: solid ember, drawn exactly where the booking would go and
 * following every change made in the panel. Its two handles stretch it in
 * quarter hours; each is a 44px target that sits outside the block, so a
 * 15-minute block still has two handles a thumb can find.
 */
function DraftBlock({
  ghost,
  top,
  height,
  onHandle,
  onMoveHandle,
  onEndHandle,
}: {
  ghost: { start: number; end: number; title: string | null; hold?: boolean };
  top: number;
  height: number;
  onHandle: (e: React.PointerEvent, which: "top" | "bottom") => void;
  onMoveHandle: (e: React.PointerEvent) => void;
  onEndHandle: (e: React.PointerEvent) => void;
}) {
  const t = useTranslations("schedule");
  const range = formatClockRange(ghost.start, ghost.end);
  const label = ghost.title ?? t("fluid.newBooking");
  const knob = (which: "top" | "bottom") => (
    <span
      data-handle={which}
      role="separator"
      aria-orientation="horizontal"
      aria-label={which === "top" ? t("fluid.handleTop") : t("fluid.handleBottom")}
      onPointerDown={(e) => onHandle(e, which)}
      onPointerMove={onMoveHandle}
      onPointerUp={onEndHandle}
      onPointerCancel={onEndHandle}
      className={cn(
        // ds-exception: the draft's handles sit above the booked blocks (z-3) and under the z-10 sticky gutter
        "pointer-events-auto absolute inset-x-0 z-[4] flex h-11 cursor-ns-resize touch-none",
        which === "top" ? "-top-10 items-end justify-end pr-3" : "-bottom-10 items-start justify-start pl-3",
      )}
    >
      <span aria-hidden className="size-4 rounded-full bg-card ring-2 ring-ember-solid rail:size-3.5" style={{ marginBottom: which === "top" ? -8 : 0, marginTop: which === "bottom" ? -8 : 0 }} />
    </span>
  );
  return (
    <div
      data-draft
      className={cn(
        // ds-exception: the draft block sits above the booked blocks (z-3) and under the z-10 sticky gutter
        "pointer-events-none absolute inset-x-1 z-[4]",
      )}
      style={{ top: top + 1, height: Math.max(12, height - 2) }}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-sm px-1.5 pb-0.5 pt-2 text-on-solid shadow-sm",
          ghost.hold ? "border border-dashed border-on-solid" : "",
        )}
        style={{
          background: ghost.hold
            ? "repeating-linear-gradient(135deg, var(--color-ember-solid) 0 6px, color-mix(in srgb, var(--color-ember-solid) 82%, white) 6px 12px)"
            : "var(--color-ember-solid)",
        }}
      >
        {height >= 28 && <span className="block line-clamp-2 text-sm font-semibold leading-tight rail:text-xs">{label}</span>}
        {height >= 44 && <span className="block text-sm leading-tight tabular-nums opacity-90 rail:text-xs">{range}</span>}
        {height < 44 && height >= 20 && height < 28 && <span className="block truncate text-xs leading-tight tabular-nums">{range}</span>}
      </div>
      {knob("top")}
      {knob("bottom")}
      <span className="sr-only" aria-live="polite">{label} · {range}</span>
    </div>
  );
}

function BlockView({
  block: b,
  column,
  top,
  height,
  rail,
  onBooking,
  onHold,
  onSession,
}: {
  block: Exclude<Block, { type: "free" }>;
  column: Column;
  top: number;
  height: number;
  rail: boolean;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
}) {
  const t = useTranslations("schedule");
  const tr = useTranslations("refunds");
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  const tall = height >= (rail ? 40 : 52);
  // Re-draws the "asked" marks when a request is made, answered or taken back.
  useRescheduleVersion();
  useRefundVersion();
  useWriteOffVersion();
  /* A small inset so two bookings back to back read as two, and a small
     corner — a calendar block, not a card. */
  // ds-exception: in-column layer z-3 (booked blocks) under the z-10 sticky gutter
  const frame = "absolute inset-x-1 z-[3] overflow-hidden rounded-sm text-left rail:inset-x-[3px] rail:rounded-sm";
  const style = rail ? { top: top + 3, height: height - 6 } : { top: top + 2, height: height - 3 };

  if (b.type === "booking") {
    const who = b.guest ?? t("board.walkIn");
    /* A refund waiting for a manager is marked on the block, so whoever is on
       the counter next sees it before selling the hour on. */
    const refunding = !!pendingRefundFor(b.booking.id);
    /* Likewise a move that has been asked for: the booking has not moved yet,
       and the next person at the counter should know before they promise its
       hour to somebody else. */
    const moving = !refunding && !!pendingRescheduleFor(b.booking.id);
    /* Money still owed that the counter has asked to write off reads the same
       way, after the refund (a refund waiting is the louder thing to know). */
    const writing = !refunding && !moving && !!pendingWriteOffFor(b.booking.orderId);
    const asked = refunding ? t("refund.boardBadge") : moving ? t("refund.moveBoardBadge") : writing ? tr("pos.markers.writeOffAsked") : "";
    const src = b.source;
    const sold = src ? (src.reference ? t("board.bookedOnRef", { name: src.marketplaceName, reference: src.reference }) : t("board.bookedOn", { name: src.marketplaceName })) : "";
    return (
      <button
        type="button"
        onClick={() => onBooking(column, b)}
        aria-label={`${t("board.bookedAria", { place, time: formatClockMin(b.start), who })}${src ? `, ${t("board.bookedOn", { name: src.marketplaceName })}` : ""}${asked ? ` · ${asked}` : ""}`}
        title={sold || undefined}
        className={cn(
          /* The frame is its own container, so the badge can ask how wide the
             block actually is. A container query measures the CONTENT box:
             four lanes on a phone leave ~53px of it, five leave ~35, and a
             badge that crowds out the guest's name is worse than none. */
          "@container",
          frame,
          "border-l-[3px] px-tight py-1 rail:px-1.5 rail:py-1",
          /* Status wins once something has happened; a plain booking sold on
             a marketplace is info blue INSTEAD of orange. */
          b.noShow
            ? "border-l-muted bg-muted-wash text-muted line-through"
            : b.arrived
              ? "border-l-success bg-success-wash text-fg"
              : src
                ? "border-l-market bg-market-wash text-fg"
                : "border-l-ember-solid bg-ember-wash text-fg",
        )}
        style={style}
      >
        <span className="flex items-center gap-1 text-sm font-semibold leading-tight rail:text-xs rail:font-medium">
          {src && (
            <span className="hidden shrink-0 @min-[3rem]:inline-flex">
              <MarketBadge id={src.marketplaceId} size="go" />
            </span>
          )}
          {b.arrived && <Check size={13} strokeWidth={2.5} className="shrink-0 text-success" aria-hidden />}
          {refunding && <RotateCcw size={13} strokeWidth={2.5} className="shrink-0 text-warning" aria-hidden />}
          {moving && <CalendarClock size={13} strokeWidth={2.5} className="shrink-0 text-warning" aria-hidden />}
          {writing && <HandCoins size={13} strokeWidth={2.5} className="shrink-0 text-warning" aria-hidden />}
          <span className="truncate">{who}</span>
        </span>
        {tall && (
          asked
            ? <span className="block truncate text-sm font-semibold leading-tight text-warning rail:text-xs rail:font-medium">{asked}</span>
            : <span className="block truncate text-sm leading-tight opacity-80 rail:text-xs rail:text-muted rail:opacity-100">{b.product?.name ?? ""}</span>
        )}
      </button>
    );
  }

  if (b.type === "hold") {
    return (
      <button
        type="button"
        onClick={() => onHold(column, b)}
        aria-label={t("board.heldAria", { place, time: formatClockMin(b.start), who: b.hold.heldFor })}
        className={cn(frame, "border border-dashed border-strong px-tight py-1 text-fg")}
        style={{
          ...style,
          background: "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 6px, var(--color-card) 6px 12px)",
        }}
      >
        <span className="flex items-center gap-1 text-sm font-semibold leading-tight rail:text-xs rail:font-medium">
          <Lock size={13} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
          <span className="truncate">{b.hold.heldFor}</span>
        </span>
        {tall && <span className="block truncate text-sm leading-tight text-muted rail:text-xs">{t("board.onHold")}</span>}
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
      aria-label={t("board.sessionAria", { place, time: formatClock(b.time), left: b.remaining })}
      className={cn(
        frame,
        "flex flex-col justify-start gap-0.5 border px-tight py-1 rail:border-l-[3px] rail:px-1.5",
        disabled ? "border-line bg-surface text-muted" : full ? "border-line bg-muted-wash text-muted" : "border-line bg-card text-fg hover:border-ember rail:border-l-ember-line",
      )}
      style={style}
    >
      {rail ? (
        <>
          {/* A desktop: what the cashier looks for (seats left) is strong, the time is quiet.
              One hour tall is one line; taller blocks stack the two. */}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className={cn("min-w-0 truncate text-xs font-semibold leading-tight", !full && !disabled && pct <= 0.2 && "text-brand-foreground")}>
              {full ? t("board.full") : t("board.seatsLeft", { count: b.remaining })}
            </span>
            {height < 64 && <span className="shrink-0 whitespace-nowrap text-xs font-normal leading-tight text-muted">{formatClock(b.time)}</span>}
            {!full && !disabled && <Plus size={14} strokeWidth={2.5} className="ml-auto shrink-0 self-center text-muted" aria-hidden />}
          </span>
          {height >= 64 && <span className="block truncate text-xs leading-tight text-muted">{formatClock(b.time)}</span>}
          {height >= 88 && b.held.length > 0 && <span className="truncate text-xs leading-tight text-muted">{t("board.someHeld")}</span>}
        </>
      ) : (
        <>
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-semibold tabular-nums">{formatClock(b.time)}</span>
        {!full && !disabled && <Plus size={16} strokeWidth={2.5} className="shrink-0 text-muted" aria-hidden />}
      </span>
      {/* The number that decides a sale, in words and large enough to read
          at a glance. A bar beside it read as "full" when it was full of
          empty seats. */}
      {tall && (
        <span className={cn("truncate text-md font-semibold leading-tight rail:text-base", !full && !disabled && pct <= 0.2 && "text-brand-foreground")}>
          {full ? t("board.full") : t("board.seatsLeft", { count: b.remaining })}
        </span>
      )}
      {tall && b.held.length > 0 && <span className="truncate text-sm leading-tight text-muted">{t("board.someHeld")}</span>}
        </>
      )}
    </button>
  );
}
