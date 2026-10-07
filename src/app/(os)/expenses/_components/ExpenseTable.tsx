"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Paperclip, Pencil, Plus, Receipt, RotateCcw, SearchX, Trash2 } from "lucide-react";
import { ActionMenu, Button, Select, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
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

/** The width of an element, as it changes — the table decides how many columns
 *  it can afford from the room it has, not from the window (the sidebar can be
 *  open or shut at any window width). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Edit, copy and delete — one menu, the same on a row of the table and a row of the list. */
function RowMenu({ expense, actions }: { expense: Expense; actions: RowActions }) {
  const t = useTranslations("expenses");
  const items: ActionMenuItem[] = [
    { key: "edit", label: t("row.edit"), icon: <Pencil size={16} strokeWidth={1.5} />, onSelect: () => actions.onOpen(expense) },
    { key: "copy", label: t("row.copy"), icon: <Copy size={16} strokeWidth={1.5} />, onSelect: () => actions.onCopy(expense) },
    { key: "delete", label: t("row.delete"), icon: <Trash2 size={16} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => actions.onDelete(expense) },
  ];
  return <ActionMenu label={t("row.menu", { title: expense.title })} items={items} />;
}

function SortHead({ id, label, sort, onSort, className, right }: { id: ExpenseSortKey; label: string; sort: Sort; onSort: (k: ExpenseSortKey) => void; className?: string; right?: boolean }) {
  const t = useTranslations("expenses");
  const active = sort.key === id;
  const Icon = active ? (sort.order === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined} className={cn("sticky top-[61px] z-10 border-b border-line bg-card py-comfortable text-[12px] font-medium text-muted", right ? "text-right" : "text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(id)}
        title={t("table.sortBy", { column: label })}
        className={cn("inline-flex items-center gap-inline rounded-xs outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ink", right && "flex-row-reverse", active && "text-fg")}
      >
        {label}
        <Icon size={13} strokeWidth={1.5} aria-hidden />
      </button>
    </th>
  );
}

function ItemsCell({ expense }: { expense: Expense }) {
  const t = useTranslations("expenses");
  return expense.lineCount > 0 ? (
    <>{t("table.itemsCount", { count: expense.lineCount })}</>
  ) : (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{t("table.oneAmount")}</span>
    </>
  );
}

function TitleCell({ expense }: { expense: Expense }) {
  const t = useTranslations("expenses");
  return (
    <>
      <span className="flex items-center gap-inline">
        <span className="min-w-0 truncate font-medium text-fg">{expense.title}</span>
        {expense.receiptUrl && (
          <span className="shrink-0 text-muted" role="img" aria-label={t("table.hasReceipt")}>
            <Paperclip size={13} strokeWidth={1.5} aria-hidden />
          </span>
        )}
      </span>
      {expense.payee && <span className="block truncate text-[12px] text-muted">{expense.payee}</span>}
    </>
  );
}

function Table({ rows, sort, onSort, actions, full, freshId }: { rows: Expense[]; sort: Sort; onSort: (k: ExpenseSortKey) => void; actions: RowActions; full: boolean; freshId: string }) {
  const t = useTranslations("expenses");
  const td = "px-tight py-comfortable align-middle";
  return (
    <table aria-label={t("table.label")} className="table-inset w-full table-fixed border-collapse text-[14px]">
      <colgroup>
        <col style={{ width: 118 }} />
        <col style={{ width: full ? 96 : 92 }} />
        <col />
        <col style={{ width: full ? 156 : 144 }} />
        <col style={{ width: full ? 156 : 144 }} />
        {full && <col style={{ width: 84 }} />}
        <col style={{ width: 124 }} />
        {full && <col style={{ width: 148 }} />}
        <col style={{ width: 72 }} />
      </colgroup>
      <thead>
        <tr>
          <SortHead id="ref" label={t("table.ref")} sort={sort} onSort={onSort} className="pr-tight" />
          <SortHead id="date" label={t("table.date")} sort={sort} onSort={onSort} className="px-tight" />
          <SortHead id="title" label={t("table.title")} sort={sort} onSort={onSort} className="px-tight" />
          <SortHead id="category" label={t("table.category")} sort={sort} onSort={onSort} className="px-tight" />
          <SortHead id="paidFrom" label={t("table.paidFrom")} sort={sort} onSort={onSort} className="px-tight" />
          {full && <SortHead id="items" label={t("table.items")} sort={sort} onSort={onSort} className="px-tight" />}
          <SortHead id="total" label={t("table.total")} sort={sort} onSort={onSort} className="px-tight" right />
          {full && <SortHead id="recordedBy" label={t("table.by")} sort={sort} onSort={onSort} className="px-tight" />}
          <th scope="col" className="sticky top-[61px] z-10 border-b border-line bg-card">
            <span className="sr-only">{t("table.actions")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr
            key={e.id}
            tabIndex={0}
            onClick={() => actions.onOpen(e)}
            onKeyDown={(ev) => {
              if (ev.target !== ev.currentTarget) return;
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                actions.onOpen(e);
              }
            }}
            className={cn("cursor-pointer border-t border-hairline outline-none transition-colors duration-quick hover:bg-muted-wash/40 focus-visible:bg-muted-wash/60", e.id === freshId && "bg-ember/10")}
          >
            <td className="py-comfortable pr-tight align-middle font-mono text-[13px] text-muted">{e.ref}</td>
            <td className={cn(td, "whitespace-nowrap text-muted")}>{shortDate(e.date)}</td>
            <td className={cn(td, "min-w-0")}><TitleCell expense={e} /></td>
            <td className={td}><CategoryTag category={e.category} size={26} /></td>
            <td className={td}><PaidTag paidFrom={e.paidFrom} counter={e.counterName} /></td>
            {full && <td className={cn(td, "whitespace-nowrap text-muted")}><ItemsCell expense={e} /></td>}
            <td className={cn(td, "whitespace-nowrap text-right font-medium tabular-nums")}>{formatMoney(e.total)}</td>
            {full && <td className={cn(td, "truncate text-muted")}>{e.recordedByName}</td>}
            <td className="py-inline align-middle"><RowMenu expense={e} actions={actions} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The same rows as a list: two lines each, for a phone or a narrow window. */
function List({ rows, actions, freshId }: { rows: Expense[]; actions: RowActions; freshId: string }) {
  const t = useTranslations("expenses");
  const labels = useExpenseLabels();
  return (
    <ul aria-label={t("table.label")}>
      {rows.map((e) => (
        <li key={e.id} className={cn("flex items-stretch border-t border-hairline transition-colors duration-quick first:border-t-0", e.id === freshId && "bg-ember/10")}>
          <button type="button" onClick={() => actions.onOpen(e)} className="flex min-h-[64px] min-w-0 flex-1 flex-col justify-center gap-inline py-comfortable pl-card pr-tight text-left outline-none transition-colors duration-quick active:bg-muted-wash focus-visible:bg-muted-wash/60">
            <span className="flex items-baseline justify-between gap-tight">
              <span className="min-w-0 truncate text-[15px] font-medium text-fg">{e.title}</span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoney(e.total)}</span>
            </span>
            <span className="text-[13px] text-muted">
              {labels.category(e.category)} · {labels.paidFrom(e.paidFrom)} · {shortDate(e.date)}
              {e.receiptUrl && (
                <span role="img" aria-label={t("table.hasReceipt")} className="ml-inline inline-block align-[-2px]">
                  <Paperclip size={13} strokeWidth={1.5} aria-hidden />
                </span>
              )}
            </span>
          </button>
          <div className="flex shrink-0 items-center pr-tight">
            <RowMenu expense={e} actions={actions} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Skeleton({ table, full }: { table: boolean; full: boolean }) {
  const t = useTranslations("expenses");
  const bar = "animate-pulse rounded-sm bg-line/60";
  return (
    <div role="status" aria-label={t("loading")} className="px-card py-tight">
      {[0, 1, 2, 3, 4, 5].map((i) =>
        table ? (
          <div key={i} className="flex items-center gap-section border-b border-hairline py-comfortable last:border-b-0">
            <div className={cn(bar, "h-4 w-[8%]")} />
            <div className={cn(bar, "h-4 w-[7%]")} />
            <div className={cn(bar, "h-4", full ? "w-[22%]" : "w-[28%]")} />
            <div className={cn(bar, "h-4 w-[12%]")} />
            <div className={cn(bar, "h-4 w-[11%]")} />
            <div className={cn(bar, "ml-auto h-4 w-[9%]")} />
          </div>
        ) : (
          <div key={i} className="border-b border-hairline py-comfortable last:border-b-0">
            <div className={cn(bar, "h-4 w-3/5")} />
            <div className={cn(bar, "mt-tight h-3 w-4/5")} />
          </div>
        ),
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  pageSize,
  total,
  wide,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  wide: boolean;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const t = useTranslations("expenses");
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-section gap-y-tight border-t border-hairline px-card py-comfortable md:flex md:flex-wrap md:justify-between md:gap-x-major">
      <p className="text-[13px] tabular-nums text-muted">{t("page.showing", { from, to, total })}</p>
      <Select
        value={String(pageSize)}
        onChange={(v) => onPageSize(Number(v))}
        options={PAGE_SIZES.map((n) => ({ value: String(n), label: t("page.size", { count: n }) }))}
        size={wide ? "sm" : "md"}
        aria-label={t("page.sizeLabel")}
        className="w-32 md:order-2 md:ml-auto"
      />
      <div className="col-span-2 flex items-center justify-between gap-tight md:order-3 md:col-auto md:justify-end">
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={15} strokeWidth={1.5} aria-hidden />} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t("page.previous")}
        </Button>
        <span className="px-inline text-[13px] tabular-nums text-muted">{t("page.of", { page, total: totalPages })}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          {t("page.next")}
          <ChevronRight size={15} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>
    </div>
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
  const [ref, width] = useWidth();
  const table = width >= 860;
  const full = width >= 1100;

  let body: React.ReactNode;
  if (failed && !rows) {
    body = (
      <div className="flex flex-col items-center gap-tight px-card py-major text-center">
        <p className="text-[15px] font-semibold">{t("error.title")}</p>
        <p className="text-[13px] text-muted">{t("error.text")}</p>
        <Button variant="secondary" icon={<RotateCcw size={15} strokeWidth={1.5} aria-hidden />} onClick={onRetry} className="mt-tight">
          {t("error.retry")}
        </Button>
      </div>
    );
  } else if (!rows) {
    body = <Skeleton table={table} full={full} />;
  } else if (rows.length === 0) {
    const Icon = filtered ? SearchX : Receipt;
    body = (
      <div className="flex flex-col items-center gap-tight px-card py-major text-center">
        <Icon size={30} strokeWidth={1.25} aria-hidden className="text-muted" />
        <p className="text-[15px] font-semibold">{filtered ? t("empty.filteredTitle") : t("empty.title")}</p>
        <p className="max-w-sm text-[13px] text-muted">{filtered ? t("empty.filteredText") : t("empty.text")}</p>
        <div className="mt-tight flex flex-wrap items-center justify-center gap-tight">
          {filtered && (
            <Button variant="secondary" onClick={onReset}>
              {t("toolbar.reset")}
            </Button>
          )}
          <Button icon={<Plus size={16} strokeWidth={1.75} aria-hidden />} onClick={onAdd}>
            {t("add")}
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
        {table ? <Table rows={rows} sort={sort} onSort={onSort} actions={actions} full={full} freshId={freshId} /> : <List rows={rows} actions={actions} freshId={freshId} />}
        <Pager page={page} totalPages={totalPages} pageSize={pageSize} total={total} wide={table} onPage={onPage} onPageSize={onPageSize} />
      </div>
    );
  }

  return (
    <div ref={ref} className="card-surface">
      {body}
    </div>
  );
}

