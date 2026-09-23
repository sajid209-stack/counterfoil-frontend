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


const HOUR_PX = 52;
const HOUR_PX_COMPACT = 44;
/** Past this many side-by-side events a week column stops being readable —
 *  the extras collapse into a "+N" that drops into the day view, where lanes
 *  have room to breathe. */
const MAX_LANES = 3;
/** Seven columns inside 320px leaves ~40px each; a third abreast would be a
 *  sliver rather than a booking. */
const MAX_LANES_COMPACT = 2;
/** Below this a block has one line, and the name gets it. A 30-minute booking
 *  is 26px tall here, which is one line of 12px text and its padding. */
const TWO_LINE_PX = 40;
/** The strip down the right of every day column that bookings never cover, so
 *  an hour that is booked AND still has room can always be clicked. Google
 *  Calendar leaves the same margin for the same reason: without it, a busy
 *  hour hides the very capacity somebody is looking for. */
const GUTTER_PX = 16;

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
  moreLabel,
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
  dayLabel: (d: Date) => { weekday: string; day: string };
  moreLabel: (count: number) => string;
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
   *  `minutes` is the length dragged, when it was more than the one hour. */
  onCreate?: (day: Date, hour: number, anchor: DOMRect, minutes?: number) => void;
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
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const bodyHeight = (closeHour - openHour) * (compact ? HOUR_PX_COMPACT : HOUR_PX);
  const maxLanes = compact ? MAX_LANES_COMPACT : MAX_LANES;
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
     and it is every hour dragged across — Google's click-and-drag, snapped to
     the hour because that is the grain this venue sells in. Only a mouse
     drags: on a touch screen the same gesture is a scroll, and a tap books
     the hour it lands on. */
  const [drag, setDrag] = useState<{ day: string; from: number; to: number } | null>(null);
  const dragging = useRef<{ day: Date; from: number; col: HTMLElement; moved: boolean } | null>(null);
  /** A drag ends in a click on the cell it started in; that click is the drag's. */
  const swallowClick = useRef(false);
  const hourAt = (col: HTMLElement, clientY: number, day: Date) => {
    const r = col.getBoundingClientRect();
    const h = Math.floor((openMin + ((clientY - r.top) / r.height) * span) / 60);
    // Never back into hours already gone: the drag stops at the first one left.
    let floor = openHour;
    while (floor < closeHour - 1 && (isPastHour?.(day, floor) ?? false)) floor++;
    return Math.min(closeHour - 1, Math.max(floor, h));
  };
  /** Where the draft will be drawn, for the panel to stand beside. */
  const create = (day: Date, from: number, to: number, col: HTMLElement | null) => {
    if (!onCreate || !col) return;
    const a = Math.min(from, to);
    const hours = Math.abs(to - from) + 1;
    const r = col.getBoundingClientRect();
    const top = r.top + ((a * 60 - openMin) / span) * r.height;
    onCreate(day, a, new DOMRect(r.left, top, r.width, ((hours * 60) / span) * r.height), hours > 1 ? hours * 60 : undefined);
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
    dragging.current = { day: cell.day, from: cell.hour, col: cell.col, moved: false };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const dragMove = (ev: React.PointerEvent<HTMLElement>) => {
    const g = dragging.current;
    if (!g) return;
    const to = hourAt(g.col, ev.clientY, g.day);
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
    create(g.day, g.from, g.moved ? hourAt(g.col, ev.clientY, g.day) : g.from, g.col);
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
    if (cell) create(cell.day, cell.hour, cell.hour, cell.col);
  };

  /* Open where the day happens.
     The grid used to open at `scrollTop` 0 — 06:00 — with every booking below
     the fold, so the first thing on screen was four hours of empty morning.
     Aim at now when this week contains it, otherwise at the first thing
     booked, and leave a quarter of the viewport above it for context. */
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
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
      <div className={compact ? "min-w-0" : "min-w-[52rem]"}>
        {/* ── day headers ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            "sticky top-0 z-40 flex bg-card transition-shadow duration-quick",
            scrolled && "border-b border-hairline shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
          )}
        >
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
                onClick={onPickDay ? () => onPickDay(d) : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-tight",
                  today && "bg-ember/5",
                  onPickDay && "transition-colors duration-quick hover:bg-subtle",
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

        {(allDay.length > 0 || ghostAllDay) && (
          <div className="flex border-b border-hairline bg-subtle/50">
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
                  categoryId: null,
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
            // The draft is never folded into "+N": it is the block being looked for.
            const overflow = packed.filter((p) => p.event.id !== GHOST_ID && p.lane >= maxLanes - 1 && p.lanes > maxLanes);
            const visible = packed.filter((p) => !overflow.includes(p));
            const overflowTop = overflow.length
              ? Math.min(...overflow.map((p) => minutesOf(p.event.start)))
              : 0;
            const overflowBottom = overflow.length
              ? Math.max(...overflow.map((p) => minutesOf(p.event.end)))
              : 0;

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
                    /* info, not danger and not ember: the legend already spends
                       danger on "session closed" and ember on "booked", and the
                       clock is not either of those. */
                    className="pointer-events-none absolute inset-x-0 z-10 h-px bg-info"
                    style={{ top: `${((nowMin - openMin) / span) * 100}%` }}
                  >
                    {/* A line alone reads as another hour rule. The knob on the
                        leading edge is what says "this one is the clock". */}
                    <span className="absolute -left-0.5 -top-[3px] h-[7px] w-[7px] rounded-full bg-info" />
                  </span>
                )}

                {/* The hours being dragged across, live. */}
                {dragHere && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[3px] z-30 rounded-sm border-2 border-ember-solid bg-ember/15 px-1 py-0.5 font-mono text-[12px] font-semibold leading-tight text-brand-foreground"
                    style={{
                      top: `${((Math.min(dragHere.from, dragHere.to) * 60 - openMin) / span) * 100}%`,
                      height: `calc(${(((Math.abs(dragHere.to - dragHere.from) + 1) * 60) / span) * 100}% - 2px)`,
                    }}
                  >
                    {toTime(Math.min(dragHere.from, dragHere.to) * 60)} – {toTime((Math.max(dragHere.from, dragHere.to) + 1) * 60)}
                  </span>
                )}

                {/* Anything beyond MAX_LANES becomes one "+N" tile rather than a
                    row of unreadable slivers. */}
                {overflow.length > 0 && (
                  <button
                    type="button"
                    onClick={onPickDay ? () => onPickDay(d) : undefined}
                    className="absolute z-10 overflow-hidden rounded-sm border border-strong bg-subtle px-1 text-left text-[12px] font-medium text-muted"
                    style={{
                      top: `${((overflowTop - openMin) / span) * 100}%`,
                      height: `calc(${((overflowBottom - overflowTop) / span) * 100}% - 2px)`,
                      left: lanePart(maxLanes - 1, maxLanes),
                      width: laneWidth(maxLanes),
                    }}
                  >
                    {moreLabel(overflow.length)}
                  </button>
                )}

                {visible.map(({ event, lane, lanes }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, event.id === GHOST_ID && draft ? draft.end : minutesOf(event.end));
                  if (e <= s) return null;
                  const tall = ((e - s) / span) * bodyHeight;
                  const across = Math.min(lanes, maxLanes);
                  const place = {
                    top: `${((s - openMin) / span) * 100}%`,
                    height: `calc(${((e - s) / span) * 100}% - 2px)`,
                    left: lanePart(Math.min(lane, maxLanes - 1), across),
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
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(event) : undefined}
                    {...peekHandlers(event, onPeek)}
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}`}
                      /* The visible text truncates at this density; the
                         accessible name never does. */
                      aria-label={`${event.title}, ${hhmm(event.start)}–${hhmm(event.end)}${
                        event.subtitle ? `, ${event.subtitle}` : ""
                      }`}
                      className={cn(
                        "absolute overflow-hidden rounded-sm border px-1 py-0.5 text-left",
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
  dayLabel: (d: Date) => { weekday: string; day: string };
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
