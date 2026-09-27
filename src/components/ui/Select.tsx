"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** A second line under the label, where a value needs qualifying. */
  note?: string;
  disabled?: boolean;
  /** Options carrying the same group are drawn under one heading. */
  group?: string;
}

/**
 * Counterfoil's own dropdown.
 *
 * A native `<select>` hands its list to the operating system: it cannot be
 * themed, its options cannot carry a second line or a group heading, the
 * chevron sits wherever the platform puts it, and on Windows the popup arrives
 * in the system's font on a white sheet in the middle of a dark app. Eighty of
 * them across this product — 47 written out and 33 through `Field` — meant
 * eighty places the design system stopped at the edge of a control.
 *
 * **Type-ahead is the reason this is worth building rather than restyling.**
 * A list of four is a list you read; a list of twenty venues, forty bookings or
 * a hundred customers is a list you search. So above a threshold the popover
 * grows a filter field, and typing anywhere in the list jumps to the next
 * option starting with those letters — the behaviour a native select has and
 * almost nothing rebuilt on the web keeps.
 *
 * Built to the ARIA combobox pattern, and to the same rules `HeaderSearch`
 * follows: the input keeps focus while `aria-activedescendant` points at the
 * highlighted row, so a screen reader announces the option without the focus
 * ring leaving the field.
 */

/**
 * From this many options up, the popover carries a search field; below it,
 * typing jumps to the next match instead. Five, because four is still a list
 * you read and five is where scanning stops being faster than typing.
 */
