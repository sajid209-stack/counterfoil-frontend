"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { categoryById, type CategoryId } from "./catalog";

/**
 * Every string a template needs, in one place.
 *
 * The wizard preview and the published page both draw the same component, so
 * they both have to hand it the same labels. That was two copies of a growing
 * object literal, which is two places for one word to drift — and the moment
 * the templates grew a stats band and a receipt panel it became fourteen more
 * strings to keep in step. One hook, called from both.
 *
 * The bill's heading is the one label that changes with the category: a
 * concert has a lineup, a tournament has fixtures, a conference has speakers.
 */
export function useTemplateLabels(categoryId: CategoryId | null) {
  const t = useTranslations("events");
  return useMemo(
    () => ({
      lineup: categoryId ? t(`section.${categoryById(categoryId).lineupKey}`) : t("section.lineup"),
      schedule: t("section.schedule"),
      about: t("section.about"),
      tickets: t("section.tickets"),
      venue: t("section.venue"),
      faq: t("section.faq"),
      gallery: t("section.gallery"),
      highlights: t("section.highlights"),
      stats: t("section.stats"),
      soldOut: t("soldOut"),
      free: t("free"),
      from: t("from"),
      getTickets: t("getTickets"),
      addToCalendar: t("addToCalendar"),
      doorsOpen: t("doorsOpen"),
      countdownDays: t("countdown.days"),
      countdownHours: t("countdown.hours"),
      countdownMins: t("countdown.mins"),
      orderSummary: t("tpl.orderSummary"),
      orderHint: t("tpl.orderHint"),
      total: t("tpl.total"),
      selectTickets: t("tpl.selectTickets"),
      checkoutTrust: t("tpl.checkoutTrust"),
      sellingFast: t("tpl.sellingFast"),
      almostGone: t("tpl.almostGone"),
      soldOutBadge: t("tpl.soldOutBadge"),
      // Kept as a raw ICU-free string with a {count} the template fills: it is
      // rendered inside an inline style tree, not JSX, so there is no element
      // to interpolate into.
      remaining: t("tpl.remaining", { count: "{count}" }),
    }),
    [t, categoryId],
  );
}
