"use client";

import { useTranslations } from "next-intl";
import { Banknote, Building2, CreditCard, Landmark, Megaphone, Package, Shapes, Smartphone, Truck, UtensilsCrossed, Users, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { ExpenseCategory, PaidFrom } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { cn } from "@/lib/cn";

/** One glyph per category, so a row can be read by its icon before its word —
 *  and never by colour alone: every icon sits beside its name. */
export const CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  supplies: Package,
  utilities: Zap,
  wages: Users,
  maintenance: Wrench,
  marketing: Megaphone,
  rent: Building2,
  transport: Truck,
  food: UtensilsCrossed,
  other: Shapes,
};

export const PAID_ICON: Record<PaidFrom, LucideIcon> = {
  cash_drawer: Banknote,
  bank: Landmark,
  bkash: Smartphone,
  card: CreditCard,
};

/** The words for the two lists, in the language on screen. */
export function useExpenseLabels() {
  const t = useTranslations("expenses");
  return {
    category: (c: ExpenseCategory) => t(`category.${c}`),
    paidFrom: (p: PaidFrom) => t(`paid.${p}`),
  };
}

/** "29 Jul", with the year once it is not this year's. */
export const shortDate = (iso: string): string => (iso.slice(0, 4) === DEMO_TODAY.slice(0, 4) ? formatDay(iso) : `${formatDay(iso)} ${iso.slice(0, 4)}`);

/** A small icon, then its name: the category, the way a row of the table says it. */
export function CategoryTag({ category, className }: { category: ExpenseCategory; className?: string }) {
  const label = useExpenseLabels().category(category);
  const Icon = CATEGORY_ICON[category];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-tight", className)}>
      <Icon size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

/** How it was paid, with the counter underneath when it came out of a cash drawer. */
export function PaidTag({ paidFrom, counter, className }: { paidFrom: PaidFrom; counter?: string; className?: string }) {
  const label = useExpenseLabels().paidFrom(paidFrom);
  return (
    <span className={cn("block min-w-0", className)}>
      <span className="block truncate">{label}</span>
      {counter && <span className="block truncate text-[12px] text-muted">{counter}</span>}
    </span>
  );
}
