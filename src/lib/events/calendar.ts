import type { EventRecord } from "@/lib/api";

/** An instant as Google and the iCalendar spec both want it: UTC, no punctuation. */
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
 */
export function calendarUrl(event: Pick<EventRecord, "title" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "subtitle">): string {
  const start = event.startsAt;
  const end = event.endsAt ?? new Date(Date.parse(start) + 2 * 60 * 60 * 1000).toISOString();
  const where = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    ...(where ? { location: where } : {}),
    ...(event.subtitle ? { details: event.subtitle } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
