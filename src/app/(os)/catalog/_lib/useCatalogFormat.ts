"use client";

import { useTranslations } from "next-intl";

/**
 * Durations and day names in the reader's language.
 *
 * `formatDuration` in lib/duration writes "1 hr 30 min" in English whatever the
 * page's language, which put English units in the middle of Bangla sentences
 * ("স্লট শুরুর 15 min আগে"). The help lines in the catalogue editors say what a
 * value means right now, so the value inside them has to be in the same
 * language as the sentence around it.
 */
export function useCatalogFormat() {
  const t = useTranslations("catalog");
  const dur = (minutes: number): string => {
    const total = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return t("dur.min", { m });
    if (m === 0) return t("dur.hr", { h });
    return t("dur.hrMin", { h, m });
  };
  const dayShort = (d: number) => t(`day.short.${d}`);
  const dayLong = (d: number) => t(`day.long.${d}`);
  return { dur, dayShort, dayLong };
}
