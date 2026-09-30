"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { toTime } from "@/lib/schedule";
import { OpenHourChips } from "./OpenHourChips";
import {
  addDays,
  focusMinute,
  hhmm,
  isoDate,
  minutesOf,
  packLanes,
  peekHandlers,
  sameDay,
  TONE_CLASS,
  type CalEvent,
  type Ghost,
} from "./model";


/** An hour is 60px, so the grid reads as a ruler: an hour of height is an
 *  hour of time, and a 90-minute booking is visibly half again as tall as the
 *  one beside it. */
const HOUR_PX = 60;
/** Below this a block has one line, and the name gets it. A 30-minute booking
 *  is 26px tall here, which is one line of 12px text and its padding. */
const TWO_LINE_PX = 40;
/** The strip down the right of every day column that bookings never cover, so
 *  an hour that is booked AND still has room can always be clicked. Google
 *  Calendar leaves the same margin for the same reason: without it, a busy
 *  hour hides the very capacity somebody is looking for. */
const GUTTER_PX = 16;

/** The grain a drag snaps to. Finer than anything is sold in on purpose —
 *  see the drag block below. */
const SNAP_MIN = 15;

/** The id the draft wears while it is laid out with real bookings. */
const GHOST_ID = "__ghost__";

/** "18–21" when both ends are on the hour, "16:15–17:00" otherwise — a range
 *  that fits a column a third of a day wide. */
const shortRange = (a: number, b: number) =>
  a % 60 === 0 && b % 60 === 0 ? `${String(a / 60).padStart(2, "0")}–${String(b / 60).padStart(2, "0")}` : `${toTime(a)}–${toTime(b)}`;

/** What the phone's open-hour chips say. */
export interface ChipText {
  heading: string;
  label: (count: number) => string;
  name: (hour: number, count: number) => string;
}

/** The week as columns of days over a shared hour gutter — the shape everyone
 *  already knows from every calendar they have ever used. */
