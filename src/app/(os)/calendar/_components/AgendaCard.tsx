"use client";

import { Check, Lock } from "lucide-react";
import { MarketBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SM, useMediaQuery } from "@/lib/useMedia";
import { toneDotClass, type CalEvent, type EventTone } from "./model";

/** The tone bar down a phone row: the status colour, or the marketplace's blue
 *  for a plain booking sold there (the same rule as the blocks and the dots). */
const TONE_BAR: Record<EventTone, string> = {
  booked: "border-l-ember-solid",
  arrived: "border-l-success",
  noshow: "border-l-strong",
  held: "border-l-warning",
  locked: "border-l-danger-solid",
};
const barClass = (e: Pick<CalEvent, "tone" | "source">) =>
  e.source && e.tone === "booked" ? "border-l-market" : TONE_BAR[e.tone];

/**
 * One booking in the phone's day list (week and month views below md).
 *
 * Below `sm` it is a ROW of the day's one white card, not a tile of its own:
 * the time on the left, a 3px tone bar, then what and who, with hairlines
 * between rows (the list draws them). The status is a dot and a word only where
 * it is not the normal "Booked". From `sm` it draws exactly what it always did
 * (the status-painted block), so tablets are unchanged.
 */
export function AgendaCard({
  event: e,
  time,
  onClick,
  handlers,
  blockClass,
  toneLabel,
  check = false,
}: {
  event: CalEvent;
  /** The start time as the list prints it ("10 AM", or the all-day mark). */
  time: string;
  onClick?: () => void;
  /** Hover handlers (the month list peeks). */
  handlers?: React.HTMLAttributes<HTMLButtonElement>;
  blockClass: (e: CalEvent) => string;
  toneLabel?: (tone: EventTone) => string;
  /** Draw the arrived tick beside the name (the week list does). */
  check?: boolean;
}) {
  const phone = !useMediaQuery(SM);
  const word = toneLabel?.(e.tone);

  if (phone) {
    return (
      <button
        type="button"
        onClick={onClick}
        {...handlers}
        className="flex min-h-14 w-full items-stretch gap-comfortable px-card py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash"
      >
        <span className="w-16 shrink-0 whitespace-nowrap pt-0.5 text-sm tabular-nums text-muted">{time}</span>
        <span aria-hidden className={cn("shrink-0 self-stretch rounded-full border-l-[3px]", barClass(e))} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-base font-medium leading-snug text-fg">
            {e.source && <MarketBadge id={e.source.id} />}
            {e.locked && <Lock size={12} strokeWidth={2.5} className="shrink-0 text-muted" />}
            <span className={cn("min-w-0 break-words", e.tone === "noshow" && "line-through")}>{e.title}</span>
            {e.sourceLabel && <span className="sr-only">, {e.sourceLabel}</span>}
          </span>
          {e.subtitle && <span className="mt-0.5 block break-words text-sm leading-snug text-muted">{e.subtitle}</span>}
          {word && e.tone !== "booked" && (
            <span className="mt-1 flex items-center gap-inline text-sm text-muted">
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", toneDotClass(e))} />
              {word}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      className={cn("flex w-full items-start gap-comfortable rounded-control border px-comfortable py-tight text-left", blockClass(e))}
    >
      <span className="w-16 shrink-0 whitespace-nowrap text-xs tabular-nums opacity-70">{time}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-0.5 text-sm font-medium leading-tight">
          {e.source && <MarketBadge id={e.source.id} />}
          {e.locked && <Lock size={11} strokeWidth={2.5} className="shrink-0" />}
          {check && e.tone === "arrived" && <Check size={11} strokeWidth={3} className="shrink-0 text-success" />}
          {/* break-words, not truncate: this is the list that exists so the name does not have to be guessed. */}
          <span className="min-w-0 break-words">{e.title}</span>
          {e.sourceLabel && <span className="sr-only">, {e.sourceLabel}</span>}
        </span>
        {e.subtitle && <span className="mt-0.5 block break-words text-xs leading-tight opacity-70">{e.subtitle}</span>}
      </span>
    </button>
  );
}
