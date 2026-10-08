"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * "Show more" for a record on a phone.
 *
 * A phone has room for the few facts a record is opened for — who, how much,
 * when, what state — and not for the nine cards behind them. The rest folds
 * under one quiet button that says so, rather than being dropped: nothing a
 * desktop shows is unreachable here, it is one press away. (Shopify's mobile
 * admin does the same with its order and customer pages.)
 *
 * The folded sections stay out of the document until opened, so a screen
 * reader is not walked through eight cards nobody asked for. The button reports
 * its state with `aria-expanded`, and returns to "Show less" at the foot of
 * what it opened.
 */
export function ShowMore({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("orders");
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && children}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-inline rounded-sm text-[0.8125rem] font-medium text-fg transition-colors duration-quick hover:bg-muted-wash",
          className,
        )}
      >
        {open ? t("showLess") : t("showMore")}
        <ChevronDown size={15} strokeWidth={1.75} aria-hidden className={cn("transition-transform duration-quick", open && "rotate-180")} />
      </button>
    </>
  );
}
