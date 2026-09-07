"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
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
  TONE_DOT,
  type CalEvent,
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
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const bodyHeight = (closeHour - openHour) * (compact ? HOUR_PX_COMPACT : HOUR_PX);
  const maxLanes = compact ? MAX_LANES_COMPACT : MAX_LANES;
  const gutter = compact ? "w-8" : "w-14";

  const nowMin = minutesOf(now);
  const weekHasToday = days.some((d) => sameDay(d, now));
  const showNow = weekHasToday && nowMin >= openMin && nowMin <= closeMin;

  // All-day events (a day-wide hold) get their own strip above the grid rather
  // than being stretched down a column they do not really occupy.
  const allDay = events.filter((e) => e.allDay);

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
    const y = body.offsetTop + ((focus - openMin) / span) * bodyHeight - box.clientHeight * 0.25;
    box.scrollTop = Math.max(0, y);
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
            "sticky top-0 z-20 flex bg-card transition-shadow duration-quick",
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

        {allDay.length > 0 && (
          <div className="flex border-b border-hairline bg-subtle/50">
            <div
              className={cn(
                gutter,
                "shrink-0 border-r border-hairline py-tight text-center text-[12px] text-faint",
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
                        TONE_CLASS[e.tone],
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* ── the grid ────────────────────────────────────────────────────── */}
        <div ref={track} className="flex" style={{ height: bodyHeight }}>
          {/* Hour gutter, once, on the left. */}
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
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>

          {days.map((d) => {
            const mine = events.filter((e) => !e.allDay && sameDay(e.start, d));
            const packed = packLanes(mine);
            const today = sameDay(d, now);
            const overflow = packed.filter((p) => p.lane >= maxLanes - 1 && p.lanes > maxLanes);
            const visible = packed.filter((p) => !overflow.includes(p));
            const overflowTop = overflow.length
              ? Math.min(...overflow.map((p) => minutesOf(p.event.start)))
              : 0;
            const overflowBottom = overflow.length
              ? Math.max(...overflow.map((p) => minutesOf(p.event.end)))
              : 0;
            return (
              <div
                key={isoDate(d)}
                /* Today's whole column, tinted, so the eye lands on it before
                   it reads anything. Kept to 4%: booked blocks are themselves
                   an ember wash, and at the 5% this started on Wednesday's
                   bookings sank into their own background. At 4%, with the
                   block borders, the column reads as ground and the blocks
                   still read as objects on it. */
                className={cn(
                  "relative flex-1 border-r border-hairline last:border-r-0",
                  today && "bg-ember/[0.04]",
                )}
              >
                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="absolute inset-x-0 h-px bg-hairline"
                    style={{ top: `${((h * 60 - openMin) / span) * 100}%` }}
                  />
                ))}

                {today && showNow && (
                  <span
                    aria-hidden
                    /* info, not danger and not ember: the legend already spends
                       danger on "session closed" and ember on "booked", and the
                       clock is not either of those. */
                    className="absolute inset-x-0 z-10 h-px bg-info"
                    style={{ top: `${((nowMin - openMin) / span) * 100}%` }}
                  >
                    {/* A line alone reads as another hour rule. The knob on the
                        leading edge is what says "this one is the clock". */}
                    <span className="absolute -left-0.5 -top-[3px] h-[7px] w-[7px] rounded-full bg-info" />
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
                      left: `${((maxLanes - 1) / maxLanes) * 100}%`,
                      width: `calc(${(1 / maxLanes) * 100}% - 2px)`,
                    }}
                  >
                    {moreLabel(overflow.length)}
                  </button>
                )}

                {visible.map(({ event, lane, lanes }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, minutesOf(event.end));
                  if (e <= s) return null;
                  const tall = ((e - s) / span) * bodyHeight;
                  const across = Math.min(lanes, maxLanes);
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
                  const canWrap = tall >= TWO_LINE_PX && !roomForTwo;
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
                        TONE_CLASS[event.tone],
                      )}
                      style={{
                        top: `${((s - openMin) / span) * 100}%`,
                        height: `calc(${((e - s) / span) * 100}% - 2px)`,
                        left: `${(lane / Math.min(lanes, maxLanes)) * 100}%`,
                        width: `calc(${(1 / Math.min(lanes, maxLanes)) * 100}% - 2px)`,
                      }}
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
}: {
  days: Date[];
  events: CalEvent[];
  now: Date;
  onSelect?: (event: CalEvent) => void;
  dayLabel: (d: Date) => { weekday: string; day: string };
  allDayLabel: string;
  emptyLabel: string;
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
                  <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[e.tone])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {agenda.length === 0 ? (
        <p className="px-comfortable py-hero text-center text-[13px] text-faint">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-tight p-comfortable">
          {agenda.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={onSelect ? () => onSelect(e) : undefined}
                className={cn(
                  "flex w-full items-start gap-comfortable rounded-sm border px-comfortable py-tight text-left",
                  TONE_CLASS[e.tone],
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
    </div>
  );
}
