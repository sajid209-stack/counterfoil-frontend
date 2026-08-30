"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, PageShell, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  listBookings,
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
} from "./_components/model";

type View = "day" | "week" | "month";

/** The demo's today. Real deployments read the actual date; see lib/schedule. */
const openingDate = () => startOfDay(new Date(`${DEMO_TODAY}T12:00:00`));

const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const router = useRouter();

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

  // ── the visible window ────────────────────────────────────────────────────
  const dayEvents = useMemo(
    () => events.filter((e) => sameDay(e.start, cursor)),
    [events, cursor],
  );
  const wkStart = useMemo(() => weekStart(cursor), [cursor]);
  const weekEvents = useMemo(() => {
    const end = addDays(wkStart, 7);
    return events.filter((e) => e.start >= wkStart && e.start < end);
  }, [events, wkStart]);
  const monthEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.start.getMonth() === cursor.getMonth() &&
          e.start.getFullYear() === cursor.getFullYear(),
      ),
    [events, cursor],
  );

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
      note: r.outOfService
        ? (r.outOfServiceReason ?? t("outOfService"))
        : `${r.nounSingular} · ${r.locationId ? "" : ""}`.trim() || null,
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
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-subtle"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => step(1)}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-subtle"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
          <input
            type="date"
            value={isoDate(cursor)}
            onChange={(e) => e.target.value && setCursor(startOfDay(new Date(`${e.target.value}T12:00:00`)))}
            className="h-9 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
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

        {view === "day" && resources.length > 0 && (
          <div className="flex flex-wrap gap-inline">
            {(["resource", "product"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
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
            />
          )}
        </div>

        {/* What the shading means. A calendar without a key is a puzzle. */}
        <div className="flex flex-wrap items-center gap-section text-[12px] text-muted">
          {[
            { tone: "border-l-ember", label: t("keyBooked") },
            { tone: "border-l-success", label: t("keyArrived") },
            { tone: "border-l-muted", label: t("keyNoShow") },
            { tone: "border-l-warning", label: t("keyHeld") },
            { tone: "border-l-danger", label: t("keyLocked") },
          ].map((k) => (
            <span key={k.label} className="flex items-center gap-tight">
              <span className={`h-3 w-3 rounded-xs border border-line border-l-[3px] ${k.tone}`} />
              {k.label}
            </span>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
