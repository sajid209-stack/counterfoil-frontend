"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, SlidersHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * One price table for everything in the catalog.
 *
 * Bookings and events each had their own: a compact row per tier for a
 * booking, and a large card per ticket for an event — so an event with three
 * tickets was several screens of scrolling, and the two editors taught two
 * different ideas of what a price is. This is the one shape both use: a row
 * per tier with its name, its price in whole taka, and the number that
 * matters for the kind (how many a ticket admits, or how many tickets exist),
 * plus what has sold where anything has. Everything else a tier can carry —
 * an age note, a sales end date, a line on the ticket — folds into the row
 * and is summarised when folded, so nothing set is ever out of sight.
 *
 * The calm pass: one hairline-ruled list rather than a bordered box per tier.
 * From `sm` it is a table (a sentence-case header over aligned columns). On a
 * phone each ticket type is two lines: its name with the price right-aligned,
 * then a one-line summary and a disclosure that opens the rest (how many it
 * admits, what has sold, the folded details, reorder and remove). There is
 * still one copy of every field in the document: the disclosure hides cells
 * with CSS below `sm`, it does not render a second set.
 */
export interface TierRowSpec {
  key: string;
  name: string;
  onName: (v: string) => void;
  namePlaceholder: string;
  nameError?: string;
  price: string;
  onPrice: (v: string) => void;
  /** A hint inside an empty price field, where one helps. */
  pricePlaceholder?: string;
  priceError?: string;
  qty: string;
  onQty: (v: string) => void;
  qtyPlaceholder?: string;
  qtyError?: string;
  /** Events: what this tier has sold, drawn against its quantity. */
  sold?: number;
  /**
   * A band under the row's fields, always open.
   *
   * For which days of a multi-day event a ticket admits — the one thing about
   * an event ticket that cannot fold away, because it is what separates two
   * rows that otherwise differ only by a price. A booking passes nothing and
   * the row is exactly as it was.
   */
  scope?: React.ReactNode;
  /** What the folded details hold, in a phrase — empty when nothing is set. */
  summary?: string;
  details?: React.ReactNode;
  remove: { label: string; onRemove: () => void; disabled?: boolean };
  onUp?: () => void;
  onDown?: () => void;
}

export interface TierTableLabels {
  name: string;
  price: string;
  qty: string;
  sold?: string;
  /** Icon buttons say what they do AND to which row — "Move Adult down",
   *  not three identical "Move down"s in a list of three. Each takes the
   *  row's name, or `unnamed` while the row has none. */
  details: (name: string) => string;
  /** The words beside the details button. It is the least obvious of the
   *  row's icons (a sliders glyph), so it is the one that carries a label. */
  detailsShort: string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  unnamed: string;
  soldOf: (sold: number, cap: number) => string;
}

