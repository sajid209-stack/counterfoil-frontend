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
  /** A purpose-built phone card for this table's row. The generic one
   *  below reads every column as a LABEL/value pair and wraps them, which
   *  is fine for a settings list and poor for anything with a natural
   *  shape — an order wants its reference, who it was for, when, and how
   *  much, in that order and not as five labelled pairs. Opt-in: pages
   *  that do not supply one keep the generic layout. */
  renderCard?: (row: T) => React.ReactNode;
  /** Below this the table scrolls sideways instead of squeezing its
   *  columns. Opt-in, because a three-column table has nothing to gain
   *  from it — but a seven-column one squeezed to 766px wraps a reference
   *  mid-identifier and clips the last column off the edge. The wrapper
   *  already carries `overflow-auto` and the scroll-shadow affordance;
   *  this is what finally uses them. */
  minWidth?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  skeletonRows?: number;
}

/** Deterministic block width for a loading cell — see the note at the call site. */
function skeletonWidth<T>(col: Column<T>, colIndex: number, rowIndex: number): string {
  if (col.align === "right") return `${56 + ((rowIndex * 7 + colIndex * 3) % 4) * 8}px`;
  if (colIndex === 0) return `${96 + ((rowIndex * 5) % 3) * 12}px`;
  return `${52 + ((rowIndex * 11 + colIndex * 17) % 5) * 9}%`;
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
  renderCard,
  minWidth,
  pagination,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="flex flex-col gap-section">
      {toolbar && <div>{toolbar}</div>}

      {/* Mobile (<768px): rows become tappable cards — primary line + labelled meta. */}
      <div className="flex flex-col gap-tight md:hidden">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`csk-${i}`} className="flex animate-pulse flex-col gap-tight card-surface p-comfortable">
              <div className="h-4 w-2/3 rounded-xs bg-line" />
              <div className="h-3 w-1/2 rounded-xs bg-line" />
            </div>
          ))}
        {showEmpty && (emptyState ?? <p className="py-section text-center text-[13px] text-muted">No results.</p>)}
        {!loading &&
          rows.map((row) => (
            <div
              key={`c-${getRowId(row)}`}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              className={cn("card-surface p-comfortable transition-transform duration-quick", onRowClick && "cursor-pointer active:bg-subtle hover:-translate-y-0.5")}
            >
              {renderCard ? (
                renderCard(row)
              ) : (
                <>
              <div className="break-words text-sm font-medium">
                {columns[0].render ? columns[0].render(row) : String((row as Record<string, unknown>)[columns[0].key] ?? "")}
              </div>
              <dl className="mt-inline flex flex-wrap gap-x-section gap-y-inline">
                {columns.slice(1).map((col) => (
                  // A card holds whatever a column holds, including strings
                  // with nothing to break on — an e-mail address or a booking
                  // reference. Without min-w-0 the pair refuses to shrink and
                  // pushes past the card, where main's overflow-x-hidden eats
                  // it silently: the value is on screen but unreadable, and
                  // nothing says so.
                  <div key={col.key} className="flex min-w-0 max-w-full items-baseline gap-inline">
                    <dt className="type-label shrink-0 text-[12px] uppercase text-muted">{col.header}</dt>
                    <dd className={cn("min-w-0 break-words text-[13px]", col.align === "right" && "font-mono tabular-nums")}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </dd>
                  </div>
                ))}
              </dl>
                </>
              )}
            </div>
          ))}
      </div>

      {/* Solid, not `card-surface`. That class is deliberately translucent —
          72% card over the warm page — which is right for a card floating on
          the ground and wrong for a dense grid of text: the body read as warm
          off-white while the sticky `thead`, which sets `bg-card`, read as
          white, so the header and its own rows did not match. */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-md border border-line bg-card scroll-x-hint md:block">
        <table className="w-full border-collapse text-sm" style={minWidth ? { minWidth } : undefined}>
                  {/* `line`, not `neutral-200`: the raw primitive is a palette entry
            that is never redefined for dark, so this rule painted a light
            #e2ded5 hairline across the top of every dark table. */}
        <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--color-line)]">
            <tr>
              {columns.map((col) => {
                const activeSort = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "type-label whitespace-nowrap px-comfortable py-tight text-[12px] text-muted",
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
                          <ArrowUpDown size={13} strokeWidth={1.5} className="text-muted" />
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
                  {columns.map((col, c) => (
                    <td key={col.key} className={cn("px-comfortable py-comfortable", alignClass(col.align))}>
                      {/* Every column used to get the same 8rem block, so the
                          skeleton reflowed the moment data landed — which is
                          worse than no skeleton, because the page jumps twice.
                          Widths now follow the column's own role: a
                          right-aligned column is money and sits right at a
                          money's width, the first column is the identifier,
                          the rest are prose. Varied per row from the indices
                          so the block reads as content rather than as a
                          progress bar, and deterministically so it does not
                          reshuffle on every render. */}
                      <div
                        className={cn(
                          "h-4 animate-pulse rounded-xs bg-line",
                          col.align === "right" ? "ml-auto" : "",
                        )}
                        style={{ width: skeletonWidth(col, c, i) }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {showEmpty && (
              <tr>
                <td colSpan={columns.length} className="px-comfortable py-hero">
                  {emptyState ?? (
                    <p className="text-center text-[13px] text-muted">No results.</p>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  /* A clickable row that only listens for clicks is unreachable
                     without a pointer. The phone card below has always been
                     focusable and key-operable; the desktop row never was, on
                     every table in the app. `tr` is kept as a `tr` rather than
                     given a button role, so screen-reader table navigation
                     still works — it just becomes a stop on the tab order with
                     a focus ring of its own. */
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "h-12 border-b border-line last:border-0",
                    onRowClick &&
                      // The ring itself comes from the app's one unlayered :focus-visible
                      // rule, which already paints ember at 2px. Utilities here only
                      // fought it: `outline-[var(--color-ember)]` is ambiguous to
                      // Tailwind, which cannot tell a colour from a width, so it
                      // emitted the wrong property and the row fell back to the
                      // browser default.
                      "cursor-pointer transition-colors duration-quick hover:bg-subtle focus-visible:bg-subtle",
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
      <p className="font-mono text-[12px] text-muted">
        {loading ? "…" : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-tight">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
          className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-inverse"
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
          className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-inverse"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
