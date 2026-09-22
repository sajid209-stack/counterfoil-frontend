"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal, Trash2 } from "lucide-react";
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
  details: string;
  moveUp: string;
  moveDown: string;
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
  const cols = withSold
    ? "sm:grid-cols-[minmax(0,1fr)_8rem_6rem_9rem_10rem]"
    : "sm:grid-cols-[minmax(0,1fr)_8rem_6rem_10rem]";
  return (
    <div className="flex flex-col gap-tight">
      {/* One header for the table rather than a label on the first row only —
          which left every later row's fields unnamed. Hidden on a phone, where
          each field carries its own label. */}
      <div aria-hidden className={cn("hidden gap-tight px-comfortable text-[12px] font-medium text-muted sm:grid", cols)}>
        <span>{labels.name}</span>
        <span className="text-right">{labels.price}</span>
        <span className="text-right">{labels.qty}</span>
        {withSold && <span className="pl-section">{labels.sold}</span>}
        <span />
      </div>
      {rows.map((r) => (
        <TierRow key={r.key} r={r} cols={cols} withSold={withSold} labels={labels} currencySymbol={currencySymbol} />
      ))}
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
}: {
  r: TierRowSpec;
  cols: string;
  withSold: boolean;
  labels: TierTableLabels;
  currencySymbol: string;
}) {
  const [open, setOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const cap = parseInt(r.qty, 10) || 0;
  /* Grouped while it is read, raw while it is typed: 12000 reads as 12,000,
     and a comma never lands under the cursor mid-number. */
  const shownPrice = editingPrice || r.price === "" || !/^\d+(\.\d+)?$/.test(r.price) ? r.price : Number(r.price).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const pct = r.sold !== undefined && cap > 0 ? Math.min(100, Math.round((r.sold / cap) * 100)) : 0;
  const err = (e?: string) => (e ? "border-danger" : "border-line");
  return (
    <div className="rounded-sm border border-line bg-card">
      <div className={cn("grid grid-cols-2 items-start gap-tight p-comfortable", cols)}>
        <label className="col-span-2 flex min-w-0 flex-col gap-inline sm:col-span-1">
          <span className="text-[12px] font-medium text-muted sm:sr-only">{labels.name}</span>
          <input
            value={r.name}
            onChange={(e) => r.onName(e.target.value)}
            placeholder={r.namePlaceholder}
            aria-invalid={!!r.nameError || undefined}
            className={cn(inputCls, err(r.nameError))}
          />
          {r.nameError && <span className="text-[12px] text-danger">{r.nameError}</span>}
        </label>
        <label className="flex min-w-0 flex-col gap-inline">
          <span className="text-[12px] font-medium text-muted sm:sr-only">{labels.price}</span>
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
              placeholder={r.pricePlaceholder}
              aria-invalid={!!r.priceError || undefined}
              className={cn(inputCls, err(r.priceError), "pl-7 text-right tabular-nums")}
            />
          </span>
          {r.priceError && <span className="text-[12px] text-danger">{r.priceError}</span>}
        </label>
        <label className="flex min-w-0 flex-col gap-inline">
          <span className="text-[12px] font-medium text-muted sm:sr-only">{labels.qty}</span>
          <input
            value={r.qty}
            onChange={(e) => r.onQty(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={r.qtyPlaceholder}
            aria-invalid={!!r.qtyError || undefined}
            className={cn(inputCls, err(r.qtyError), "text-right tabular-nums")}
          />
          {r.qtyError && <span className="text-[12px] text-danger">{r.qtyError}</span>}
        </label>
        {withSold && (
          <span className="col-span-2 flex min-w-0 flex-col justify-center gap-inline sm:col-span-1 sm:h-11 sm:pl-section">
            {r.sold !== undefined && r.sold > 0 ? (
              <>
                <span className="text-[12px] tabular-nums">
                  <span className="sm:sr-only">{labels.sold}: </span>
                  {labels.soldOf(r.sold, cap)}
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-ember-solid" : "bg-success")} style={{ width: `${pct}%` }} />
                </span>
              </>
            ) : (
              <span className="text-[12px] text-muted">
                <span aria-hidden>—</span>
              </span>
            )}
          </span>
        )}
        <span className="col-span-2 flex items-center justify-end gap-inline sm:col-span-1 sm:h-11">
          {r.details && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={labels.details}
              title={labels.details}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-sm hover:bg-muted-wash hover:text-fg sm:h-9 sm:w-9",
                open ? "bg-muted-wash text-fg" : "text-muted",
              )}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </button>
          )}
          {r.onUp && (
            <button type="button" aria-label={labels.moveUp} onClick={r.onUp} className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-fg sm:h-9 sm:w-9">
              <ArrowUp size={16} strokeWidth={1.5} />
            </button>
          )}
          {r.onDown && (
            <button type="button" aria-label={labels.moveDown} onClick={r.onDown} className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:bg-muted-wash hover:text-fg sm:h-9 sm:w-9">
              <ArrowDown size={16} strokeWidth={1.5} />
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
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </span>
      </div>
      {/* What the folded details hold, in a line — so nothing set is out of
          sight, without a second row per tier when nothing is. */}
      {!open && r.summary && <p className="-mt-inline truncate px-comfortable pb-tight text-[12px] text-muted">{r.summary}</p>}
      {open && r.details && <div className="grid gap-section border-t border-hairline p-comfortable sm:grid-cols-2">{r.details}</div>}
    </div>
  );
}
