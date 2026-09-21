"use client";

import { cn } from "@/lib/cn";

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
      <h3 className="type-label mb-tight text-[12px] text-muted">{heading}</h3>
      <div className="grid grid-cols-3 gap-tight">
        {hours.map(({ hour, count }) => (
          <button
            key={hour}
            type="button"
            aria-label={chipName(hour, count)}
            onClick={(e) => onPick(hour, e.currentTarget.getBoundingClientRect())}
            className={cn(
              "flex min-h-11 flex-col items-start justify-center rounded-sm border border-dashed border-strong/60 px-comfortable py-inline text-left",
              "transition-colors duration-quick active:border-ember active:bg-ember/10",
            )}
          >
            <span className="font-mono text-[13px] font-medium leading-tight">{String(hour).padStart(2, "0")}:00</span>
            <span className="text-[12px] leading-tight text-muted">{chipLabel(count)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
