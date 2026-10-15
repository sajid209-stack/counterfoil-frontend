"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Location, Product } from "@/lib/api/types";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import type { CategoryId } from "@/lib/events/catalog";
import { whenInWords } from "@/lib/storefront/when";

/** The booking's "when" in words, in the reader's language ("" for an
 *  on-a-date booking, which states its own date). */
export function useWhenWords(product: Product, location: Location | undefined): string {
  const t = useTranslations("storefront");
  return useMemo(
    () => whenInWords(product, location, (k, v) => t(k as never, v as never)),
    [product, location, t],
  );
}

/** The good-to-know lines a booking's policies give: what happens when you pay,
 *  how the ticket arrives, and the cancelling and changing rules. One list for
 *  every look, so the Classic page and the themed ones state the same things. */
export function useKnowLines(product: Product): string[] {
  const t = useTranslations("storefront");
  const pol = product.policies;
  return useMemo(() => {
    const know: string[] = [t("know.instant"), t("know.sms")];
    if (pol?.cancellation === "free_until") know.push(pol.cancelHours > 0 ? t("know.freeCancel", { hours: pol.cancelHours }) : t("know.freeCancelAny"));
    else if (pol?.cancellation === "fee") know.push(t("know.feeCancel", { hours: pol.cancelHours, pct: pol.cancelFeePct }));
    else if (pol?.cancellation === "none") know.push(t("know.noCancel"));
    if (pol?.reschedule === "until" && pol.rescheduleHours > 0) know.push(t("know.reschedule", { hours: pol.rescheduleHours }));
    return know;
  }, [pol, t]);
}

/** Every string a template needs: the shared set, plus the ones the one page
 *  system added (included, good to know, the countdown's default words). */
export function usePageLabels(categoryId: CategoryId | null) {
  const base = useTemplateLabels(categoryId);
  const t = useTranslations("events");
  return useMemo(
    () => ({
      ...base,
      included: t("tpl.included"),
      know: t("tpl.know"),
      nextUp: t("tpl.nextUp"),
      startsIn: t("tpl.startsIn"),
      countingDown: t("tpl.countingDown"),
      when: t("tpl.when"),
    }),
    [base, t],
  );
}
