import { formatClockOf, formatDay } from "@/lib/format";
import type { WalkOptions } from "@/lib/sequences";

const pad = (n: number) => String(n).padStart(2, "0");
/** A local date as the YYYY-MM-DD the app's day formatter takes. */
export const ymdOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** How "Try it" and the previews write a day and a clock. */
export const walkOptions = (venue: string): WalkOptions => ({
  venue,
  day: (d) => formatDay(ymdOf(d), { weekday: true }),
  clock: (d) => formatClockOf(d),
});
