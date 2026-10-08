"use client";

import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";

export interface Column<T> {
  key: string;
  /** Usually a word. A node where the header IS a control — a select-all box. */
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** Figures are Inter with tabular numerals. DM Mono is for identifiers
   *  (references, codes), so a column asks for it with `mono: true`. (It used
   *  to be the default for every right-aligned column, which put money in the
   *  typewriter face on every table that had not opted out.) */
  mono?: boolean;
  width?: string;
  className?: string;
  /** `hide` leaves this column out of the generic phone row. A phone row is
   *  two lines — who it is, and the few facts worth a glance — so a column
   *  that is only useful beside seven others can opt out. Ignored by a table
   *  that supplies its own `renderCard`. */
  phone?: "hide";
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
  /**
   * How the rows read below md.
   *
   * `cards` (the default) is a stack of separate cards — right for a record
   * with a picture and a few facts, and what fifteen tables in this app draw.
   *
   * `list` is one card of hairline-separated rows. A stack of cards spends
   * 16px of gap plus 32px of padding on every row before a word of content,
   * which measured 142px an order and 141px a customer at 390px — five rows to
   * a screen, on the two lists somebody scrolls most. A list is the shape a
   * phone reads a long index in, and it is what the owner asked for: "less
   * info, like a table".
   */
  cardVariant?: "cards" | "list";
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
  /** Rows ticked for a bulk action. A selected row that looks exactly like
   *  the rest leaves the checkbox as the only record of what is about to be
   *  acted on — which is fine until the list is longer than a screen. */
  isSelected?: (row: T) => boolean;
  /** `fixed` sizes columns from their declared widths and lets the rest take
   *  what is left, so one long name cannot push the last column off the edge.
   *  Opt-in: tables that never declared widths keep sizing to their content. */
  layout?: "auto" | "fixed";
  /** `page` lets the table run the full length of the page, which then does
   *  the only vertical scrolling; the default keeps it in a 70vh box with its
   *  own scroll and a pinned header. A long list in a box inside a scrolling
   *  page is two scrollbars and a trapped mouse wheel. */
  height?: "box" | "page";
  /** Draw `toolbar` as the top row of the table's own card from md up — one
   *  object holding the search, the filters and the rows, the way a mature
   *  admin lays out an index. Below md the toolbar stays above the list, where
   *  a phone wants it. Opt-in: a toolbar that is not asked into the card keeps
   *  sitting above it. */
  toolbarInCard?: boolean;
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
  cardVariant = "cards",
  minWidth,
  pagination,
  skeletonRows = 6,
  isSelected,
  layout = "auto",
  height = "box",
  toolbarInCard = false,
}: DataTableProps<T>) {
  const tc = useTranslations("common");
  const showEmpty = !loading && rows.length === 0;
  const list = cardVariant === "list";
  /* Which side draws the toolbar — decided, not hidden with CSS, so the page
     never carries a second invisible copy of its search box. */
  const wide = useMediaQuery(MD);
  const inCard = toolbarInCard && wide && !!toolbar;

  return (
    <div className="flex flex-col gap-section">
      {toolbar && !inCard && <div>{toolbar}</div>}

      {/* Mobile (<768px): rows become tappable cards — primary line + labelled meta. */}
      <div className={cn("md:hidden", list ? "card-surface overflow-hidden" : "flex flex-col gap-section")}>
        {loading &&
          Array.from({ length: list ? 6 : 3 }).map((_, i) => (
            <div
              key={`csk-${i}`}
              className={cn(
                "flex animate-pulse flex-col gap-tight",
                list ? "border-b border-hairline px-card py-comfortable last:border-0" : "card-surface p-card",
              )}
            >
              <div className="h-4 w-2/3 rounded-xs bg-line" />
              <div className="h-3 w-1/2 rounded-xs bg-line" />
            </div>
          ))}
        {showEmpty && (emptyState ?? <p className="py-section text-center text-[0.8125rem] text-muted">{tc("noResults")}</p>)}
        {!loading &&
          rows.map((row) => (
            <div
              key={`c-${getRowId(row)}`}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              className={cn(
                list
                  /* A row, not a card: no gap, no second border, and the lift
                     goes with them — a row that rises out of its own list reads
                     as a card that has come loose. */
                  ? "border-b border-hairline px-card py-comfortable last:border-0"
                  : "card-surface p-card",
                onRowClick && "cursor-pointer active:bg-muted-wash",
                isSelected?.(row) && (list ? "bg-ember/5" : "border-ember bg-ember/5"),
              )}
            >
              {renderCard ? (
                renderCard(row)
              ) : (
                <>
              <div className="break-words text-sm font-medium">
                {columns[0].render ? columns[0].render(row) : String((row as Record<string, unknown>)[columns[0].key] ?? "")}
              </div>
              <dl className="mt-inline flex flex-wrap gap-x-section gap-y-inline">
                {columns.slice(1).filter((col) => col.phone !== "hide").map((col) => (
                  // A card holds whatever a column holds, including strings
                  // with nothing to break on — an e-mail address or a booking
                  // reference. Without min-w-0 the pair refuses to shrink and
                  // pushes past the card, where main's overflow-x-hidden eats
                  // it silently: the value is on screen but unreadable, and
                  // nothing says so.
                  <div key={col.key} className="flex min-w-0 max-w-full items-baseline gap-inline">
                    <dt className="shrink-0 text-[0.75rem] text-muted">{col.header}</dt>
                    <dd className={cn("min-w-0 break-words text-[0.8125rem]", col.mono === true && "font-mono", col.align === "right" && "tabular-nums")}>
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

      {/* The table is a card: `card-surface` carries the soft edge, and the
          shell owns what that edge is. `bg-card` stays on top of it — the
          surface class may be translucent, and a dense grid of text on a
          translucent card reads as two different whites (the body warm, the
          sticky `thead` solid). */}
      {/* `relative` makes this box the containing block for anything
          absolutely positioned in a cell — screen-reader-only text above all.
          Without it that text is placed against the page instead, escapes this
          box's clip, and quietly makes the whole document taller than its
          content: on the catalog, 850px taller, enough to scroll the sticky
          sidebar away. */}
      <div
        className={cn(
          "card-surface relative hidden bg-card md:block",
          /* In the card the table scrolls in a box of its own, so the card itself
             must NOT clip: a date panel or a menu opened from the toolbar row
             drops over the rows beneath and would be cut off at its edge. The
             rounding that overflow-hidden would have given goes on the two
             rows that meet the corners instead. */
          !inCard && cn("overflow-auto scroll-x-hint", height === "box" && "max-h-[70vh]"),
        )}
      >
        {inCard && <div className="rounded-t-md border-b border-hairline p-comfortable">{toolbar}</div>}
        <div className={cn(inCard && "overflow-auto rounded-b-md scroll-x-hint", inCard && height === "box" && "max-h-[70vh]")}>
        <table
          className={cn("table-inset w-full border-collapse text-sm", layout === "fixed" && "table-fixed")}
          style={minWidth ? { minWidth } : undefined}
        >
          {/* A whisper of tint on the header row, and a hairline under it. It is
              opaque — the rows scroll under it — so the tint is mixed into the
              card rather than laid over it. In dark `subtle` IS the card, so
              there the header is simply the card. */}
          <thead className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--color-subtle)_40%,var(--color-card))] shadow-[0_1px_0_0_var(--color-hairline)]">
            <tr>
              {columns.map((col) => {
                const activeSort = sort?.key === col.key;
                const sortable = !!col.sortable && !!onSortChange;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={sortable ? (activeSort ? (sort?.order === "asc" ? "ascending" : "descending") : "none") : undefined}
                    className={cn(
                      "whitespace-nowrap px-comfortable py-2.5 text-[0.8125rem] font-medium text-muted",
                      alignClass(col.align),
                    )}
                  >
                    {sortable ? (
                      /* The arrows belong to the column being sorted, and to the
                         one under the pointer or the keyboard. Four ghost
                         double-arrows down a header row were the loudest thing
                         on the table. The glyph keeps its room either way, so
                         the header does not shift as the pointer crosses it. */
                      <button
                        type="button"
                        onClick={() => onSortChange?.(col.key)}
                        className={cn(
                          "group -mx-1.5 inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 transition-colors duration-quick hover:text-fg",
                          activeSort && "text-fg",
                        )}
                      >
                        {col.header}
                        {activeSort ? (
                          sort?.order === "asc" ? (
                            <ChevronUp size={13} strokeWidth={1.75} aria-hidden />
                          ) : (
                            <ChevronDown size={13} strokeWidth={1.75} aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown
                            size={13}
                            strokeWidth={1.5}
                            aria-hidden
                            className="opacity-0 transition-opacity duration-quick group-hover:opacity-100 group-focus-visible:opacity-100"
                          />
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
                <tr key={`sk-${i}`} className="border-b border-hairline last:border-0">
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
                <td colSpan={columns.length} className="px-comfortable py-section">
                  {emptyState ?? (
                    <p className="text-center text-[0.8125rem] text-muted">{tc("noResults")}</p>
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
                          /* Only when the ROW itself has focus. A key press
                             inside the row — opening its own menu, say —
                             bubbles here, so Enter on the row menu used to
                             open the menu AND navigate away from under it.
                             The mouse path already stopped propagation; the
                             keyboard path never did. */
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  aria-selected={isSelected ? isSelected(row) : undefined}
                  className={cn(
                    "h-12 border-b border-hairline last:border-0",
                    isSelected?.(row) && "bg-ember/5",
                    onRowClick &&
                      // The ring itself comes from the app's one unlayered :focus-visible
                      // rule, which already paints ember at 2px. Utilities here only
                      // fought it: `outline-[var(--color-ember)]` is ambiguous to
                      // Tailwind, which cannot tell a colour from a width, so it
                      // emitted the wrong property and the row fell back to the
                      // browser default.
                      /* A selected row keeps its tint under the pointer —
                         deepened, not swapped for the plain hover grey. */
                      (isSelected?.(row)
                        ? "cursor-pointer transition-colors duration-quick hover:bg-ember/10 focus-visible:bg-ember/10"
                        : "cursor-pointer transition-colors duration-quick hover:bg-fg/[0.035] focus-visible:bg-fg/[0.035]"),
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-comfortable py-tight align-middle",
                        alignClass(col.align),
                        col.mono === true && "font-mono",
                        col.align === "right" && "tabular-nums",
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
  const tc = useTranslations("common");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between">
      <p className="text-[0.75rem] tabular-nums text-muted">
        {loading ? "…" : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-tight">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label={tc("previousPage")}
          className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-strong"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-[0.75rem] tabular-nums text-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          aria-label={tc("nextPage")}
          className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-fg disabled:text-faint disabled:cursor-not-allowed hover:enabled:border-strong"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
