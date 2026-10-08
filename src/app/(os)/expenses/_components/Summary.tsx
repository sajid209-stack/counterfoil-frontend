"use client";

import { useTranslations } from "next-intl";
import type { ExpenseCategory, ExpenseSummary } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { useExpenseLabels } from "./parts";

/** How many categories get a colour of their own; everything after that is one
 *  neutral "other categories" slice. The palette has four hues, in a fixed
 *  order, validated as a set (see `--chart-cat-*` in globals.css). A phone
 *  shows three: it is a glance, and "other" stands for the rest. */
const SERIES = 4;
const SERIES_PHONE = 3;

/** Written out whole, not built from the index: Tailwind only emits a theme
 *  variable it can find in the source, and `var(--chart-cat-${i})` finds none. */
const SERIES_COLORS = ["var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)", "var(--chart-cat-4)"];
const OTHER_COLOR = "var(--chart-cat-other)";

interface Slice {
  key: string;
  /** Absent on the "other categories" slice, which stands for several. */
  category?: ExpenseCategory;
  total: number;
  /** Whole percent, worked out so the slices add up to exactly 100. */
  percent: number;
  /** Under half a percent: shown as "<1%" rather than a "0%" that reads as nothing. */
  tiny: boolean;
  color: string;
}

/**
 * The biggest four categories, then everything else as one slice, with each
 * share rounded by largest remainder so the figures beside the bar add up to
 * 100 and not to 99 or 101.
 */
function slicesOf(summary: ExpenseSummary, series: number): Slice[] {
  const top = summary.byCategory.slice(0, series);
  const rest = summary.byCategory.slice(series);
  const parts: Omit<Slice, "percent" | "tiny">[] = top.map((c, i) => ({ key: c.category, category: c.category, total: c.total, color: SERIES_COLORS[i] }));
  if (rest.length > 0) parts.push({ key: "other", total: rest.reduce((n, c) => n + c.total, 0), color: OTHER_COLOR });

  const whole = parts.reduce((n, p) => n + p.total, 0);
  const raw = parts.map((p) => (whole > 0 ? (p.total / whole) * 100 : 0));
  const floor = raw.map((r) => Math.floor(r));
  let left = 100 - floor.reduce((n, f) => n + f, 0);
  [...raw.keys()]
    .sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])))
    .forEach((i) => {
      if (left > 0) {
        floor[i] += 1;
        left -= 1;
      }
    });
  return parts.map((p, i) => ({ ...p, percent: floor[i], tiny: raw[i] < 0.5 }));
}

/**
 * Where the money went, as one card.
 *
 * The total and what it covers on the left; on the right one 100% bar split
 * into the four biggest categories and "other categories", and under it a
 * legend that repeats every segment as a row — swatch, icon, name, amount,
 * share. A colour is never the only way to tell a segment apart: each has its
 * own row with its name and its figure, the bar carries a description that
 * lists them all, and no text is set in a series colour.
 *
 * It is the same query as the table's, over every page, so it always equals the
 * rows in the table added together. A legend row narrows the table to that
 * category (and a second press clears it); "other categories" stands for
 * several, so it does not.
 */
