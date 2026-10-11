"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select } from "./Select";
import { cn } from "@/lib/cn";

/**
 * Pagination — the one pager.
 *
 * Left: the range on screen ("1–20 of 156"). Right: an optional page-size
 * select, previous / next, and "Page 2 of 8" between them. The icon buttons are
 * 44px on touch and 36px from md; disabled at the ends and while `loading`.
 *
 * Pass `pageSizeOptions` and `onPageSizeChange` together to offer a page-size
 * choice; leave them out for a fixed page size (DataTable's behaviour).
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    "flex h-11 w-11 items-center justify-center rounded-control border border-line text-fg transition-colors duration-quick enabled:hover:border-strong enabled:hover:bg-muted-wash disabled:cursor-not-allowed disabled:text-faint md:h-9 md:w-9";

  return (
    <nav
      aria-label={t("ui.pagination")}
      className={cn("flex flex-wrap items-center justify-between gap-tight", className)}
    >
      <p className="text-sm tabular-nums text-muted" aria-live="polite">
        {loading ? "…" : t("ui.range", { from, to, total })}
      </p>
      <div className="flex items-center gap-tight">
        {pageSizeOptions && onPageSizeChange && (
          <Select
            size="sm"
            align="end"
            aria-label={t("ui.rowsPerPage")}
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
            disabled={loading}
            className="w-20"
          />
        )}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label={t("previousPage")}
          className={btn}
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted">
          {t("ui.pageOf", { page, total: totalPages })}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label={t("nextPage")}
          className={btn}
        >
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/** Alias: some call sites (and the spec) say "Pager". */
export { Pagination as Pager };
