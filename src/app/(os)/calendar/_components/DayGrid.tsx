"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  focusMinute,
  hhmm,
  minutesOf,
  packLanes,
  peekHandlers,
  sameDay,
  TONE_CLASS,
  type CalEvent,
} from "./model";

/** One lane of the day: a resource, a guide, a product — whatever the day is
 *  grouped by. */
export interface DayLane {
  id: string;
  name: string;
  /** Shown under the name — a rate, a capacity, an out-of-service reason. */
  note?: string | null;
  /** Out of service: the whole lane is hatched. */
  blocked?: boolean;
}

/** 17 hours at 76px needed 1,292px of track plus a 160px name column, so the
 *  evening ran off the right of a 1512px desktop and the day could not be seen
 *  at once. At 60 the whole trading day fits the width it actually has, and a
 *  30-minute booking is still 30px — enough for a short name, and the detail
 *  panel carries the rest. */
const HOUR_PX = 60;
/** The phone timeline runs top to bottom, so an hour is worth vertical room. */
const HOUR_PX_COMPACT = 56;
/** Two abreast is the most a 320px track can show without becoming slivers. */
const MAX_LANES_COMPACT = 2;

/**
 * The day, as a real calendar.
 *
 * The thing this fixes: the old view stacked a timeline per resource and
 * repeated the 6→23 hour axis under every single one. Here the axis is drawn
 * ONCE across the top and every lane hangs off it, so the eye can read down a
 * column and compare lanes at the same instant — which is the only reason to
 * put them one above another in the first place.
 */
export function DayGrid({
  date,
  lanes,
  events,
  now,
  openHour = 6,
  closeHour = 23,
  onSelect,
  onPeek,
  emptyLabel,
  showEmptyLabel,
  hideEmptyLabel,
  compact = false,
}: {
  date: Date;
  lanes: DayLane[];
  events: CalEvent[];
  /** The app's clock, passed in rather than read here. */
  now: Date;
  openHour?: number;
  closeHour?: number;
  onSelect?: (event: CalEvent) => void;
  onPeek?: (event: CalEvent | null, anchor: DOMRect | null) => void;
  emptyLabel: string;
  showEmptyLabel: (count: number) => string;
  hideEmptyLabel: string;
  /** Phone: the axis turns vertical and the lanes stop being columns. */
  compact?: boolean;
}) {
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i);
  const width = (closeHour - openHour) * HOUR_PX;

  const nowMin = minutesOf(now);
  const showNow = sameDay(now, date) && nowMin >= openMin && nowMin <= closeMin;

  const pct = (m: number) => ((m - openMin) / span) * 100;

  /* Lanes with nothing on them, folded away.
     Every active resource got a row whether or not the day touched it, so a
     venue with eight courts opened on eight empty rows and the bookings were
     below the fold. An out-of-service lane is never folded: "nothing booked"
     and "closed today" must not look the same, which is the whole reason that
     hatching exists. */
  const [showEmpty, setShowEmpty] = useState(false);
  const busy = useMemo(() => new Set(events.filter((e) => !e.allDay).map((e) => e.ownerId)), [events]);
  const emptyLanes = lanes.filter((l) => !busy.has(l.id) && !l.blocked);
  const shownLanes = showEmpty ? lanes : lanes.filter((l) => busy.has(l.id) || l.blocked);

  if (lanes.length === 0) {
    return <p className="py-hero text-center text-[13px] text-faint">{emptyLabel}</p>;
  }

  /* ── phone ──────────────────────────────────────────────────────────────
     Lanes across the screen is a desktop idea: seven resources against
     seventeen hours needs 1,292px of track, and no phone has it. So on a
     phone the axis turns vertical — the shape every pocket calendar uses —
     and the lane a booking belongs to moves inside the block, where it reads
     as part of the booking rather than as a column heading scrolled off
     somewhere to the left.

     Nothing is dropped by the turn. Lanes with no bookings would simply
     vanish, so the ones that are out of service are named above the track:
     "no bookings" and "closed all day" must never look the same. */
  if (compact) {
    return (
      <CompactDay
        lanes={lanes}
        events={events}
        openHour={openHour}
        closeHour={closeHour}
        showNow={showNow}
        nowMin={nowMin}
        now={now}
        onSelect={onSelect}
        onPeek={onPeek}
        emptyLabel={emptyLabel}
      />
    );
  }

  /* Every lane folded away leaves an hour axis over nothing, plus a "Show 8
     empty" that reads as the only content on the page. Say what happened. */
  if (shownLanes.length === 0) {
    return (
      <>
        <p className="py-hero text-center text-[13px] text-faint">{emptyLabel}</p>
        <EmptyLaneToggle
          count={emptyLanes.length}
          open={showEmpty}
          onToggle={() => setShowEmpty((v) => !v)}
          showLabel={showEmptyLabel}
          hideLabel={hideEmptyLabel}
        />
      </>
    );
  }

  return (
    <>
      <DayTrack
        hours={hours}
        lanes={shownLanes}
        events={events}
        openMin={openMin}
        closeMin={closeMin}
        span={span}
        width={width}
        pct={pct}
        showNow={showNow}
        nowMin={nowMin}
        now={now}
        onSelect={onSelect}
        onPeek={onPeek}
      />
      <EmptyLaneToggle
        count={emptyLanes.length}
        open={showEmpty}
        onToggle={() => setShowEmpty((v) => !v)}
        showLabel={showEmptyLabel}
        hideLabel={hideEmptyLabel}
      />
    </>
  );
}

