"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Hourglass, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { toTime } from "@/lib/schedule";
import {
  focusMinute,
  hhmm,
  isoDate,
  minutesOf,
  packLanes,
  peekHandlers,
  sameDay,
  type CalEvent,
  type Ghost,
} from "./model";
import type { OpenSlot } from "./openSlots";
import { OpenHourChips } from "./OpenHourChips";
import type { ChipText } from "./WeekGrid";

/** What an open tile says: its price, or a session's places left. */
export type OpenTileLabel = (slot: OpenSlot) => { short: string; tiny: string; full: string };

/** One lane of the day: a resource, a guide, a product — whatever the day is
 *  grouped by. */
export interface DayLane {
  id: string;
  name: string;
  /** Shown under the name — a rate, a capacity, an out-of-service reason. */
  note?: string | null;
  /** Out of service: the whole lane is hatched. */
  blocked?: boolean;
  /** A field, a lane or a departure — something this calendar can sell. Its
   *  time that cannot be sold is shaded; a guide's row, or "Not assigned",
   *  has no availability of its own to state. */
  sellable?: boolean;
  /** Minutes the lane is held between bookings — a field's changeover. */
  buffer?: number;
  /** Only one thing is sold on it — a bowling lane — so a block there need
   *  not repeat the product's name and can say who, or how many, instead. */
  single?: boolean;
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
  blockClass,
  openSlots = [],
  onCreate,
  openLabel,
  onCreateHour,
  chipText,
  ghost = null,
  ghostLabel = "",
  changeoverLabel = "",
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
  /* What a block is painted. The page decides — status is the default and
     what the key explains, but an operator can colour by category instead,
     and then the same function answers for every grid. Held and closed keep
     their hatching either way: blocked is blocked whatever colour means. */
  blockClass: (e: CalEvent) => string;
  /** Every open field-hour and departure with room, for this day. */
  openSlots?: OpenSlot[];
  /** An open slot was clicked, or a run of them dragged across: open the
   *  booking panel on it. `minutes` is the length dragged, past one slot. */
  onCreate?: (slot: OpenSlot, anchor: DOMRect, minutes?: number) => void;
  openLabel?: OpenTileLabel;
  /** Phone: an open hour was tapped, rather than one slot. */
  onCreateHour?: (hour: number, anchor: DOMRect) => void;
  chipText?: ChipText;
  /** The booking being made, drawn on its lane. */
  ghost?: Ghost | null;
  ghostLabel?: string;
  /** What a shaded hour held for a field's changeover says. */
  changeoverLabel?: string;
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
  /* A lane with something still to sell is not empty, even with nothing
     booked on it — it is exactly the lane somebody is looking for. */
  const draft = ghost && !ghost.allDay && ghost.laneId && ghost.date === isoDate(date) ? ghost : null;
  const draftLane = draft?.laneId ?? null;
  const busy = useMemo(
    () =>
      new Set([
        ...events.filter((e) => !e.allDay).map((e) => e.ownerId),
        ...openSlots.map((o) => o.laneId),
        // The lane the draft is on stays open, whatever else it holds.
        ...(draftLane ? [draftLane] : []),
      ]),
    [events, openSlots, draftLane],
  );
  const emptyLanes = lanes.filter((l) => !busy.has(l.id) && !l.blocked);
  const shownLanes = showEmpty ? lanes : lanes.filter((l) => busy.has(l.id) || l.blocked);

  if (lanes.length === 0) {
    return <p className="py-hero text-center text-[13px] text-muted">{emptyLabel}</p>;
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
    const byHour = new Map<number, number>();
    for (const o of openSlots) {
      const h = Math.floor(o.minutes / 60);
      byHour.set(h, (byHour.get(h) ?? 0) + o.options.length);
    }
    const chips = [...byHour].sort((a, b) => a[0] - b[0]).map(([hour, count]) => ({ hour, count }));
    return (
      <>
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
        blockClass={blockClass}
      />
      {onCreateHour && chipText && (
        <OpenHourChips
          hours={chips}
          onPick={onCreateHour}
          heading={chipText.heading}
          chipLabel={chipText.label}
          chipName={chipText.name}
        />
      )}
      </>
    );
  }

