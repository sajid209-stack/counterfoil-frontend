"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSearch,
  Pagination,
  Tabs,
  tabPanelProps,
  type Column,
  type FilterSpec,
  type TabItem,
} from "@/components/ui";
import { PageShell, PageToolbar } from "@/components/ui/PageShell";

const PAGE_SIZES = [10, 20, 50];

/**
 * The list screen both Refunds and Write-offs are: a page title, one quiet
 * summary line, underline tabs with counts, a search with a single Filters
 * button, and a table that becomes a two-line list on a phone.
 *
 * The page supplies the words, the columns and the rows; this supplies the
 * shape, so the two screens cannot drift apart. A row opens the detail, which is
 * the page's `children` (a Sheet), because the detail needs the page's own
 * state — which request is open, who is answering.
 *
 * Nothing here reads a clock or a request: rows arrive already worked out and
 * `loading` holds the table in its skeleton until the browser has the venue.
 */
export function RequestsList<T>({
  title,
  description,
  summary,
  tabsLabel,
  tabs,
  tab,
  onTab,
  search,
  onSearch,
  searchPlaceholder,
  filters,
  columns,
  rows,
  getRowId,
  onOpen,
  renderCard,
  loading,
  emptyIcon,
  empty,
  filtered,
  onReset,
  children,
}: {
  title: string;
  description: string;
  summary: string;
  tabsLabel: string;
  tabs: TabItem[];
  tab: string;
  onTab: (value: string) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filters: FilterSpec[];
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onOpen: (row: T) => void;
  renderCard: (row: T) => React.ReactNode;
  loading: boolean;
  emptyIcon: React.ReactNode;
  empty: { title: string; body: string };
  /** Anything narrowing the list beyond its tab: a search or a filter. */
  filtered: boolean;
  onReset: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("requests");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(PAGE_SIZES[1]);
  // A page past the end (the list shrank after an answer) is shown as the last.
  const last = Math.max(1, Math.ceil(rows.length / size));
  const shown = Math.min(page, last);
  const pageRows = rows.slice((shown - 1) * size, shown * size);
  const panel = tabPanelProps("requests-tabs", tab);

  const toolbar = (
    <FilterBar
      search={<FilterSearch value={search} onChange={(v) => { onSearch(v); setPage(1); }} placeholder={searchPlaceholder} />}
      filters={filters}
    />
  );

  return (
    <PageShell title={title} description={description}>
      <div className="flex flex-col gap-section">
        {/* One quiet line, not a band of cards: the list is the point. */}
        <p className="text-sm tabular-nums text-muted" aria-live="polite">
          {summary}
        </p>

        <PageToolbar underline>
          <Tabs
            id="requests-tabs"
            aria-label={tabsLabel}
            items={tabs}
            value={tab}
            onChange={(v) => {
              onTab(v);
              setPage(1);
            }}
          />
        </PageToolbar>

        <div {...panel} className="flex flex-col gap-section outline-none">
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowId={getRowId}
            loading={loading}
            onRowClick={onOpen}
            minWidth="62rem"
            height="page"
            cardVariant="list"
            toolbar={toolbar}
            toolbarInCard
            renderCard={renderCard}
            emptyState={
              <EmptyState
                icon={filtered ? <SearchX size={24} strokeWidth={1.5} aria-hidden /> : emptyIcon}
                title={empty.title}
                message={empty.body}
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={onReset}>
                      {t("reset")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          {!loading && rows.length > PAGE_SIZES[0] && (
            <Pagination
              page={shown}
              pageSize={size}
              total={rows.length}
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          )}
        </div>
      </div>
      {children}
    </PageShell>
  );
}
