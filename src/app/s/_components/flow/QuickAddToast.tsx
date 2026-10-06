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
    "inline-flex min-h-11 items-center justify-center rounded-[12px] px-comfortable text-[14px] font-semibold leading-none transition-[filter] duration-quick";
  return (
    <div
      role="status"
      data-sf-toast
      className="sf-toast fixed inset-x-gutter bottom-[5.5rem] z-[55] rounded-[16px] border border-hairline bg-white p-comfortable shadow-[0_12px_40px_rgba(0,0,0,0.18)] md:inset-x-auto md:right-major md:w-[380px]"
    >
      <div className="flex items-start gap-comfortable">
        <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sf-soft)] text-[var(--sf-ink)]">
          <Check size={14} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{t("toast.added")}</p>
          <p className="truncate text-[14px] text-muted">{name}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("toast.dismiss")}
          className="-mr-tight -mt-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="mt-tight grid grid-cols-2 gap-tight">
        <button type="button" onClick={flow.goBasket} className={`${btn} border border-strong bg-white text-fg hover:border-fg`}>
          {t("basket.viewBasket")}
        </button>
        <button type="button" onClick={flow.goCheckout} className={`${btn} bg-[var(--sf-fill)] text-[var(--sf-on-fill)] hover:brightness-90`}>
          {t("toast.checkout")}
        </button>
      </div>
    </div>
  );
}