const SEARCHABLE_FROM = 5;

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  name,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  size = "md",
  searchPlaceholder,
  emptyLabel,
  align = "start",
  bare = false,
  dataAttrs,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /**
   * The trigger's height, and the ONLY place it is set: `sm` is a dense
   * toolbar control, `md` the form control, `lg` the till's 48px touch floor.
   * Never layer a height through `triggerClassName` — `cn` does not merge
   * conflicting utilities, so `h-11 h-12` is decided by stylesheet order.
   */
  size?: "sm" | "md" | "lg";
  /**
   * `bare` draws no box of its own and sizes to what it says — for a control
   * that lives INSIDE a chip or a row that already has a border. A native
   * select did this for free; the popover has to be told.
   */
  bare?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  align?: "start" | "end";
  /**
   * `data-*` attributes for the trigger, for a page that has to find or focus
   * this control by hand — the reports filter bar focuses a chip it has just
   * added, which needs a handle on the focusable element itself.
   */
  dataAttrs?: Record<`data-${string}`, string>;
}) {
  const reactId = useId();
  const listId = `${id ?? reactId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /* Type-to-jump on an unsearched list: the letters typed in the last second,
     the way a native select behaves. */
  const typed = useRef({ text: "", at: 0 });

  const searchable = options.length >= SEARCHABLE_FROM;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    /* Matches the start of any word, not any substring: typing "p" should
       offer Planetarium before it offers Day Pass. */
    const starts = options.filter((o) => o.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
    const rest = options.filter((o) => !starts.includes(o) && o.label.toLowerCase().includes(q));
    return [...starts, ...rest];
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  /*
   * Opening lands the highlight on what is already chosen, so Enter is a no-op
   * rather than a silent change to the first row. Set here rather than in an
   * effect: which row is highlighted is a consequence of the press that opened
   * the popover, and a setState in an effect is an error in this codebase.
   */
  const openList = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };

  /* Focus, though, IS an effect: the field it moves to does not exist until the
     popover has mounted. */
  useEffect(() => {
    if (!open) return;
    const f = requestAnimationFrame(() => (searchable ? input.current?.focus() : listRef.current?.focus()));
    return () => cancelAnimationFrame(f);
  }, [open, searchable]);

  /*
   * Where the popover goes — and why it is a portal.
   *
   * A native select drew its list through the operating system: nothing on the
   * page could clip it and it could never leave the screen. An ordinary
   * absolutely-positioned panel loses both of those. Measured rather than
   * assumed, across every converted dropdown at two widths:
   *
   *   - `section.card-surface` carries `overflow-hidden` so its hairline rows
   *     stay inside its rounded corners, and it cut the Sign-in rules popover
   *     clean in half. Any card, any scrolling table, does the same.
   *   - A trigger near an edge pushed the panel 63px past the right on
   *     /orders and 48px past the left on /dashboard, both at 390.
   *
   * So the panel is portalled to <body> and placed in viewport coordinates,
   * which no ancestor can clip, and clamped to the window. It writes onto the
   * node rather than into state: where it lands is a fact about the layout
   * that has just happened, and a setState in an effect is an error here.
   */
  useLayoutEffect(() => {
    const el = panel.current;
    const t = trigger.current;
    if (!open || !el || !t) return;
    const place = () => {
      const pad = 8;
      const a = t.getBoundingClientRect();
      /* Match the trigger's width unless the caller asked for a panel that
         sizes to its own content. */
      if (!bare) el.style.width = `${Math.round(a.width)}px`;
      el.style.top = "0px";
      el.style.left = "0px";
      /* Clear the previous placement's cap before measuring, or a panel that
         was once squeezed against the bottom of the window stays squeezed
         after a resize that gave it room again. */
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      let x = align === "end" ? a.right - r.width : a.left;
      x = Math.min(x, window.innerWidth - pad - r.width);
      x = Math.max(x, pad);
      /* Below the trigger, or above it where there is no room below — which is
         what a form's last field does on a phone. */
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      const y = flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(y)}px`;
      el.style.maxHeight = `${Math.round(Math.max(120, (flip ? a.top : window.innerHeight - a.bottom) - pad - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, shown.length, align, bare]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      /* The panel is portalled to <body>, so "outside" is neither the control
         nor the panel — testing only the control would close it on its own
         options. */
      if (!root.current?.contains(n) && !panel.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  /* Keep the highlighted row in view without scrolling the page behind it. */
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = (focusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.value);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const move = (d: number) => {
      e.preventDefault();
      setActive((i) => {
        let n = i;
        for (let k = 0; k < shown.length; k++) {
          n = (n + d + shown.length) % shown.length;
          if (!shown[n]?.disabled) break;
        }
        return n;
      });
    };
    if (e.key === "ArrowDown") return move(1);
    if (e.key === "ArrowUp") return move(-1);
    if (e.key === "Home") { e.preventDefault(); return setActive(0); }
    if (e.key === "End") { e.preventDefault(); return setActive(shown.length - 1); }
    /* Both stop here. `Modal` listens for Escape on the document, so without
       this an Escape meant for the popover would close the dialog under it as
       well; and an Enter meant for an option would reach a form behind. */
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const o = shown[active]; if (o) choose(o); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return close(); }
    if (e.key === "Tab") return close(false);
    /* Type-to-jump, only where there is no search field to type into. */
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 900 ? e.key : typed.current.text + e.key, at: now };
      const q = typed.current.text.toLowerCase();
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(q));
      if (i >= 0) setActive(i);
    }
  };

  const groups = useMemo(() => {
    const out: { name?: string; items: { o: SelectOption; i: number }[] }[] = [];
    shown.forEach((o, i) => {
      const last = out[out.length - 1];
      if (last && last.name === o.group) last.items.push({ o, i });
      else out.push({ name: o.group, items: [{ o, i }] });
    });
    return out;
  }, [shown]);

  return (
    <div ref={root} className={cn("relative", className)}>
      {/* A real form value, so anything reading the DOM still finds one. */}
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        {...dataAttrs}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex min-w-0 items-center text-left outline-none transition-colors duration-quick",
          bare
            ? "max-w-[14rem] gap-tight bg-transparent pl-inline pr-0 text-[0.8125rem] font-medium"
            : /* The chevron sits in a reserved gutter rather than floating at
                 the end of the text: every trigger's arrow then lines up down a
                 column of controls, whatever each one says. */
              cn(
                "w-full justify-between gap-tight rounded-sm border bg-card pl-comfortable pr-tight text-sm",
                "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-faint",
                ariaInvalid ? "border-danger" : "border-line hover:border-strong",
              ),
          /* A fixed height is part of having a box, so `bare` does not take
              one — it sits in a chip or a card header that already has its own.
              The touch floor still applies on a phone, where the control is
              the whole target; from `sm` it collapses to its own text, which
              is what the native control it replaced did. */
          bare ? "min-h-11 sm:min-h-0" : size === "sm" ? "h-9" : size === "lg" ? "h-12" : "h-11",
          triggerClassName,
        )}
      >
        <span className={cn("min-w-0 truncate", !bare && "flex-1", !selected && "text-muted")}>
          {selected ? selected.label : (placeholder ?? "")}
        </span>
        <ChevronDown
          size={bare ? 14 : 16}
          strokeWidth={1.5}
          aria-hidden
          className={cn(
            "shrink-0 text-muted transition-transform duration-quick",
            bare ? "w-3.5" : "w-5",
            open && "rotate-180",
          )}
        />
      </button>

      {open && createPortal(
        <div
          ref={panel}
          className={cn(
            "fixed z-50 flex max-h-[18rem] min-w-[12rem] flex-col overflow-hidden rounded-sm border border-line bg-card shadow-lg",
            bare && "w-max max-w-[18rem]",
          )}
        >
          {/* `data-focus-host` because the global `:focus-visible` rule is
              UNLAYERED and beats every utility — without it the field draws a
              square ember ring across the panel's rounded corners. The rule
              this codebase already carries for the POS search pill. */}
          {searchable && (
            <div data-focus-host className="flex shrink-0 items-center gap-inline border-b border-hairline px-comfortable focus-within:border-ember">
              <Search size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              <input
                ref={input}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKey}
                placeholder={searchPlaceholder}
                /* Never nameless: a caller may give no placeholder, and
                   "search field" alone does not say what is being searched. */
                aria-label={searchPlaceholder ?? ariaLabel}
                /* Deliberately NOT a second combobox. The trigger is the
                   combobox — it owns aria-expanded and aria-controls — and
                   this is a filter inside its popup. Two comboboxes for one
                   control is ambiguous to a screen reader, and it made
                   `[role="combobox"]` match twice whenever a list was open. */
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
            tabIndex={searchable ? -1 : 0}
            aria-label={ariaLabel}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            onKeyDown={searchable ? undefined : onKey}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-inline outline-none"
          >
            {shown.length === 0 && emptyLabel && (
              /* Only where the caller has supplied the wording. A blank strip
                 under a search field reads as a rendering fault, and this
                 layer has no translator of its own — every primitive here
                 takes its strings as props. */
              <p className="px-comfortable py-tight text-[0.8125rem] text-muted">{emptyLabel}</p>
            )}
            {groups.map((g, gi) => (
              <div key={g.name ?? gi} role="group" aria-label={g.name}>
                {g.name && (
                  <p className="px-comfortable pb-inline pt-tight text-[0.75rem] font-medium text-muted">{g.name}</p>
                )}
                {g.items.map(({ o, i }) => {
                  const on = o.value === value;
                  return (
                    <div
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-i={i}
                      role="option"
                      aria-selected={on}
                      aria-disabled={o.disabled || undefined}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onClick={() => choose(o)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-tight px-comfortable text-sm sm:min-h-9",
                        o.disabled && "cursor-not-allowed text-faint",
                        !o.disabled && i === active && "bg-muted-wash",
                        on && "font-medium",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.note && <span className="block truncate text-[0.75rem] text-muted">{o.note}</span>}
                      </span>
                      {on && <Check size={15} strokeWidth={2} aria-hidden className="shrink-0 text-brand-foreground" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
