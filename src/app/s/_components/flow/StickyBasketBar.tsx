"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { WRAP } from "../Chrome";
import { sfBtn } from "../sf";

/**
 * "2 items · ৳1,150 · View basket": the one thing that follows a guest around
 * the venue page once there is something to buy. The header carries the basket
 * count everywhere; this bar says what it adds up to and offers the next step.
 *
 * A spacer sits in the page flow so the bar never covers the footer.
 */
export function StickyBasketBar() {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  if (flow.itemCount === 0) return null;

  return (
    <>
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className={cn(WRAP, "flex items-center justify-between gap-section py-comfortable")}>
          <p className="tnum min-w-0 truncate text-[16px] font-semibold">
            {t("basket.itemCount", { count: flow.itemCount })} · {formatMoney(flow.totals.total)}
          </p>
          <button type="button" onClick={flow.goBasket} className={cn(sfBtn.primary, "shrink-0")}>
            {t("basket.viewBasket")}
          </button>
        </div>
      </div>
    </>
  );
}
