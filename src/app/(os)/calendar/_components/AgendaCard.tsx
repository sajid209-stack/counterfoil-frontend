"use client";

import { Check, Lock } from "lucide-react";
import { MarketBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SM, useMediaQuery } from "@/lib/useMedia";
import { toneDotClass, type CalEvent, type EventTone } from "./model";

/**
 * One booking in the phone's day list (week and month views below md).
 *
 * Below `sm` it is one quiet tile with a single tint, whatever the booking's
 * state: its status is a small dot and a word on the last line, not a fill, a
 * stripe and a badge at once. From `sm` it draws exactly what it always did
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
  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      className={cn(
        "flex w-full items-start gap-comfortable text-left",
        phone ? "min-h-11 rounded-card bg-subtle px-comfortable py-comfortable dark:ring-1 dark:ring-inset dark:ring-line" : cn("rounded-control border px-comfortable py-tight", blockClass(e)),
      )}
    >
      <span className={cn("w-16 shrink-0 whitespace-nowrap text-xs tabular-nums", phone ? "pt-0.5 text-muted" : "opacity-70")}>{time}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-0.5 text-sm font-medium leading-tight">
          {e.source && <MarketBadge id={e.source.id} />}
          {e.locked && <Lock size={11} strokeWidth={2.5} className="shrink-0" />}
          {!phone && check && e.tone === "arrived" && <Check size={11} strokeWidth={3} className="shrink-0 text-success" />}
          {/* break-words, not truncate: this is the list that exists so the name does not have to be guessed. */}
          <span className="min-w-0 break-words">{e.title}</span>
          {e.sourceLabel && <span className="sr-only">, {e.sourceLabel}</span>}
        </span>
        {e.subtitle && <span className={cn("mt-0.5 block break-words text-xs leading-tight", phone ? "text-muted" : "opacity-70")}>{e.subtitle}</span>}
        {phone && word && (
          <span className="mt-tight flex items-center gap-inline text-xs text-muted">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", toneDotClass(e))} />
            {word}
          </span>
        )}
      </span>
    </button>
  );
}