export function TierTable({
  rows,
  labels,
  currencySymbol = "৳",
}: {
  rows: TierRowSpec[];
  labels: TierTableLabels;
  currencySymbol?: string;
}) {
  const withSold = rows.some((r) => r.sold !== undefined);
  const anyUp = rows.some((r) => r.onUp);
  const anyDown = rows.some((r) => r.onDown);
  const cols = withSold
    ? "sm:grid-cols-[minmax(0,1fr)_8rem_6rem_9rem_12.5rem]"
    : "sm:grid-cols-[minmax(0,1fr)_8rem_6rem_12.5rem]";
  return (
    <div className="flex flex-col">
      {/* One header for the table rather than a label on the first row only,
          which left every later row's fields unnamed. Hidden on a phone, where
          each ticket type is its own two lines. */}
      <div aria-hidden className={cn("hidden gap-tight border-b border-hairline pb-tight text-[0.8125rem] font-medium text-muted sm:grid", cols)}>
        <span>{labels.name}</span>
        <span className="text-right">{labels.price}</span>
        <span className="text-right">{labels.qty}</span>
        {withSold && <span className="pl-section">{labels.sold}</span>}
        <span />
      </div>
      <div className="divide-y divide-hairline">
        {rows.map((r) => (
          <TierRow key={r.key} r={r} cols={cols} withSold={withSold} labels={labels} currencySymbol={currencySymbol} anyUp={anyUp} anyDown={anyDown} />
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "h-11 w-full min-w-0 rounded-sm border bg-card px-comfortable text-sm outline-none transition-colors duration-quick placeholder:text-muted focus:border-inverse";

function TierRow({
  r,
  cols,
  withSold,
  labels,
  currencySymbol,
  anyUp,
  anyDown,
}: {
  r: TierRowSpec;
  cols: string;
  withSold: boolean;
  labels: TierTableLabels;
  currencySymbol: string;
  /** Some row has a reorder arrow, so a row without one keeps its place — the
   *  More and Remove buttons then line up down the whole column. */
  anyUp: boolean;
  anyDown: boolean;
}) {
  const [open, setOpen] = useState(false);
  /* Phone only: the rest of the row. It opens by itself when something in it
     needs the operator (a quantity still to be typed, or a problem with it) so
     a required field is never hidden behind a closed disclosure. */
  const [more, setMore] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const cap = parseInt(r.qty, 10) || 0;
  const needsMore = r.qty === "" || !!r.qtyError;
  const moreOpen = more || needsMore;
  /* Grouped while it is read, raw while it is typed: 12000 reads as 12,000,
     and a comma never lands under the cursor mid-number. */
  const shownPrice = editingPrice || r.price === "" || !/^\d+(\.\d+)?$/.test(r.price) ? r.price : Number(r.price).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const pct = r.sold !== undefined && cap > 0 ? Math.min(100, Math.round((r.sold / cap) * 100)) : 0;
  const err = (e?: string) => (e ? "border-danger" : "border-line");
  const who = r.name.trim() || labels.unnamed;
  /* Hidden below `sm` until the disclosure is open. */
  const phoneHidden = !moreOpen && "max-sm:hidden";
  const line2 = [r.qty !== "" ? `${labels.qty}: ${r.qty}` : "", r.summary].filter(Boolean).join(" · ");
  return (
    <div className="py-comfortable first:pt-tight last:pb-0">
      <div className={cn("grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-x-tight gap-y-tight", cols)}>
        <label className="flex min-w-0 flex-col gap-inline">
          <span aria-hidden className="sr-only">{labels.name}</span>
          <input
            value={r.name}
            onChange={(e) => r.onName(e.target.value)}
            placeholder={r.namePlaceholder}
            aria-label={labels.name}
            aria-invalid={!!r.nameError || undefined}
            className={cn(inputCls, err(r.nameError))}
          />
          {r.nameError && <span className="text-[0.8125rem] text-danger">{r.nameError}</span>}
        </label>
        <label className="flex min-w-0 flex-col gap-inline">
          <span className="sr-only">{labels.price}</span>
          <span className="relative">
            <span aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-sm text-muted">
              {currencySymbol}
            </span>
            <input
              value={shownPrice}
              onFocus={() => setEditingPrice(true)}
              onBlur={() => setEditingPrice(false)}
              onChange={(e) => r.onPrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              aria-label={labels.price}
              placeholder={r.pricePlaceholder}
              aria-invalid={!!r.priceError || undefined}
              className={cn(inputCls, err(r.priceError), "pl-7 text-right tabular-nums")}
            />
          </span>
          {r.priceError && <span className="text-[0.8125rem] text-danger">{r.priceError}</span>}
        </label>

        {/* Phone, line 2: the summary and the way to the rest. */}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={moreOpen}
          disabled={needsMore}
          className="col-span-2 -mr-3 flex min-h-11 min-w-0 items-center gap-tight rounded-sm text-left text-[0.8125rem] text-muted sm:hidden"
        >
          <span className="min-w-0 flex-1 truncate">{line2}</span>
          <span className="sr-only">{labels.details(who)}</span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-fg">
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-quick", moreOpen && "rotate-180")} />
          </span>
        </button>

        <label className={cn("col-span-2 flex min-w-0 flex-col gap-inline sm:col-span-1", phoneHidden)}>
          <span className="text-[0.8125rem] font-medium text-muted sm:sr-only">{labels.qty}</span>
          <input
            value={r.qty}
            onChange={(e) => r.onQty(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            aria-label={labels.qty}
            placeholder={r.qtyPlaceholder}
            aria-invalid={!!r.qtyError || undefined}
            className={cn(inputCls, err(r.qtyError), "text-right tabular-nums")}
          />
          {r.qtyError && <span className="text-[0.8125rem] text-danger">{r.qtyError}</span>}
        </label>
        {withSold && (
          <span className={cn("col-span-2 flex min-w-0 flex-col justify-center gap-inline sm:col-span-1 sm:h-11 sm:pl-section", phoneHidden)}>
            {r.sold !== undefined && r.sold > 0 ? (
              <>
                <span className="text-[0.8125rem] tabular-nums">
                  <span className="sm:sr-only">{labels.sold}: </span>
                  {labels.soldOf(r.sold, cap)}
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${pct}%` }} />
                </span>
              </>
            ) : (
              <span className="text-[0.8125rem] text-muted">
                <span aria-hidden>—</span>
              </span>
            )}
          </span>
        )}
        <span className={cn("col-span-2 flex items-center justify-end gap-inline sm:col-span-1 sm:h-11", phoneHidden)}>
          {r.details && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={labels.details(who)}
              title={labels.details(who)}
              className={cn(
                "flex h-11 items-center gap-inline rounded-sm px-tight text-[0.8125rem] font-medium hover:bg-muted-wash hover:text-fg sm:h-9",
                open ? "bg-muted-wash text-fg" : "text-muted",
              )}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden />
              <span aria-hidden>{labels.detailsShort}</span>
            </button>
          )}
          {!r.onUp && anyUp && <span aria-hidden className="hidden h-9 w-9 sm:block" />}
          {r.onUp && (
            <button type="button" aria-label={labels.moveUp(who)} title={labels.moveUp(who)} onClick={r.onUp} className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-fg sm:h-9 sm:w-9">
              <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          {!r.onDown && anyDown && <span aria-hidden className="hidden h-9 w-9 sm:block" />}
          {r.onDown && (
            <button type="button" aria-label={labels.moveDown(who)} title={labels.moveDown(who)} onClick={r.onDown} className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-fg sm:h-9 sm:w-9">
              <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <button
            type="button"
            aria-label={r.remove.label}
            title={r.remove.label}
            aria-disabled={r.remove.disabled || undefined}
            onClick={r.remove.disabled ? undefined : r.remove.onRemove}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-danger aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted sm:h-9 sm:w-9"
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </span>
      </div>
      {r.scope && <div className="mt-tight">{r.scope}</div>}
      {/* What the folded details hold, in a line, so nothing set is out of
          sight without a second row per tier when nothing is. (On a phone the
          summary is already on the row's second line.) */}
      {!open && r.summary && <p className="mt-inline truncate text-[0.8125rem] text-muted max-sm:hidden">{r.summary}</p>}
      {open && r.details && <div className={cn("mt-tight grid gap-section rounded-sm bg-muted-wash p-comfortable sm:grid-cols-2", phoneHidden)}>{r.details}</div>}
    </div>
  );
}
