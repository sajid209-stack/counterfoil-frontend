import type { EventRecord } from "@/lib/api";
import { runsOverDays } from "@/lib/api";

/** An instant as Google and the iCalendar spec both want it: UTC, no punctuation. */
/** The day after, in plain `yyyymmdd` — UTC arithmetic so the +06:00 the rest
 *  of this app is written in cannot move it. */
const dayAfter = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
};

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * "Add to calendar", as a link rather than a download.
 *
 * A guest who has decided to come still has to remember to turn up, and the
 * page they decided on is the last place that can help them. Every event page
 * worth copying offers this next to the ticket button.
 *
 * Google's template URL is used rather than an `.ics` file because a data-URI
 * download is blocked in an iframe — which is exactly where this page is drawn
 * while an operator is building it — and because it opens in the calendar most
 * of this product's guests already use. An event with no end time is given two
 * hours, which is what a calendar does with a blank end anyway.
 *
 * **A multi-day event goes in as all-day, spanning its days.** Written as a
 * timed block it becomes one continuous 32-hour entry — a conference running
 * 09:00–17:30 on two days would sit across the intervening night, occupying an
 * evening it does not use. All-day over the right dates is the true shape, and
 * the per-day hours are on the page where they belong.
 */
export function calendarUrl(
  event: Pick<EventRecord, "id" | "title" | "startsAt" | "endsAt" | "days" | "venueName" | "venueAddress" | "subtitle">,
): string {
  const start = event.startsAt;
  const end = event.endsAt ?? new Date(Date.parse(start) + 2 * 60 * 60 * 1000).toISOString();
  const where = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    /* All-day ranges are written as plain dates and Google reads the end as
       exclusive, so the last day needs one added to be included. */
    dates: runsOverDays(event)
      ? `${start.slice(0, 10).replace(/-/g, "")}/${dayAfter(end.slice(0, 10))}`
      : `${stamp(start)}/${stamp(end)}`,
    ...(where ? { location: where } : {}),
    ...(event.subtitle ? { details: event.subtitle } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
