"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";

/**
 * "Added to basket" with the two next steps, shown after a quick add. The
 * sticky basket bar already carries the count and View basket, so this adds
 * what it cannot: the name of what was just added, and Checkout. It sits above
 * that bar, clears itself after a few seconds, and can be dismissed.
 */
export function QuickAddToast({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();

  useEffect(() => {
    const id = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(id);
    // The parent keys this component on each add, so the timer restarts then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const btn =
    "inline-flex min-h-11 items-center justify-center rounded-md px-comfortable text-base font-semibold leading-none transition-[filter] duration-quick";
  return (
    <div
      role="status"
      data-sf-toast
      className="sf-toast fixed inset-x-gutter bottom-24 z-50 rounded-lg border border-hairline bg-card p-comfortable shadow-float md:inset-x-auto md:right-major md:w-[380px]"
    >
      <div className="flex items-start gap-comfortable">
        <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember-wash text-brand-foreground">
          <Check size={14} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{t("toast.added")}</p>
          <p className="truncate text-base text-muted">{name}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("toast.dismiss")}
          className="-mr-tight -mt-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-muted-wash"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="mt-tight grid grid-cols-2 gap-tight">
        <button type="button" onClick={flow.goBasket} className={`${btn} border border-strong bg-card text-fg hover:border-fg`}>
          {t("basket.viewBasket")}
        </button>
        <button type="button" onClick={flow.goCheckout} className={`${btn} bg-ember-solid text-on-solid hover:brightness-90`}>
          {t("toast.checkout")}
        </button>
      </div>
    </div>
  );
}
