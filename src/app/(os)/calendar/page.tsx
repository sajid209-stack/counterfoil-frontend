"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, PageShell, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import {
  listBookings,
  listCategories,
  listHolds,
  listProducts,
  listResources,
  listStaff,
} from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { DayGrid, type DayLane } from "./_components/DayGrid";
import { WeekGrid } from "./_components/WeekGrid";
import { MonthGrid } from "./_components/MonthGrid";
import {
  addDays,
  bookingsToEvents,
  holdsToEvents,
  isoDate,
  sameDay,
  startOfDay,
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

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(openingDate);
  const [groupBy, setGroupBy] = useState<"resource" | "product">("resource");

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

  const openEvent = (e: CalEvent) => {
    if (e.kind === "hold") router.push("/holds");
    else if (e.orderId) router.push(`/orders/${e.orderId}`);
  };

  const weekdayLabels = WEEKDAYS_MON_FIRST.map((d) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(2026, 6, 5 + d)),
  );

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
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
            onChange={(e) => e.target.value && setCursor(startOfDay(new Date(`${e.target.value}T12:00:00`)))}
            className="h-11 md:h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-section">
        <div className="flex flex-wrap items-center justify-between gap-tight">
          <Tabs
            items={[
              { value: "day", label: t("tabDay") },
              { value: "week", label: t("tabWeek") },
              { value: "month", label: t("tabMonth") },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
          />
          <span className="font-mono text-[13px] text-muted">{rangeLabel}</span>
        </div>

        {/* ── filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-tight">
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

            {filtered && (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                {t("clearFilters")}
              </Button>
            )}
          </div>

          {/* The key IS the filter. Each one says what its colour means, how
              many are in view, and switches that state off when tapped. */}
          <div className="flex flex-wrap items-center gap-tight">
            {TONES.map((tone) => {
              const on = tones.includes(tone);
              return (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTone(tone)}
                  className={`flex items-center gap-tight rounded-sm border px-comfortable py-1 text-[12px] transition-colors duration-quick ${
                    on ? "border-line bg-card text-fg" : "border-line bg-subtle text-faint"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-xs border border-line border-l-[3px] ${TONE_BAR[tone]} ${on ? "" : "opacity-40"}`} />
                  {t(TONE_KEY[tone])}
                  <span className="font-mono text-[12px] text-muted">{toneCounts[tone]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {view === "day" && !compact && resources.length > 0 && (
          <div className="flex flex-wrap gap-inline">
            {(["resource", "product"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`h-11 md:h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
                  groupBy === g
                    ? "border-ember bg-ember/10 text-brand-foreground"
                    : "border-line text-muted hover:bg-subtle"
                }`}
              >
                {t(g === "resource" ? "groupByResource" : "groupByProduct")}
              </button>
            ))}
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
              onSelect={openEvent}
              emptyLabel={t("nothingToday")}
              compact={compact}
            />
          ) : view === "week" ? (
            <WeekGrid
              weekStartDate={wkStart}
              events={weekEvents}
              onSelect={openEvent}
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
              weekdayLabels={weekdayLabels}
              moreLabel={(n) => t("more", { count: n })}
              onSelect={openEvent}
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

      </div>
    </PageShell>
  );
}
