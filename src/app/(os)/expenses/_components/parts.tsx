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

/** An icon in a quiet disc, then its name. */
export function CategoryTag({ category, size = 28, className }: { category: ExpenseCategory; size?: number; className?: string }) {
  const label = useExpenseLabels().category(category);
  const Icon = CATEGORY_ICON[category];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-tight", className)}>
      <span aria-hidden style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-muted-wash text-muted">
        <Icon size={Math.round(size * 0.55)} strokeWidth={1.5} />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export function PaidTag({ paidFrom, counter, className }: { paidFrom: PaidFrom; counter?: string; className?: string }) {
  const label = useExpenseLabels().paidFrom(paidFrom);
  const Icon = PAID_ICON[paidFrom];
  return (
    <span className={cn("inline-flex min-w-0 items-start gap-tight", className)}>
      <Icon size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0 text-muted" />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {counter && <span className="block truncate text-[12px] text-muted">{counter}</span>}
      </span>
    </span>
  );
}
