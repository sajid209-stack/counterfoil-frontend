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
 * phone the five become a strip that scrolls sideways and snaps to each one,
 * rather than a card three rows deep: a list page should reach its list.
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
      className="no-scrollbar flex w-full min-w-0 snap-x snap-mandatory gap-x-major overflow-x-auto md:snap-none md:gap-x-0 md:overflow-visible lg:grid lg:grid-cols-5"
    >
      {items.map((i) => (
        <div key={i.key} title={i.hint} className="w-[36%] min-w-[7.5rem] shrink-0 snap-start md:w-auto md:min-w-0 md:flex-1 md:shrink">
          <dt className="whitespace-nowrap text-sm text-muted">{i.label}</dt>
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
