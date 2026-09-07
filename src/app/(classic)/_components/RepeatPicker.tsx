"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Occurrence } from "@/lib/recurrence";

/** Quick counts that FILL the stepper rather than limit it — the app's own
 *  rule for duration chips, applied to weeks. */
const CHIPS = [4, 8, 12];

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );

/**
 * "The next 7 Wednesdays at 6."
 *
 * The count is a stepper because the answer is a number the customer says out
 * loud, and the dates are listed because the honest answer to "can I have all
 * seven?" is usually "six of them" — and the cashier has to be able to say
 * which one is missing before taking the money, not after.
 */
export function RepeatPicker({
  count,
  onCount,
  plan,
  time,
  unitPrice,
  currency,
  max = 26,
}: {
  count: number;
  onCount: (n: number) => void;
  plan: Occurrence[];
  time?: string;
  unitPrice: number;
  currency: string;
  max?: number;
}) {
  const t = useTranslations("pos");
  const bookable = plan.filter((o) => o.ok).length;
  const blocked = plan.length - bookable;

  return (
    <div className="mb-section flex flex-col gap-tight">
      <span className="type-label text-[12px] text-muted">{t("repeat.title")}</span>

      <div className="flex flex-wrap items-center gap-tight">
        <div className="flex items-center gap-tight">
          <button
            type="button"
            aria-label={t("repeat.fewer")}
            onClick={() => onCount(Math.max(1, count - 1))}
            disabled={count <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-sm border border-line text-lg disabled:opacity-40 active:bg-ember/10"
          >
            −
          </button>
          <span className="min-w-16 text-center font-mono text-sm">
            {count === 1 ? t("repeat.once") : t("repeat.weeks", { count })}
          </span>
          <button
            type="button"
            aria-label={t("repeat.more")}
            onClick={() => onCount(Math.min(max, count + 1))}
            disabled={count >= max}
            className="flex h-12 w-12 items-center justify-center rounded-sm border border-line text-lg disabled:opacity-40 active:bg-ember/10"
          >
            +
          </button>
        </div>
        {CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onCount(n)}
            className={cn(
              "h-12 shrink-0 rounded-sm border px-comfortable text-sm transition-colors duration-quick",
              count === n ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card active:bg-ember/10",
            )}
          >
            {t("repeat.weeks", { count: n })}
          </button>
        ))}
      </div>

      {count > 1 && (
        <>
          <ul className="flex flex-col rounded-sm border border-line">
            {plan.map((o) => (
              <li
                key={o.date}
                className={cn(
                  "flex items-center gap-comfortable border-b border-line px-comfortable py-tight last:border-0",
                  !o.ok && "bg-subtle",
                )}
              >
                <span className={cn("shrink-0", o.ok ? "text-success" : "text-faint")}>
                  {o.ok ? <Check size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}
                </span>
                <span className={cn("min-w-0 flex-1 truncate font-mono text-[13px]", !o.ok && "text-faint line-through")}>
                  {dayLabel(o.date)}
                  {time ? ` · ${time}` : ""}
                </span>
                {!o.ok && (
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-muted">
                    {t(`repeat.reason_${o.reason ?? "taken"}`)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="text-[12px] text-muted">
            {blocked > 0
              ? t("repeat.summarySkipping", {
                  count: bookable,
                  skipped: blocked,
                  amount: formatMoney(unitPrice * bookable, currency),
                })
              : t("repeat.summary", { count: bookable, amount: formatMoney(unitPrice * bookable, currency) })}
          </p>
        </>
      )}
    </div>
  );
}
