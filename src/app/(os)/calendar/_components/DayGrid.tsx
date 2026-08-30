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
}: {
  date: Date;
  lanes: DayLane[];
  events: CalEvent[];
  openHour?: number;
  closeHour?: number;
  onSelect?: (event: CalEvent) => void;
  emptyLabel: string;
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

  return (
    // The grid scrolls inside its own card on both axes, so the hour axis can
    // stick to the top of it. The page itself never scrolls sideways.
    <div className="max-h-[70vh] overflow-auto">
      <div style={{ minWidth: width + 160 }}>
        {/* ── the one shared axis ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-card">
          <div className="sticky left-0 z-30 w-40 shrink-0 border-r border-line bg-card" />
          <div className="relative h-8 flex-1">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute top-1.5 -translate-x-1/2 font-mono text-[11px] text-muted"
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
                      "mt-0.5 break-words text-[11px] leading-tight",
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
                      <span className="flex items-center gap-0.5 truncate text-[11px] font-medium leading-tight">
                        {event.locked && <Lock size={9} strokeWidth={2.5} className="shrink-0" />}
                        {event.title}
                      </span>
                      {height > 28 && event.subtitle && (
                        <span className="block truncate font-mono text-[10px] leading-tight opacity-70">
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
