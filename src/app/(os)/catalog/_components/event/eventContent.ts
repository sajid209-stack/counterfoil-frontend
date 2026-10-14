import type { EventDay, EventLineupEntry } from "@/lib/api/events";

/**
 * An event's facts as the forms hold them: what it is called, when it is, where
 * it is, and its cover. `EventDetails` and `EventDays` edit this shape, so it
 * lives apart from the page designer that used to own it.
 */
export interface EventContent {
  title: string;
  subtitle: string;
  date: string;
  startTime: string;
  /** Optional: an end time, and the day it falls on (a festival runs past
   *  midnight, a tour runs for days). Empty `endTime` means no stated end. */
  endDate: string;
  endTime: string;
  /** The days it runs, when it runs on more than one. Generated from the date
   *  range and then editable, so an operator states the range once. Empty, or
   *  one entry, is a single-day event and no day control is drawn. */
  days: EventDay[];
  venueName: string;
  venueAddress: string;
  description: string;
  coverUrl: string;
  /** A YouTube or Vimeo link, as pasted. Parsed at render time. */
  videoUrl: string;
  organiserName: string;
  organiserBlurb: string;
  lineup: EventLineupEntry[];
  faq: { id: string; q: string; a: string }[];
}

export const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** An end, where one was set: the day and time it finishes, with a finish
 *  before the start on the same day read as past midnight. */
export function endsAtOf(c: Pick<EventContent, "date" | "startTime" | "endDate" | "endTime">): string | undefined {
  if (!c.endTime || !c.date) return undefined;
  let day = c.endDate || c.date;
  if (day === c.date && c.endTime <= c.startTime) day = shiftDay(c.date, 1);
  return `${day}T${c.endTime}:00+06:00`;
}
