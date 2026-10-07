"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export interface ChipOption {
  value: string;
  label: string;
}

/** From this many options up the list grows a search field, as `Select` does. */
const SEARCHABLE_FROM = 8;

/** The chip's own look, shared with the date chip so the toolbar reads as one row. */
export const chipBox = (active: boolean, open: boolean) =>
  cn(
    /* 46px outside is 44px inside the border: the trigger is the touch target. */
    "flex h-[46px] min-w-0 max-w-full items-stretch rounded-sm border bg-card text-[0.8125rem] transition-colors duration-quick md:h-9",
    active ? "border-ember bg-ember/10" : open ? "border-inverse" : "border-line hover:border-strong",
  );

/**
 * A filter you can choose several values of, drawn as a chip that says what it
 * is set to.
 *
 * `Select` picks one. A report asks "cash *or* bKash, at the main gate *or* the
 * kiosk", so this picks many — and because a closed filter that does not say
 * what it holds is a filter nobody trusts, the chip carries its selection in
 * its own face: **Counter: Fort Main Gate +1**, with a clear button beside it.
 * The popover stays open while values are ticked (closing after each tick turns
 * choosing three things into three trips), and offers Clear and Done.
 *
 * Built the way `Select` is: a combobox-style trigger, a listbox portalled to
 * <body> so no card can clip it, placed in viewport coordinates and clamped to
 * the window, Escape and Tab to leave, arrows and Space to choose.
 */
export function FilterChip({
  label,
  options,
  value,
  onChange,
  icon,
  searchPlaceholder,
  emptyLabel,
  className,
  iconOnly = false,
  resetLabel,
  onReset,
}: {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  /** Just the glyph, never the selection and never a clear button — for a
   *  control that is a setting rather than a filter (which columns to show). */
  iconOnly?: boolean;
  /** What the popover's left-hand button says and does, where "clear" is the
   *  wrong word: columns reset to their defaults rather than to nothing. */
  resetLabel?: string;
  onReset?: () => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("orders.chip");
  const reactId = useId();
  const listId = `${reactId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchable = options.length >= SEARCHABLE_FROM;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const chosen = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const on = chosen.length > 0 && !iconOnly;
  const summary = on ? (chosen.length > 1 ? `${chosen[0]} +${chosen.length - 1}` : chosen[0]) : "";

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const openList = () => {
    setActive(0);
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const f = requestAnimationFrame(() => (searchable ? input.current?.focus() : listRef.current?.focus()));
    return () => cancelAnimationFrame(f);
  }, [open, searchable]);

  /* Placement, written onto the node rather than into state — where the panel
     lands is a fact about a layout that has just happened. Same reasoning, and
     the same clamping, as `Select`. */
  useLayoutEffect(() => {
    const el = panel.current;
    const tr = trigger.current;
    if (!open || !el || !tr) return;
    const place = () => {
      const pad = 8;
      const a = (root.current ?? tr).getBoundingClientRect();
      el.style.top = "0px";
      el.style.left = "0px";
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      const x = Math.max(pad, Math.min(a.left, window.innerWidth - pad - r.width));
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      const y = flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(y)}px`;
      el.style.maxHeight = `${Math.round(Math.max(160, (flip ? a.top : window.innerHeight - a.bottom) - pad - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, shown.length]);

  /* Escape leaves from anywhere while the list is open — focus moves into the
     list a frame after it opens, and a key pressed in that frame should not be
     lost. */
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setQuery("");
      trigger.current?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!root.current?.contains(n) && !panel.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    const move = (d: number) => {
      e.preventDefault();
      setActive((i) => (shown.length === 0 ? 0 : (i + d + shown.length) % shown.length));
    };
    if (e.key === "ArrowDown") return move(1);
    if (e.key === "ArrowUp") return move(-1);
    if (e.key === "Home") { e.preventDefault(); return setActive(0); }
    if (e.key === "End") { e.preventDefault(); return setActive(Math.max(0, shown.length - 1)); }
    /* Space types a space into the search field, so there Enter alone chooses. */
    if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      e.stopPropagation();
      const o = shown[active];
      if (o) toggle(o.value);
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === "Tab") return close(false);
  };

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <div className={cn(chipBox(on, open), iconOnly && "w-[46px] md:w-9")}>
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={on ? `${label}: ${chosen.join(", ")}` : label}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              openList();
            }
          }}
          title={iconOnly ? label : undefined}
          className={cn("flex min-w-0 flex-1 items-center rounded-sm text-left outline-none", iconOnly ? "justify-center" : "gap-tight px-comfortable")}
        >
          {icon && <span className={cn("shrink-0", iconOnly ? "text-fg" : "text-muted")}>{icon}</span>}
          {!iconOnly && (
            <>
              <span className="min-w-0 truncate">
                <span className="text-fg">{label}</span>
                {on && (
                  <>
                    <span className="text-fg">: </span>
                    <span className="font-medium text-fg">{summary}</span>
                  </>
                )}
              </span>
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
            </>
          )}
        </button>
        {on && (
          <button
            type="button"
            onClick={() => onChange([])}
            aria-label={tc("clearFilter", { name: label })}
            className="grid w-11 shrink-0 place-items-center rounded-r-sm text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash md:w-9"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={panel}
            className="fixed z-50 flex max-h-[20rem] w-max min-w-[14rem] max-w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-md border border-line bg-card shadow-lg"
          >
            {searchable && (
              <div data-focus-host className="flex shrink-0 items-center gap-inline border-b border-hairline px-comfortable focus-within:border-ember">
                <Search size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                <input
                  ref={input}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  onKeyDown={onKey}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder ?? label}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-multiselectable="true"
              aria-label={label}
              tabIndex={searchable ? -1 : 0}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              onKeyDown={searchable ? undefined : onKey}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-inline outline-none"
            >
              {shown.length === 0 && emptyLabel && <p className="px-comfortable py-tight text-[0.8125rem] text-muted">{emptyLabel}</p>}
              {shown.map((o, i) => {
                const picked = value.includes(o.value);
                return (
                  <div
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={picked}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-tight px-comfortable text-sm sm:min-h-9",
                      i === active && "bg-muted-wash",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-xs border",
                        picked ? "border-inverse bg-inverse text-inverse-fg" : "border-strong bg-card",
                      )}
                    >
                      {picked && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", picked && "font-medium")}>{o.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-tight border-t border-hairline px-tight py-inline">
              <button
                type="button"
                disabled={onReset ? false : chosen.length === 0}
                onClick={() => (onReset ? onReset() : onChange([]))}
                className="h-11 rounded-sm px-comfortable text-[0.8125rem] font-medium text-muted hover:text-fg disabled:opacity-40 sm:h-9"
              >
                {resetLabel ?? t("clear")}
              </button>
              <button
                type="button"
                onClick={() => close()}
                className="h-11 rounded-sm px-comfortable text-[0.8125rem] font-medium text-fg hover:bg-muted-wash sm:h-9"
              >
                {t("done")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
