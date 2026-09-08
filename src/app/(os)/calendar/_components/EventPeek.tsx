"use client";

import { Clock, Lock, Tag, Users } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { hhmm, type CalEvent, type EventTone } from "./model";

const TONE_PILL: Record<EventTone, PillTone> = {
  booked: "info",
  arrived: "success",
  noshow: "neutral",
  held: "warning",
  locked: "danger",
};

const TONE_KEY: Record<EventTone, string> = {
  booked: "keyBooked",
  arrived: "keyArrived",
  noshow: "keyNoShow",
  held: "keyHeld",
  locked: "keyLocked",
};

const GAP = 10;
const W = 264;

/**
 * The card that follows the pointer over a block.
 *
 * A block in a week column is between 53 and 165px wide, so most of them
 * cannot say their own name. Clicking already opens the full panel; this is
 * the cheaper question — "what is that one?" — answered without a click, the
 * way every calendar worth using answers it.
 *
 * Pointer only. On a touch screen `mouseenter` fires on tap, which would put a
 * card under the finger at the same moment the tap opens the panel behind it,
 * so the grids only report hovers when the device actually has a pointer.
 */
export function EventPeek({
  event,
  anchor,
  t,
  dayLabel,
}: {
  event: CalEvent | null;
  /** Where the block is, in viewport coordinates. */
  anchor: DOMRect | null;
  t: (key: string) => string;
  dayLabel: (d: Date) => string;
}) {
  // Nothing to place until a pointer is actually over a block, and this
  // returns before anything reads `window` — the card only ever exists as a
  // consequence of a mouse event, so there is no server render to guard.
  if (!event || !anchor) return null;

  // Beside the block, flipped to the other side when it would run off, and
  // clamped so it can never open partly outside the window. Derived from the
  // props rather than held in state: it is a position, not a decision.
  const wantRight = anchor.right + GAP + W < window.innerWidth;
  const box = {
    left: wantRight ? anchor.right + GAP : Math.max(GAP, anchor.left - GAP - W),
    top: Math.min(Math.max(GAP, anchor.top + anchor.height / 2 - 70), window.innerHeight - 170),
  };

  const when = event.allDay ? t("allDayLong") : `${hhmm(event.start)} – ${hhmm(event.end)}`;

  return (
    <div
      // Decorative in the accessibility tree: every block already carries the
      // same words in its aria-label, and announcing them twice on focus would
      // be worse than not announcing them here at all.
      aria-hidden
      className={cn(
        "pointer-events-none fixed z-40 w-[16.5rem] rounded-md border border-line bg-card p-comfortable",
        "shadow-lg ring-1 ring-ink/5",
        "motion-safe:animate-[peek-in_120ms_ease-out]",
      )}
      style={{ left: box.left, top: box.top }}
    >
      <div className="flex flex-col gap-tight">
        <div className="flex items-start justify-between gap-tight">
          <span className="min-w-0 break-words text-[14px] font-semibold leading-tight">
            {event.title}
          </span>
          {event.locked && (
            <Lock size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-muted" />
          )}
        </div>

        {/* A flex child in a column stretches, and a status pill spanning the
            whole card reads as a banner rather than as a label. */}
        <span className="flex">
          <StatusPill tone={TONE_PILL[event.tone]}>{t(TONE_KEY[event.tone])}</StatusPill>
        </span>

        <span className="flex items-start gap-tight text-[13px]">
          <Clock size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-muted" />
          <span className="min-w-0">
            <span className="font-mono">{when}</span>
            <span className="block text-[12px] text-muted">{dayLabel(event.start)}</span>
          </span>
        </span>

        {event.subtitle && (
          <span className="flex items-start gap-tight text-[13px]">
            {event.kind === "hold" ? (
              <Tag size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-muted" />
            ) : (
              <Users size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-muted" />
            )}
            <span className="min-w-0 break-words">{event.subtitle}</span>
          </span>
        )}

        <span className="mt-inline text-[12px] text-muted">{t("peekHint")}</span>
      </div>
    </div>
  );
}
