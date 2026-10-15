"use client";

import { CalendarDays, Clock, MapPin, Timer, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { dayCountOf, isEventProduct, runsOverDays, spansDays } from "@/lib/api/events";
import { formatClock, formatClockRange, formatDay, formatDayRange } from "@/lib/format";
import { formatDuration } from "@/lib/duration";
import { productMinutes } from "@/lib/storefront/facts";
import type { PageCtx } from "./context";

export interface HeroFact {
  id: "date" | "time" | "where" | "length";
  icon: LucideIcon;
  text: string;
}

const HHMM = /^\d{2}:\d{2}$/;

/** The clock part of an ISO instant written in the business's offset
 *  ("2026-08-14T19:00:00+06:00" → "19:00"). Read off the string, never through
 *  `Date`, so a reader in another time zone sees the venue's clock. */
const clockOf = (iso: string | undefined): string | null => {
  const hhmm = iso?.slice(11, 16);
  return hhmm && HHMM.test(hhmm) ? hhmm : null;
};

/**
 * The facts a page states about WHEN and WHERE, in one list, for the hero and
 * nothing else to disagree with: the date (or, for a booking that repeats, its
 * "when" in words), the time, the venue and how long it lasts.
 *
 * Never a date for a booking that has none (`ev.undated`), and never a clock
 * range across two different days: a multi-day page says "Runs N days" and
 * leaves each day's hours to the programme, where they are true.
 */
export function useHeroFacts(ctx: PageCtx): HeroFact[] {
  const t = useTranslations("storefront");
  const { ev, product } = ctx;
  const out: HeroFact[] = [];

  const dated = isEventProduct(product) && !ev.undated;
  if (dated) {
    const multi = runsOverDays(ev);
    const days = multi
      ? spansDays(ev)
        ? (ev.days ?? []).map((d) => d.date)
        : [ev.startsAt.slice(0, 10), (ev.endsAt ?? ev.startsAt).slice(0, 10)]
      : [ev.startsAt.slice(0, 10)];
    const first = days[0];
    const last = days[days.length - 1];
    /* A run of days is stated as its two ends, even when the days between are not all listed. */
    out.push({ id: "date", icon: CalendarDays, text: multi && last !== first ? `${formatDay(first, { weekday: true })} – ${formatDay(last, { weekday: true })}` : formatDayRange(days, { weekday: true }) });
    if (multi) {
      out.push({ id: "time", icon: Clock, text: t("pg.shell.runsDays", { count: dayCountOf(ev) }) });
    } else {
      const start = clockOf(ev.startsAt);
      const end = clockOf(ev.endsAt);
      if (start) out.push({ id: "time", icon: Clock, text: end && end > start ? formatClockRange(start, end) : formatClock(start) });
    }
  } else if (ev.whenText) {
    out.push({ id: "date", icon: CalendarDays, text: ev.whenText });
  }

  if (ev.venueName) out.push({ id: "where", icon: MapPin, text: ev.venueName });

  const minutes = productMinutes(product);
  if (minutes) out.push({ id: "length", icon: Timer, text: formatDuration(minutes) });
  return out;
}

/** Is there a date to add to a calendar? */
export const canAddToCalendar = (ctx: PageCtx): boolean => isEventProduct(ctx.product) && !ctx.ev.undated;
