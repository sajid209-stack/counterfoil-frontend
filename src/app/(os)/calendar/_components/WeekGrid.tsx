"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addDays,
  hhmm,
  isoDate,
  minutesOf,
  packLanes,
  sameDay,
  TONE_CLASS,
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

/** The week as columns of days over a shared hour gutter — the shape everyone
 *  already knows from every calendar they have ever used. */
export function WeekGrid({
  weekStartDate,
  events,
  openHour = 6,
  closeHour = 23,
  onSelect,
  onPickDay,
  dayLabel,
  moreLabel,
  compact = false,
}: {
  weekStartDate: Date;
  events: CalEvent[];
  openHour?: number;
  closeHour?: number;
  onSelect?: (event: CalEvent) => void;
  onPickDay?: (date: Date) => void;
  /** Renders the column header, so the page owns date formatting. */
  dayLabel: (d: Date) => { weekday: string; day: string };
  moreLabel: (count: number) => string;
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

  const now = new Date();
  const nowMin = minutesOf(now);
  const showNow = nowMin >= openMin && nowMin <= closeMin;

  // All-day events (a day-wide hold) get their own strip above the grid rather
  // than being stretched down a column they do not really occupy.
  const allDay = events.filter((e) => e.allDay);

  return (
    // Both axes scroll in ONE container so the day headers can stick to its
    // top. Sticky against the page would let them scroll away, which is the
    // one thing a calendar header must never do.
    <div className="max-h-[70vh] overflow-auto">
      <div className={compact ? "min-w-0" : "min-w-[52rem]"}>
        {/* ── day headers ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-card">
          <div className={cn(gutter, "shrink-0 border-r border-line")} />
          {days.map((d) => {
            const today = sameDay(d, now);
            const label = dayLabel(d);
            return (
              <button
                key={isoDate(d)}
                type="button"
                onClick={onPickDay ? () => onPickDay(d) : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 border-r border-line py-tight last:border-r-0",
                  onPickDay && "transition-colors duration-quick hover:bg-subtle",
                )}
              >
                <span className="type-label text-[10px] text-muted">{label.weekday}</span>
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[12px]",
                    today ? "bg-ember text-ink" : "text-fg",
                  )}
                >
                  {label.day}
                </span>
              </button>
            );
          })}
        </div>

        {allDay.length > 0 && (
          <div className="flex border-b border-line bg-subtle/50">
            <div className={cn(gutter, "shrink-0 border-r border-line py-tight text-center font-mono text-[10px] text-faint")}>
              all day
            </div>
            {days.map((d) => (
              <div key={isoDate(d)} className="flex-1 border-r border-line p-0.5 last:border-r-0">
                {allDay
                  .filter((e) => sameDay(e.start, d))
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(e) : undefined}
                      className={cn(
                        "mb-0.5 block w-full truncate rounded-xs border px-tight py-0.5 text-left text-[10px]",
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
        <div className="flex" style={{ height: bodyHeight }}>
          {/* Hour gutter, once, on the left. */}
          <div className={cn("relative shrink-0 border-r border-line", gutter)}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-tight -translate-y-1/2 font-mono text-[11px] text-muted"
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
              <div key={isoDate(d)} className="relative flex-1 border-r border-line last:border-r-0">
                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="absolute inset-x-0 h-px bg-line/70"
                    style={{ top: `${((h * 60 - openMin) / span) * 100}%` }}
                  />
                ))}

                {today && showNow && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 z-10 h-0.5 bg-ember"
                    style={{ top: `${((nowMin - openMin) / span) * 100}%` }}
                  />
                )}

                {/* Anything beyond MAX_LANES becomes one "+N" tile rather than a
                    row of unreadable slivers. */}
                {overflow.length > 0 && (
                  <button
                    type="button"
                    onClick={onPickDay ? () => onPickDay(d) : undefined}
                    className="absolute z-10 overflow-hidden rounded-xs border border-strong bg-subtle px-1 text-left text-[10px] font-medium text-muted"
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
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(event) : undefined}
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}`}
                      className={cn(
                        "absolute overflow-hidden rounded-xs border px-1 py-0.5 text-left",
                        TONE_CLASS[event.tone],
                      )}
                      style={{
                        top: `${((s - openMin) / span) * 100}%`,
                        height: `calc(${((e - s) / span) * 100}% - 2px)`,
                        left: `${(lane / Math.min(lanes, maxLanes)) * 100}%`,
                        width: `calc(${(1 / Math.min(lanes, maxLanes)) * 100}% - 2px)`,
                      }}
                    >
                      <span className="flex items-center gap-0.5 truncate text-[10px] font-medium leading-tight">
                        {event.locked && <Lock size={8} strokeWidth={2.5} className="shrink-0" />}
                        {event.title}
                      </span>
                      {!compact && (
                        <span className="block truncate font-mono text-[9px] leading-tight opacity-70">
                          {hhmm(event.start)}
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
