"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListFilter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * The search field every list opens with, drawn once so the lists cannot drift
 * apart: 44px on a touch screen, 36px from md, a soft stroke that firms (not
 * blackens) on focus, the glyph inside the left edge. Pass it as `search`.
 */
export function FilterSearch({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-11 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none transition-colors duration-quick placeholder:text-muted focus:border-strong md:h-9 md:w-64"
      />
    </div>
  );
}

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
  /** Draw this one filter's control on the row itself from md up, beside the
   *  search, instead of inside the Filters panel — for the single filter a
   *  list is cut by most often (usually the date range). At most one per bar:
   *  a row of inline filters is the clutter the panel exists to remove. It
   *  still lives in the sheet on a phone, and because it names its own value
   *  on the desktop row it is neither counted nor chipped there. */
  inline?: boolean;
}

/**
 * The list-page filter row — the one pattern for every index.
 *
 *     [search] [lead] [Filters ⧩ 2]                       [actions]
 *     Status: Paid ×   Channel: Online ×   Clear filters
 *
 * Search is the one control a list is opened with. `lead` is the optional ONE
 * key filter that earns a place on the row (a date range). Everything else sits
 * behind a single **Filters** button that counts what is set — a popover on a
 * desktop, a bottom sheet on a phone — and whatever is set comes back out as a
 * removable chip on a second row, with **Clear filters** at its end. The chips
 * row exists only while something is set, so a list with no filters applied is
 * one quiet line.
 *
 * Measured before it was built: /orders spent 96px on a search field and three
 * selects stacked down a 390px screen, which with the figures above it put the
 * first order 451px into a 735px viewport. Four controls for a question most
 * visits do not ask. Shopify admin, Stripe and Linear all converge on the shape
 * above for the same reason.
 *
 * The rules, all from the design database:
 *
 * - **`progressive-disclosure`** (Apple HIG) — reveal progressively. Search is
 *   the one control a list is opened with, so it stays; the rest fold.
 * - **`chip-collection-reflow`** (High) — an overflow summary must be an
 *   *operable disclosure*, never a way of hiding values. So anything actually
 *   set comes back out as a chip that says what it is and can clear it, and
 *   the button carries the count. Nothing a person chose is ever only inside a
 *   closed panel.
 * - **`state-preservation`** (HIG/MD) — the panel is a view of the live
 *   filters, not a form: every control writes through as it is touched, so
 *   there is nothing to lose and no Apply to forget.
 * - **`modal-escape`** (HIG) — the sheet handles the four ways out; the
 *   popover closes on Escape, on a press outside and on Tab out of it.
 *
 * The props are additive over what the catalogue and inventory already pass:
 * `search`, `filters` and `lead` keep their meaning; `actions` is new.
 */
