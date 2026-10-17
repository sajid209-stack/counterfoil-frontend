"use client";

import { useTranslations } from "next-intl";
import type { SalesSummary } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * The figures for whatever the filters match, as one quiet row.
 *
 * Not the StatStrip band — the owner wants cards on the Dashboard, Finances
 * and Analytics, and a list page is a list. These sit above the table in one
 * soft card, read left to right in the order a sale is read (what it came to,
 * what is still owed, how many, how much was sold, what was paid), and are over
 * everything the filters match, not the twenty rows on screen.
 *
 * The figure is the band's role (`type-figure` semibold, 24px from xl, where the
 * five cells have room; 18px below, where five money figures in one row would
 * otherwise be clipped).
 *
 * Calm, in the Shopify admin way: a small sentence-case label over a figure,
 * no rules between them — the gap does that work — and the one figure that
 * needs somebody to act, what is still owed, is the only one in colour. On a
 * phone the five are one card of two-across cells divided by hairlines, with
 * the odd last one spanning both: every figure on screen, none behind a
 * sideways scroll, none cut mid-word ("Transa…" reads as a fault). Three rows
 * of 18px figures is ~190px, and a list page still reaches its list. The card's
 * own padding is the section's from md up; below it the cells carry theirs.
 *
 * `data-figure` and `data-amount` carry the exact value, for checks that must
 * not parse "৳1,234.50".
 */
export function SalesFigures({ summary: s, loading }: { summary: SalesSummary; loading: boolean }) {
  const t = useTranslations("orders.figures");
  const items: { key: string; label: string; value: string; raw: number; tone?: "warning"; hint?: string }[] = [
    { key: "sales", label: t("sales"), value: formatMoney(s.sales), raw: s.sales, hint: t("salesHint") },
    { key: "owed", label: t("owed"), value: formatMoney(s.owed), raw: s.owed, tone: s.owed > 0 ? "warning" : undefined },
    { key: "orders", label: t("orders"), value: String(s.orders), raw: s.orders },
    { key: "items", label: t("items"), value: String(s.items), raw: s.items },
    { key: "paid", label: t("paid"), value: formatMoney(s.paid), raw: s.paid },
  ];
  return (
    <dl
      data-sales-figures
      aria-busy={loading || undefined}
      className="grid w-full min-w-0 grid-cols-[repeat(2,minmax(min-content,1fr))] gap-px bg-hairline md:flex md:gap-x-0 md:bg-transparent lg:grid lg:grid-cols-5"
    >
      {items.map((i) => (
        <div key={i.key} title={i.hint} className="min-w-0 bg-card px-comfortable py-comfortable max-md:last:odd:col-span-2 md:flex-1 md:bg-transparent md:p-0">
          <dt className="text-xs text-muted md:whitespace-nowrap md:text-sm">{i.label}</dt>
          <dd
            data-figure={i.key}
            data-amount={i.raw}
            className={cn(
              "type-figure mt-inline whitespace-nowrap text-lg font-semibold leading-tight xl:text-2xl",
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
