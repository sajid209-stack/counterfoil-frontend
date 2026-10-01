"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";

/**
 * "2 items · ৳1,150 · View basket" — the one thing that follows a guest
 * around the venue and booking pages once there is something to buy.
 *
 * Fixed at the bottom at every width rather than only on a phone: the
 * storefront's header carries only the venue's name and a back link, so this
 * is the one persistent way into the basket the whole site has.
 */
export function StickyBasketBar() {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  if (flow.itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ember-solid text-white shadow-[0_-8px_24px_rgba(0,0,0,0.16)]">
      <button
        type="button"
        onClick={flow.goBasket}
        className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-tight px-gutter py-tight text-left"
      >
        <span className="flex min-w-0 items-center gap-tight">
          <ShoppingBag size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate text-[14px] font-medium">
            {t("basket.itemCount", { count: flow.itemCount })} · {formatMoney(flow.totals.total)}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold underline-offset-4">{t("basket.viewBasket")}</span>
      </button>
    </div>
  );
}
