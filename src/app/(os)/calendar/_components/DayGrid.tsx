"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { hhmm, minutesOf, packLanes, sameDay, TONE_CLASS, type CalEvent } from "./model";

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

const HOUR_PX = 76; // wide enough that a 30-minute booking still shows its name
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
  openHour = 6,
  closeHour = 23,
  onSelect,
  emptyLabel,
  compact = false,
}: {
  date: Date;
  lanes: DayLane[];
  events: CalEvent[];
  openHour?: number;
  closeHour?: number;
  onSelect?: (event: CalEvent) => void;
  emptyLabel: string;
  /** Phone: the axis turns vertical and the lanes stop being columns. */
  compact?: boolean;
}) {
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;
  const span = Math.max(1, closeMin - openMin);
  const hours = Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i);
  const width = (closeHour - openHour) * HOUR_PX;

  const now = new Date();
  const nowMin = minutesOf(now);
  const showNow = sameDay(now, date) && nowMin >= openMin && nowMin <= closeMin;

  const pct = (m: number) => ((m - openMin) / span) * 100;

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
    const timed = events.filter((e) => !e.allDay);
    const packed = packLanes(timed);
    const laneName = new Map(lanes.map((l) => [l.id, l.name]));
    const blocked = lanes.filter((l) => l.blocked);
    const trackHeight = (closeHour - openHour) * HOUR_PX_COMPACT;

    return (
      <div>
        {blocked.length > 0 && (
          <div className="flex flex-col gap-tight border-b border-line px-comfortable py-tight">
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
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="flex" style={{ height: trackHeight }}>
              {/* Hours down the left, once. */}
              <div className="relative w-11 shrink-0 border-r border-line">
                {hours.slice(0, -1).map((h) => (
                  <span
                    key={h}
                    className="absolute right-tight -translate-y-1/2 font-mono text-[12px] text-muted"
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
                    className="absolute inset-x-0 h-px bg-line/70"
                    style={{ top: `${pct(h * 60)}%` }}
                  />
                ))}

                {showNow && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 z-10 h-0.5 bg-ember"
                    style={{ top: `${pct(nowMin)}%` }}
                  />
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
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}`}
                      className={cn(
                        "absolute overflow-hidden rounded-xs border px-tight py-0.5 text-left",
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
                        {event.title}
                      </span>
                      {tall > 30 && (
                        <span className="block truncate font-mono text-[12px] leading-tight opacity-70">
                          {hhmm(event.start)}
                          {owner ? ` · ${owner}` : ""}
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

  return (
    // The grid scrolls inside its own card on both axes, so the hour axis can
    // stick to the top of it. The page itself never scrolls sideways.
    <div className="max-h-[70vh] overflow-auto">
      <div style={{ minWidth: width + 160 }}>
        {/* ── the one shared axis ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-card">
          <div className="sticky left-0 z-30 w-40 shrink-0 border-r border-line bg-card" />
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
            <div key={lane.id} className="flex border-b border-line last:border-0">
              {/* Name column stays put while the hours scroll under it. */}
              <div className="sticky left-0 z-10 flex w-40 shrink-0 flex-col justify-center border-r border-line bg-card px-comfortable">
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
                    className="absolute inset-y-0 w-px bg-line/70"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}

                {showNow && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 z-10 w-0.5 bg-ember"
                    style={{ left: `${pct(nowMin)}%` }}
                  />
                )}

                {packed.map(({ event, lane: row, lanes: rows }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, minutesOf(event.end));
                  if (e <= s) return null;
                  const height = (rowHeight - 8) / rows;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={onSelect ? () => onSelect(event) : undefined}
                      title={`${event.title} · ${hhmm(event.start)}–${hhmm(event.end)}${event.subtitle ? ` · ${event.subtitle}` : ""}`}
                      className={cn(
                        "absolute overflow-hidden rounded-xs border px-tight text-left transition-shadow duration-quick",
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
                      <span className="flex items-center gap-0.5 truncate text-[12px] font-medium leading-tight">
                        {event.locked && <Lock size={9} strokeWidth={2.5} className="shrink-0" />}
                        {event.title}
                      </span>
                      {height > 28 && event.subtitle && (
                        <span className="block truncate font-mono text-[12px] leading-tight opacity-70">
                          {hhmm(event.start)} · {event.subtitle}
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
