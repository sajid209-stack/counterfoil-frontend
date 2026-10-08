"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListFilter } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";

/**
 * The calendar's one **Filters** control: a button that counts what is set, and
 * a panel that holds every filter — a popover under the button from md up, a
 * bottom sheet on a phone.
 *
 * The calendar used to draw two rows of controls before its first booking: six
 * state chips (which were the colour key and the status filter at once), the
 * Filters button, and a stack of selects behind it. Everything but the date
 * controls and the view switch now lives in here, as the other list pages do
 * with `FilterBar`. The calendar's own row cannot use `FilterBar` itself: its
 * date controls, view switch and create button sit on either side of the
 * Filters button, and on a phone the button has to sit at the END of the date
 * row as a glyph, not at the start as a labelled button.
 *
 * `trigger` is drawn by the parent so the same button can stay in step with
 * the page; this owns the open state and what appears when it is open.
 */
export function FilterPanel({
  count,
  label,
  title,
  doneLabel,
  clearLabel,
  onClear,
  /** A glyph on a phone, where the date controls leave no room for words. */
  glyphOnPhone = true,
  children,
}: {
  /** How many filters are set. */
  count: number;
  /** The button's words, and its accessible name when it carries a count. */
  label: (count: number) => string;
  title: string;
  doneLabel: string;
  clearLabel: string;
  onClear: () => void;
  glyphOnPhone?: boolean;
  children: React.ReactNode;
}) {
  const wide = useMediaQuery(MD);
  /* Open for the form factor it was opened in: remembering `true` alone would
     turn a desktop popover into a phone sheet the moment the window narrowed. */
  const [openFor, setOpenFor] = useState<boolean | null>(null);
  const open = openFor === wide;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = (focus = true) => {
    setOpenFor(null);
    if (focus) trigger.current?.focus();
  };

  /* Placement is written onto the node, not into state: where the panel lands
     is a fact about a layout that has just happened. Portalled and placed in
     viewport coordinates so no card or scroller can clip it, and clamped to the
     window; it opens upward when there is no room below. */
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
      el.style.maxHeight = `${Math.round(Math.max(240, (flip ? a.top : below) - pad - 8))}px`;
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
      /* A Select inside the panel draws its list in a portal of its own. */
      if (n.closest?.("[data-select-panel]")) return;
      setOpenFor(null);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", away);
    };
  }, [open, wide]);

  const words = label(count);
  const button = (
    <button
      ref={trigger}
      type="button"
      id="calendar-filters-button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? "calendar-filters" : undefined}
      aria-label={words}
      title={words}
      onClick={() => (open ? close(false) : setOpenFor(wide))}
      className={cn(
        "relative flex h-11 shrink-0 items-center gap-tight rounded-sm border text-[0.8125rem] font-medium text-fg transition-colors duration-quick md:h-9",
        glyphOnPhone ? "w-11 justify-center md:w-auto md:justify-start md:px-comfortable" : "px-comfortable",
        open || count > 0 ? "border-strong bg-subtle dark:bg-fg/5" : "border-line bg-card hover:border-strong",
      )}
    >
      <ListFilter size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
      <span className={cn(glyphOnPhone && "max-md:sr-only")}>{label(0)}</span>
      {count > 0 && (
        <>
          <span data-filter-count aria-hidden className="grid h-5 min-w-5 place-items-center rounded-full bg-inverse px-inline text-[0.75rem] font-semibold text-inverse-fg max-md:hidden">
            {count}
          </span>
          {/* A dot rather than a count when the words have gone: the accessible
              name still says how many. */}
          <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-inverse md:hidden" />
        </>
      )}
    </button>
  );

  const footer = (
    <>
      {count > 0 && (
        <Button variant="tertiary" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
      <Button variant="secondary" size="sm" className="ml-auto" onClick={() => close()}>
        {doneLabel}
      </Button>
    </>
  );

  return (
    <>
      {button}
      {open &&
        wide &&
        createPortal(
          <div
            ref={panel}
            id="calendar-filters"
            role="dialog"
            aria-label={title}
            className="fixed z-50 flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-md border border-hairline bg-card shadow-lg dark:border-line"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            <div className="flex shrink-0 items-center gap-tight border-t border-hairline px-tight py-inline">{footer}</div>
          </div>,
          document.body,
        )}
      {!wide && (
        <Sheet open={open} onClose={() => close()} title={title} closeLabel={doneLabel} footer={footer}>
          <div id="calendar-filters">{children}</div>
        </Sheet>
      )}
    </>
  );
}
