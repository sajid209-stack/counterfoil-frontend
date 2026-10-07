"use client";

import { useTranslations } from "next-intl";
import type { SalesSummary } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * The figures for whatever the filters match, as one quiet row.
 *
 * Not the StatStrip band — the owner wants cards on the Dashboard, Finances
 * and Analytics, and a list page is a list. These sit beside the search in the
 * same panel, read left to right in the order a sale is read (what it came to,
 * how many, how much was sold), and are over everything the filters match, not
 * the twenty rows on screen.
 *
 * `data-figure` and `data-amount` carry the exact value, for checks that must
 * not parse "৳1,234.50".
 */
export function SalesFigures({ summary: s, loading }: { summary: SalesSummary; loading: boolean }) {
  const t = useTranslations("orders.figures");
  /* Read left to right on a desktop in the order a sale is read. On a phone the
     two that decide something — what it came to and what is still owed — are
     the first row, and the counts sit under them smaller. */
  const items: { key: string; label: string; value: string; raw: number; tone?: "warning"; hint?: string; phone: string }[] = [
    { key: "sales", label: t("sales"), value: formatMoney(s.sales), raw: s.sales, hint: t("salesHint"), phone: "max-lg:order-1 max-lg:col-span-3" },
    { key: "orders", label: t("orders"), value: String(s.orders), raw: s.orders, phone: "max-lg:order-3 max-lg:col-span-2" },
    { key: "items", label: t("items"), value: String(s.items), raw: s.items, phone: "max-lg:order-4 max-lg:col-span-2" },
    { key: "paid", label: t("paid"), value: formatMoney(s.paid), raw: s.paid, phone: "max-lg:order-5 max-lg:col-span-2" },
    { key: "owed", label: t("owed"), value: formatMoney(s.owed), raw: s.owed, tone: s.owed > 0 ? "warning" : undefined, phone: "max-lg:order-2 max-lg:col-span-3" },
  ];
  return (
    <dl data-sales-figures aria-busy={loading || undefined} className="grid min-w-0 grid-cols-6 gap-x-section gap-y-tight max-lg:w-full lg:flex lg:items-stretch lg:gap-0">
      {items.map((i, n) => (
        <div
          key={i.key}
          title={i.hint}
          className={cn("min-w-0", i.phone, n > 0 && "lg:border-l lg:border-line lg:pl-section", n < items.length - 1 && "lg:pr-section")}
        >
          {/* Sentence case on a phone, where three counts share a row and "TRANSACTIONS" in capitals
              would run into "ITEMS SOLD"; the desktop keeps the page's small caps. */}
          <dt className="whitespace-nowrap text-[13px] font-medium text-muted">{i.label}</dt>
          <dd
            data-figure={i.key}
            data-amount={i.raw}
            className={cn(
              "mt-inline whitespace-nowrap font-semibold tabular-nums leading-tight",
              i.key === "sales" || i.key === "owed" ? "text-xl lg:text-lg" : "text-base lg:text-lg",
              i.tone === "warning" && "text-warning",
              loading && "opacity-50",
            )}
          >
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
