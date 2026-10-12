"use client";

import { cn } from "@/lib/cn";
import { formatClockMin } from "@/lib/format";

/**
 * The day's open hours as chips, for a phone.
 *
 * A seven-column time grid does not fit 390px, so the phone week is a day
 * strip over a list — and a list of bookings says nothing about what is still
 * free. These chips are the phone's answer to "is there anything at four?":
 * every hour with something to sell, how much, one tap from the booking sheet.
 */
export function OpenHourChips({
  hours,
  onPick,
  heading,
  chipLabel,
  chipName,
}: {
  hours: { hour: number; count: number }[];
  onPick: (hour: number, anchor: DOMRect) => void;
  heading: string;
  chipLabel: (count: number) => string;
  chipName: (hour: number, count: number) => string;
}) {
  if (hours.length === 0) return null;
  return (
    <section aria-label={heading} className="border-t border-hairline px-card py-comfortable">
      <h3 className="mb-tight text-xs font-medium text-muted">{heading}</h3>
      <div className="grid grid-cols-3 gap-tight">
        {hours.map(({ hour, count }) => (
          <button
            key={hour}
            type="button"
            aria-label={chipName(hour, count)}
            onClick={(e) => onPick(hour, e.currentTarget.getBoundingClientRect())}
            className={cn(
              "flex min-h-11 flex-col items-start justify-center rounded-control border border-dashed border-strong px-comfortable py-inline text-left",
              "transition-colors duration-quick active:border-ember active:bg-ember-wash",
            )}
          >
            <span className="text-sm font-medium leading-tight tabular-nums">{formatClockMin(hour * 60, { short: true })}</span>
            <span className="text-xs leading-tight text-muted">{chipLabel(count)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
