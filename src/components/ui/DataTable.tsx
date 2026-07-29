"use client";

import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  sort?: { key: string; order: "asc" | "desc" };
  onSortChange?: (key: string) => void;
  /** search input + filter controls live here; the table stays domain-agnostic */
  toolbar?: React.ReactNode;
  emptyState?: React.ReactNode;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  skeletonRows?: number;
}

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  onRowClick,
  sort,
  onSortChange,
  toolbar,
  emptyState,
  pagination,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="flex flex-col gap-section">
      {toolbar && <div>{toolbar}</div>}

      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              {columns.map((col) => {
                const activeSort = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "type-label whitespace-nowrap px-comfortable py-tight text-[11px] text-neutral-600",
                      alignClass(col.align),
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key)}
                        className="inline-flex items-center gap-inline uppercase tracking-wide hover:text-ink"
                      >
                        {col.header}
                        {activeSort ? (
                          sort?.order === "asc" ? (
                            <ChevronUp size={13} strokeWidth={1.5} />
                          ) : (
                            <ChevronDown size={13} strokeWidth={1.5} />
                          )
                        ) : (
                          <ArrowUpDown size={13} strokeWidth={1.5} className="text-neutral-400" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-neutral-200 last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-comfortable py-comfortable">
                      <div className="h-4 w-full max-w-[8rem] animate-pulse rounded-xs bg-neutral-200" />
                    </td>
                  ))}
                </tr>
              ))}

            {showEmpty && (
              <tr>
                <td colSpan={columns.length} className="px-comfortable py-hero">
                  {emptyState ?? (
                    <p className="text-center text-[13px] text-neutral-400">No results.</p>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-neutral-200 last:border-0",
                    onRowClick && "cursor-pointer transition-colors duration-quick hover:bg-neutral-50",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-comfortable py-comfortable align-middle",
                        alignClass(col.align),
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} loading={loading} />}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between">
      <p className="font-mono text-[12px] text-neutral-400">
        {loading ? "…" : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-tight">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-ink disabled:text-neutral-400 disabled:cursor-not-allowed hover:enabled:border-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="font-mono text-[12px] text-neutral-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-neutral-200 text-ink disabled:text-neutral-400 disabled:cursor-not-allowed hover:enabled:border-ink"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
