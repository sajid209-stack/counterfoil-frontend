"use client";

import { useFormatter } from "next-intl";
import { formatDateTime } from "@/lib/format";
import { demoNow } from "@/lib/schedule";

/**
 * How long ago something happened, in the reader's language.
 *
 * The shared formatRelative writes "4h ago" in English whatever the locale,
 * which put "সক্রিয় 4h ago" on the Bangla team list. next-intl's formatter says
 * it in the page's language; past a week the relative form stops helping
 * ("23 days ago" is not a date anyone can place), so it hands back to the date.
 */
export function useSince() {
  const format = useFormatter();
  return (iso: string): string => {
    const then = new Date(iso);
    const now = demoNow();
    const days = (now.getTime() - then.getTime()) / 86_400_000;
    return days >= 0 && days <= 7 ? format.relativeTime(then, now) : formatDateTime(iso);
  };
}