export function FilterBar({
  search,
  filters,
  /** Drawn beside search at every width — the page's ONE key filter, or a
   *  segmented control or tab strip that IS its primary cut rather than one
   *  filter among several. */
  lead,
  /** The right-hand end of the row: at most two buttons and an overflow menu.
   *  Put `max-md:hidden` on what a phone does not need — it renders at every
   *  width, because only the page knows which of its actions a thumb wants. */
  actions,
  className,
}: {
  search?: React.ReactNode;
  filters: FilterSpec[];
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  /* Which side draws the controls, rather than both sides drawing them and one
     being hidden. A hidden copy is a real node: it is FIRST in document order,
     so anything selecting "the status filter" gets the invisible one, and a
     screen reader finds two of every control. This app has been caught by that
     three times — the sell wall, the page-header portal, the orders nav. */
  const wide = useMediaQuery(MD);
  /* Open for the form factor it was opened in. Remembering `true` alone would
     turn a desktop popover into a phone sheet the moment the window narrowed,
     and resetting it would need a setState in an effect. */
  const [openFor, setOpenFor] = useState<boolean | null>(null);
  const open = openFor === wide;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const inline = wide ? filters.filter((f) => f.inline).slice(0, 1) : [];
  const folded = filters.filter((f) => !inline.includes(f));
  const set = folded.filter((f) => f.active);
  const count = set.length;

  const close = (focus = true) => {
    setOpenFor(null);
    if (focus) trigger.current?.focus();
  };

  /* The desktop popover is portalled to <body> and placed in viewport
     coordinates, for the reason `Select` is: any card, any scrolling table
     clips an absolutely-positioned panel. Written onto the node rather than
     into state — where it lands is a fact about a layout that has just
     happened. */
  useLayoutEffect(() => {
    const el = panel.current;
    const tr = trigger.current;
    if (!open || !wide || !el || !tr) return;
    const place = () => {
      const pad = 8;
      const a = tr.getBoundingClientRect();
      el.style.top = "0px";
      el.style.left = "0px";
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      const x = Math.max(pad, Math.min(a.left, window.innerWidth - pad - r.width));
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4)}px`;
      el.style.maxHeight = `${Math.round(Math.max(200, (flip ? a.top : below) - pad - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, wide, count]);

  useEffect(() => {
    if (!open || !wide) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenFor(null);
      trigger.current?.focus();
    };
    const away = (e: MouseEvent) => {
      const n = e.target as Element | null;
      if (!n || panel.current?.contains(n) || trigger.current?.contains(n)) return;
      /* A `Select` inside the panel draws its list in a portal of its own, so
         a press on one of its options is outside the panel by the DOM's
         reckoning and inside it by the person's. */
      if (n.closest?.("[data-select-panel]")) return;
      setOpenFor(null);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    /* Land inside the panel, on its first control, so a keyboard user opening
       it is already in it. */
    const f = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')?.focus();
    });
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", away);
      cancelAnimationFrame(f);
    };
  }, [open, wide]);

  /* The panel is portalled to the END of <body>, so Tab off its last control
     would land in the browser's chrome rather than back in the page. Leaving
     the panel by Tab closes it and returns to the Filters button, which is
     where the page's tab order resumes. */
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = panel.current;
    const active = document.activeElement;
    if (!root || !active || !root.contains(active)) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'));
    const edge = e.shiftKey ? items[0] : items[items.length - 1];
    if (active === edge) {
      e.preventDefault();
      close();
    }
  };

  const clearAll = () => set.forEach((f) => f.onClear());

  const chipText = (f: FilterSpec) => (f.active && f.active !== f.label ? `${f.label}: ${f.active}` : (f.active ?? ""));

  const filtersButton = folded.length > 0 && (
    <button
      ref={trigger}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open && wide ? panelId : undefined}
      aria-label={count ? t("filtersApplied", { count }) : t("filters")}
      onClick={() => (open ? close(false) : setOpenFor(wide))}
      className={cn(
        "flex h-11 shrink-0 items-center gap-tight rounded-sm border px-comfortable text-[0.8125rem] font-medium text-fg transition-colors duration-quick md:h-9",
        open || count > 0 ? "border-strong bg-subtle dark:bg-fg/5" : "border-line bg-card hover:border-strong",
      )}
    >
      <ListFilter size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
      {t("filters")}
      {count > 0 && (
        <span data-filter-count className="grid h-5 min-w-5 place-items-center rounded-full bg-inverse px-inline text-[0.75rem] font-semibold text-inverse-fg">
          {count}
        </span>
      )}
    </button>
  );

  /* The same node the desktop popover and the phone sheet both draw, from one
     definition, so neither can fall behind the other. */
  const body = (
    <div className="flex flex-col">
      {folded.map((f) => (
        /* Not a <label>: these controls are buttons, and a label wrapping a
           button fires it on every press of the words above it. */
        <div key={f.key} className="flex flex-col gap-inline border-b border-hairline p-card last:border-0 md:px-comfortable md:py-comfortable">
          <span className="text-[0.75rem] font-medium text-muted">{f.label}</span>
          {f.control}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn("flex min-w-0", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        <div className="flex flex-wrap items-center gap-tight">
          {search && <div className="min-w-0 flex-1 md:flex-none">{search}</div>}

          {/* A phone's order is search, Filters, then the rest; from md the
              row reads search, the key filter, Filters. */}
          {!wide && filtersButton}
          {lead}
          {wide && inline.map((f) => <div key={f.key}>{f.control}</div>)}
          {wide && filtersButton}

          {actions && <div className="flex items-center gap-tight md:ml-auto">{actions}</div>}
        </div>

        {/* What is set, so a narrowed list never looks like the whole one.
            Wraps rather than scrolling: a chip that has scrolled out of view
            is a filter nobody knows is on. */}
        {count > 0 && (
          <div className="flex flex-wrap items-center gap-inline">
            {set.map((f) => (
              <span
                key={f.key}
                data-applied={f.key}
                className="flex items-center gap-inline rounded-full bg-subtle py-inline pl-comfortable pr-inline text-[0.75rem] font-medium text-fg dark:bg-fg/10"
              >
                {chipText(f)}
                <button
                  type="button"
                  onClick={f.onClear}
                  aria-label={t("clearFilter", { name: f.label })}
                  className="-my-1.5 -mr-1 grid h-11 w-11 place-items-center rounded-full text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash md:my-0 md:mr-0 md:h-6 md:w-6"
                >
                  <X size={13} strokeWidth={2} aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="flex h-11 items-center rounded-sm px-tight md:h-8 text-[0.8125rem] font-medium text-brand-foreground underline-offset-2 hover:underline"
            >
              {t("clearFilters")}
            </button>
          </div>
        )}
      </div>

      {/* Mounted only while open, and only on the side that draws it, so each
          control exists once. */}
      {open && wide &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={t("filters")}
            onKeyDown={onPanelKey}
            className="fixed z-50 flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-md border border-hairline bg-card shadow-lg dark:border-line"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
            <div className="flex shrink-0 items-center gap-tight border-t border-hairline px-tight py-inline">
              {count > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-9 rounded-sm px-comfortable text-[0.8125rem] font-medium text-brand-foreground hover:bg-muted-wash"
                >
                  {t("clearFilters")}
                </button>
              )}
              <button
                type="button"
                onClick={() => close()}
                className="ml-auto h-9 rounded-sm px-comfortable text-[0.8125rem] font-medium text-fg hover:bg-muted-wash"
              >
                {t("done")}
              </button>
            </div>
          </div>,
          document.body,
        )}

      {!wide && (
        <Sheet
          open={open}
          onClose={() => close()}
          title={t("filters")}
          closeLabel={t("close")}
          footer={
            <>
              {count > 0 && (
                <Button variant="tertiary" onClick={clearAll}>
                  {t("clearFilters")}
                </Button>
              )}
              <Button variant="primary" className="ml-auto" onClick={() => close()}>
                {t("done")}
              </Button>
            </>
          }
        >
          {body}
        </Sheet>
      )}
    </div>
  );
}