  /* Every lane folded away leaves an hour axis over nothing, plus a "Show 8
     empty" that reads as the only content on the page. Say what happened. */
  if (shownLanes.length === 0) {
    return (
      <>
        <p className="py-hero text-center text-[13px] text-muted">{emptyLabel}</p>
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
        blockClass={blockClass}
        openSlots={openSlots}
        onCreate={onCreate}
        openLabel={openLabel}
        pastUntil={sameDay(now, date) ? nowMin : isoDate(date) < isoDate(now) ? closeMin : openMin}
        draft={draft}
        ghostLabel={ghostLabel}
        changeoverLabel={changeoverLabel}
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
    <div className="border-t border-hairline px-card py-tight">
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
  width: fixedWidth,
  pct,
  showNow,
  nowMin,
  now,
  onSelect,
  onPeek,
  blockClass,
  openSlots,
  onCreate,
  openLabel,
  pastUntil,
  draft,
  ghostLabel,
  changeoverLabel,
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
  blockClass: (e: CalEvent) => string;
  openSlots: OpenSlot[];
  onCreate?: (slot: OpenSlot, anchor: DOMRect, minutes?: number) => void;
  openLabel?: OpenTileLabel;
  /** Minutes before this have gone: the whole day for a past date. */
  pastUntil: number;
  draft: Ghost | null;
  ghostLabel: string;
  changeoverLabel: string;
}) {
  /* Open where the day happens rather than at its left edge. */
  const scroller = useRef<HTMLDivElement>(null);
  /* Same idea as the week's header: the axis and the sticky name column divide
     nothing until something starts sliding underneath them. Two axes here, so
     two dividers, each earned independently. */
  const [scrolledY, setScrolledY] = useState(false);
  const [scrolledX, setScrolledX] = useState(false);
  /* The hours take the width there is. A fixed 60px left the day 20px wider
     than a 1440 screen's card — so either "06:00" or "23:00" was always half
     under an edge — and on a wide screen it wasted the room a one-hour
     booking needs for its name. Below 52px an hour it scrolls instead. */
  const [avail, setAvail] = useState(0);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const ro = new ResizeObserver(() => setAvail(box.clientWidth));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const hourCount = Math.max(1, hours.length - 1);
  const width = avail ? Math.max(hourCount * 52, avail - 160) : fixedWidth;
  const focus = focusMinute(events, now, showNow);
  useEffect(() => {
    const box = scroller.current;
    if (!box || focus == null) return;
    // An hour before what it aims at, and the hour's own label clear of the
    // name column — it was opening on "00 07:00", half a label.
    const aim = Math.max(openMin, Math.floor(focus / 60) * 60 - 60);
    // A day that nearly fits is not scrolled at all: a 20px nudge only hid
    // half of the first hour's label under the names.
    if (box.scrollWidth - box.clientWidth < 60) {
      box.scrollLeft = 0;
      return;
    }
    box.scrollLeft = Math.max(0, ((aim - openMin) / span) * width - 24);
  }, [focus, openMin, span, width]);

  /* ── dragging along a lane ─────────────────────────────────────────────
     Press on an open hour and drag right to take the hours after it: two
     hours of the outdoor field, three of lane 2. The run only grows across
     hours that are open on THAT lane and follow one another, so the drag
     can never promise time that is booked. A mouse only — on a touch
     screen the same gesture scrolls the day. */
  const [drag, setDrag] = useState<{ laneId: string; from: number; to: number } | null>(null);
  const dragging = useRef<{ slot: OpenSlot; run: OpenSlot[]; row: HTMLElement; last: OpenSlot } | null>(null);
  const swallowClick = useRef(false);
  const runFrom = (slot: OpenSlot) => {
    const mine = openSlots.filter((o) => o.laneId === slot.laneId).sort((a, b) => a.minutes - b.minutes);
    const out = [slot];
    for (let i = mine.indexOf(slot) + 1; i < mine.length; i++) {
      const prev = out[out.length - 1];
      if (mine[i].minutes !== prev.minutes + prev.span) break;
      out.push(mine[i]);
    }
    return out;
  };
  const anchorOf = (row: HTMLElement, from: number, to: number) => {
    const r = row.getBoundingClientRect();
    return new DOMRect(r.left + (pct(from) / 100) * r.width, r.top, ((to - from) / span) * r.width, r.height);
  };
  const dragStart = (ev: React.PointerEvent<HTMLElement>, slot: OpenSlot) => {
    if (slot.isSession || ev.pointerType !== "mouse" || ev.button !== 0) return;
    const row = ev.currentTarget.closest<HTMLElement>("[data-lane-row]");
    if (!row) return;
    dragging.current = { slot, run: runFrom(slot), row, last: slot };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const dragMove = (ev: React.PointerEvent<HTMLElement>) => {
    const g = dragging.current;
    if (!g) return;
    const r = g.row.getBoundingClientRect();
    const m = openMin + ((ev.clientX - r.left) / r.width) * span;
    const last = [...g.run].reverse().find((o) => o.minutes <= m) ?? g.slot;
    if (last === g.last && last === g.slot) return;
    g.last = last;
    setDrag({ laneId: g.slot.laneId, from: g.slot.minutes, to: last.minutes + last.span });
  };
  const dragEnd = () => {
    const g = dragging.current;
    dragging.current = null;
    setDrag(null);
    if (!g || !onCreate) return;
    swallowClick.current = true;
    const to = g.last.minutes + g.last.span;
    onCreate(g.slot, anchorOf(g.row, g.slot.minutes, to), to - g.slot.minutes > g.slot.span ? to - g.slot.minutes : undefined);
  };
  const dragCancel = () => {
    dragging.current = null;
    setDrag(null);
  };
  const slotClick = (ev: React.MouseEvent<HTMLElement>, slot: OpenSlot) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    onCreate?.(slot, ev.currentTarget.getBoundingClientRect());
  };

  return (
    // The grid scrolls inside its own card on both axes, so the hour axis can
    // stick to the top of it. The page itself never scrolls sideways.
    <div
      ref={scroller}
      onScroll={(e) => {
        setScrolledY(e.currentTarget.scrollTop > 0);
        setScrolledX(e.currentTarget.scrollLeft > 0);
      }}
      className="max-h-[70vh] overflow-auto"
    >
      <div style={{ minWidth: width + 160 }} className={avail && avail - 160 >= hourCount * 52 ? "w-full" : undefined}>
        {/* ── the one shared axis ─────────────────────────────────────────── */}
        <div
          className={cn(
            "sticky top-0 z-40 flex bg-card transition-shadow duration-quick",
            scrolledY && "border-b border-hairline shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
          )}
        >
          <div
            className={cn(
              "sticky left-0 z-30 w-40 shrink-0 bg-card transition-shadow duration-quick",
              scrolledX && "border-r border-hairline",
            )}
          />
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
                {toTime(h * 60)}
              </span>
            ))}
          </div>
        </div>

        {/* ── lanes ───────────────────────────────────────────────────────── */}
        {lanes.map((lane) => {
          const mine = events.filter((e) => !e.allDay && e.ownerId === lane.id);
          const packed = packLanes(mine);
          const open = onCreate ? openSlots.filter((o) => o.laneId === lane.id) : [];
          const isSession = open.length > 0 ? open[0].isSession : lane.id.startsWith("session:");
          /* A field is one place, so its open hours and its bookings never
             overlap and the tiles sit in the row itself. A session is many
             places: a departure can be booked AND still have seats, so its
             open departures get a band of their own under the bookings. */
          const sessionBand = isSession && (open.length > 0 || draft?.laneId === lane.id) ? 30 : 0;
          const bookedHeight = Math.max(sessionBand ? 34 : 64, 26 * Math.max(packed.length ? 1 : 0, ...packed.map((p) => p.lanes)) + 20);
          const rowHeight = sessionBand ? (packed.length ? bookedHeight : 8) + sessionBand : Math.max(64, bookedHeight);

          /* Time that cannot be sold, shaded: what has gone, and on anything
             that sells, every stretch that is not open. Bookable time is the
             plain card — the price used to be printed on every free hour of
             every lane, a wall of "৳1,000" that made the three bookings on
             the day the hardest thing on it to find. The price is one hover
             away, on the hour you are actually looking at. */
          const off: { from: number; to: number }[] = [];
          if (onCreate && lane.sellable && !lane.blocked) {
            let cursor = openMin;
            for (const o of [...open].sort((a, b) => a.minutes - b.minutes)) {
              if (o.minutes > cursor) off.push({ from: cursor, to: o.minutes });
              cursor = Math.max(cursor, o.minutes + (isSession ? 0 : o.span));
              if (isSession) cursor = Math.max(cursor, o.minutes);
            }
            if (!isSession && cursor < closeMin) off.push({ from: cursor, to: closeMin });
            // A departure lane is open between departures; only the past is off.
            if (isSession) off.length = 0;
          }
          if (pastUntil > openMin && !lane.blocked) off.push({ from: openMin, to: Math.min(closeMin, pastUntil) });
          // One shade per stretch: the past and a closed morning overlap.
          off.sort((a, b) => a.from - b.from);
          for (let i = 1; i < off.length; i++) {
            if (off[i].from <= off[i - 1].to) {
              off[i - 1].to = Math.max(off[i - 1].to, off[i].to);
              off.splice(i--, 1);
            }
          }
          /* Cut around the lane's bookings. The blocks cover those minutes
             anyway, and what is left is each gap on its own — which is what
             lets a gap know it sits against a booking. */
          const pieces = off.flatMap((r) => {
            let segs: { from: number; to: number }[] = [r];
            for (const e of mine) {
              const a = minutesOf(e.start);
              const b = minutesOf(e.end);
              segs = segs.flatMap((x) =>
                b <= x.from || a >= x.to
                  ? [x]
                  : [
                      { from: x.from, to: Math.max(x.from, a) },
                      { from: Math.min(x.to, b), to: x.to },
                    ].filter((y) => y.to > y.from),
              );
            }
            return segs;
          });
          const dragHere = drag?.laneId === lane.id ? drag : null;
          const draftHere = draft?.laneId === lane.id ? draft : null;

          return (
            <div key={lane.id} className="flex border-b border-hairline last:border-0">
              {/* Name column stays put while the hours scroll under it. Above
                  the draft, so a block scrolled left slides under the name. */}
              <div
                className={cn(
                  "sticky left-0 z-[35] flex w-40 shrink-0 flex-col justify-center bg-card px-card transition-shadow duration-quick",
                  scrolledX && "border-r border-hairline shadow-[1px_0_2px_rgb(0_0_0/0.06)]",
                )}
              >
                {/* Two lines, then the rest on hover and for a screen reader.
                    A tour named in 84 characters wrapped to seven lines here
                    and pushed its own row to 130px. */}
                <span title={lane.name} className="line-clamp-2 break-words text-[13px] font-medium leading-tight">
                  {lane.name}
                </span>
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
                data-lane-row
                className={cn(
                  "relative flex-1",
                  lane.blocked &&
                    "bg-[repeating-linear-gradient(45deg,var(--color-subtle),var(--color-subtle)_3px,transparent_3px,transparent_7px)]",
                )}
                style={{ height: rowHeight }}
              >
                {pieces.map((r) => {
                  /* A shaded hour between bookings on a field is not a mystery:
                     the field is held for its changeover, and a free-looking
                     17:00 that cannot be sold is exactly what the desk would
                     otherwise report as a bug. It says so. */
                  const changeover =
                    (lane.buffer ?? 0) > 0 &&
                    r.from >= pastUntil &&
                    mine.some((e) => Math.abs(minutesOf(e.start) - r.to) < 1 || Math.abs(minutesOf(e.end) - r.from) < 1);
                  const px = ((r.to - r.from) / span) * width;
                  return (
                    <span
                      key={`off${r.from}`}
                      title={changeover ? changeoverLabel : undefined}
                      className={cn(
                        "absolute inset-y-0 flex items-center justify-center bg-offtime",
                        changeover ? "pointer-events-auto" : "pointer-events-none",
                      )}
                      style={{ left: `${pct(r.from)}%`, width: `${((r.to - r.from) / span) * 100}%` }}
                    >
                      {/* The word where it fits, an hourglass where it does not
                          — a one-hour gap is 60px and "Changeover" is 68. */}
                      {changeover &&
                        (px >= 76 ? (
                          <span className="truncate px-inline text-[12px] text-muted">{changeoverLabel}</span>
                        ) : (
                          <Hourglass size={13} strokeWidth={1.5} aria-label={changeoverLabel} className="text-muted" />
                        ))}
                    </span>
                  );
                })}

                {/* Hour rules, drawn behind everything. */}
                {hours.map((h) => (
                  <span
                    key={h}
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-px bg-hairline"
                    style={{ left: `${pct(h * 60)}%` }}
                  />
                ))}

                {showNow && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-info"
                    style={{ left: `${pct(nowMin)}%` }}
                  />
                )}

                {/* Open time you can click, drawn only when you point at it. A
                    booking is a thing; an open hour is room for one, and at
                    rest room looks like nothing — which is the point. On hover
                    it becomes the outline of the booking a click would make,
                    with the time and what it costs. A departure is different:
                    it is a scheduled thing with seats, so its places left stay
                    written, quietly, on the band under its bookings. */}
                {open.map((slot, i) => {
                  /* A departure can run longer than the gap to the next one
                     (a 90-minute tour every hour), so a tile ends where the
                     next one begins rather than drawing over it. */
                  const next = open[i + 1]?.minutes;
                  const s = Math.max(openMin, slot.minutes);
                  const e = Math.min(closeMin, slot.minutes + slot.span, next != null && next > slot.minutes ? next : Infinity);
                  if (e <= s) return null;
                  const label = openLabel?.(slot);
                  const wide = ((e - s) / span) * width;
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      data-open-slot
                      aria-label={label?.full}
                      title={label?.full}
                      onPointerDown={(ev) => dragStart(ev, slot)}
                      onPointerMove={dragMove}
                      onPointerUp={dragEnd}
                      onPointerCancel={dragCancel}
                      onClick={(ev) => slotClick(ev, slot)}
                      className={cn(
                        "group/open absolute flex overflow-hidden rounded-sm text-[12px] transition-colors duration-quick",
                        slot.isSession
                          ? "items-center justify-center border border-dashed border-strong/60 text-muted hover:border-solid hover:border-ember hover:bg-ember/[0.07] hover:text-brand-foreground"
                          : "flex-col items-start justify-start border border-transparent px-1 py-0.5 hover:border-dashed hover:border-ember/70 hover:bg-ember/[0.06]",
                      )}
                      style={{
                        left: `${pct(s)}%`,
                        width: `calc(${((e - s) / span) * 100}% - 2px)`,
                        top: slot.isSession ? rowHeight - sessionBand + 2 : 4,
                        height: slot.isSession ? sessionBand - 6 : rowHeight - 10,
                      }}
                    >
                      {slot.isSession ? (
                        <span className="truncate px-0.5">{wide >= 42 ? label?.short : label?.tiny}</span>
                      ) : !drag ? (
                        <span aria-hidden className="hidden min-w-0 flex-col leading-tight group-hover/open:flex">
                          <span className="flex items-center gap-0.5 font-mono font-medium text-brand-foreground">
                            <Plus size={10} strokeWidth={2.5} className="shrink-0" />
                            {wide >= 56 ? slot.time : null}
                          </span>
                          {wide >= 56 && <span className="truncate text-muted">{label?.short}</span>}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {packed.map(({ event, lane: row, lanes: rows }) => {
                  const s = Math.max(openMin, minutesOf(event.start));
                  const e = Math.min(closeMin, minutesOf(event.end));
                  if (e <= s) return null;
                  // Bookings share the row above a session's band of open departures.
                  const height = (rowHeight - sessionBand - 8) / rows;
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
                        // A one-hour block is ~58px: 4px sides leave room for "1 guest".
                        "absolute overflow-hidden rounded-sm border text-left transition-shadow duration-quick",
                        wide < 90 ? "px-1" : "px-tight",
                        blockClass(event),
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
                            the same block reading "Yog". The row already names
                            the field; the desk's question about it is WHO, so
                            a named booking leads with the guest. */}
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
                            // "Bowling Lane" in a 42px block wrapped to "Bowlin" /
                            // "Lane" — a word cut with no sign it was. Two lines
                            // only where a word fits; otherwise an ellipsis.
                            height >= 40 && wide >= 96 && !(height > 28 && wide >= 64)
                              ? "line-clamp-2"
                              : "truncate",
                          )}
                        >
                          {event.guest ?? (lane.single ? (event.party ?? event.title) : event.title)}
                        </span>
                      </span>
                      {/* Then what, or how many — hidden rather than cut to
                          three letters where the block cannot hold six. */}
                      {height > 28 && wide >= 64 && (event.guest ? (lane.single ? event.party : event.title) : (event.party ?? event.subtitle)) && (
                        <span className="block truncate text-[12px] leading-tight opacity-70">
                          {event.guest ? (lane.single ? event.party : event.title) : (event.party ?? event.subtitle)}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* The hours being dragged across, live. */}
                {dragHere && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute z-30 rounded-sm border-2 border-ember-solid bg-ember/15 px-1 py-0.5 font-mono text-[12px] font-semibold leading-tight text-brand-foreground"
                    style={{
                      left: `${pct(dragHere.from)}%`,
                      width: `calc(${((dragHere.to - dragHere.from) / span) * 100}% - 2px)`,
                      top: 4,
                      height: rowHeight - 10,
                    }}
                  >
                    {toTime(dragHere.from)} – {toTime(dragHere.to)}
                  </span>
                )}

                {/* The draft, on the lane it will take. It moves when the
                    panel picks another lane or another length, which is the
                    whole point of drawing it: you see the booking land. */}
                {draftHere && (
                  <div
                    data-ghost
                    aria-hidden
                    className="pointer-events-none absolute z-30 overflow-hidden rounded-sm bg-ember-solid px-tight py-0.5 text-white shadow-pop ring-2 ring-card"
                    style={{
                      left: `${pct(Math.max(openMin, draftHere.start))}%`,
                      width: `calc(${((Math.min(closeMin, draftHere.end) - Math.max(openMin, draftHere.start)) / span) * 100}% - 2px)`,
                      top: isSession ? rowHeight - sessionBand + 2 : 4,
                      height: isSession ? sessionBand - 6 : rowHeight - 10,
                    }}
                  >
                    {/* An hour here is 60px. "New booking / 14:00 – 15:00"
                        does not fit it, and "New … / 14:0…" says nothing, so
                        a one-hour draft states its start and lets the panel
                        say the rest. */}
                    {((Math.min(closeMin, draftHere.end) - Math.max(openMin, draftHere.start)) / span) * width >= 110 ? (
                      <>
                        <span className="block truncate text-[12px] font-semibold leading-tight">
                          {draftHere.title ?? ghostLabel}
                        </span>
                        {!isSession && (
                          <span className="block truncate font-mono text-[12px] leading-tight text-white/90">
                            {toTime(draftHere.start)} – {toTime(draftHere.end)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="block truncate font-mono text-[12px] font-semibold leading-tight">{toTime(draftHere.start)}</span>
                        {draftHere.title && !isSession && (
                          <span className="block truncate text-[12px] leading-tight text-white/90">{draftHere.title}</span>
                        )}
                      </>
                    )}
                  </div>
                )}
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
  blockClass,
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
  blockClass: (e: CalEvent) => string;
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
        <div className="flex flex-col gap-tight border-b border-hairline px-card py-tight">
          {blocked.map((l) => (
            <span key={l.id} className="flex items-baseline gap-tight text-[12px]">
              <span className="font-medium text-fg">{l.name}</span>
              <span className="min-w-0 truncate text-danger">{l.note}</span>
            </span>
          ))}
        </div>
      )}

      {timed.length === 0 ? (
        <p className="py-hero text-center text-[13px] text-muted">{emptyLabel}</p>
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
                      blockClass(event),
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