export function Summary({
  summary,
  loading,
  periodLabel,
  selected,
  onSelect,
}: {
  summary: ExpenseSummary | undefined;
  loading: boolean;
  periodLabel: string;
  selected: ExpenseCategory[];
  onSelect: (category: ExpenseCategory) => void;
}) {
  const t = useTranslations("expenses");
  const labels = useExpenseLabels();
  const wide = useMediaQuery(MD);
  const slices = summary ? slicesOf(summary, wide ? SERIES : SERIES_PHONE) : [];
  const empty = !!summary && (summary.count === 0 || summary.total <= 0);
  const nameOf = (s: Slice) => (s.category ? labels.category(s.category) : t("summary.other"));
  const pctOf = (s: Slice) => (s.tiny ? t("summary.tiny") : `${s.percent}%`);

  return (
    <section aria-label={t("summary.label")} aria-busy={loading} className={cn("card-surface p-card transition-opacity", loading && summary && "opacity-60")}>
      <div className="grid gap-section lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-major">
        {/* Left: the figure and what it covers. */}
        <dl className="min-w-0">
          <dt className="text-[12px] font-medium text-muted">{t("summary.total")}</dt>
          {summary ? (
            <>
              <dd className="mt-inline text-[28px] font-semibold leading-tight tracking-[-0.025em] tabular-nums">{formatMoney(summary.total)}</dd>
              <dd className="mt-inline text-[12px] text-muted">{t("summary.context", { count: summary.count, period: periodLabel })}</dd>
            </>
          ) : (
            <>
              <dd className="mt-inline"><Bar className="h-7 w-36 rounded-sm" /></dd>
              <dd className="mt-inline"><Bar className="h-3 w-44 rounded-sm" /></dd>
            </>
          )}
        </dl>

        {/* Right: where it went. */}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted">{t("summary.whereWent")}</p>
          {!summary ? (
            <div className="mt-tight">
              <span role="status" className="sr-only">{t("loading")}</span>
              <Bar className="h-2.5 w-full rounded-full" />
              {/* Rows the height of the real ones, so the card does not jump when the answer lands. */}
              <div className="-mx-tight mt-comfortable grid gap-x-major gap-y-inline sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex min-h-[44px] items-center px-tight sm:min-h-9">
                    <Bar className="h-4 w-full rounded-sm" />
                  </div>
                ))}
              </div>
            </div>
          ) : empty ? (
            <p className="mt-tight text-[13px] text-muted">{t("summary.none")}</p>
          ) : (
            <>
              <div
                role="img"
                aria-label={t("summary.barLabel", { total: formatMoney(summary.total), parts: slices.map((s) => `${nameOf(s)} ${formatMoney(s.total)} (${pctOf(s)})`).join(", ") })}
                className="mt-tight flex h-2.5 w-full gap-[2px]"
              >
                {slices.map((s, i) => (
                  <span
                    key={s.key}
                    style={{ flexGrow: s.total, flexShrink: 1, flexBasis: 0, minWidth: 4, backgroundColor: s.color }}
                    className={cn("block h-full rounded-xs", i === 0 && "rounded-l-full", i === slices.length - 1 && "rounded-r-full")}
                  />
                ))}
              </div>
              <ul className="-mx-tight mt-comfortable grid gap-x-major gap-y-inline sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {slices.map((s) => {
                  const row = "grid min-h-[44px] w-full grid-cols-[10px_minmax(0,1fr)_auto_3rem] items-center gap-x-tight rounded-sm px-tight text-left sm:min-h-9";
                  const cells = (
                    <>
                      <span aria-hidden style={{ backgroundColor: s.color }} className="h-2.5 w-2.5 rounded-[3px]" />
                      <span className="min-w-0 truncate text-[13px]">{nameOf(s)}</span>
                      <span className="whitespace-nowrap text-right text-[13px] font-medium tabular-nums">{formatMoney(s.total)}</span>
                      <span className="text-right text-[12px] tabular-nums text-muted">{pctOf(s)}</span>
                    </>
                  );
                  const only = s.category !== undefined && selected.length === 1 && selected[0] === s.category;
                  return (
                    <li key={s.key} className="min-w-0">
                      {s.category ? (
                        <button
                          type="button"
                          aria-pressed={only}
                          title={only ? t("summary.clearFilter") : t("summary.filterBy", { category: nameOf(s) })}
                          onClick={() => onSelect(s.category as ExpenseCategory)}
                          className={cn(row, "transition-colors duration-quick hover:bg-muted-wash", only && "bg-muted-wash")}
                        >
                          {cells}
                        </button>
                      ) : (
                        /* "Other categories" stands for several and does nothing
                           when pressed, so it is not a 44px target. */
                        <div className="grid min-h-[44px] w-full grid-cols-[10px_minmax(0,1fr)_auto_3rem] items-center gap-x-tight px-tight sm:min-h-9">{cells}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse bg-line/60", className)} />;
}
