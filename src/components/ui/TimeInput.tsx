"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseTimeOfDay } from "@/lib/duration";
import { formatClock } from "@/lib/format";
import { toMinutes, toTime } from "@/lib/schedule";
import { Field } from "./Field";

/** What the field draws for a stored "HH:MM": "7:30 PM". Empty stays empty —
 *  `formatClock`'s dash is for a read-only cell, not for a box to type in. */
const shown = (hhmm: string) => (hhmm ? formatClock(hhmm) : "");

/** A time-of-day field a human can type into. It DRAWS 12-hour — "7:30 PM",
 *  like every time a person reads in the product — and its value stays the
 *  stored 24h "HH:MM". Typing reads either clock: `7:30 pm`, `7:30p`, `7pm`,
 *  `730p`, `19:30`, `1930`, `930`, `7` (→ 7:00 AM). Steppers adjust by `step`
 *  minutes; any minute is typable. */
export function TimeInput({
  label,
  value,
  onChange,
  step = 15,
  picker = false,
  help,
  error,
  required,
  disabled,
  className,
}: {
  label?: string;
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  step?: number;
  /** Offer the times as a list as well as typing them. Opt-in, because most
   *  of this app's time fields sit in dense forms where a stepper is quicker
   *  — and because a control used in eighty places does not change shape on
   *  everyone at once. */
  picker?: boolean;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const listId = useId();
  const [text, setText] = useState(() => shown(value));
  const [focused, setFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const openBtn = useRef<HTMLButtonElement>(null);

  /* Every time of day at the step — 96 of them at a quarter hour, which is a
     list rather than a row of chips, and is why this is a dropdown. */
  const times: string[] = [];
  for (let m = 0; m < 1440; m += step) times.push(toTime(m));

  useEffect(() => {
    if (!focused) setText(shown(value));
  }, [value, focused]);

  /* Placed in viewport coordinates and portalled to <body>, the same way the
     app's other dropdown is: a time field sits inside cards and scrollers
     that would otherwise clip the list. Written onto the node rather than
     into state — where it lands is a fact about the layout that has just
     happened. */
  useLayoutEffect(() => {
    const el = panel.current;
    const t = box.current;
    if (!open || !el || !t) return;
    const place = () => {
      const pad = 8;
      const a = t.getBoundingClientRect();
      el.style.width = `${Math.round(a.width)}px`;
      el.style.top = "0px";
      el.style.left = "0px";
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      let x = Math.min(a.left, window.innerWidth - pad - r.width);
      x = Math.max(x, pad);
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      const y = flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(y)}px`;
      el.style.maxHeight = `${Math.round(Math.max(120, (flip ? a.top : window.innerHeight - a.bottom) - pad - 8))}px`;
    };
    place();
    /* Not the list's OWN scroll: a capturing listener sees it, and `place`
       clears the height cap before measuring — which un-overflows the list
       for an instant and resets it to the top. It fought the opening scroll
       and would have fought a wheel just as hard. */
    const onScroll = (e: Event) => {
      if (el.contains(e.target as Node)) return;
      place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  /* Open ON the time it already holds, and bring it into view — a list of 96
     that opens at midnight is a list nobody can use. */
  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    const row = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el || !row) return;
    /* Scroll the PANEL, not the page: `scrollIntoView` on a fixed, portalled
       list scrolls whatever ancestor it finds, which here is the document —
       so the list stayed at midnight and the page jumped instead. */
    /* Centre it only when it is out of view. A row the pointer is resting on
       is already in view, and recentring the list under the pointer moved the
       row away between press and release — so the click landed on the list
       itself and nothing was chosen. Arrow keys past an edge still bring the
       next row into view. */
    const above = row.offsetTop < el.scrollTop;
    const below = row.offsetTop + row.offsetHeight > el.scrollTop + el.clientHeight;
    if (!above && !below) return;
    const top = row.offsetTop - el.clientHeight / 2 + row.offsetHeight / 2;
    el.scrollTop = Math.max(0, top);
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const openList = () => {
    const at = times.indexOf(value);
    setActive(at >= 0 ? at : Math.max(0, times.findIndex((x) => x > value)));
    setOpen(true);
  };

  const choose = (t: string) => {
    setParseError(null);
    onChange(t);
    setText(shown(t));
    setOpen(false);
  };

  const commit = (raw: string) => {
    const parsed = parseTimeOfDay(raw);
    if (parsed == null) {
      setParseError(`Couldn't read "${raw}" — try "9:30 AM", "6:30 PM" or "6:30p".`);
      setText(shown(value));
      return;
    }
    setParseError(null);
    onChange(parsed);
    setText(shown(parsed));
  };

  const nudge = (dir: 1 | -1) => {
    const next = toTime((toMinutes(value) + dir * step + 1440) % 1440);
    setParseError(null);
    onChange(next);
    setText(shown(next));
  };

  /* An inset ring, not a border: a border takes two pixels out of the
     44px box, and the steppers inside it were left 42px tall on a phone. */
  const border = error || parseError ? "ring-danger focus-within:ring-danger" : "ring-line focus-within:ring-inverse";

  /* The floor is on the OUTER box, and it is the control's own rather than the
     caller's to get wrong: below md the two nudges are 44px squares each, so a
     caller asking for 7rem left about 24px for the field and the time simply
     vanished. min-width beats width, so a narrow caller reserves the room in
     the layout instead of overflowing it. */
  return (
    <Field label={label} help={help} error={error ?? parseError ?? undefined} required={required} htmlFor={id} className={cn("min-w-[9.5rem] md:min-w-[7.75rem]", className)}>
      <div ref={box} className={cn("flex h-11 items-stretch overflow-hidden rounded-sm bg-card ring-1 ring-inset transition-colors duration-quick", border, disabled && "bg-subtle")}>
        <input
          id={id}
          type="text"
          /* Not `numeric`: a phone's number pad has no letters, and "7:30 pm"
             is now as much the way in as "1930". */
          autoComplete="off"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => { setFocused(true); e.target.select(); }}
          onBlur={(e) => { setFocused(false); commit(e.target.value); }}
          role={picker ? "combobox" : undefined}
          aria-expanded={picker ? open : undefined}
          aria-controls={picker && open ? listId : undefined}
          aria-activedescendant={picker && open ? `${listId}-${active}` : undefined}
          aria-autocomplete={picker ? "none" : undefined}
          onKeyDown={(e) => {
            /* With a list, the field drives it and focus never leaves: that
               is what a combo box does, and it is what lets somebody type
               "18" and then arrow into the quarter hours around it. */
            if (picker && open) {
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(times.length - 1, i + 1)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return; }
              if (e.key === "Home") { e.preventDefault(); setActive(0); return; }
              if (e.key === "End") { e.preventDefault(); setActive(times.length - 1); return; }
              if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); choose(times[active]); return; }
            }
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (picker) openList();
              else nudge(-1);
            }
          }}
          onWheel={(e) => { if (focused) { e.preventDefault(); nudge(e.deltaY < 0 ? 1 : -1); } }}
          className="w-full bg-transparent px-comfortable text-sm tabular-nums outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {/* Where the caller asked for a list, one control rather than three:
            a chevron that opens every time at the step. Typing still works,
            and so do the arrow keys and the wheel, so nothing is lost. */}
        {picker ? (
          <button
            type="button"
            ref={openBtn}
            aria-label="Choose a time"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            disabled={disabled}
            onClick={() => {
              if (open) { setOpen(false); return; }
              openList();
              /* The field drives the list, so the field takes the focus —
                 otherwise the arrow keys land on a button that ignores them. */
              document.getElementById(id)?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !open) { e.preventDefault(); openList(); }
            }}
            className="flex w-11 shrink-0 items-center justify-center border-l border-line text-muted transition-colors duration-quick hover:text-fg active:bg-line md:w-8"
          >
            <ChevronDown size={15} strokeWidth={1.5} aria-hidden />
          </button>
        ) : (
        <div className="flex flex-row-reverse border-l border-line md:flex-col">
          <button type="button" tabIndex={-1} aria-label="Later" disabled={disabled} onClick={() => nudge(1)} className="flex h-full w-11 items-center justify-center text-muted hover:text-fg active:bg-line md:h-1/2 md:w-8"><ChevronUp size={13} strokeWidth={1.5} /></button>
          <button type="button" tabIndex={-1} aria-label="Earlier" disabled={disabled} onClick={() => nudge(-1)} className="flex h-full w-11 items-center justify-center border-r border-line text-muted hover:text-fg active:bg-line md:h-1/2 md:w-8 md:border-r-0 md:border-t"><ChevronDown size={13} strokeWidth={1.5} /></button>
        </div>
        )}
      </div>

      {open &&
        createPortal(
          <div
            ref={panel}
            id={listId}
            role="listbox"
            aria-label="Times"
            tabIndex={-1}
            onKeyDown={(e) => {
              /* The field owns the keyboard; this is for a pointer user whose
                 click put focus in here. */
              if (e.key === "Escape") { e.stopPropagation(); setOpen(false); openBtn.current?.focus(); }
            }}
            className="fixed z-50 flex flex-col overflow-y-auto rounded-md border border-line bg-card py-inline shadow-lg"
          >
            {times.map((t, i) => (
              <button
                key={t}
                id={`${listId}-${i}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={t === value}
                data-active={i === active || undefined}
                onClick={() => choose(t)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-tight px-comfortable text-left text-sm tabular-nums md:min-h-9",
                  i === active ? "bg-muted-wash text-fg" : "text-fg",
                )}
              >
                {shown(t)}
                {t === value && <Check size={14} strokeWidth={2} aria-hidden className="shrink-0 text-brand-foreground" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </Field>
  );
}
