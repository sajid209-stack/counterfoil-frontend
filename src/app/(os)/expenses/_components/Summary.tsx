"use client";

import { useTranslations } from "next-intl";
import type { ExpenseSummary } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { CATEGORY_ICON, useExpenseLabels } from "./parts";

/** A share, with one decimal while it is under 10% so 0.3% never reads "0%". */
const percent = (part: number, whole: number): string => {
  if (whole <= 0) return "0%";
  const p = (part / whole) * 100;
  return `${p < 10 ? Math.round(p * 10) / 10 : Math.round(p)}%`;
};

/**
 * What the dates and filters add up to, as one line of figures on the page
 * itself — no cards. The total, how many expenses, and where the money went:
 * the four biggest categories, each with a thin bar for its share.
 *
 * It is the same query as the table's, over every page, so it always equals the
 * rows in the table added together.
 */
export function Summary({ summary, loading, periodLabel }: { summary: ExpenseSummary | undefined; loading: boolean; periodLabel: string }) {
  const t = useTranslations("expenses");
  const labels = useExpenseLabels();
  const top = summary?.byCategory.slice(0, 4) ?? [];

  return (
    <section aria-label={t("summary.label")} aria-busy={loading} className={cn("flex flex-col gap-section py-tight transition-opacity xl:flex-row xl:items-start xl:gap-major", loading && summary && "opacity-60")}>
      <div className="flex gap-major xl:contents">
        <dl className="min-w-0 md:w-52 md:shrink-0">
          <dt className="text-[12px] font-medium text-muted">{t("summary.total")}</dt>
          <dd className="mt-inline text-[26px] font-semibold leading-tight tracking-[-0.025em] tabular-nums">{summary ? formatMoney(summary.total) : <Bar className="h-7 w-32" />}</dd>
          <dd className="mt-inline text-[12px] text-muted">{periodLabel}</dd>
        </dl>
        <dl className="min-w-0 md:w-32 md:shrink-0 md:border-l md:border-hairline md:pl-major">
          <dt className="text-[12px] font-medium text-muted">{t("summary.count")}</dt>
          <dd className="mt-inline text-[26px] font-semibold leading-tight tracking-[-0.025em] tabular-nums">{summary ? summary.count : <Bar className="h-7 w-10" />}</dd>
          <dd className="mt-inline text-[12px] text-muted">{summary ? (summary.items > 0 ? t("summary.items", { count: summary.items }) : t("summary.noItems")) : " "}</dd>
        </dl>
      </div>

      <div className="min-w-0 flex-1 xl:border-l xl:border-hairline xl:pl-major">
        <p className="text-[12px] font-medium text-muted">{t("summary.biggest")}</p>
        {summary && top.length === 0 ? (
          <p className="mt-tight text-[13px] text-muted">{t("summary.none")}</p>
        ) : (
          <ul className="mt-tight grid grid-cols-2 gap-x-section gap-y-comfortable sm:grid-cols-4">
            {(summary ? top : [0, 1, 2, 3].map(() => null)).map((c, i) => {
              if (!c || !summary) return <li key={i}><Bar className="h-10 w-full" /></li>;
              const Icon = CATEGORY_ICON[c.category];
              const share = summary.total > 0 ? (c.total / summary.total) * 100 : 0;
              return (
                <li key={c.category} className="min-w-0">
                  <div className="flex items-center justify-between gap-tight text-[13px]">
                    <span className={cn("flex min-w-0 items-center gap-inline", i === 0 ? "font-semibold text-fg" : "text-fg")}>
                      <Icon size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                      <span className="truncate">{labels.category(c.category)}</span>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted">{percent(c.total, summary.total)}</span>
                  </div>
                  <p className={cn("mt-inline text-[13px] tabular-nums", i === 0 ? "font-semibold" : "")}>{formatMoney(c.total)}</p>
                  <div role="img" aria-label={t("summary.share", { percent: percent(c.total, summary.total), category: labels.category(c.category) })} className="mt-tight h-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-ember-solid" style={{ width: `${Math.max(3, Math.min(100, share))}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-sm bg-line/60", className)} />;
}
