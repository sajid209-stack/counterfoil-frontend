"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock, Plus, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPriceShort } from "@/lib/format";
import { toTimeOfDay, type Block, type Column, type Group } from "../_lib/board";

/** One hour, tall enough that a free half-hour is still a thumb target. */
export const HOUR_PX = 64;
const GUTTER = 46;
/** Four lanes fit a phone at this width, with "Lane 4" still whole. */
const COL_MIN = 72;
const HEADER = 56;

/**
 * The board: hours down, places across, one block per thing that is happening.
 *
 * Four kinds of block and no more, each told apart by SHAPE and a glyph as
 * well as colour, because the person at this counter may not read the words:
 *   · free    — white, a big orange +, the price. Tap it to sell or hold.
 *   · booked  — filled orange, the customer's name. A tick once they are in.
 *   · on hold — striped grey with a lock, and who it is held for.
 *   · a show  — its seats left, a bar that empties as it sells.
 * Grey behind everything is time that cannot be booked (past, or closed).
 *
 * The same thing is always in the same place: the time on the left, the
 * places along the top, now as a red line. That is the pattern a counter
 * learns once and then works from memory.
 */
export function Board({
  group,
  nowMinutes,
  onFree,
  onBooking,
  onHold,
  onSession,
  onColumn,
}: {
  group: Group;
  /** Null when the day shown is not today. */
  nowMinutes: number | null;
  onFree: (column: Column, block: Extract<Block, { type: "free" }>) => void;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
  onColumn: (column: Column) => void;
}) {
  const t = useTranslations("schedule");
  const box = useRef<HTMLDivElement>(null);
  const hours: number[] = [];
  for (let m = group.from; m < group.to; m += 60) hours.push(m);
  const height = hours.length * HOUR_PX;
  const y = (m: number) => ((m - group.from) / 60) * HOUR_PX;
  const showNow = nowMinutes !== null && nowMinutes >= group.from && nowMinutes <= group.to;

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

  const cols = group.columns.length;

  return (
    <div
      ref={box}
      className="go-surface relative overflow-auto overscroll-contain rounded-go"
      style={{ height: "min(70dvh, 640px)", minHeight: 360 }}
    >
      <div className="relative" style={{ minWidth: GUTTER + cols * COL_MIN }}>
        {/* Place names — pinned as the day scrolls under them. */}
        <div className="sticky top-0 z-20 flex border-b border-hairline bg-card" style={{ height: HEADER }}>
          <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: GUTTER }} />
          {group.columns.map((c) => {
            const closed = !!c.resource?.outOfService;
            const name = c.kind === "unassigned" ? t("board.noPlace") : c.name;
            /* The whole header is the control, not a "⋯" beside the name: at
               four lanes on a phone a menu button left "La…", and the lane's
               number is exactly what a cashier who does not read looks for. */
            const body = (
              <>
                <span className="block w-full truncate text-[0.875rem] font-semibold leading-tight text-fg" title={name}>{name}</span>
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
                className="flex min-w-[72px] flex-1 flex-col items-center justify-center border-l border-hairline px-1 text-center hover:bg-muted-wash"
              >
                {body}
              </button>
            ) : (
              <div key={c.id} className="flex min-w-[72px] flex-1 flex-col items-center justify-center border-l border-hairline px-1 text-center">
                {body}
              </div>
            );
          })}
        </div>

        <div className="relative flex" style={{ height }}>
          {/* The hours. */}
          <div className="sticky left-0 z-10 shrink-0 border-r border-hairline bg-card" style={{ width: GUTTER }}>
            {hours.map((m) => (
              <div key={m} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute left-1.5 top-1 text-[0.8125rem] font-medium tabular-nums text-muted">{toTimeOfDay(m)}</span>
              </div>
            ))}
          </div>

          {group.columns.map((c) => (
            <div
              key={c.id}
              className="relative min-w-[72px] flex-1 border-l border-hairline"
              style={{
                /* What cannot be booked is the ground: a soft grey, ruled by
                   the hour. Free time is drawn ON it as white, so the eye goes
                   to what can be sold. */
                background: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX - 1}px, var(--color-hairline) ${HOUR_PX}px), var(--color-subtle)`,
              }}
            >
              {(group.blocks.get(c.id) ?? []).map((b) => (
                <BlockView
                  key={b.key}
                  block={b}
                  column={c}
                  top={y(Math.max(b.start, group.from))}
                  height={Math.max(28, y(Math.min(b.end, group.to)) - y(Math.max(b.start, group.from)))}
                  onFree={onFree}
                  onBooking={onBooking}
                  onHold={onHold}
                  onSession={onSession}
                />
              ))}
            </div>
          ))}

          {showNow && (
            <div aria-hidden className="pointer-events-none absolute right-0 z-[5]" style={{ top: y(nowMinutes as number), left: GUTTER - 6 }}>
              <div className="relative h-0.5 bg-danger">
                <span className="absolute -left-0 -top-[5px] h-3 w-3 rounded-full bg-danger" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockView({
  block: b,
  column,
  top,
  height,
  onFree,
  onBooking,
  onHold,
  onSession,
}: {
  block: Block;
  column: Column;
  top: number;
  height: number;
  onFree: (column: Column, block: Extract<Block, { type: "free" }>) => void;
  onBooking: (column: Column, block: Extract<Block, { type: "booking" }>) => void;
  onHold: (column: Column, block: Extract<Block, { type: "hold" }>) => void;
  onSession: (column: Column, block: Extract<Block, { type: "session" }>) => void;
}) {
  const t = useTranslations("schedule");
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  const tall = height >= 52;
  const frame = "absolute inset-x-1 overflow-hidden rounded-go-sm text-left transition-transform duration-quick active:scale-[0.98]";
  const style = { top: top + 2, height: height - 4 };

  if (b.type === "free") {
    return (
      <button
        type="button"
        onClick={() => onFree(column, b)}
        aria-label={t("board.freeAria", { place, time: b.time, price: formatPriceShort(b.price) })}
        className={cn(frame, "flex flex-col items-center justify-center gap-0.5 border border-line bg-card shadow-sm hover:border-ember")}
        style={style}
      >
        <Plus size={tall ? 22 : 18} strokeWidth={2.25} className="text-ember" aria-hidden />
        {tall && <span className="text-[0.8125rem] font-medium tabular-nums text-muted">{formatPriceShort(b.price)}</span>}
      </button>
    );
  }

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
              : "border-l-ember-solid bg-ember/15 text-fg",
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
          background:
            "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 6px, var(--color-card) 6px 12px)",
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
        "flex flex-col justify-between border px-tight py-1",
        disabled ? "border-line bg-subtle text-muted opacity-70" : full ? "border-line bg-muted-wash text-muted" : "border-line bg-card text-fg shadow-sm hover:border-ember",
      )}
      style={style}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[0.8125rem] font-semibold tabular-nums">{b.time}</span>
        {!full && !disabled && <Plus size={16} strokeWidth={2.25} className="shrink-0 text-ember" aria-hidden />}
      </span>
      {tall && (
        <>
          <span className="truncate text-[0.8125rem] leading-tight">
            {full ? t("board.full") : t("board.seatsLeft", { count: b.remaining })}
            {b.held.length > 0 && ` · ${t("board.someHeld")}`}
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-success" style={{ width: `${pct * 100}%` }} />
          </span>
        </>
      )}
    </button>
  );
}
