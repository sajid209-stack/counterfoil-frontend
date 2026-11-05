"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { shiftDay } from "@/lib/dayModel";
import { MD, useMediaQuery } from "@/lib/useMedia";

const RAIL = "(min-width: 64rem) and (orientation: landscape)";
import { tileClass } from "../../_components/Tiles";

/* ── The days, as one strip that scrolls sideways ─────────────────────────
 *
 * A week you could only turn a page at a time made "Friday three weeks out"
 * four taps. Square Appointments, Fresha and Google Calendar's phone apps all
 * do the same two things instead: the days run on in a strip you flick, and a
 * calendar button opens the whole month for a long jump. This is both. The
 * chosen day is the solid orange one, today is ringed, the first of each month
 * carries the month's name, and the month above follows the left edge.
 *
 * Past days stay reachable (the schedule has always shown them, to look up
 * what was booked); the strip starts a week back and runs two months ahead,
 * and grows if the calendar sends it somewhere further.
 */

const DAYS_BACK = 7;
const DAYS_AHEAD = 60;
const latn = { numberingSystem: "latn" } as const;
const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);

export function DayStrip({
  title,
  date,
  today,
  load,
  onChange,
  middle,
}: {
  /** The page's title, drawn on the header's one line from the desktop up
   *  (below it the page keeps its screen-reader-only heading). */
  title?: React.ReactNode;
  date: string;
  today: string;
  /** How many bookings a day holds — the dots under it. */
  load: (iso: string) => number;
  onChange: (iso: string) => void;
  /** Sits between the month and the buttons from lg up (the group tabs). */
  middle?: React.ReactNode;
}) {
  const t = useTranslations("schedule");
  const format = useFormatter();
  const md = useMediaQuery(MD);
  /* On a desktop the toolbar steps a day at a time and the strip has its own
     arrows; on a phone the arrows turn a week, as they always did. */
  const rail = useMediaQuery(RAIL);
  const [open, setOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  /* Set when the day was chosen somewhere other than the strip (arrows, the
     calendar, Today): only then does the strip move. Tapping a day you can
     already see must not slide the row under your thumb. */
  const follow = useRef(true);
  const [viewIso, setViewIso] = useState(date);
  const [inView, setInView] = useState(true);

  const days = useMemo(() => {
    const from = shiftDay(date < shiftDay(today, -DAYS_BACK) ? date : today, -DAYS_BACK);
    const to = date > shiftDay(today, DAYS_AHEAD) ? shiftDay(date, 14) : shiftDay(today, DAYS_AHEAD);
    const out: string[] = [];
    for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
    return out;
  }, [date, today]);

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const cells = el.querySelectorAll<HTMLElement>("[data-day]");
    if (cells.length < 2) return;
    const stride = cells[1].offsetLeft - cells[0].offsetLeft;
    const idx = Math.min(days.length - 1, Math.max(0, Math.round(el.scrollLeft / stride)));
    setViewIso(days[idx]);
    const sel = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (sel) setInView(sel.offsetLeft >= el.scrollLeft - 1 && sel.offsetLeft + sel.offsetWidth <= el.scrollLeft + el.clientWidth + 1);
  }, [days]);

  /* Bring the chosen day to the start of the strip, with one day of lead-in so
     it is clearly not the edge. Sets scrollLeft on the strip itself, where
     scrollIntoView would move the page as well. */
  useLayoutEffect(() => {
    const el = stripRef.current;
    const sel = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && sel && follow.current) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.dataset.ready !== "1";
      el.scrollTo({ left: Math.max(0, sel.offsetLeft - sel.offsetWidth - 4), behavior: still ? "auto" : "smooth" });
      el.dataset.ready = "1";
      follow.current = false;
    }
    measure();
  }, [date, days, measure]);

  useEffect(() => {
    if (!open || !md) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, md]);

  /* The strip's own arrows page it by what is showing, without choosing a
     day: they move the window, the toolbar moves the day. */
  const scrollStrip = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.93, behavior: "smooth" });
  };

  const pick = (iso: string, scroll: boolean) => {
    follow.current = scroll;
    onChange(iso);
  };
  const choose = (iso: string) => {
    setOpen(false);
    pick(iso, true);
    triggerRef.current?.focus();
  };

  /* Arrow keys walk the days and Enter or Space chooses, as on any button.
     One tab stop for the whole strip, on the chosen day. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const cur = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
    const next = (step > 0 ? cur?.nextElementSibling : cur?.previousElementSibling) as HTMLElement | null;
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  const monthLabel = format.dateTime(dateOf(viewIso), { month: "long", year: "numeric", ...latn });
  const dc = dateOf(date);
  const chosen = `${format.dateTime(dc, { weekday: "short" })} ${format.dateTime(dc, { day: "numeric", ...latn })} ${format.dateTime(dc, { month: "short" })}`;
  const showChosen = !inView;
  const picker = (
    <div className="mx-auto w-max max-w-full pb-comfortable md:pb-0 [&>div>button:last-child]:min-w-11 [&_.type-label]:text-sm">
      <DatePicker
        value={date}
        today={today}
        shape="go"
        autoFocus
        onChange={choose}
        labels={{ previousMonth: t("previousMonth"), nextMonth: t("nextMonth"), today: t("today") }}
      />
    </div>
  );

  return (
    <>
      <div data-top-band className="flex items-center gap-inline rail:h-12 rail:gap-2">
        {title ? <h1 className="mr-section hidden shrink-0 text-xl font-semibold tracking-title text-fg rail:order-first rail:mr-4 rail:block">{title}</h1> : null}
        <button type="button" onClick={() => pick(shiftDay(date, rail ? -1 : -7), true)} aria-label={rail ? t("prevDay") : t("prevWeek")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-card hover:bg-muted-wash rail:size-9 rail:rounded-control rail:shadow-none rail:ring-1 rail:ring-inset rail:ring-line rail:order-1">
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        </button>
        <p className="min-w-0 truncate text-center text-md font-semibold text-fg rail:hidden">{monthLabel}</p>
        {/* A desktop names the day itself, so the label can never disagree with the board (the strip may be scrolled to another month). */}
        <p suppressHydrationWarning className="hidden shrink-0 whitespace-nowrap text-base font-semibold text-fg rail:order-4 rail:block">{chosen}</p>
        <button type="button" onClick={() => pick(shiftDay(date, rail ? 1 : 7), true)} aria-label={rail ? t("nextDay") : t("nextWeek")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-card hover:bg-muted-wash rail:size-9 rail:rounded-control rail:shadow-none rail:ring-1 rail:ring-inset rail:ring-line rail:order-3">
          <ChevronRight size={20} strokeWidth={2} aria-hidden />
        </button>
        {middle ? <div className="hidden min-w-0 flex-1 px-tight lg:block rail:order-6 rail:ml-2 rail:flex-none rail:px-0">{middle}</div> : null}
        <span className={cn("flex-1", Boolean(middle) && "lg:hidden")} />
        {(date !== today || rail) && (
          <button type="button" onClick={() => pick(today, true)} disabled={rail && date === today} className="inline-flex h-11 shrink-0 items-center rounded-full bg-card px-comfortable text-base font-semibold text-fg shadow-card hover:bg-muted-wash rail:font-medium rail:order-2 rail:h-9 rail:rounded-control rail:px-3 rail:shadow-none rail:ring-1 rail:ring-inset rail:ring-line rail:disabled:text-muted">
            {t("today")}
          </button>
        )}
        <div ref={wrapRef} className="relative shrink-0 rail:order-5">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`${t("chooseDate")} — ${chosen}`}
            suppressHydrationWarning
            title={t("chooseDate")}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-tight rounded-full bg-card text-base font-semibold text-fg shadow-card hover:bg-muted-wash rail:size-9 rail:rounded-control rail:px-0 rail:shadow-none rail:ring-1 rail:ring-inset rail:ring-line",
              showChosen ? "px-comfortable" : "w-11",
            )}
          >
            <CalendarDays size={20} strokeWidth={2} aria-hidden />
            {showChosen && <span suppressHydrationWarning className="whitespace-nowrap rail:hidden">{chosen}</span>}
          </button>
          {open && md && (
            <div id={panelId} role="dialog" aria-label={t("chooseDate")} className="absolute right-0 top-[calc(100%+4px)] z-40 w-max rounded-go border border-line bg-card shadow-lg">
              {picker}
            </div>
          )}
        </div>
      </div>

      <div className="rail:flex rail:items-center rail:gap-2">
      <button type="button" onClick={() => scrollStrip(-1)} aria-label={t("prevWeek")} className="hidden size-9 shrink-0 items-center justify-center rounded-control text-fg-secondary ring-1 ring-inset ring-line hover:bg-muted-wash rail:inline-flex">
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </button>
      <div
        ref={stripRef}
        role="group"
        aria-label={t("daysLabel")}
        onScroll={measure}
        onKeyDown={onKeyDown}
        className="relative -mx-gutter flex snap-x snap-proximity gap-tight overflow-x-auto scroll-px-gutter px-gutter py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rail:mx-0 rail:min-w-0 rail:flex-1 rail:scroll-px-0 rail:gap-1.5 rail:px-0 rail:py-0.5"
      >
        {days.map((iso) => {
          const on = iso === date;
          const isToday = iso === today;
          const dt = dateOf(iso);
          const n = Math.min(3, load(iso));
          const monthStart = dt.getDate() === 1;
          return (
            <button
              key={iso}
              data-day
              type="button"
              onClick={() => pick(iso, false)}
              aria-pressed={on}
              aria-current={isToday ? "date" : undefined}
              tabIndex={on ? 0 : -1}
              aria-label={format.dateTime(dt, { weekday: "long", day: "numeric", month: "long", ...latn })}
              className={tileClass({
                selected: on,
                className: cn("min-h-14 w-12 shrink-0 snap-start gap-0.5 px-0 rail:h-10 rail:min-h-10 rail:w-auto rail:basis-[calc((100%-13*6px)/14)] rail:flex-row rail:gap-1 rail:overflow-hidden rail:px-0.5", monthStart && "ml-1 rail:ml-0", !on && isToday && "ring-2 ring-inset ring-ember-solid"),
              })}
            >
              {/* Node and Chromium abbreviate some Bangla months differently, so the short month may differ after hydration. */}
              <span suppressHydrationWarning className={cn("text-sm font-medium rail:hidden", on ? "text-on-solid" : "text-muted")}>
                {monthStart ? format.dateTime(dt, { month: "short" }) : format.dateTime(dt, { weekday: "narrow" })}
              </span>
              <span suppressHydrationWarning className={cn("hidden whitespace-nowrap text-sm font-normal rail:inline", on ? "text-on-solid" : "text-muted")}>
                {monthStart ? format.dateTime(dt, { month: "short" }) : format.dateTime(dt, { weekday: "short" })}
              </span>
              <span className="text-lg font-semibold tabular-nums leading-none rail:text-base">{dt.getDate()}</span>
              <span aria-hidden className="flex h-1.5 gap-0.5 rail:[&>span:nth-child(n+2)]:hidden">
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-on-solid" : "bg-ember")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => scrollStrip(1)} aria-label={t("nextWeek")} className="hidden size-9 shrink-0 items-center justify-center rounded-control text-fg-secondary ring-1 ring-inset ring-line hover:bg-muted-wash rail:inline-flex">
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </button>
      </div>

      {!md && (
        <Sheet open={open} onClose={() => setOpen(false)} title={t("chooseDate")} closeLabel={t("close")}>
          {picker}
        </Sheet>
      )}
    </>
  );
}
