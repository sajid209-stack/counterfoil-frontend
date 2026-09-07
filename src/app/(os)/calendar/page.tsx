"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button, PageShell, Tabs } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { MD, XL, useMediaQuery } from "@/lib/useMedia";
import {
  listBookings,
  listCategories,
  listHolds,
  listProducts,
  listResources,
  listStaff,
} from "@/lib/api";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { DayGrid, type DayLane } from "./_components/DayGrid";
import { WeekGrid } from "./_components/WeekGrid";
import { MonthGrid } from "./_components/MonthGrid";
import { EventDetail } from "./_components/EventDetail";
import {
  addDays,
  bookingsToEvents,
  holdsToEvents,
  isoDate,
  sameDay,
  startOfDay,
  tradingWindow,
  weekStart,
  type CalEvent,
  type EventTone,
} from "./_components/model";

type View = "day" | "week" | "month";

/** The demo's today. Real deployments read the actual date; see lib/schedule. */
const openingDate = () => startOfDay(new Date(`${DEMO_TODAY}T12:00:00`));

const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** The five states a slot can be in, in the order the key reads them. */
const TONES: EventTone[] = ["booked", "arrived", "noshow", "held", "locked"];
const TONE_KEY: Record<EventTone, string> = {
  booked: "keyBooked",
  arrived: "keyArrived",
  noshow: "keyNoShow",
  held: "keyHeld",
  locked: "keyLocked",
};
const TONE_BAR: Record<EventTone, string> = {
  booked: "border-l-ember",
  arrived: "border-l-success",
  noshow: "border-l-muted",
  held: "border-l-warning",
  locked: "border-l-danger",
};

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const router = useRouter();

  // Server snapshot true: the desktop grids are the heavier markup, so
  // assuming wide means a desktop never flashes the phone layout on hydration.
  // A phone corrects itself on mount, before paint.
  const wide = useMediaQuery(MD, true);
  const compact = !wide;
  /** Wide enough for a week block to carry a second line. */
  const roomy = useMediaQuery(XL, true);

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(openingDate);
  const [groupBy, setGroupBy] = useState<"resource" | "product">("resource");
  /* One clock, shared with the grids. They each used to call `new Date()`,
     which in the demo is a day the seeded week never contains — so no column
     was ever "today", the current-time line never drew, and the button
     labelled Today jumped to a date the grid did not agree was today. */
  const now = useMemo(() => demoNow(), []);
  /** The event the detail panel is showing. Clicking a block opens this
   *  rather than navigating, because at week density the block cannot show
   *  its own name and a page load is a heavy way to ask "what is this?". */
  const [detail, setDetail] = useState<CalEvent | null>(null);

  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 200 }), []);
  const resourcesQ = useApiQuery(
    () => listResources({ pageSize: 100, filters: { status: "active" } }),
    [],
  );
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const categoriesQ = useApiQuery(() => listCategories({ pageSize: 100 }), []);
  const holdsQ = useApiQuery(() => listHolds({ pageSize: 500, filters: { effectiveStatus: "held" } }), []);

  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);

  const events = useMemo<CalEvent[]>(
    () => [
      ...bookingsToEvents(bookingsQ.data?.data ?? [], products, resources, staff),
      ...holdsToEvents(holdsQ.data?.data ?? []),
    ],
    [bookingsQ.data, holdsQ.data, products, resources, staff],
  );

  const loading =
    bookingsQ.loading || productsQ.loading || resourcesQ.loading || holdsQ.loading;

  /* The hours the grids draw, from the catalogue rather than from a guess.
     It lands on the same 06–23 for this venue, which is the point: it was
     right by coincidence before and is right by derivation now. */
  const { openHour, closeHour } = useMemo(
    () => tradingWindow(products, events),
    [products, events],
  );

  // ── filters ───────────────────────────────────────────────────────────────
  // Two questions a manager actually asks of a calendar: "show me just this
  // one thing" and "show me only what is in this state". The first three are
  // selects because they are long lists; the last is the key itself, made
  // clickable — a legend that explains the colours and a filter that acts on
  // them are the same control, and drawing them separately would state the
  // same five words twice.
  const [bookingFilter, setBookingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tones, setTones] = useState<EventTone[]>(TONES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Only the folded-away selects count towards the badge — the tone toggles
   *  are on screen saying their own state, so counting them would report a
   *  filter as hidden while the user is looking straight at it. */
  const selectFilters = [bookingFilter, categoryFilter, ownerFilter].filter(
    (v) => v !== "all",
  ).length;
  const categories = useMemo(() => categoriesQ.data?.data ?? [], [categoriesQ.data]);
  const filtered =
    bookingFilter !== "all" || categoryFilter !== "all" || ownerFilter !== "all" || tones.length !== TONES.length;
  const resetFilters = () => {
    setBookingFilter("all");
    setCategoryFilter("all");
    setOwnerFilter("all");
    setTones(TONES);
  };
  const toggleTone = (tone: EventTone) =>
    setTones((cur) => (cur.includes(tone) ? cur.filter((x) => x !== tone) : [...cur, tone]));

  /** Everything the selects allow, before the state toggles narrow it. Counts
   *  on the toggles are read from HERE, so a state's count does not drop to
   *  zero merely because it is currently switched off. */
  const scoped = useMemo(
    () =>
      events.filter((e) => {
        if (bookingFilter !== "all" && e.productId !== bookingFilter) return false;
        if (categoryFilter !== "all") {
          const p = products.find((x) => x.id === e.productId);
          if (!p || p.categoryId !== categoryFilter) return false;
        }
        if (ownerFilter !== "all" && e.ownerId !== ownerFilter) return false;
        return true;
      }),
    [events, bookingFilter, categoryFilter, ownerFilter, products],
  );
  const visible = useMemo(() => scoped.filter((e) => tones.includes(e.tone)), [scoped, tones]);

  // ── the visible window ────────────────────────────────────────────────────
  const dayEvents = useMemo(
    () => visible.filter((e) => sameDay(e.start, cursor)),
    [visible, cursor],
  );
  const wkStart = useMemo(() => weekStart(cursor), [cursor]);
  const weekEvents = useMemo(() => {
    const end = addDays(wkStart, 7);
    return visible.filter((e) => e.start >= wkStart && e.start < end);
  }, [visible, wkStart]);
  const monthEvents = useMemo(
    () =>
      visible.filter(
        (e) =>
          e.start.getMonth() === cursor.getMonth() &&
          e.start.getFullYear() === cursor.getFullYear(),
      ),
    [visible, cursor],
  );

  /** How many of each state are in the window on screen — the number that
   *  makes the toggle worth reading rather than just worth clicking. */
  const toneCounts = useMemo(() => {
    const inWindow = scoped.filter((e) =>
      view === "day"
        ? sameDay(e.start, cursor)
        : view === "week"
          ? e.start >= wkStart && e.start < addDays(wkStart, 7)
          : e.start.getMonth() === cursor.getMonth() && e.start.getFullYear() === cursor.getFullYear(),
    );
    const out = {} as Record<EventTone, number>;
    for (const t of TONES) out[t] = 0;
    for (const e of inWindow) out[e.tone] += 1;
    return out;
  }, [scoped, view, cursor, wkStart]);

  // ── day lanes ─────────────────────────────────────────────────────────────
  const lanes = useMemo<DayLane[]>(() => {
    if (groupBy === "product") {
      // Only products that actually have something on this day — an empty row
      // per catalogue item would bury the day in blank lanes.
      const ids = [...new Set(dayEvents.map((e) => e.productId))];
      return ids
        .map((id) => ({ id, name: products.find((p) => p.id === id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const rows: DayLane[] = resources.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.outOfService ? (r.outOfServiceReason ?? t("outOfService")) : r.nounSingular,
      blocked: r.outOfService,
    }));
    // Guides are capacity owners too, so a departure they lead is on the day.
    const guideIds = [
      ...new Set(
        dayEvents
          .map((e) => e.ownerId)
          .filter((id): id is string => !!id && !resources.some((r) => r.id === id)),
      ),
    ];
    for (const id of guideIds) {
      rows.push({ id, name: staff.find((s) => s.id === id)?.name ?? id, note: t("guideLane") });
    }
    if (dayEvents.some((e) => e.ownerId == null)) {
      rows.push({ id: "__none__", name: t("noResource"), note: t("noResourceNote") });
    }
    return rows;
  }, [groupBy, dayEvents, products, resources, staff, t]);

  // In product grouping the lane key is the product, not the capacity owner.
  const laneEvents = useMemo(
    () =>
      groupBy === "product"
        ? dayEvents.map((e) => ({ ...e, ownerId: e.productId }))
        : dayEvents.map((e) => ({ ...e, ownerId: e.ownerId ?? "__none__" })),
    [dayEvents, groupBy],
  );

  // ── navigation ────────────────────────────────────────────────────────────
  const step = (dir: 1 | -1) =>
    setCursor((c) =>
      view === "day"
        ? addDays(c, dir)
        : view === "week"
          ? addDays(c, dir * 7)
          : new Date(c.getFullYear(), c.getMonth() + dir, 1),
    );

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-GB", opts).format(d);
    if (view === "day") {
      return fmt(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (view === "week") {
      const end = addDays(wkStart, 6);
      const sameMonth = wkStart.getMonth() === end.getMonth();
      return `${fmt(wkStart, { day: "numeric", ...(sameMonth ? {} : { month: "short" }) })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return fmt(cursor, { month: "long", year: "numeric" });
  }, [view, cursor, wkStart]);

  /** Where a booking leads once you have decided it is the one you wanted. */
  const canOpen = (e: CalEvent) => e.kind === "hold" || !!e.orderId;
  const openEvent = (e: CalEvent) => {
    if (e.kind === "hold") router.push("/holds");
    else if (e.orderId) router.push(`/orders/${e.orderId}`);
  };

  /* An empty grid caused by a filter looks exactly like a genuinely empty
     week, which is the one thing it must not do. When the window has nothing
     in it AND something is filtering, say so and offer the way back. */
  const inWindow = view === "day" ? dayEvents : view === "week" ? weekEvents : monthEvents;
  const emptyByFilter = !loading && inWindow.length === 0 && filtered;

  /** The key IS the filter: each chip says what its colour means, how many
   *  are in view, and switches that state off when tapped. Drawing a legend
   *  and a filter separately would state the same five words twice. */
  const toneKey = TONES.map((tone) => {
    const on = tones.includes(tone);
    return (
      <button
        key={tone}
        type="button"
        aria-pressed={on}
        onClick={() => toggleTone(tone)}
        className={cn(
          "flex h-11 items-center gap-tight rounded-sm border px-comfortable text-[12px] transition-colors duration-quick md:h-9",
          on ? "border-line bg-card text-fg" : "border-line bg-subtle text-faint",
        )}
      >
        <span
          className={cn(
            "h-3 w-3 rounded-xs border border-line border-l-[3px]",
            TONE_BAR[tone],
            !on && "opacity-40",
          )}
        />
        {t(TONE_KEY[tone])}
        <span className="font-mono text-[12px] text-muted">{toneCounts[tone]}</span>
      </button>
    );
  });

  const weekdayLabels = WEEKDAYS_MON_FIRST.map((d) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(2026, 6, 5 + d)),
  );

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
    >
      <div className="flex flex-col gap-section">
        {/* The range and the control that changes it, together. They were 60px
            apart — arrows in the page header, the label they move down beside
            the tabs — so you read where you are in one place and moved it in
            another. */}
        <div className="flex flex-wrap items-center justify-between gap-comfortable">
          <Tabs
            items={[
              { value: "day", label: t("tabDay") },
              { value: "week", label: t("tabWeek") },
              { value: "month", label: t("tabMonth") },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
          />

          <div className="flex flex-wrap items-center gap-tight">
            <Button variant="secondary" size="sm" onClick={() => setCursor(openingDate())}>
              {t("today")}
            </Button>
            <div className="flex items-center gap-inline">
              <button
                type="button"
                aria-label={t("previous")}
                onClick={() => step(-1)}
                className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-subtle"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              {/* Between the arrows, which is where you look for it — and a
                  live region, because stepping a week changes nothing else a
                  screen reader would announce. */}
              <h2
                aria-live="polite"
                className="min-w-[11rem] px-tight text-center text-[15px] font-medium tracking-tight"
              >
                {rangeLabel}
              </h2>
              <button
                type="button"
                aria-label={t("next")}
                onClick={() => step(1)}
                className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-subtle"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
            <input
              aria-label={tc("chooseDate")}
              type="date"
              value={isoDate(cursor)}
              onChange={(e) =>
                e.target.value && setCursor(startOfDay(new Date(`${e.target.value}T12:00:00`)))
              }
              className="h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
            />
          </div>
        </div>

        {/* ── filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-tight">
          {/* The key stays out where it can be read — it is the legend, and
              hiding it makes five colours unreadable. The three selects fold
              away: they were three full-width controls on a phone, and with
              the tabs and the key above them the grid did not start until 62%
              of the screen had gone by. */}
          <div className="flex flex-wrap items-center gap-tight">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="calendar-filters"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "flex h-11 items-center gap-tight rounded-sm border px-comfortable text-[13px] transition-colors duration-quick md:h-9",
                selectFilters > 0
                  ? "border-ember bg-ember/10 text-brand-foreground"
                  : "border-line hover:bg-subtle",
              )}
            >
              <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />
              {selectFilters > 0 ? t("filtersActive", { count: selectFilters }) : t("filters")}
            </button>

            {!compact && toneKey}

            {view === "day" && !compact && resources.length > 0 && (
              <span className="flex items-center gap-inline">
                {(["resource", "product"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={groupBy === g}
                    onClick={() => setGroupBy(g)}
                    className={cn(
                      "h-11 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick md:h-9",
                      groupBy === g
                        ? "border-ember bg-ember/10 text-brand-foreground"
                        : "border-line text-muted hover:bg-subtle",
                    )}
                  >
                    {t(g === "resource" ? "groupByResource" : "groupByProduct")}
                  </button>
                ))}
              </span>
            )}

            {/* Not while the empty-state notice below is offering the same
                button — two ways out of one situation, side by side. */}
            {filtered && !emptyByFilter && (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                {t("clearFilters")}
              </Button>
            )}
          </div>

          <div id="calendar-filters" hidden={!filtersOpen} className="flex flex-col gap-tight">
            {compact && <div className="flex flex-wrap items-center gap-tight">{toneKey}</div>}
            <div className="flex flex-wrap items-center gap-tight">
            <select
              value={bookingFilter}
              onChange={(e) => setBookingFilter(e.target.value)}
              aria-label={t("filterBooking")}
              className="h-11 md:h-9 min-w-0 max-w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse"
            >
              <option value="all">{t("allBookings")}</option>
              {[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label={t("filterCategory")}
              className="h-11 md:h-9 min-w-0 max-w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse"
            >
              <option value="all">{t("allCategories")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {(resources.length > 0 || staff.length > 0) && (
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                aria-label={t("filterOwner")}
                className="h-11 md:h-9 min-w-0 max-w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse"
              >
                <option value="all">{t("allOwners")}</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            </div>
          </div>
        </div>

        {emptyByFilter && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-comfortable rounded-sm border border-line bg-subtle px-comfortable py-tight"
          >
            <span className="min-w-0 text-[13px]">
              <span className="font-medium">{t("noMatch")}</span>{" "}
              <span className="text-muted">{t("noMatchHint")}</span>
            </span>
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              {t("clearFilters")}
            </Button>
          </div>
        )}

        <div className="card-surface overflow-hidden">
          {loading ? (
            <div aria-busy="true" className="h-[28rem] animate-pulse bg-line/40" />
          ) : view === "day" ? (
            <DayGrid
              date={cursor}
              lanes={lanes}
              events={laneEvents}
              now={now}
              openHour={openHour}
              closeHour={closeHour}
              onSelect={setDetail}
              emptyLabel={t("nothingToday")}
              showEmptyLabel={(n) => t("showEmptyLanes", { count: n })}
              hideEmptyLabel={t("hideEmptyLanes")}
              compact={compact}
            />
          ) : view === "week" ? (
            <WeekGrid
              weekStartDate={wkStart}
              events={weekEvents}
              now={now}
              openHour={openHour}
              closeHour={closeHour}
              allDayLabel={t("allDayStrip")}
              emptyLabel={t("nothingToday")}
              roomy={roomy}
              onSelect={setDetail}
              onPickDay={(d) => {
                setCursor(d);
                setView("day");
              }}
              dayLabel={(d) => ({
                weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d),
                day: String(d.getDate()),
              })}
              moreLabel={(n) => t("more", { count: n })}
              compact={compact}
            />
          ) : (
            <MonthGrid
              month={cursor}
              events={monthEvents}
              now={now}
              weekdayLabels={weekdayLabels}
              moreLabel={(n) => t("more", { count: n })}
              onSelect={setDetail}
              onPickDay={(d) => {
                setCursor(d);
                setView("day");
              }}
              compact={compact}
              dayHeading={(d) =>
                new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(d)
              }
              emptyLabel={t("nothingToday")}
            />
          )}
        </div>

        <EventDetail
          event={detail}
          onClose={() => setDetail(null)}
          onOpen={openEvent}
          canOpen={!!detail && canOpen(detail)}
          dayLabel={(d) =>
            new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(d)
          }
          t={t}
        />
      </div>
    </PageShell>
  );
}