export function WeekGrid({
  weekStartDate,
  events,
  now,
  openHour = 6,
  closeHour = 23,
  onSelect,
  onPeek,
  onPickDay,
  dayLabel,
  allDayLabel,
  emptyLabel,
  roomy = false,
  compact = false,
  blockClass,
  dotClass,
  openCount,
  onCreate,
  bookLabel,
  isPastHour,
  chipText,
  ghost = null,
  ghostLabel = "",
  noneLabel = "",
  stackLabel,
  onMove,
  canMove,
  moveSnap,
}: {
  weekStartDate: Date;
  events: CalEvent[];
  /** The app's clock, passed in rather than read here: three grids each
   *  calling `new Date()` is why "today" never highlighted. */
  now: Date;
  openHour?: number;
  closeHour?: number;
  onSelect?: (event: CalEvent) => void;
  onPeek?: (event: CalEvent | null, anchor: DOMRect | null) => void;
  onPickDay?: (date: Date) => void;
  /** Renders the column header, so the page owns date formatting. */
  /** `long` names the day in full for a screen reader: a button reading
   *  "W 29" out loud does not say which day it is. */
  dayLabel: (d: Date) => { weekday: string; day: string; long?: string };
  allDayLabel: string;
  /** Shown when the chosen day has nothing on it. */
  emptyLabel: string;
  /** The columns are wide enough for a block to carry a second line. Measured
   *  by the page, because it depends on the viewport rather than on the data:
   *  at 1024 a day column is about 97px and the subtitle truncated on 23 of 28
   *  blocks, which is worse than not drawing it. */
  roomy?: boolean;
  /** Phone: the columns shrink to fit rather than the week scrolling away. */
  compact?: boolean;
  /* What a block is painted. The page decides — status is the default and
     what the key explains, but an operator can colour by category instead,
     and then the same function answers for every grid. Held and closed keep
     their hatching either way: blocked is blocked whatever colour means. */
  blockClass: (e: CalEvent) => string;
  dotClass: (e: CalEvent) => string;
  /** How many things can still be booked starting in this hour of this day. */
  openCount?: (day: Date, hour: number) => number;
  /** Empty time was clicked, or dragged across: open the booking panel there.
   *  `start` is in minutes from midnight, snapped to the quarter hour, and
   *  `minutes` is the length dragged when it was more than the default hour. */
  onCreate?: (day: Date, start: number, anchor: DOMRect, minutes?: number) => void;
  /** "4 open" on hover, and the cell's accessible name. */
  bookLabel?: (day: Date, hour: number, count: number) => { short: string; full: string };
  /** An hour that has already gone, which cannot be sold. */
  isPastHour?: (day: Date, hour: number) => boolean;
  chipText?: ChipText;
  /** The booking being made, drawn where it will go. */
  ghost?: Ghost | null;
  /** What the draft says before anything is chosen — Google's "(No title)". */
  ghostLabel?: string;
  /** What hovering an hour with nothing to sell says. */
  noneLabel?: string;
  /** "2 bookings · 5 guests" — several bookings on one departure. */
  stackLabel?: (bookings: number, guests: number) => string;
  /** Move a booking by dragging its body. Without it blocks only open. */
  onMove?: (e: CalEvent, date: string, start: number) => void;
  /** Which blocks can be dragged at all. A hold is released from its own
   *  panel and a stack is several bookings, so neither moves. */
  canMove?: (e: CalEvent) => boolean;
  /** Where a drop would really land. A lane keeps the quarter hour; a session
   *  snaps to its own departures, because 16:15 is not a departure and a
   *  label promising one would be a lie the drop then corrects. */
  moveSnap?: (e: CalEvent, date: string, start: number) => number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const bodyHeight = (closeHour - openHour) * HOUR_PX;
  const gutter = compact ? "w-8" : "w-14";
  /** Blocks share the column minus the gutter — only when the page books. */
  const lanePart = (i: number, n: number) =>
    onCreate ? `calc((100% - ${GUTTER_PX}px) * ${i / n})` : `${(i / n) * 100}%`;
  const laneWidth = (n: number) =>
    onCreate ? `calc((100% - ${GUTTER_PX}px) / ${n} - 2px)` : `calc(${(1 / n) * 100}% - 2px)`;

  const nowMin = minutesOf(now);
  const weekHasToday = days.some((d) => sameDay(d, now));
  const showNow = weekHasToday && nowMin >= openMin && nowMin <= closeMin;

  // All-day events (a day-wide hold) get their own strip above the grid rather
  // than being stretched down a column they do not really occupy.
  const allDay = events.filter((e) => e.allDay);
  const ghostAllDay = ghost?.allDay && days.some((d) => isoDate(d) === ghost.date) ? ghost : null;

  /* ── making a booking by pointing at the grid ─────────────────────────────
     Click an hour and the draft is that hour; press and drag down the column
     and it is what you dragged across, to the quarter hour.

     A quarter is finer than this venue sells in, and that is deliberate: the
     gesture says what was meant, and the panel beside it goes on offering
     only the starts that can really be sold. Snapped to the hour instead, a
     90-minute intention could not be expressed at all.

     Only a mouse drags: on a touch screen the same gesture is a scroll, and a
     tap books the hour it lands on. */
  const [drag, setDrag] = useState<{ day: string; from: number; to: number } | null>(null);
  const dragging = useRef<{ day: Date; from: number; col: HTMLElement; moved: boolean } | null>(null);
  /** A drag ends in a click on the cell it started in; that click is the drag's. */
  const swallowClick = useRef(false);
  /** The first minute of the day that can still be sold — a drag never backs
   *  into an hour already gone. */
  const floorMin = (day: Date) => {
    let h = openHour;
    while (h < closeHour - 1 && (isPastHour?.(day, h) ?? false)) h++;
    return h * 60;
  };
  /** The quarter hour the pointer is in, clamped into the day. */
  const minuteAt = (col: HTMLElement, clientY: number, day: Date) => {
    const r = col.getBoundingClientRect();
    const raw = openMin + ((clientY - r.top) / r.height) * span;
    const snapped = Math.floor(raw / SNAP_MIN) * SNAP_MIN;
    return Math.min(closeMin - SNAP_MIN, Math.max(floorMin(day), snapped));
  };
  /** Where the draft will be drawn, for the panel to stand beside. Both ends
   *  are minutes; the second is inclusive of the quarter it names. */
  const create = (day: Date, from: number, to: number, col: HTMLElement | null) => {
    if (!onCreate || !col) return;
    const a = Math.min(from, to);
    const length = Math.max(SNAP_MIN, Math.max(from, to) + SNAP_MIN - a);
    const r = col.getBoundingClientRect();
    const top = r.top + ((a - openMin) / span) * r.height;
    onCreate(day, a, new DOMRect(r.left, top, r.width, (length / span) * r.height), length);
  };
  /* One set of handlers on the track rather than five on every one of 119
     cells: each cell says which day and hour it is, and the track reads it. */
  const cellOf = (target: EventTarget) => {
    const el = (target as HTMLElement).closest?.<HTMLElement>("[data-cell]");
    if (!el) return null;
    const col = el.closest<HTMLElement>("[data-day-col]");
    const day = days[Number(el.dataset.day)];
    return col && day ? { day, hour: Number(el.dataset.hour), col } : null;
  };
  const dragStart = (ev: React.PointerEvent<HTMLElement>) => {
    if (ev.pointerType !== "mouse" || ev.button !== 0) return;
    const cell = cellOf(ev.target);
    if (!cell) return;
    dragging.current = { day: cell.day, from: minuteAt(cell.col, ev.clientY, cell.day), col: cell.col, moved: false };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const dragMove = (ev: React.PointerEvent<HTMLElement>) => {
    const g = dragging.current;
    if (!g) return;
    const to = minuteAt(g.col, ev.clientY, g.day);
    if (to === g.from && !g.moved) return;
    g.moved = true;
    setDrag({ day: isoDate(g.day), from: g.from, to });
  };
  const dragEnd = (ev: React.PointerEvent<HTMLElement>) => {
    const g = dragging.current;
    dragging.current = null;
    setDrag(null);
    if (!g) return;
    swallowClick.current = true;
    /* A press that never moved is a click on that hour, not a 15-minute
       booking: the quarter is what a DRAG expresses, and a click has always
       meant "this hour". */
    if (!g.moved) {
      const h = Math.floor(g.from / 60) * 60;
      create(g.day, h, h + 60 - SNAP_MIN, g.col);
      return;
    }
    create(g.day, g.from, minuteAt(g.col, ev.clientY, g.day), g.col);
  };
  const dragCancel = () => {
    dragging.current = null;
    setDrag(null);
  };
  const cellClick = (ev: React.MouseEvent<HTMLElement>) => {
    // A mouse already booked on pointer-up; this is a tap, a pen or
    // assistive technology.
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    const cell = cellOf(ev.target);
    if (cell) create(cell.day, cell.hour * 60, cell.hour * 60 + 60 - SNAP_MIN, cell.col);
  };

  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  /* ── moving a booking by dragging its body ────────────────────────────────
     The same gesture every calendar has: pick the block up, drop it where it
     should be. What is drawn while it moves is where it would LAND — the page
     supplies the snap, so a session follows its own departures rather than
     the quarter hour the pointer is on, and the label never promises a time
     the drop would then correct.

     Mouse only, again: on a touch screen this gesture is a scroll, and a
     booking that moved because somebody scrolled the week is the worst
     outcome available here. */
  const [moving, setMoving] = useState<{
    id: string;
    title: string;
    date: string;
    start: number;
    end: number;
  } | null>(null);
  const mv = useRef<{
    e: CalEvent;
    grab: number;
    length: number;
    fromX: number;
    fromY: number;
    day: Date;
    cols: HTMLElement[];
    moved: boolean;
    target: { date: string; start: number } | null;
  } | null>(null);
  /** A move ends in a click on the block; that click is the move's. */
  const swallowBlockClick = useRef(false);

  /** Minutes at a pointer's Y. Every column shares the track's vertical
   *  geometry, so one rect answers for all seven. */
  const minuteFromY = (clientY: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return openMin;
    return openMin + ((clientY - r.top) / r.height) * span;
  };

  const moveStart = (ev: React.PointerEvent<HTMLElement>, e: CalEvent, day: Date) => {
    if (!onMove || ev.pointerType !== "mouse" || ev.button !== 0) return;
    if (canMove && !canMove(e)) return;
    /* The track below is listening for a drag that makes a NEW booking. A
       press that lands on a block is not that. */
    ev.stopPropagation();
    const from = minutesOf(e.start);
    mv.current = {
      e,
      grab: minuteFromY(ev.clientY) - from,
      length: Math.max(SNAP_MIN, minutesOf(e.end) - from),
      fromX: ev.clientX,
      fromY: ev.clientY,
      day,
      /* Read once, at the start: the columns cannot move mid-gesture, and
         asking what is under the pointer would answer "the block being
         dragged" and make a cross-day move impossible. */
      cols: Array.from(track.current?.querySelectorAll<HTMLElement>("[data-day-col]") ?? []),
      moved: false,
      target: null,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
    /* Whatever the pointer was hovering, it is not hovering now: a peek card
       about the block being carried, drawn over the place it is going, is
       the one thing that must not be on screen during this gesture. */
    onPeek?.(null, null);
  };

  const moveMove = (ev: React.PointerEvent<HTMLElement>) => {
    const g = mv.current;
    if (!g) return;
    /* A few pixels of slop, so a click that trembles is still a click. */
    if (!g.moved && Math.abs(ev.clientY - g.fromY) < 4 && Math.abs(ev.clientX - g.fromX) < 4) return;
    g.moved = true;
    const i = g.cols.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right;
    });
    const day = i >= 0 && days[i] ? days[i] : g.day;
    const date = isoDate(day);
    const raw = minuteFromY(ev.clientY) - g.grab;
    const snappedRaw = Math.floor(raw / SNAP_MIN) * SNAP_MIN;
    const clamped = Math.max(openMin, Math.min(closeMin - g.length, snappedRaw));
    const start = moveSnap ? moveSnap(g.e, date, clamped) : clamped;
    g.target = { date, start };
    setMoving({ id: g.e.id, title: g.e.title, date, start, end: start + g.length });
  };

  const moveEnd = () => {
    const g = mv.current;
    mv.current = null;
    setMoving(null);
    if (!g || !g.moved) return;
    swallowBlockClick.current = true;
    const t = g.target;
    if (!t) return;
    // Dropped where it already was: a move that changes nothing is not a move.
    if (t.date === isoDate(g.e.start) && t.start === minutesOf(g.e.start)) return;
    onMove?.(g.e, t.date, t.start);
  };

  const moveCancel = () => {
    mv.current = null;
    setMoving(null);
  };

  /* Open where the day happens.
     The grid used to open at `scrollTop` 0 — 06:00 — with every booking below
     the fold, so the first thing on screen was four hours of empty morning.
     Aim at now when this week contains it, otherwise at the first thing
     booked, and leave a quarter of the viewport above it for context. */
  /* The header divides nothing while the grid is at the top — it is the
     same surface as the row under it. It earns its rule the moment content
     starts sliding underneath. */
  const [scrolled, setScrolled] = useState(false);
  const focus = focusMinute(events, now, showNow);
  useEffect(() => {
    const box = scroller.current;
    const body = track.current;
    if (!box || !body || focus == null) return;
    /* Measured, not taken from offsetTop: the scroller is not the track's
       offset parent, so offsetTop counted the page above it and the grid
       opened a quarter-screen past now, with the now-line under the header.
       It opens on an hour rule, one hour before what it aims at, so the
       first thing read is a whole hour and the line below it. */
    const header = body.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const aim = Math.max(openMin, Math.floor(focus / 60) * 60 - 60);
    const sticky = box.firstElementChild?.firstElementChild?.getBoundingClientRect().height ?? 0;
    // Ten pixels short, so the hour's own label (centred on its rule) is whole.
    box.scrollTop = Math.max(0, header - sticky + ((aim - openMin) / span) * bodyHeight - 10);
  }, [focus, openMin, span, bodyHeight]);

  /* A phone does not get a seven-column time grid.
     Seven columns inside 390px is 47px each, and a booking sharing its hour
     drops to 21px — 26 of 27 blocks were clipping their own name and what
     survived read "Badm", "S", "S". So the week keeps its job of choosing a
     day and hands the reading of one to a list, which is the shape every
     pocket calendar settled on and the one the month view here already uses. */
  if (compact) {
    return (
      <CompactWeek
        days={days}
        events={events}
        now={now}
        onSelect={onSelect}
        dayLabel={dayLabel}
        allDayLabel={allDayLabel}
        emptyLabel={emptyLabel}
        blockClass={blockClass}
        dotClass={dotClass}
        openHoursOf={(d) =>
          hours
            .filter((h) => !(isPastHour?.(d, h) ?? false))
            .map((h) => ({ hour: h, count: openCount?.(d, h) ?? 0 }))
            .filter((x) => x.count > 0)
        }
        onCreate={onCreate}
        chipText={chipText}
      />
    );
  }

  return (
    // Both axes scroll in ONE container so the day headers can stick to its
    // top. Sticky against the page would let them scroll away, which is the
    // one thing a calendar header must never do.
    <div
      ref={scroller}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      className="max-h-[70vh] overflow-auto"
    >
      {/* No min-width. Seven columns share whatever the card has, and below
            `lg` the compact week takes over rather than the grid scrolling
            sideways with three days off the end of it. */}
      <div className="min-w-0">
        {/* Headers and the all-day row pin as ONE block. An all-day booking
            applies to every hour, so scrolling to the evening must not scroll
            away the thing that is true of all of it — and pinning them
            together means the second one does not have to measure the first.
            The rule and shadow belong to the pair, drawn once underneath. */}
        <div
          className={cn(
            "sticky top-0 z-40 bg-card transition-shadow duration-quick",
            scrolled && "border-b border-hairline shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
          )}
        >
        {/* ── day headers ─────────────────────────────────────────────────── */}
        <div className="flex">
          {/* No rule under the gutter or between the days up here: the
              dates are a label strip, not cells, and ruling them boxes in
              seven numbers that are already spaced apart. */}
          <div className={cn(gutter, "shrink-0")} />
          {days.map((d) => {
            const today = sameDay(d, now);
            const label = dayLabel(d);
            return (
              <button
                key={isoDate(d)}
                type="button"
                aria-label={label.long}
                onClick={onPickDay ? () => onPickDay(d) : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-tight",
                  today && "bg-ember/5",
                  onPickDay && "transition-colors duration-quick hover:bg-muted-wash",
                )}
              >
                <span
                  className={cn(
                    "type-label text-[12px]",
                    today ? "text-brand-foreground" : "text-muted",
                  )}
                >
                  {label.weekday}
                </span>
                <span
                  className={cn(
                    "flex h-7 min-w-[2rem] items-center justify-center rounded-sm px-1.5 font-mono text-[13px]",
                    // White on ember measures 3.50:1. It is the house rule for
                    // anything sitting inside a solid ember frame, and the same
                    // declared exception the till already carries.
                    today ? "bg-ember-solid font-semibold text-white" : "text-fg",
                  )}
                >
                  {label.day}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pinned under the day headers, not scrolled away with the grid: an
            all-day booking applies to every hour, so it has to stay readable
            at whatever hour you have scrolled to. `top` is the header's own
            height, measured rather than assumed — it grows with the label. */}
        {(allDay.length > 0 || ghostAllDay) && (
          <div className="flex border-t border-hairline bg-subtle/50">
            <div
              className={cn(
                gutter,
                "shrink-0 border-r border-hairline py-tight text-center text-[12px] text-muted",
              )}
            >
              {compact ? allDayLabel.slice(0, 3) : allDayLabel}
            </div>
            {days.map((d) => (
              <div key={isoDate(d)} className="flex-1 border-r border-hairline p-0.5 last:border-r-0">
                {allDay
                  .filter((e) => sameDay(e.start, d))
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(e) : undefined}
                      {...peekHandlers(e, onPeek)}
                      className={cn(
                        "mb-0.5 block w-full truncate rounded-sm border px-tight py-0.5 text-left text-[12px]",
                        blockClass(e),
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
                {/* A day ticket has no hour, so its draft sits up here —
                    where Google puts an all-day event. */}
                {ghostAllDay?.date === isoDate(d) && (
                  <span
                    data-ghost
                    className="mb-0.5 block w-full truncate rounded-sm bg-ember-solid px-tight py-0.5 text-[12px] font-semibold text-white shadow-pop"
                  >
                    {ghostAllDay.title ?? ghostLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        </div>

        {/* ── the grid ────────────────────────────────────────────────────── */}
        <div
          ref={track}
          className="flex"
          style={{ height: bodyHeight }}
          onPointerDown={onCreate ? dragStart : undefined}
          onPointerMove={onCreate ? dragMove : undefined}
          onPointerUp={onCreate ? dragEnd : undefined}
          onPointerCancel={onCreate ? dragCancel : undefined}
          onClick={onCreate ? cellClick : undefined}
        >
          {/* Hour gutter, once, on the left. "13:00" rather than "13": a bare
              number beside a column of times reads as a count. */}
          <div className={cn("relative shrink-0 border-r border-hairline", gutter)}>
            {hours.map((h, i) => (
              <span
                key={h}
                className={cn(
                  "absolute right-tight font-mono text-[12px] text-muted",
                  // The first label centred on its own rule sits half above the
                  // track, where the sticky header cuts it in half.
                  i === 0 ? "translate-y-0" : "-translate-y-1/2",
                )}
                style={{ top: `${((h * 60 - openMin) / span) * 100}%` }}
              >
                {compact ? String(h).padStart(2, "0") : toTime(h * 60)}
              </span>
            ))}
          </div>

          {days.map((d, dayIndex) => {
            const key = isoDate(d);
            const mine = events.filter((e) => !e.allDay && sameDay(e.start, d));
            /* The draft takes a column of the day's layout, the way Google
               makes room for "(No title)": bookings already at that hour step
               aside for as long as the panel is open and come back when it
               closes. Laid over them instead — whole or in the right half — it
               hid the very booking a "Busy" lane chip was about. */
            const draft = ghost && !ghost.allDay && ghost.date === key ? ghost : null;
            /* One departure, one block. Two parties on the 18:00 walking tour
               were two blocks side by side, each a sliver reading "Grand
               Heri…", when what the desk wants from the week is "the 18:00
               tour has 2 bookings". Only bookings of the same thing, at the
               same time, with the same guide or lane are stacked; the day
               view still shows each one. */
            const groups = new Map<string, CalEvent[]>();
            for (const e of mine) {
              const k = e.kind === "booking" ? `${e.productId}|${e.start.getTime()}|${e.end.getTime()}|${e.ownerId ?? ""}` : e.id;
              groups.set(k, [...(groups.get(k) ?? []), e]);
            }
            const stacks = new Map<string, CalEvent[]>();
            const shown: CalEvent[] = [];
            for (const [k, list] of groups) {
              if (list.length === 1) {
                shown.push(list[0]);
                continue;
              }
              const id = `stack:${k}`;
              stacks.set(id, list);
              shown.push({
                ...list[0],
                id,
                subtitle: stackLabel?.(list.length, list.reduce((n, e) => n + (e.partySize ?? 0), 0)),
                tone: list.every((e) => e.tone === list[0].tone) ? list[0].tone : "booked",
                locked: false,
              });
            }
            const draftEvent: CalEvent | null = draft
              ? {
                  id: GHOST_ID,
                  kind: "booking",
                  title: draft.title ?? ghostLabel,
                  start: new Date(`${key}T${toTime(draft.start)}:00`),
                  end: new Date(`${key}T${toTime(Math.min(draft.end, 24 * 60 - 1))}:00`),
                  allDay: false,
                  ownerId: null,
                  productId: "",
                          tone: "booked",
                  locked: false,
                }
              : null;
            const packed = packLanes(draftEvent ? [...shown, draftEvent] : shown);
            /* Hours a booking already covers: a hover label there would be
               cut in pieces behind the block, so it floats above instead. */
            const covered = new Set<number>();
            for (const e of mine) {
              for (let h = Math.floor(minutesOf(e.start) / 60); h * 60 < minutesOf(e.end); h++) covered.add(h);
            }
            const isToday = sameDay(d, now);
            /* Everything at an hour is drawn, side by side, sharing the column
               between them. There used to be a cap of three with the rest
               folded into a "+N" tile — which answered "how many" and hid
               which, on the one screen whose job is to say what is on. A busy
               hour is narrow now, and narrow is legible in a way absent is
               not: every block still carries its whole name in its accessible
               name, opens its own panel, and says everything on hover. */

            /* What each hour is: gone, sellable, or not. Runs of hours that
               cannot be sold are shaded as one block, so the rule between two
               of them does not read as a seam. */
            const state = (h: number): "past" | "open" | "none" => {
              if (isPastHour?.(d, h)) return "past";
              return (openCount?.(d, h) ?? 0) > 0 ? "open" : "none";
            };
            const runs: { from: number; to: number }[] = [];
            if (onCreate) {
              for (const h of hours) {
                if (state(h) === "open") continue;
                const last = runs[runs.length - 1];
                if (last && last.to === h) last.to = h + 1;
                else runs.push({ from: h, to: h + 1 });
              }
            }
            const dragHere = drag && drag.day === key ? drag : null;
            return (
              <div
                key={key}
                data-day-col
                data-day-index={dayIndex}
                /* Today's column is no longer tinted. The body of the grid now
                   has exactly two grounds — white is time you can sell, the
                   offtime shade is time you cannot — and a 4% ember wash on
                   one column was a third, the colour of a booking, on time
                   that was simply free. The header's badge and the now-line
                   say "today" without borrowing either meaning. */
                className="relative flex-1 border-r border-hairline last:border-r-0"
              >
                {/* Time that cannot be sold, shaded — and nothing else marked.
                    This grid used to write "6 open" into every hour that had
                    anything, seventy labels to say what was true of nearly
                    all of them. Bookable is the plain card now, which is what
                    the eye assumes of empty time anyway; the count is one
                    hover away. */}
                {runs.map((r) => (
                  <span
                    key={`off${r.from}`}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bg-offtime"
                    style={{
                      top: `${((r.from * 60 - openMin) / span) * 100}%`,
                      height: `${(((r.to - r.from) * 60) / span) * 100}%`,
                    }}
                  />
                ))}

                {/* Every hour still to come is a cell you can book into —
                    Google Calendar's click-empty-time-to-create, except that it
                    already knows what can be sold there. Hover names the hour
                    and how much is open; click opens the panel with a draft
                    block on that hour; drag down the column for longer. An
                    hour with nothing left still answers, with the nearest
                    hours that have something, because "is there anything at
                    four?" deserves "no, but five" rather than a dead click. */}
                {onCreate &&
                  hours.map((h) => {
                    const s = state(h);
                    if (s === "past") return null;
                    const count = s === "open" ? (openCount?.(d, h) ?? 0) : 0;
                    const top = `${((h * 60 - openMin) / span) * 100}%`;
                    const height = `${(60 / span) * 100}%`;
                    const label = bookLabel?.(d, h, count);
                    const time = toTime(h * 60);
                    return (
                      <button
                        key={`c${h}`}
                        type="button"
                        tabIndex={-1}
                        data-open-cell={s === "open" ? "" : undefined}
                        data-none-cell={s === "none" ? "" : undefined}
                        aria-label={label?.full ?? `${time}, ${noneLabel}`}
                        data-cell
                        data-day={dayIndex}
                        data-hour={h}
                        className="group/cell absolute inset-x-0 cursor-pointer"
                        style={{ top, height }}
                      >
                        {/* The hover: the hour you would get, drawn as the
                            outline of a block — a preview of the draft a click
                            makes. Under any bookings, so it never hides one. */}
                        {/* Not under the draft: an outline peeking out beside the
                            solid block reads as a second, broken one. */}
                        {!drag && !(draft && h * 60 < draft.end && (h + 1) * 60 > draft.start) && (
                          <span
                            aria-hidden
                            className={cn(
                              "absolute inset-x-[3px] inset-y-[1px] hidden rounded-sm border border-dashed px-1 py-0.5 text-left group-hover/cell:block",
                              s === "open" ? "border-ember/70 bg-ember/[0.06]" : "border-strong bg-card/60",
                            )}
                          >
                            {!covered.has(h) && (
                              <span className="flex flex-wrap items-baseline gap-x-1 text-[12px] leading-tight">
                                {s === "open" && <Plus size={10} strokeWidth={2.5} className="self-center text-brand-foreground" />}
                                <span className={cn("font-mono font-medium", s === "open" ? "text-brand-foreground" : "text-muted")}>{time}</span>
                                <span className="text-muted">{s === "open" ? label?.short : noneLabel}</span>
                              </span>
                            )}
                          </span>
                        )}
                        {/* Where bookings cover the hour, the offer floats above
                            them in the strip they leave free. */}
                        {!drag && covered.has(h) && s === "open" && (
                          <span
                            aria-hidden
                            className="absolute right-[2px] top-0.5 z-20 hidden items-center gap-0.5 rounded-xs bg-ember-solid px-1 text-[12px] font-medium leading-tight text-white shadow-sm group-hover/cell:flex"
                          >
                            <Plus size={10} strokeWidth={2.5} />
                            {label?.short}
                          </span>
                        )}
                      </button>
                    );
                  })}

                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 h-px bg-hairline"
                    style={{ top: `${((h * 60 - openMin) / span) * 100}%` }}
                  />
                ))}

                {isToday && showNow && (
                  <span
                    aria-hidden
                    /* Red, at the owner's direction and against the note that
                       used to sit here: this was `info` because the legend
                       already spends danger on "session closed". Red is what
                       every calendar anyone has used draws the clock in, and
                       that recognition is worth more than the collision — the
                       line is 2px and hairline-thin, it carries no label, and
                       it is the only thing on the grid that moves. */
                    className="pointer-events-none absolute inset-x-0 z-10 h-[2px] bg-danger-solid"
                    style={{ top: `calc(${((nowMin - openMin) / span) * 100}% - 1px)` }}
                  >
                    {/* A line alone reads as another hour rule. The knob on the
                        leading edge is what says "this one is the clock". */}
                    <span className="absolute -left-[3px] -top-[3px] h-[8px] w-[8px] rounded-full bg-danger-solid" />
                  </span>
                )}

                {/* Where the booking being carried would land, with the time
                    it would land at. Full width of the column, over everything,
                    and not interactive — it is a preview of a drop, not a
                    thing to press. */}
                {moving && moving.date === key && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[3px] z-40 overflow-hidden rounded-sm border-2 border-ember-solid bg-card px-1 py-0.5 text-left shadow-pop"
                    style={{
                      top: `${((moving.start - openMin) / span) * 100}%`,
                      height: `calc(${((moving.end - moving.start) / span) * 100}% - 2px)`,
                    }}
                  >
                    <span className="block truncate font-mono text-[12px] font-semibold leading-tight text-brand-foreground">
                      {toTime(moving.start)} – {toTime(moving.end)}
                    </span>
                    <span className="block truncate text-[12px] leading-tight text-fg">{moving.title}</span>
                  </span>
                )}

                {/* The hours being dragged across, live. */}
                {dragHere && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[3px] z-30 rounded-sm border-2 border-ember-solid bg-ember/15 px-1 py-0.5 font-mono text-[12px] font-semibold leading-tight text-brand-foreground"
                    style={{
                      top: `${((Math.min(dragHere.from, dragHere.to) - openMin) / span) * 100}%`,
                      height: `calc(${((Math.abs(dragHere.to - dragHere.from) + SNAP_MIN) / span) * 100}% - 2px)`,
                    }}
                  >
                    {toTime(Math.min(dragHere.from, dragHere.to))} – {toTime(Math.max(dragHere.from, dragHere.to) + SNAP_MIN)}
                  </span>
                )}

                {packed.map(({ event, lane, lanes }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, event.id === GHOST_ID && draft ? draft.end : minutesOf(event.end));
                  if (e <= s) return null;
                  const tall = ((e - s) / span) * bodyHeight;
                  const across = lanes;
                  const place = {
                    top: `${((s - openMin) / span) * 100}%`,
                    height: `calc(${((e - s) / span) * 100}% - 2px)`,
                    left: lanePart(lane, across),
                    width: laneWidth(across),
                  };

                  /* The second line costs the first one its width. It needs a
                     tall block, a column to itself, and a viewport wide enough
                     that the column is worth having — otherwise the name wins,
                     because the name is what tells two bookings apart. */
                  const roomForTwo = tall >= TWO_LINE_PX && across === 1 && roomy;
                  /* A block narrow enough that an icon crowds out the name is
                     better off with the name: a 29px block showing nothing but
                     a tick says less than one reading "Yog". */
                  const roomForIcon = across < 3;
                  /* Two lines for the name when the block is tall and is not
                     already spending its second line on the subtitle. */
                  const canWrap = tall >= TWO_LINE_PX && !roomForTwo && across < 3;
                  /* The draft: solid ember, the colour of the New booking
                     button, because it is that button's result — and nothing
                     else on the grid is solid, so it cannot be mistaken for a
                     booking that exists. White on ember-solid is the declared
                     house exception, as on the today badge. */
                  if (event.id === GHOST_ID && draft) {
                    const range = shortRange(draft.start, draft.end);
                    return (
                      <div
                        key={GHOST_ID}
                        data-ghost
                        aria-hidden
                        className={cn(
                        "pointer-events-none absolute z-30 overflow-hidden rounded-sm px-1 py-0.5 shadow-pop ring-2 ring-card",
                        /* A held draft is hatched warning, the same as every hold
                           already on this grid: an ember block would say the slot
                           is being sold. */
                        draft.hold ? TONE_CLASS.held : "bg-ember-solid text-white",
                      )}
                        style={place}
                      >
                        {/* Squeezed beside other bookings, the time leads — the
                            end a drag set included — and the name follows: the
                            panel already names it in 20px. */}
                        {across > 1 ? (
                          <>
                            <span className="block truncate font-mono text-[12px] font-semibold leading-tight">{range}</span>
                            {tall >= 30 && <span className="block truncate text-[12px] font-medium leading-tight text-white/90">{draft.title ?? ghostLabel}</span>}
                          </>
                        ) : (
                          <>
                            <span className={cn("block text-[12px] font-semibold leading-tight", tall >= TWO_LINE_PX + 12 ? "line-clamp-2" : "truncate")}>
                              {draft.title ?? ghostLabel}
                            </span>
                            {tall >= 30 && (
                              <span className="block truncate font-mono text-[12px] leading-tight text-white/90">
                                {toTime(draft.start)} – {toTime(draft.end)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }
                  const stack = stacks.get(event.id);
                  if (stack) {
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={onPickDay ? () => onPickDay(d) : undefined}
                        title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)} · ${event.subtitle ?? ""}`}
                        aria-label={`${event.title}, ${hhmm(event.start)}–${hhmm(event.end)}, ${event.subtitle ?? ""}`}
                        className={cn(
                          "absolute overflow-hidden rounded-sm border px-1 py-0.5 text-left shadow-[2px_2px_0_-1px_var(--color-card),2px_2px_0_0_var(--color-line)]",
                          blockClass(event),
                        )}
                        style={place}
                      >
                        <span className="flex items-start gap-0.5 text-[12px] font-medium leading-tight">
                          <span className="shrink-0 rounded-xs bg-fg/10 px-0.5 font-mono">{stack.length}</span>
                          <span className={cn("min-w-0", canWrap ? "line-clamp-2" : "truncate")}>{event.title}</span>
                        </span>
                        {tall >= TWO_LINE_PX && across === 1 && (
                          <span className="block truncate text-[12px] leading-tight opacity-70">{event.subtitle}</span>
                        )}
                      </button>
                    );
                  }
                  const movable = !!onMove && (!canMove || canMove(event));
                  const carrying = moving?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={
                        onSelect
                          ? (ev) => {
                              /* The click that ends a drag belongs to the drag,
                                 not to opening the booking that was dragged. */
                              if (swallowBlockClick.current) {
                                swallowBlockClick.current = false;
                                ev.stopPropagation();
                                return;
                              }
                              onSelect(event);
                            }
                          : undefined
                      }
                      onPointerDown={movable ? (ev) => moveStart(ev, event, d) : undefined}
                      onPointerMove={movable ? moveMove : undefined}
                      onPointerUp={movable ? moveEnd : undefined}
                      onPointerCancel={movable ? moveCancel : undefined}
                    {...peekHandlers(event, moving ? undefined : onPeek)}
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}`}
                      /* The visible text truncates at this density; the
                         accessible name never does. */
                      aria-label={`${event.title}, ${hhmm(event.start)}–${hhmm(event.end)}${
                        event.subtitle ? `, ${event.subtitle}` : ""
                      }`}
                      className={cn(
                        "absolute overflow-hidden rounded-sm border px-1 py-0.5 text-left",
                        movable && "cursor-grab active:cursor-grabbing",
                        // Where it was, while where it is going is drawn solid.
                        carrying && "opacity-40",
                        blockClass(event),
                      )}
                      style={place}
                    >
                      <span className="flex items-start gap-0.5 text-[12px] font-medium leading-tight">
                        {roomForIcon && event.locked && (
                          <Lock size={9} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                        )}
                        {/* Arrived is a green bar and nothing else, which is
                            status by colour alone; the tick is the word. */}
                        {roomForIcon && event.tone === "arrived" && (
                          <Check size={9} strokeWidth={3} className="mt-0.5 shrink-0 text-success" />
                        )}
                        {/* Wrap before truncating. The rule for a name that
                            distinguishes one booking from another says to wrap
                            or stack it, and a 45-minute block is 39px tall —
                            two lines of 12px. "Grand Heritage Ar…" becomes
                            "Grand Heritage / Architecture Tour". */}
                        <span className={cn("min-w-0", canWrap ? "line-clamp-2" : "truncate")}>
                          {event.title}
                        </span>
                      </span>
                      {roomForTwo && (
                        <span className="block truncate text-[12px] leading-tight opacity-70">
                          {event.subtitle ?? hhmm(event.start)}
                        </span>
                      )}
                    </button>
                  );
                })}

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The week on a phone: a strip to choose the day, a list to read it.
 *
 * The strip keeps what a week view is for — seeing which days are busy before
 * picking one — by stating each day's load as dots, the same language the
 * month view uses. The list underneath is where a booking is actually read,
 * and there nothing truncates: full width, the name wrapping if it must.
 */
function CompactWeek({
  days,
  events,
  now,
  onSelect,
  dayLabel,
  allDayLabel,
  emptyLabel,
  blockClass,
  dotClass,
  openHoursOf,
  onCreate,
  chipText,
}: {
  days: Date[];
  events: CalEvent[];
  now: Date;
  onSelect?: (event: CalEvent) => void;
  /** `long` names the day in full for a screen reader: a button reading
   *  "W 29" out loud does not say which day it is. */
  dayLabel: (d: Date) => { weekday: string; day: string; long?: string };
  allDayLabel: string;
  emptyLabel: string;
  blockClass: (e: CalEvent) => string;
  dotClass: (e: CalEvent) => string;
  openHoursOf?: (d: Date) => { hour: number; count: number }[];
  onCreate?: (day: Date, hour: number, anchor: DOMRect) => void;
  chipText?: ChipText;
}) {
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = isoDate(e.start);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /* Open on today when the week contains it, otherwise on the first day that
     has anything — never on a blank Monday when Friday is where the work is. */
  const fallback =
    days.find((d) => sameDay(d, now)) ??
    days.find((d) => (byDay.get(isoDate(d)) ?? []).length > 0) ??
    days[0];
  const [picked, setPicked] = useState<string | null>(null);
  const selectedKey =
    picked && days.some((d) => isoDate(d) === picked) ? picked : isoDate(fallback);
  const agenda = byDay.get(selectedKey) ?? [];
  const selectedDay = days.find((d) => isoDate(d) === selectedKey) ?? days[0];
  const openToday = openHoursOf?.(selectedDay) ?? [];

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-hairline">
        {days.map((d) => {
          const key = isoDate(d);
          const list = byDay.get(key) ?? [];
          const today = sameDay(d, now);
          const on = key === selectedKey;
          const label = dayLabel(d);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              aria-label={label.long}
              onClick={() => setPicked(key)}
              className={cn(
                "flex min-h-[3.5rem] flex-col items-center gap-1 border-r border-hairline py-tight last:border-r-0",
                on && "bg-ember/10",
              )}
            >
              <span className="type-label text-[12px] text-muted">{label.weekday.slice(0, 1)}</span>
              <span
                className={cn(
                  "flex h-7 min-w-[2rem] items-center justify-center rounded-sm px-1.5 font-mono text-[13px]",
                  today && "bg-ember-solid font-semibold text-white",
                  !today && on && "border border-ember text-brand-foreground",
                  !today && !on && "text-fg",
                )}
              >
                {label.day}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {list.slice(0, 4).map((e) => (
                  <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", dotClass(e))} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {agenda.length === 0 ? (
        // With open hours below, an empty day is not the end of the page.
        <p className={cn("px-card text-center text-[13px] text-muted", openToday.length ? "py-section" : "py-hero")}>{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-tight p-card">
          {agenda.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={onSelect ? () => onSelect(e) : undefined}
                className={cn(
                  "flex w-full items-start gap-comfortable rounded-sm border px-comfortable py-tight text-left",
                  blockClass(e),
                )}
              >
                <span className="w-12 shrink-0 font-mono text-[12px] opacity-70">
                  {e.allDay ? allDayLabel.slice(0, 3) : hhmm(e.start)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-0.5 text-[13px] font-medium leading-tight">
                    {e.locked && <Lock size={11} strokeWidth={2.5} className="shrink-0" />}
                    {e.tone === "arrived" && (
                      <Check size={11} strokeWidth={3} className="shrink-0 text-success" />
                    )}
                    {/* break-words, not truncate: this is the list that exists
                        so the name does not have to be guessed. */}
                    <span className="min-w-0 break-words">{e.title}</span>
                  </span>
                  {e.subtitle && (
                    <span className="mt-0.5 block break-words text-[12px] leading-tight opacity-70">
                      {e.subtitle}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {onCreate && chipText && (
        <OpenHourChips
          hours={openToday}
          onPick={(h, a) => onCreate(selectedDay, h, a)}
          heading={chipText.heading}
          chipLabel={chipText.label}
          chipName={chipText.name}
        />
      )}
    </div>
  );
}
