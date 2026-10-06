"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Location } from "@/lib/api/types";
import { formatClock } from "@/lib/format";
import { openStatus } from "@/lib/storefront/hours";

/** Monday first, the way the rest of the app reads a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** The venue's status line and a weekday namer, in the reader's language. */
export function useVenueHours(location: Location, now: Date) {
  const t = useTranslations("storefront");
  const locale = useLocale();
  /* In the reader's language: a Bangla page listing "Monday, Tuesday…" was the
     one block of English left on it. 2026-07-05 is a Sunday. */
  const dayName = (d: number) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long" }).format(new Date(2026, 6, 5 + d));

  const status = openStatus(location.openingHours, now);
  const text =
    status.kind === "open"
      ? t("status.open", { time: formatClock(status.until) })
      : status.kind === "later"
        ? t("status.opensLater", { time: formatClock(status.at) })
        : status.kind === "next"
          ? status.dayOffset === 1
            ? t("status.opensTomorrow", { time: formatClock(status.at) })
            : t("status.opensDay", { day: dayName(status.dayOfWeek), time: formatClock(status.at) })
          : t("closedToday");
  return { status, text, isOpen: status.kind === "open", dayName };
}