/** "Show 6 empty" / "Hide empty" — the lanes the day did not touch. */
function EmptyLaneToggle({
  count,
  open,
  onToggle,
  showLabel,
  hideLabel,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  showLabel: (count: number) => string;
  hideLabel: string;
}) {
  if (count === 0) return null;
  return (
    <div className="border-t border-hairline px-comfortable py-tight">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-9 items-center rounded-sm px-tight text-[13px] text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg"
      >
        {open ? hideLabel : showLabel(count)}
      </button>
    </div>
  );
}

/** The desktop day: one shared axis across the top, lanes hanging off it. */
function DayTrack({
  hours,
  lanes,
  events,
  openMin,
  closeMin,
  span,
  width,
  pct,
  showNow,
  nowMin,
  now,
  onSelect,
  onPeek,
}: {
  hours: number[];
  lanes: DayLane[];
  events: CalEvent[];
  openMin: number;
  closeMin: number;
  span: number;
  width: number;
  pct: (m: number) => number;
  showNow: boolean;
  nowMin: number;
  now: Date;
  onSelect?: (event: CalEvent) => void;
  onPeek?: (event: CalEvent | null, anchor: DOMRect | null) => void;
}) {
  /* Open where the day happens rather than at its left edge. */
  const scroller = useRef<HTMLDivElement>(null);
  const focus = focusMinute(events, now, showNow);
  useEffect(() => {
    const box = scroller.current;
    if (!box || focus == null) return;
    const x = 160 + ((focus - openMin) / span) * width - box.clientWidth * 0.2;
    box.scrollLeft = Math.max(0, x);
  }, [focus, openMin, span, width]);

  return (
    // The grid scrolls inside its own card on both axes, so the hour axis can
    // stick to the top of it. The page itself never scrolls sideways.
    <div ref={scroller} className="max-h-[70vh] overflow-auto">
      <div style={{ minWidth: width + 160 }}>
        {/* ── the one shared axis ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex border-b border-hairline bg-card">
          <div className="sticky left-0 z-30 w-40 shrink-0 border-r border-hairline bg-card" />
          <div className="relative h-8 flex-1">
            {hours.map((h, i) => (
              <span
                key={h}
                className={cn(
                  "absolute top-1.5 font-mono text-[12px] text-muted",
                  // Centring the end labels would push them outside the track
                  // and clip them against the gutter.
                  i === 0 ? "translate-x-0" : i === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: `${pct(h * 60)}%` }}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>

        {/* ── lanes ───────────────────────────────────────────────────────── */}
        {lanes.map((lane) => {
          const mine = events.filter((e) => !e.allDay && e.ownerId === lane.id);
          const packed = packLanes(mine);
          const rowHeight = Math.max(64, 26 * Math.max(1, ...packed.map((p) => p.lanes)) + 20);

          return (
            <div key={lane.id} className="flex border-b border-hairline last:border-0">
              {/* Name column stays put while the hours scroll under it. */}
              <div className="sticky left-0 z-10 flex w-40 shrink-0 flex-col justify-center border-r border-hairline bg-card px-comfortable">
                <span className="break-words text-[13px] font-medium leading-tight">{lane.name}</span>
                {lane.note && (
                  <span
                    className={cn(
                      "mt-0.5 break-words text-[12px] leading-tight",
                      lane.blocked ? "text-danger" : "text-muted",
                    )}
                  >
                    {lane.note}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "relative flex-1",
                  lane.blocked &&
                    "bg-[repeating-linear-gradient(45deg,var(--color-subtle),var(--color-subtle)_3px,transparent_3px,transparent_7px)]",
                )}
                style={{ height: rowHeight }}
              >
                {/* Hour rules, drawn behind everything. */}
                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-hairline"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}

                {showNow && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 z-10 w-0.5 bg-info"
                    style={{ left: `${pct(nowMin)}%` }}
                  />
                )}

                {packed.map(({ event, lane: row, lanes: rows }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, minutesOf(event.end));
                  if (e <= s) return null;
                  const height = (rowHeight - 8) / rows;
                  const wide = ((e - s) / span) * width;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(event) : undefined}
                    {...peekHandlers(event, onPeek)}
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}${event.subtitle ? ` · ${event.subtitle}` : ""}`}
                      aria-label={`${event.title}, ${hhmm(event.start)}–${hhmm(event.end)}${
                        event.subtitle ? `, ${event.subtitle}` : ""
                      }`}
                      className={cn(
                        "absolute overflow-hidden rounded-sm border px-tight text-left transition-shadow duration-quick",
                        TONE_CLASS[event.tone],
                        onSelect && "hover:shadow-sm",
                      )}
                      style={{
                        left: `${pct(s)}%`,
                        width: `calc(${((e - s) / span) * 100}% - 2px)`,
                        top: 4 + row * height,
                        height: height - 2,
                      }}
                    >
                      <span className="flex items-start gap-0.5 text-[12px] font-medium leading-tight">
                        {/* Only where the name still gets a look in. A 29px
                            block reduced to a lone green tick says less than
                            the same block reading "Yog". */}
                        {wide > 60 && event.locked && (
                          <Lock size={9} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                        )}
                        {wide > 60 && event.tone === "arrived" && (
                          <Check size={9} strokeWidth={3} className="mt-0.5 shrink-0 text-success" />
                        )}
                        {/* Wrap before truncating, where the lane is tall
                            enough to have a second line to give. */}
                        <span
                          className={cn(
                            "min-w-0",
                            height >= 40 && !(height > 28 && wide > 150 && event.subtitle)
                              ? "line-clamp-2"
                              : "truncate",
                          )}
                        >
                          {event.title}
                        </span>
                      </span>
                      {/* The start time is what the block's own left edge
                          already says, and printing it stole the line from the
                          party size and the lane, which it does not. */}
                      {height > 28 && wide > 150 && event.subtitle && (
                        <span className="block truncate text-[12px] leading-tight opacity-70">
                          {event.subtitle}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The phone day: the axis turns vertical and the lane moves into the block. */
function CompactDay({
  lanes,
  events,
  openHour,
  closeHour,
  showNow,
  nowMin,
  now,
  onSelect,
  onPeek,
  emptyLabel,
}: {
  lanes: DayLane[];
  events: CalEvent[];
  openHour: number;
  closeHour: number;
  showNow: boolean;
  nowMin: number;
  now: Date;
  onSelect?: (event: CalEvent) => void;
  onPeek?: (event: CalEvent | null, anchor: DOMRect | null) => void;
  emptyLabel: string;
}) {
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i);
  const pct = (m: number) => ((m - openMin) / span) * 100;

  const timed = events.filter((e) => !e.allDay);
  const packed = packLanes(timed);
  const laneName = new Map(lanes.map((l) => [l.id, l.name]));
  const blocked = lanes.filter((l) => l.blocked);
  const trackHeight = (closeHour - openHour) * HOUR_PX_COMPACT;

  const scroller = useRef<HTMLDivElement>(null);
  const focus = focusMinute(events, now, showNow);
  useEffect(() => {
    const box = scroller.current;
    if (!box || focus == null) return;
    box.scrollTop = Math.max(0, ((focus - openMin) / span) * trackHeight - box.clientHeight * 0.25);
  }, [focus, openMin, span, trackHeight]);

  return (
    <div>
      {blocked.length > 0 && (
        <div className="flex flex-col gap-tight border-b border-hairline px-comfortable py-tight">
          {blocked.map((l) => (
            <span key={l.id} className="flex items-baseline gap-tight text-[12px]">
              <span className="font-medium text-fg">{l.name}</span>
              <span className="min-w-0 truncate text-danger">{l.note}</span>
            </span>
          ))}
        </div>
      )}

      {timed.length === 0 ? (
        <p className="py-hero text-center text-[13px] text-faint">{emptyLabel}</p>
      ) : (
        <div ref={scroller} className="max-h-[70vh] overflow-y-auto">
          <div className="flex" style={{ height: trackHeight }}>
            {/* Hours down the left, once. */}
            <div className="relative w-11 shrink-0 border-r border-hairline">
              {hours.slice(0, -1).map((h, i) => (
                <span
                  key={h}
                  className={cn(
                    "absolute right-tight font-mono text-[12px] text-muted",
                    i === 0 ? "translate-y-0" : "-translate-y-1/2",
                  )}
                  style={{ top: `${pct(h * 60)}%` }}
                >
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </div>

            <div className="relative flex-1">
              {hours.map((h) => (
                <span
                  key={h}
                  aria-hidden
                  className="absolute inset-x-0 h-px bg-hairline"
                  style={{ top: `${pct(h * 60)}%` }}
                />
              ))}

              {showNow && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 z-10 h-px bg-info"
                  style={{ top: `${pct(nowMin)}%` }}
                >
                  <span className="absolute -left-0.5 -top-[3px] h-[7px] w-[7px] rounded-full bg-info" />
                </span>
              )}

              {packed.map(({ event, lane: col, lanes: cols }) => {
                const s = Math.max(openMin, minutesOf(event.start));
                const e = Math.min(closeMin, minutesOf(event.end));
                if (e <= s) return null;
                const across = Math.min(cols, MAX_LANES_COMPACT);
                if (col >= across) return null; // folded behind a neighbour
                const owner = event.ownerId ? laneName.get(event.ownerId) : null;
                const tall = ((e - s) / span) * trackHeight;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={onSelect ? () => onSelect(event) : undefined}
                    {...peekHandlers(event, onPeek)}
                    aria-label={`${event.title}, ${hhmm(event.start)}–${hhmm(event.end)}${
                      owner ? `, ${owner}` : ""
                    }`}
                    className={cn(
                      "absolute overflow-hidden rounded-sm border px-tight py-0.5 text-left",
                      TONE_CLASS[event.tone],
                    )}
                    style={{
                      top: `${pct(s)}%`,
                      height: `calc(${((e - s) / span) * 100}% - 2px)`,
                      left: `${(col / across) * 100}%`,
                      width: `calc(${(1 / across) * 100}% - 2px)`,
                    }}
                  >
                    <span className="flex items-center gap-0.5 truncate text-[12px] font-medium leading-tight">
                      {event.locked && <Lock size={9} strokeWidth={2.5} className="shrink-0" />}
                      {event.tone === "arrived" && (
                        <Check size={9} strokeWidth={3} className="shrink-0 text-success" />
                      )}
                      {event.title}
                    </span>
                    {tall > 30 && owner && (
                      <span className="block truncate text-[12px] leading-tight opacity-70">
                        {owner}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
