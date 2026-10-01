import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";

/**
 * A clock time in a narrow cell — a 4-across time grid on a 390px phone.
 *
 * "12:30 PM" at the till's grid size is close to a quarter of a phone, and the
 * till's text can be set larger, so the AM/PM is allowed to drop UNDER the
 * figure, smaller, rather than the figure being cut. It is a real space, so a
 * cell that has the room keeps one line and a screen reader reads "12:30 PM".
 *
 * `short` (the default here) drops ":00" on the hour — "7 PM" — which is what
 * a grid of hourly slots wants. Block rather than inline-block, because a text
 * decoration (an unavailable time is struck through) does not reach inside an
 * inline-block.
 *
 * Only what is drawn: the value passed in stays the 24-hour "HH:MM" the data
 * carries.
 */
export function ClockCell({
  hhmm,
  short = true,
  className,
  ampmClassName = "text-[0.8125rem] font-medium",
}: {
  hhmm: string;
  short?: boolean;
  className?: string;
  ampmClassName?: string;
}) {
  const text = formatClock(hhmm, { short });
  const cut = text.lastIndexOf(" ");
  if (cut < 0) return <span className={cn("block text-center", className)}>{text}</span>;
  return (
    <span className={cn("block min-w-0 text-center leading-tight", className)}>
      {text.slice(0, cut)} <span className={ampmClassName}>{text.slice(cut + 1)}</span>
    </span>
  );
}

/**
 * The 24-hour "HH:MM" times inside a display string, said in 12 hours.
 *
 * For text that was put together elsewhere and handed over whole — a receipt
 * line written into the completion handover before this screen existed — so
 * the stored snapshot is left exactly as it is and only what is drawn changes.
 * Two-digit hours only: that is the shape stored times have, and it keeps a
 * short duration such as "1:30" from being read as a clock.
 */
export function clockify(text: string): string {
  return text.replace(/\b([01]\d|2[0-3]):([0-5]\d)\b(?!\s?[AaPp][Mm])/g, (m) => formatClock(m));
}
