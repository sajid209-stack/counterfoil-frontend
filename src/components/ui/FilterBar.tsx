"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { Sheet } from "./Sheet";

export interface FilterSpec {
  key: string;
  /** What the filter is, as its own word — the label above its control. */
  label: string;
  /** The control, exactly as it renders on a desktop. One definition, two
   *  places: a filter drawn twice is a filter that can disagree with itself. */
  control: React.ReactNode;
  /** What it is currently set to, or null while it is not narrowing anything.
   *  This is the chip's text, so it names the VALUE ("Paid"), not the field. */
  active?: string | null;
  /** Put it back to everything. */
  onClear: () => void;
}

/**
 * Search, and the filters behind one button on a phone.
 *
 * Measured before it was built: /orders spent 96px on a search field and three
 * selects stacked down a 390px screen, which with the figures above it put the
 * first order 451px into a 735px viewport. Four controls for a question most
 * visits do not ask.
 *
 * So the rules, all from the design database:
 *
 * - **`progressive-disclosure`** (Apple HIG) — reveal progressively. Search is
 *   the one control a list is opened with, so it stays; the rest fold.
 * - **`chip-collection-reflow`** (High) — an overflow summary must be an
 *   *operable disclosure*, never a way of hiding values. So anything actually
 *   set comes back out as a chip that says what it is and can clear it, and
 *   the button carries the count. Nothing a person chose is ever only inside a
 *   closed sheet.
 * - **`state-preservation`** (HIG/MD) — the sheet is a view of the live
 *   filters, not a form: every control writes through as it is touched, so
 *   there is nothing to lose and no Apply to forget.
 * - **`modal-escape`** (HIG) — `Sheet` handles the four ways out.
 *
 * From `md` every control renders inline, which is where the room is and what
 * a desktop list has always looked like.
 */
export function FilterBar({
  search,
  filters,
  /** Drawn beside search at every width — a segmented control or tab strip
   *  that IS the page's primary cut rather than one filter among several. */
  lead,
  className,
}: {
  search?: React.ReactNode;
  filters: FilterSpec[];
  lead?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const set = filters.filter((f) => f.active);
  /* Which side draws the controls, rather than both sides drawing them and one
     being hidden. A hidden copy is a real node: it is FIRST in document order,
     so anything selecting "the status filter" gets the invisible one, and a
     screen reader finds two of every control. This app has been caught by that
     three times — the sell wall, the page-header portal, the orders nav. */
  const wide = useMediaQuery(MD);

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      <div className="flex flex-wrap items-center gap-tight">
        {search && <div className="min-w-0 flex-1 md:flex-none">{search}</div>}

        {/* The phone's one filter control. It names itself and counts what is
            set, because "Filter" alone does not say whether anything is. */}
        {filters.length > 0 && !wide && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={cn(
              "flex h-11 shrink-0 items-center gap-inline rounded-sm border px-comfortable text-[0.8125rem] font-medium transition-colors duration-quick",
              set.length ? "border-ember bg-ember/10 text-brand-foreground" : "border-line text-muted active:bg-muted-wash",
            )}
          >
            <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden />
            {t("filters")}
            {set.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember-solid px-inline text-[0.75rem] font-semibold text-white">
                {set.length}
              </span>
            )}
          </button>
        )}

        {lead}

        {/* Desktop: the controls themselves, inline. */}
        {wide && filters.map((f) => <div key={f.key}>{f.control}</div>)}
      </div>

      {/* What is set, on a phone, so a narrowed list never looks like the whole
          one. Wraps rather than scrolling: a chip that has scrolled out of view
          is a filter nobody knows is on. */}
      {set.length > 0 && !wide && (
        <div className="flex flex-wrap items-center gap-inline">
          {set.map((f) => (
            <span
              key={f.key}
              className="flex items-center gap-inline rounded-full border border-line bg-subtle py-inline pl-comfortable pr-inline text-[0.75rem] font-medium"
            >
              {f.active}
              <button
                type="button"
                onClick={f.onClear}
                aria-label={t("clearFilter", { name: f.label })}
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash"
              >
                <X size={13} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
          {set.length > 1 && (
            <button
              type="button"
              onClick={() => set.forEach((f) => f.onClear())}
              className="flex h-8 items-center px-inline text-[0.75rem] font-medium text-brand-foreground underline-offset-2 hover:underline"
            >
              {t("clearAll")}
            </button>
          )}
        </div>
      )}

      {/* Mounted only while open AND only below md, so the control exists once. */}
      {!wide && (
        <Sheet open={open} onClose={() => setOpen(false)} title={t("filters")} closeLabel={t("close")}>
          <div className="flex flex-col">
            {filters.map((f) => (
              /* Not a <label>: these controls are buttons, and a label wrapping
                 a button fires it on every press of the words above it. */
              <div key={f.key} className="flex flex-col gap-inline border-b border-hairline p-card last:border-0">
                <span className="text-[0.75rem] font-medium text-muted">{f.label}</span>
                {/* The SAME node the desktop row draws, from one definition, so
                    the sheet cannot fall behind the inline row. */}
                {f.control}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
