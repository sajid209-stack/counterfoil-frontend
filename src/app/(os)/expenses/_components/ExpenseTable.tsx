"use client";

import { ChevronLeft, ChevronRight, Copy, Paperclip, Pencil, Plus, Receipt, RotateCcw, SearchX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ActionMenu, Button, DataTable, EmptyState, Select, type ActionMenuItem, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { MD, useMediaQuery } from "@/lib/useMedia";
import type { Expense, ExpenseSortKey } from "@/lib/api";
import { CategoryTag, PaidTag, shortDate, useExpenseLabels } from "./parts";

export const PAGE_SIZES = [10, 20, 50, 100];

export interface Sort {
  key: ExpenseSortKey;
  order: "asc" | "desc";
}

export interface RowActions {
  onOpen: (e: Expense) => void;
  onCopy: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}

/** Edit, copy and delete — one menu, the same on a row of the table and a row of the phone list. */
function RowMenu({ expense, actions }: { expense: Expense; actions: RowActions }) {
  const t = useTranslations("expenses");
  const items: ActionMenuItem[] = [
    { key: "edit", label: t("row.edit"), icon: <Pencil size={16} strokeWidth={1.5} />, onSelect: () => actions.onOpen(expense) },
    { key: "copy", label: t("row.copy"), icon: <Copy size={16} strokeWidth={1.5} />, onSelect: () => actions.onCopy(expense) },
    { key: "delete", label: t("row.delete"), icon: <Trash2 size={16} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => actions.onDelete(expense) },
  ];
  return <ActionMenu label={t("row.menu", { title: expense.title })} items={items} />;
}

function ReceiptMark() {
  const t = useTranslations("expenses");
  return (
    <span className="shrink-0 text-muted" role="img" aria-label={t("table.hasReceipt")}>
      <Paperclip size={13} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/**
 * The expenses table: Ref · Date · Title · Category · Paid from · Items · Total
 * · Added by · ⋯ — drawn by `DataTable`, the way Orders and Customers are.
 *
 * Money is Inter with tabular figures, right-aligned (`DataTable` sets a
 * right-aligned column in DM Mono unless told otherwise, and DM Mono is for
 * identifiers: here, the reference). The payee sits under the title as a muted
 * second line, and the counter under "paid from" when it came out of a cash
 * drawer. A row opens the drawer; the menu at its end edits, copies or deletes.
 */
function useColumns(actions: RowActions): Column<Expense>[] {
  const t = useTranslations("expenses");
  const sortable = true;
  return [
    {
      key: "ref",
      header: t("table.ref"),
      sortable,
      render: (e) => <span className="whitespace-nowrap font-mono text-[13px]">{e.ref}</span>,
    },
    {
      key: "date",
      header: t("table.date"),
      sortable,
      render: (e) => <span className="whitespace-nowrap text-[0.8125rem]">{shortDate(e.date)}</span>,
    },
    {
      key: "title",
      header: t("table.title"),
      sortable,
      render: (e) => (
        <span className="block min-w-0 max-w-[22rem]">
          <span className="flex items-center gap-inline">
            <span className="min-w-0 truncate font-medium">{e.title}</span>
            {e.receiptUrl && <ReceiptMark />}
          </span>
          {e.payee && <span className="block truncate text-[12px] text-muted">{e.payee}</span>}
        </span>
      ),
    },
    {
      key: "category",
      header: t("table.category"),
      sortable,
      render: (e) => <CategoryTag category={e.category} className="text-[0.8125rem]" />,
    },
    {
      key: "paidFrom",
      header: t("table.paidFrom"),
      sortable,
      render: (e) => <PaidTag paidFrom={e.paidFrom} counter={e.counterName} className="max-w-[10rem] text-[0.8125rem]" />,
    },
    {
      key: "items",
      header: t("table.items"),
      sortable,
      align: "right",
      mono: false,
      render: (e) =>
        e.lineCount > 0 ? (
          <span className="whitespace-nowrap text-[0.8125rem]">{t("table.itemsCount", { count: e.lineCount })}</span>
        ) : (
          <>
            <span aria-hidden className="text-muted">—</span>
            <span className="sr-only">{t("table.oneAmount")}</span>
          </>
        ),
    },
    {
      key: "total",
      header: t("table.total"),
      sortable,
      align: "right",
      mono: false,
      render: (e) => <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(e.total)}</span>,
    },
    {
      key: "recordedBy",
      header: t("table.by"),
      sortable,
      render: (e) => <span className="block max-w-[9rem] truncate text-[0.8125rem]" title={e.recordedByName}>{e.recordedByName}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("table.actions")}</span>,
      width: "3rem",
      render: (e) => (
        <span className="flex justify-end" onClick={(ev) => ev.stopPropagation()}>
          <RowMenu expense={e} actions={actions} />
        </span>
      ),
    },
  ];
}

/** The phone's row: two lines. What it was and what it cost, then which, how it
 *  was paid and when. The reference stays in DM Mono — it is an identifier. */
function ExpenseCard({ e, actions }: { e: Expense; actions: RowActions }) {
  const labels = useExpenseLabels();
  return (
    <div className="flex items-start gap-tight">
      <div className="flex min-w-0 flex-1 flex-col gap-inline">
        <div className="flex items-baseline justify-between gap-tight">
          <span className="flex min-w-0 flex-1 items-center gap-inline">
            <span className="min-w-0 truncate text-sm font-medium">{e.title}</span>
            {e.receiptUrl && <ReceiptMark />}
          </span>
          <span className="shrink-0 text-[13px] font-medium tabular-nums">{formatMoney(e.total)}</span>
        </div>
        <span className="truncate text-[12px] text-muted">
          <span className="font-mono">{e.ref}</span> · {labels.category(e.category)} · {labels.paidFrom(e.paidFrom)} · {shortDate(e.date)}
        </span>
      </div>
      <span className="-mr-tight shrink-0" onClick={(ev) => ev.stopPropagation()}>
        <RowMenu expense={e} actions={actions} />
      </span>
    </div>
  );
}

/** Showing 1–20 of 64 · Show 20 · Previous · Page 1 of 4 · Next — the same pager Orders draws. */
function Pager({ page, totalPages, pageSize, total, onPage, onPageSize }: { page: number; totalPages: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const t = useTranslations("expenses");
  const wide = useMediaQuery(MD);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "inline-flex h-11 items-center gap-inline rounded-sm border border-line px-comfortable text-[0.8125rem] font-medium text-fg transition-colors duration-quick hover:enabled:border-inverse disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60 md:h-9";
  return (
    <nav aria-label={t("page.label")} className="flex flex-wrap items-center justify-between gap-x-section gap-y-tight">
      <p className="text-[0.8125rem] tabular-nums text-muted" aria-live="polite">
        {t("page.showing", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-tight">
        <div className="flex items-center gap-tight">
          <span id="expenses-size-label" className="text-[0.8125rem] text-muted">{t("page.show")}</span>
          <Select
            aria-labelledby="expenses-size-label"
            size={wide ? "sm" : "md"}
            value={String(pageSize)}
            onChange={(v) => onPageSize(Number(v))}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </div>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} strokeWidth={1.5} aria-hidden />
          {t("page.previous")}
        </button>
        <span className="min-w-[5.5rem] text-center text-[0.8125rem] tabular-nums text-muted">{t("page.of", { page, total: totalPages })}</span>
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          {t("page.next")}
          <ChevronRight size={15} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

export function ExpenseTable({
  rows,
  total,
  page,
  totalPages,
  pageSize,
  loading,
  failed,
  sort,
  filtered,
  freshId,
  actions,
  onSort,
  onPage,
  onPageSize,
  onAdd,
  onReset,
  onRetry,
}: {
  /** `undefined` until the first answer arrives. */
  rows: Expense[] | undefined;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  loading: boolean;
  failed: boolean;
  sort: Sort;
  /** Anything narrower than the default view is set. */
  filtered: boolean;
  /** The expense just saved: its row is tinted for a moment so the eye finds it. */
  freshId: string;
  actions: RowActions;
  onSort: (key: ExpenseSortKey) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("expenses");
  const columns = useColumns(actions);

  if (failed && !rows) {
    return (
      <div className="card-surface flex flex-col items-center gap-tight p-card py-major text-center">
        <p className="text-[15px] font-semibold">{t("error.title")}</p>
        <p className="text-[13px] text-muted">{t("error.text")}</p>
        <Button variant="secondary" icon={<RotateCcw size={15} strokeWidth={1.5} aria-hidden />} onClick={onRetry} className="mt-tight">
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  const Icon = filtered ? SearchX : Receipt;
  return (
    /* While a new page or sort loads, the rows stay and dim: a skeleton is for
       the first answer only, so the table does not flash empty on every click. */
    <div className={cn("flex flex-col gap-section transition-opacity", loading && rows && "opacity-60")} aria-busy={loading}>
      <DataTable
        columns={columns}
        rows={rows ?? []}
        getRowId={(e) => e.id}
        loading={!rows}
        sort={sort}
        onSortChange={(key) => onSort(key as ExpenseSortKey)}
        onRowClick={actions.onOpen}
        isSelected={(e) => e.id === freshId}
        minWidth="64rem"
        height="page"
        cardVariant="list"
        renderCard={(e) => <ExpenseCard e={e} actions={actions} />}
        emptyState={
          <EmptyState
            icon={<Icon size={30} strokeWidth={1.25} aria-hidden />}
            title={filtered ? t("empty.filteredTitle") : t("empty.title")}
            message={filtered ? t("empty.filteredText") : t("empty.text")}
            action={
              <div className="flex flex-wrap items-center justify-center gap-tight">
                {filtered && (
                  <Button variant="secondary" onClick={onReset}>
                    {t("toolbar.reset")}
                  </Button>
                )}
                <Button icon={<Plus size={16} strokeWidth={1.75} aria-hidden />} onClick={onAdd}>
                  {t("add")}
                </Button>
              </div>
            }
          />
        }
      />
      {rows && rows.length > 0 && <Pager page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPage={onPage} onPageSize={onPageSize} />}
    </div>
  );
}
