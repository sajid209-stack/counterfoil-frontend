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

      {/* Mobile: rows become tappable cards — primary line + labelled meta. */}
      <div className="flex flex-col gap-tight sm:hidden">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`csk-${i}`} className="flex animate-pulse flex-col gap-tight rounded-md border border-line bg-card p-comfortable">
              <div className="h-4 w-2/3 rounded-xs bg-line" />
              <div className="h-3 w-1/2 rounded-xs bg-line" />
            </div>
          ))}
        {showEmpty && (emptyState ?? <p className="py-section text-center text-[13px] text-faint">No results.</p>)}
        {!loading &&
          rows.map((row) => (
            <div
              key={`c-${getRowId(row)}`}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              className={cn("rounded-md border border-line bg-card p-comfortable transition-transform duration-quick", onRowClick && "cursor-pointer active:bg-subtle hover:-translate-y-0.5")}
            >
              <div className="text-sm font-medium">
                {columns[0].render ? columns[0].render(row) : String((row as Record<string, unknown>)[columns[0].key] ?? "")}
              </div>
              <dl className="mt-inline flex flex-wrap gap-x-section gap-y-inline">
                {columns.slice(1).map((col) => (
                  <div key={col.key} className="flex items-baseline gap-inline">
                    <dt className="type-label text-[10px] uppercase text-faint">{col.header}</dt>
                    <dd className={cn("text-[13px]", col.align === "right" && "font-mono tabular-nums")}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
      </div>

      <div className="hidden max-h-[70vh] overflow-auto rounded-md border border-line bg-card shadow-sm sm:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--color-neutral-200)]">
            <tr>
              {columns.map((col) => {
                const activeSort = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "type-label whitespace-nowrap px-comfortable py-tight text-[11px] text-muted",
                      alignClass(col.align),
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key)}
                        className="inline-flex items-center gap-inline uppercase tracking-wide hover:text-fg"
                      >
                        {col.header}
                        {activeSort ? (
                          sort?.order === "asc" ? (
                            <ChevronUp size={13} strokeWidth={1.5} />
                          ) : (
                            <ChevronDown size={13} strokeWidth={1.5} />
                          )
                        ) : (
                          <ArrowUpDown size={13} strokeWidth={1.5} className="text-faint" />
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
                <tr key={`sk-${i}`} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-comfortable py-comfortable">
                      <div className="h-4 w-full max-w-[8rem] animate-pulse rounded-xs bg-line" />
                    </td>
                  ))}
                </tr>
              ))}

            {showEmpty && (
              <tr>
                <td colSpan={columns.length} className="px-comfortable py-hero">
                  {emptyState ?? (
                    <p className="text-center text-[13px] text-faint">No results.</p>
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
                    "h-12 border-b border-line last:border-0",
                    onRowClick && "cursor-pointer transition-colors duration-quick hover:bg-subtle",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-comfortable py-tight align-middle",
                        alignClass(col.align),
                        col.align === "right" && "font-mono tabular-nums",
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
      <p className="font-mono text-[12px] text-faint">
        {loading ? "…" : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-tight">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-inverse"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="font-mono text-[12px] text-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-inverse"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
