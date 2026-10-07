"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { PAGE_SIZES } from "../_lib/filters";

/**
 * Previous · Next · Page 1 of 8 · Show 20.
 *
 * `DataTable` has a pager, but it has no page size and a list that people
 * export from and read for a living wants one. This is that pager with the
 * size beside it, and the count of what is on screen out of everything that
 * matches — the number that tells somebody the filters did something.
 */
export function OrdersPager({
  page,
  size,
  total,
  loading,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  loading?: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const t = useTranslations("orders.pager");
  /* `Select` takes its height from a prop, not from a breakpoint, so the phone
     asks for the 44px one. */
  const wide = useMediaQuery(MD);
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const btn =
    "inline-flex h-11 items-center gap-inline rounded-sm border border-line px-comfortable text-[0.8125rem] font-medium text-fg transition-colors duration-quick hover:enabled:border-inverse disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60 md:h-9";
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-x-section gap-y-tight">
      <p className="text-[0.8125rem] tabular-nums text-muted" aria-live="polite">
        {loading ? "…" : t("range", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-tight">
        <div className="flex items-center gap-tight">
          <span id="orders-size-label" className="text-[0.8125rem] text-muted">{t("show")}</span>
          <Select
            aria-labelledby="orders-size-label"
            size={wide ? "sm" : "md"}
            value={String(size)}
            onChange={(v) => onSize(Number(v))}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </div>
        <button type="button" className={btn} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} strokeWidth={1.5} aria-hidden />
          {t("previous")}
        </button>
        <span className="min-w-[5.5rem] text-center text-[0.8125rem] tabular-nums text-muted">{t("page", { page, pages })}</span>
        <button type="button" className={btn} disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>
          {t("next")}
          <ChevronRight size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
