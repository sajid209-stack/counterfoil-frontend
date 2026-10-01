"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button, DateField, PageShell, Select, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { LG, MD, XL, useMediaQuery } from "@/lib/useMedia";
import {
  bookingEditable,
  checkInBooking,
  getOperator,
  getSlots,
  isResourceFreeFor,
  peekBookings,
  rescheduleBooking,
  listBookings,
    listHolds,
  listProducts,
  listResources,
  listStaff,
  lockBooking,
  peekOrders,
  placeHold,
  releaseHold,
  unlockBooking,
} from "@/lib/api";
import { DEMO_TODAY, demoNow, isSlotBased, slotISO, toMinutes as toMinutesOf, toTime } from "@/lib/schedule";
import { formatClock, formatClockMin, formatPriceShort } from "@/lib/format";
import { DayGrid, type DayLane } from "./_components/DayGrid";
import { WeekGrid } from "./_components/WeekGrid";
import { MonthGrid } from "./_components/MonthGrid";
import { EventDetail } from "./_components/EventDetail";
import { HoldList } from "./_components/HoldList";
import { EventPeek } from "./_components/EventPeek";
import { CalendarStats } from "./_components/CalendarStats";
import { BookingPanel, type BookingRequest, type Carry } from "./_components/BookingPanel";
import { openHours, openSlotsFor, optionsInHour, sessionLaneId, type OpenSlot } from "./_components/openSlots";
import {
  addDays,
  bookingsToEvents,
  minutesOf,
  holdsToEvents,
  isoDate,
  sameDay,
  startOfDay,
  tradingWindow,
  weekStart,
  windowStats,
  type CalEvent,
  type EventWords,
  type Ghost,
  TONE_CLASS,
  TONE_DOT,
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
/** The legend swatch is a miniature of the block itself. When blocks were
 *  white with a coloured edge this was a square with a coloured edge; now that
 *  they are filled, so is this. A key that does not look like the thing it
 *  explains is a key you have to learn twice. */
const TONE_SWATCH: Record<EventTone, string> = {
  booked: "bg-ember-wash border-ember/40",
  arrived: "bg-success-wash border-success/40",
  noshow: "bg-muted-wash border-line",
  held: "bg-warning-wash border-warning/40",
  locked: "bg-danger-wash border-danger/40",
};

/** Whose name the lock record carries. The order page uses the same one. */
const ACTOR = "Nadia Islam";

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const toast = useToast();
  const tc = useTranslations("common");
  /* The hold vocabulary is shared with the till, so it keeps its own
     namespace — what moved was the page, not the mechanism. */
  const th = useTranslations("holds");
  const router = useRouter();

  // Server snapshot true: the desktop grids are the heavier markup, so
  // assuming wide means a desktop never flashes the phone layout on hydration.
  // A phone corrects itself on mount, before paint.
  const wide = useMediaQuery(MD, true);
  const compact = !wide;
  /** Wide enough for a week block to carry a second line. */
  const roomy = useMediaQuery(XL, true);
  /* The week grid gives up its columns later than the rest of the page does.
     Seven of them need the card to be about 620px wide before a day is worth
     reading, which is `lg` — between `md` and `lg` the full grid used to
     scroll sideways inside the card with three days off the end and nothing
     saying so. The chrome around it still branches at `md`. */
  const weekCompact = !useMediaQuery(LG, true);

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
  /** The block the pointer is over, and where it is. Hover answers "what is
   *  that one?" without the click that the full panel costs. */
  const [peek, setPeek] = useState<CalEvent | null>(null);
  const [peekAt, setPeekAt] = useState<DOMRect | null>(null);
  const onPeek = (e: CalEvent | null, anchor: DOMRect | null) => {
    setPeek(e);
    setPeekAt(anchor);
  };

  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 200 }), []);
  const resourcesQ = useApiQuery(
    () => listResources({ pageSize: 100, filters: { status: "active" } }),
    [],
  );
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const holdsQ = useApiQuery(() => listHolds({ pageSize: 500, filters: { effectiveStatus: "held" } }), []);
  const operatorQ = useApiQuery(() => getOperator(), []);

  /** An empty slot that was clicked, or the New booking button. */
  const [request, setRequest] = useState<BookingRequest | null>(null);
  /** The booking being made, as the grid draws it. The panel moves it. */
  const [ghost, setGhost] = useState<Ghost | null>(null);
  /* What was typed into a panel that closed without booking — the guest's
     name, their number, how they are paying. Someone on the phone asks about
     four, then says "actually, five": clicking five closes one panel and
     opens another, and retyping the name is the cost of that. A popover that
     closes on a click elsewhere must not throw work away, so the next one
     starts from it. Cleared once a booking is made. */
  const [carry, setCarry] = useState<Carry | null>(null);
  /** The order just booked, so its block can say "this one" for a moment. */
  const [justBooked, setJustBooked] = useState<string | null>(null);
  const openRequest = (r: BookingRequest) => {
    setDetail(null);
    setRequest(r);
    setGhost(
      r.hour == null
        ? null
        : {
            date: r.date,
            /* The draft is drawn where the gesture put it, to the quarter
               hour; `hour` is only which hour's options the panel lists. */
            start: r.lane ? toMinutesOf(r.lane.time) : r.startMinutes ?? r.hour * 60,
            end:
              (r.lane ? toMinutesOf(r.lane.time) : r.startMinutes ?? r.hour * 60) +
              (r.minutes ?? r.lane?.span ?? 60),
            laneId: r.lane?.laneId,
            title: null,
          },
    );
  };
  /* Availability is read from the store at render, so a booking just made has
     to say so: this moves on every booking and every open-slot list is keyed
     on it. */
  const [stamp, setStamp] = useState(0);
  const today = DEMO_TODAY;
  const nowMin = minutesOf(now);

  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const resources = useMemo(() => resourcesQ.data?.data ?? [], [resourcesQ.data]);
  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);

  /* Who each order is for, read from the store when the bookings arrive —
     an order and its bookings are written together, so a new booking's
     guest is there by the time its block is. */
  const guestOf = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const o of bookingsQ.data ? peekOrders() : []) m.set(o.id, o.customerName);
    return m;
  }, [bookingsQ.data]);

  /* The words a block carries — "2 people", "Sales stopped" — from the
     messages, so a Bangla screen does not draw English on every block. */
  const words = useMemo<EventWords>(
    () => ({
      people: (count) => t("people", { count }),
      holdWhole: t("holdWhole"),
      holdPlace: t("holdPlace"),
      holdSeats: (count) => t("holdSeatsHeld", { count }),
      holdSpaces: (count) => t("holdSpacesHeld", { count }),
    }),
    [t],
  );

  const events = useMemo<CalEvent[]>(
    () => [
      ...bookingsToEvents(bookingsQ.data?.data ?? [], products, resources, staff, (id) => guestOf.get(id) ?? null, words).map((e) =>
        /* A booking of a lane or a field that is on none of them is using
           one the availability engine cannot see. Named on its block, so a
           "4 free" that is really three has a visible reason. */
        e.ownerId == null && products.find((p) => p.id === e.productId)?.resourceIds?.length
          ? { ...e, subtitle: [e.subtitle, t("unassigned")].filter(Boolean).join(" · ") }
          : e,
      ),
      ...holdsToEvents(holdsQ.data?.data ?? [], words),
    ],
    [bookingsQ.data, holdsQ.data, products, resources, staff, guestOf, t, words],
  );

  /* The skeleton is for the first load only. A reload after a booking, a lock
     or a check-in keeps the grid on screen: swapping it for a grey slab
     unmounted it, threw away its scroll position and flashed the page at the
     very moment the new booking was meant to appear on it. */
  const loading =
    (bookingsQ.loading && !bookingsQ.data) ||
    (productsQ.loading && !productsQ.data) ||
    (resourcesQ.loading && !resourcesQ.data) ||
    (holdsQ.loading && !holdsQ.data);

  /** Products that run as sessions of their own — a show, a departure — rather
   *  than on a field. Their bookings belong on a lane of their own in the day. */
  const sessionProductIds = useMemo(
    () =>
      new Set(
        products
          .filter((p) => isSlotBased(p.bookingType) && !(p.resourceIds?.length))
          .map((p) => p.id),
      ),
    [products],
  );

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
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tones, setTones] = useState<EventTone[]>(TONES);
  /* What a block's colour MEANS. Status is the default and always has been —
     the five-state key doubles as the filter, which is most of why this
     calendar reads as a working tool rather than a wall of pastels. Category
     is the owner's ask, and it answers a different question: not "what is
     happening to this booking" but "what KIND of thing is it", which is what
     a manager scanning a week for the tours actually wants. */
  /* Who the record says did it. Same constant the order page uses — the mock
     has no session user beyond DEMO_STAFF_ID, and inventing a second name for
     the same actor would put two people in one audit trail. */
  const [acting, setActing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Closing hands the focus back to the button that opened it — on a phone
   *  the panel is a dialog, and a dialog that closes onto nothing leaves a
   *  keyboard at the top of the page. */
  const closeFilters = () => {
    setFiltersOpen(false);
    document.getElementById("calendar-filters-button")?.focus();
  };
  /** Only the folded-away selects count towards the badge — the tone toggles
   *  are on screen saying their own state, so counting them would report a
   *  filter as hidden while the user is looking straight at it. */
  const selectFilters = [bookingFilter, ownerFilter].filter(
    (v) => v !== "all",
  ).length;
  /* What can be sold from the calendar as it is filtered. Filtered to the
     bowling, the grid shades the hours bowling cannot fill and the panel
     offers bowling — what you are looking at is what you can book. */
  const sellProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          bookingFilter === "all" || p.id === bookingFilter,
      ),
    [products, bookingFilter],
  );
  const filtered =
    bookingFilter !== "all" || ownerFilter !== "all" || tones.length !== TONES.length;
  const resetFilters = () => {
    setBookingFilter("all");
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
        if (ownerFilter !== "all" && e.ownerId !== ownerFilter) return false;
        return true;
      }),
    [events, bookingFilter, ownerFilter],
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

  // ── what is still open ────────────────────────────────────────────────────
  /* The day's open field-hours and departures, for the tiles on the day grid.
     Product grouping draws lanes per booking rather than per field, where a
     field-hour offered as Cricket and as Futsal would be drawn twice, so the
     tiles belong to the resource view only. `stamp` is in the dependencies on
     purpose: availability is read from the store, which a booking just moved. */
  const dayOpen = useMemo<OpenSlot[]>(
    () => (view === "day" && groupBy === "resource" && stamp >= 0 ? openSlotsFor(sellProducts, isoDate(cursor), today, nowMin) : []),
    [view, groupBy, sellProducts, cursor, today, nowMin, stamp],
  );

  /** For each day of the week on screen, how much is open in each hour. */
  const weekOpen = useMemo(() => {
    const out = new Map<string, number>();
    if (view !== "week" || stamp < 0) return out;
    for (let i = 0; i < 7; i++) {
      const date = isoDate(addDays(wkStart, i));
      if (date < today) continue;
      const slots = openSlotsFor(sellProducts, date, today, nowMin);
      for (let h = openHour; h < closeHour; h++) {
        const n = optionsInHour(sellProducts, slots, date, h, today, nowMin).length;
        if (n > 0) out.set(`${date}|${h}`, n);
      }
    }
    return out;
  }, [view, wkStart, sellProducts, today, nowMin, openHour, closeHour, stamp]);

  /** New booking from the header: the day on screen (never one already gone),
   *  at the next hour that has anything to sell. */
  const openNewBooking = (on?: Date, anchor: DOMRect | null = null) => {
    const iso = isoDate(on ?? cursor);
    const date = iso < today ? today : iso;
    const hrs = openHours(sellProducts, openSlotsFor(sellProducts, date, today, nowMin), date, today, nowMin, openHour, closeHour);
    openRequest({ date, hour: hrs[0]?.hour ?? null, anchor });
  };

  const dayLong = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);

  /** The phone's open-hour chips, in words. */
  const chipText = {
    heading: t("book.openToBook"),
    label: (count: number) => t("book.openShort", { count }),
    name: (hour: number, count: number) =>
      t("book.openChipLabel", { time: formatClockMin(hour * 60), count }),
  };

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
      sellable: true,
      buffer: Math.max(0, ...products.filter((p) => p.resourceIds?.includes(r.id)).map((p) => p.bufferMinutes ?? 0)),
      single: products.filter((p) => p.resourceIds?.includes(r.id)).length === 1,
    }));
    /* A session is its own lane: its bookings and its open departures read
       along one row, the way a field's hours do. It used to sit in "Not
       assigned", which described the database rather than the venue. */
    const sessionIds = new Set([
      ...dayOpen.filter((o) => o.isSession).map((o) => o.laneId.slice("session:".length)),
      ...dayEvents
        .filter((e) => e.ownerId == null && sessionProductIds.has(e.productId))
        .map((e) => e.productId),
    ]);
    const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id;
    for (const id of [...sessionIds].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) {
      rows.push({ id: sessionLaneId(id), name: nameOf(id), note: t("sessionLane"), sellable: true });
    }
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
    if (dayEvents.some((e) => e.ownerId == null && !sessionProductIds.has(e.productId))) {
      rows.push({ id: "__none__", name: t("noResource"), note: t("noResourceNote") });
    }
    return rows;
  }, [groupBy, dayEvents, dayOpen, sessionProductIds, products, resources, staff, t]);

  // In product grouping the lane key is the product, not the capacity owner.
  const laneEvents = useMemo(
    () =>
      groupBy === "product"
        ? dayEvents.map((e) => ({ ...e, ownerId: e.productId }))
        : dayEvents.map((e) => ({
            ...e,
            ownerId: e.ownerId ?? (sessionProductIds.has(e.productId) ? sessionLaneId(e.productId) : "__none__"),
          })),
    [dayEvents, groupBy, sessionProductIds],
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

  /** Where a booking leads once you have decided it is the one you wanted.
   *  A hold leads nowhere: everything it can do, it does in the panel. */
  const canOpen = (e: CalEvent) => e.kind === "booking" && !!e.orderId;
  const openEvent = (e: CalEvent) => {
    if (e.orderId) router.push(`/orders/${e.orderId}`);
  };

  /* What the period on screen holds, and how it compares with the one before
     it. Counted from `scoped` — the select filters apply, the state toggles do
     not, because switching "no-show" off is a way of looking at the grid
     rather than a claim that there were none. */
  const [statsNow, statsPrev] = useMemo(() => {
    const bounds = (offset: number): [Date, Date] => {
      if (view === "day") {
        const from = startOfDay(addDays(cursor, offset));
        return [from, addDays(from, 1)];
      }
      if (view === "week") {
        const from = addDays(wkStart, offset * 7);
        return [from, addDays(from, 7)];
      }
      const from = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
      return [from, new Date(cursor.getFullYear(), cursor.getMonth() + offset + 1, 1)];
    };
    const [a, b] = bounds(0);
    const [pa, pb] = bounds(-1);
    return [windowStats(scoped, a, b), windowStats(scoped, pa, pb)];
  }, [scoped, view, cursor, wkStart]);

  /** The register's one surviving job: everything held, wherever it is. */
  const [holdList, setHoldList] = useState(false);
  const activeHolds = useMemo(
    () => (holdsQ.data?.data ?? []).filter((h) => h.active).sort((a, b) => `${a.date}${a.slotStart ?? ""}`.localeCompare(`${b.date}${b.slotStart ?? ""}`)),
    [holdsQ.data],
  );

  /* Holds outside the window on screen.
     The register that listed every hold is gone, and a grid only shows the
     days somebody has navigated to — so a hold placed three months out would
     sit there unseen until it was too late to matter. The held figure says
     how many are elsewhere, and pressing it goes to the nearest one. */
  const heldElsewhere = useMemo(() => {
    const all = (holdsQ.data?.data ?? []).filter((h) => h.active);
    if (!all.length) return null;
    const from = view === "day" ? startOfDay(cursor) : view === "week" ? wkStart : new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = view === "day" ? addDays(from, 1) : view === "week" ? addDays(from, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const out = all.filter((h) => {
      const d = new Date(`${h.date}T12:00:00`);
      return d < from || d >= to;
    });
    if (!out.length) return null;
    /* The next one forward if there is one, otherwise the most recent behind:
       a manager stepping through the year should land on the one they have
       not dealt with yet. */
    const ahead = out.filter((h) => new Date(`${h.date}T12:00:00`) >= to).sort((a, b) => a.date.localeCompare(b.date));
    const behind = out.filter((h) => new Date(`${h.date}T12:00:00`) < from).sort((a, b) => b.date.localeCompare(a.date));
    const next = ahead[0] ?? behind[0];
    return { count: out.length, date: next.date };
  }, [holdsQ.data, view, cursor, wkStart]);

  /* An empty grid caused by a filter looks exactly like a genuinely empty
     week, which is the one thing it must not do. When the window has nothing
     in it AND something is filtering, say so and offer the way back. */
  const inWindow = view === "day" ? dayEvents : view === "week" ? weekEvents : monthEvents;
  const emptyByFilter = !loading && inWindow.length === 0 && filtered;

  /**
   * What a block is painted.
   *
   * Colour means STATUS — catalogue groups are gone, and with them the choice
   * of painting by one. Two rules are not negotiable. **Held and closed keep
   * their hatching**: those are the app's "you cannot have this" signal,
   * carried by texture as well as colour so it never depends on hue — and a
   * held slot painted in its category's colour would look sellable. And a
   * **no-show keeps its strike-through**, so the category says what the
   * booking is while the strike still says nobody came.
   */
  const blockClass = useCallback(
    (e: CalEvent) => {
      /* Colour means STATUS. A no-show keeps its strike-through as well, so
         "nobody came" is carried by shape and not by colour alone. */
      const base = TONE_CLASS[e.tone];
      const paint = e.tone === "noshow" ? `${base} line-through` : base;
      /* The booking just made, ringed for a moment where the draft stood —
         the answer to "did that work?" is on the grid, not only in a toast
         at the other corner of the screen. */
      return e.orderId && e.orderId === justBooked
        ? `${paint} ring-2 ring-ember-solid ring-offset-1 ring-offset-card`
        : paint;
    },
    [justBooked],
  );
  useEffect(() => {
    if (!justBooked) return;
    const id = window.setTimeout(() => setJustBooked(null), 2600);
    return () => window.clearTimeout(id);
  }, [justBooked]);

  /* Google Calendar's keys, where they mean the same thing here: c to make
     something, t for today, d / w / m for the grain, j / k (or n / p) to step.
     Only when nothing is being typed and no panel is open — a shortcut that
     fires inside a name field is a bug with a keyboard. */
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (request || detail || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "c") openNewBooking();
      else if (k === "t") setCursor(openingDate());
      else if (k === "d") setView("day");
      else if (k === "w") setView("week");
      else if (k === "m") setView("month");
      else if (k === "j" || k === "n") step(1);
      else if (k === "k" || k === "p") step(-1);
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const dotClass = useCallback(
    (e: CalEvent) => {
      return TONE_DOT[e.tone];
    },
    [],
  );

  /* Lock, unlock and mark-arrived, from the block you are looking at. Each
     goes through the SAME api the order page uses, so a booking locked here
     is locked everywhere and the reason lands on the same record. */
  const detailBlocked = useMemo(() => {
    if (!detail || detail.kind !== "booking" || detail.locked) return null;
    const check = bookingEditable(detail.id, ACTOR);
    return check.editable ? null : check.reason;
  }, [detail]);

  const doLock = async (e: CalEvent, lock: boolean, reason: string) => {
    setActing(true);
    const res = lock ? await lockBooking(e.id, ACTOR, reason) : await unlockBooking(e.id, ACTOR, reason);
    setActing(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    toast.success(t(lock ? "lockedToast" : "unlockedToast"));
    setDetail(null);
    bookingsQ.reload();
  };

  /* Releasing puts the places back on public sale at once, so it is offered
     with a way back: Undo places the same hold again. It is a new record with
     a new id — which is honest, because the first one really was released. */
  const doRelease = async (e: CalEvent) => {
    const before = (holdsQ.data?.data ?? []).find((h) => h.id === e.id);
    setActing(true);
    const res = await releaseHold(e.id);
    setActing(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setDetail(null);
    holdsQ.reload();
    toast.success(th("released", { heldFor: e.title }), {
      label: t("undo"),
      run: async () => {
        if (!before) return;
        const back = await placeHold({
          productId: before.productId,
          locationId: before.locationId,
          kind: before.kind,
          date: before.date,
          slotStart: before.slotStart ?? null,
          slotEnd: before.slotEnd ?? null,
          quantity: before.quantity,
          seatLabels: before.seatLabels,
          resourceId: before.resourceId ?? null,
          resourceName: before.resourceName ?? null,
          heldFor: before.heldFor,
          reason: before.reason,
          placedBy: before.placedBy,
          expiresAt: before.expiresAt ?? null,
        });
        if (back.ok) holdsQ.reload();
        else toast.error(back.error.message);
      },
    });
  };

  /* ── moving a booking by dragging it ──────────────────────────────────────
     The gesture is the grid's; what may move, where it may land and whether
     it lands at all are decided here, where the store is.

     A hold does not move: it is released from its own panel, which is a
     different act with a different consequence. A stack is several bookings
     wearing one block, so moving it would move some of them. And a booking
     somebody has locked does not move at all — `bookingEditable` is the one
     question every edit path in this app asks, so it is asked here too. */
  const canMove = useCallback(
    (e: CalEvent) => e.kind === "booking" && !e.id.startsWith("stack:") && !e.locked,
    [],
  );

  /** Where a drop really lands. A booking sold in departures follows its own
   *  departures rather than the quarter hour the pointer is on, so the label
   *  under the cursor is the time the booking will actually have. */
  const moveSnap = useCallback(
    (e: CalEvent, date: string, start: number) => {
      const product = products.find((x) => x.id === e.productId);
      if (!product) return start;
      const times = getSlots(product, date).map((sl) => toMinutesOf(sl.time));
      if (!times.length) return start;
      const near = times.reduce((a, b) => (Math.abs(b - start) < Math.abs(a - start) ? b : a));
      /* Beyond an hour and a half it is not "that departure, nudged" any
         more — leave it where the pointer is and let the drop refuse, which
         says why. */
      return Math.abs(near - start) <= 90 ? near : start;
    },
    [products],
  );

  const doMove = async (e: CalEvent, date: string, start: number) => {
    const b = peekBookings().find((x) => x.id === e.id);
    if (!b) return;
    const edit = bookingEditable(b.id, ACTOR);
    if (!edit.editable) {
      toast.error(edit.reason);
      return;
    }
    const from = toMinutesOf(b.slotStart.slice(11, 16));
    const length = Math.max(15, b.slotEnd ? toMinutesOf(b.slotEnd.slice(11, 16)) - from : 60);
    const time = toTime(start);
    /** What a person reads; `time` stays the 24-hour slot key. */
    const shown = formatClockMin(start);
    const product = products.find((x) => x.id === b.productId);

    /* The same two questions the till asks before it sells anything, asked of
       where this would land. A resource is free or it is not; a departure has
       room for this party or it does not. */
    if (b.resourceId) {
      if (!isResourceFreeFor(b.resourceId, date, time, length, product?.bufferMinutes ?? 0, b.id)) {
        toast.error(t("moveBusy", { time: shown }));
        return;
      }
    } else if (product && isSlotBased(product.bookingType)) {
      const slot = getSlots(product, date).find((sl) => sl.time === time);
      if (!slot) {
        toast.error(t("moveNoSlot", { time: shown }));
        return;
      }
      if (slot.remaining < b.partySize) {
        toast.error(t("moveFull", { time: shown, count: slot.remaining }));
        return;
      }
    }

    const was = { start: b.slotStart, end: b.slotEnd };
    const res = await rescheduleBooking(b.id, slotISO(date, time), slotISO(date, toTime(start + length)));
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setDetail(null);
    bookingsQ.reload();
    setStamp((n) => n + 1);
    toast.success(t("movedToast", { name: e.title, time: shown }), {
      label: t("undo"),
      run: async () => {
        const back = await rescheduleBooking(b.id, was.start, was.end);
        if (!back.ok) {
          toast.error(back.error.message);
          return;
        }
        bookingsQ.reload();
        setStamp((n) => n + 1);
      },
    });
  };

  const doComplete = async (e: CalEvent) => {
    setActing(true);
    const res = await checkInBooking(e.id, e.partySize ?? 1);
    setActing(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("arrivedToast", { name: e.title }));
    setDetail(null);
    bookingsQ.reload();
  };

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
          on ? "border-line bg-card text-fg" : "border-line bg-subtle text-muted",
        )}
      >
        <span
          className={cn("h-3.5 w-3.5 rounded-xs border", TONE_SWATCH[tone], !on && "opacity-40")}
        />
        {t(TONE_KEY[tone])}
        <span className="font-mono text-[12px] text-muted">{toneCounts[tone]}</span>
      </button>
    );
  });

  /* One button, rendered in one of two places: beside the date controls on a
     phone, and at the head of the key row on a desktop. Declaring it once is
     what keeps its badge and its pressed state the same in both. */
  const filtersButton = (
    <button
      type="button"
      id="calendar-filters-button"
      aria-expanded={filtersOpen}
      aria-controls="calendar-filters"
      onClick={() => setFiltersOpen((v) => !v)}
      className={cn(
        "flex h-11 items-center gap-tight rounded-sm border text-[13px] transition-colors duration-quick md:h-9",
        compact ? "w-11 shrink-0 justify-center" : "px-comfortable",
        selectFilters > 0
          ? "border-ember bg-ember/10 text-brand-foreground"
          : "border-line hover:bg-muted-wash",
      )}
      aria-label={compact ? (selectFilters > 0 ? t("filtersActive", { count: selectFilters }) : t("filters")) : undefined}
    >
      <SlidersHorizontal size={compact ? 18 : 14} strokeWidth={1.5} aria-hidden />
      {!compact && (selectFilters > 0 ? t("filtersActive", { count: selectFilters }) : t("filters"))}
      {/* A dot rather than a count when the label has gone: the accessible
          name still says how many. */}
      {compact && selectFilters > 0 && <span aria-hidden className="absolute -mt-5 ml-5 h-2 w-2 rounded-full bg-ember-solid" />}
    </button>
  );

  const weekdayLabels = WEEKDAYS_MON_FIRST.map((d) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(2026, 6, 5 + d)),
  );

  const filterBody = (
    <>
            {compact && <div className="flex flex-wrap items-center gap-tight">{toneKey}</div>}
            <div className="flex flex-wrap items-center gap-tight">
            <Select
              value={bookingFilter}
              onChange={setBookingFilter}
              aria-label={t("filterBooking")}
              size="sm"
              className="max-w-full"
              triggerClassName="text-[13px] md:h-9"
              options={[
                { value: "all", label: t("allBookings") },
                ...[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />


            {/* What colour MEANS. A segmented pair rather than a select,
                because there are two answers and both are worth seeing —
                and it sits with the filters because, like them, it changes
                how the same day is read rather than which day it is. */}

            {(resources.length > 0 || staff.length > 0) && (
              <Select
                value={ownerFilter}
                onChange={setOwnerFilter}
                aria-label={t("filterOwner")}
                size="sm"
                className="max-w-full"
                triggerClassName="text-[13px] md:h-9"
                options={[
                  { value: "all", label: t("allOwners") },
                  ...resources.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            )}
            </div>
    </>
  );

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      primary={{
        label: t("book.newBooking"),
        onClick: () => openNewBooking(),
        title: t("book.newBookingKey"),
        keyShortcut: "C",
      }}
    >
      <div className="flex flex-col gap-section">
        <CalendarStats
          now={statsNow}
          previous={statsPrev}
          comparisonLabel={t(view === "day" ? "vsDay" : view === "week" ? "vsWeek" : "vsMonth")}
          labels={{
            bookings: t("statBookings"),
            arrived: t("statArrived"),
            noshow: t("statNoShow"),
            holds: t("statHolds"),
          }}
          /* The figure opens the list. Jumping straight to the nearest hold
             was one target out of N: with four scattered across the year you
             could reach one and had to guess the rest. */
          elsewhere={
            activeHolds.length > 0
              ? {
                  count: activeHolds.length,
                  label: heldElsewhere ? t("heldElsewhere", { count: heldElsewhere.count }) : t("heldSeeAll"),
                  onGo: () => setHoldList(true),
                }
              : undefined
          }
        />

        {/* The range and the control that changes it, together. They were 60px
            apart — arrows in the page header, the label they move down beside
            the tabs — so you read where you are in one place and moved it in
            another. */}
        <div className="flex flex-wrap items-center justify-between gap-comfortable">
          <div className="flex flex-wrap items-center gap-tight">
            <Button variant="secondary" size="sm" onClick={() => setCursor(openingDate())}>
              {t("today")}
            </Button>
            <div className="flex items-center gap-inline">
              <button
                type="button"
                aria-label={t("previous")}
                onClick={() => step(-1)}
                className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-muted-wash"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              {/* Between the arrows, which is where you look for it — and a
                  live region, because stepping a week changes nothing else a
                  screen reader would announce. */}
              <h2
                aria-live="polite"
                /* The 11rem floor keeps the arrows from jumping as the label
                   changes width — worth it on a desktop, and on a phone it is
                   what pushed the date and filter glyphs onto a row of their
                   own. Below sm the label takes the width it needs. */
                className="whitespace-nowrap px-tight text-center text-[15px] font-medium tracking-tight sm:min-w-[11rem]"
              >
                {rangeLabel}
              </h2>
              <button
                type="button"
                aria-label={t("next")}
                onClick={() => step(1)}
                className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line transition-colors duration-quick hover:bg-muted-wash"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
            {/* Ours. The native control rendered 07/29/2026 beside a range
                label reading "27 Jul – 2 Aug 2026" — two date formats, one
                toolbar, because the browser owned one of them. */}
            {/* A glyph on a phone. The range label two controls to the left
                already says which week this is, so the field was spending a
                whole row restating it — and a phone had four toolbar rows
                before the first booking. */}
            <DateField
              value={isoDate(cursor)}
              today={isoDate(now)}
              onChange={(iso) => setCursor(startOfDay(new Date(`${iso}T12:00:00`)))}
              labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
              compact={compact}
              className={compact ? undefined : "w-44"}
            />
            {/* Up here on a phone, beside the controls it belongs with, rather
                than alone on a row of its own. */}
            {compact && filtersButton}
          </div>

          {/* The view switch sits on the right, the date controls on the left —
              the owner's call: where you are in time is read first, and the
              grain you are looking at is the smaller decision. DOM order
              follows, so the tab order runs the same way the eye does. */}
          <Tabs
            items={[
              { value: "day", label: t("tabDay") },
              { value: "week", label: t("tabWeek") },
              { value: "month", label: t("tabMonth") },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
          />
        </div>

        {/* ── filters ─────────────────────────────────────────────────────── */}
        <div className={cn("flex flex-col gap-tight", compact && !filtersOpen && !filtered && "hidden")}>
          {/* The key stays out where it can be read — it is the legend, and
              hiding it makes five colours unreadable. The three selects fold
              away: they were three full-width controls on a phone, and with
              the tabs and the key above them the grid did not start until 62%
              of the screen had gone by. */}
          <div className="flex flex-wrap items-center gap-tight">
            {!compact && filtersButton}

            {!compact && toneKey}

            {/* How the day's rows are cut — a way of looking, like the view
                switch, so it is drawn as one: a segmented pair. In ember it
                read as one more filter switched on. */}
            {view === "day" && !compact && resources.length > 0 && (
              <span role="group" aria-label={t("groupBy")} className="ml-auto flex items-center gap-inline rounded-sm bg-muted-wash p-inline">
                {(["resource", "product"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={groupBy === g}
                    onClick={() => setGroupBy(g)}
                    className={cn(
                      "h-9 rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick md:h-7",
                      groupBy === g ? "bg-card text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
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

          {/* On a phone these are a sheet, not a block that pushes the
              calendar down: opening them used to put the grid's first pixel
              19px BELOW the tab bar, so the one thing being filtered was the
              one thing that could not be seen. Above `md` they stay inline,
              where there is room and a sheet would be ceremony. */}
          {!compact && (
            <div id="calendar-filters" hidden={!filtersOpen} className="flex flex-col gap-tight">
              {filterBody}
            </div>
          )}
        </div>

        {/* The phone's filters, over the page rather than in front of it. */}
        {compact && filtersOpen && (
          <>
            <div
              aria-hidden
              onClick={closeFilters}
              className="fixed inset-0 z-40 bg-ink/40"
            />
            <div
              id="calendar-filters"
              role="dialog"
              aria-modal="true"
              aria-label={t("filters")}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeFilters();
              }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col gap-comfortable overflow-y-auto rounded-t-md border-t border-line bg-card p-gutter"
              style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center justify-between gap-tight">
                <h2 className="text-[15px] font-semibold">{t("filters")}</h2>
                <Button variant="secondary" size="sm" autoFocus onClick={closeFilters}>
                  {t("filtersDone")}
                </Button>
              </div>
              {filterBody}
              {filtered && (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          </>
        )}

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
              onPeek={onPeek}
              emptyLabel={t("nothingToday")}
              showEmptyLabel={(n) => t("showEmptyLanes", { count: n })}
              hideEmptyLabel={t("hideEmptyLanes")}
              compact={compact}
              blockClass={blockClass}
              openSlots={dayOpen}
              chipText={chipText}
              onCreateHour={(h, anchor) => openRequest({ date: isoDate(cursor), hour: h, anchor })}
              onCreate={(slot, anchor, minutes) =>
                openRequest({
                  date: slot.date,
                  hour: Math.floor(slot.minutes / 60),
                  lane: {
                    laneId: slot.laneId,
                    time: slot.time,
                    span: slot.span,
                    resourceId: slot.isSession ? undefined : slot.laneId,
                    productId: slot.isSession ? slot.laneId.slice("session:".length) : undefined,
                  },
                  minutes,
                  anchor,
                })
              }
              ghost={ghost}
              ghostLabel={t("book.untitled")}
              changeoverLabel={t("book.changeover")}
              openLabel={(slot) => {
                const from = Math.min(...slot.options.map((o) => o.price));
                const price = formatPriceShort(from, operatorQ.data?.currency);
                return slot.isSession
                  ? {
                      short: t("book.left", { count: slot.remaining ?? 0 }),
                      tiny: String(slot.remaining ?? 0),
                      full: t("book.openTileLabel", {
                        lane: slot.laneName,
                        time: formatClock(slot.time),
                        what: t("book.seatsLeft", { count: slot.remaining ?? 0 }),
                      }),
                    }
                  : {
                      // A field shared by two bookings is "from" its cheaper.
                      short: slot.options.length > 1 && new Set(slot.options.map((o) => o.price)).size > 1 ? t("book.fromPrice", { amount: price }) : price,
                      tiny: "+",
                      full: t("book.openTileLabel", { lane: slot.laneName, time: formatClock(slot.time), what: price }),
                    };
              }}
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
              onPeek={onPeek}
              onPickDay={(d) => {
                setCursor(d);
                setView("day");
              }}
              dayLabel={(d) => ({
                weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d),
                day: String(d.getDate()),
                long: t("openDay", { day: dayLong(d) }),
              })}
              compact={weekCompact}
              onMove={doMove}
              canMove={canMove}
              moveSnap={moveSnap}
              blockClass={blockClass}
              dotClass={dotClass}
              chipText={chipText}
              openCount={(d, h) => weekOpen.get(`${isoDate(d)}|${h}`) ?? 0}
              isPastHour={(d, h) => isoDate(d) < today || (isoDate(d) === today && (h + 1) * 60 <= nowMin)}
              onCreate={(d, start, anchor, minutes) =>
                openRequest({ date: isoDate(d), hour: Math.floor(start / 60), startMinutes: start, minutes, anchor })
              }
              ghost={ghost}
              ghostLabel={t("book.untitled")}
              noneLabel={t("book.nothingOpen")}
              stackLabel={(n, guests) => t("book.stack", { count: n, guests })}
              bookLabel={(d, h, count) => ({
                short: t("book.openShort", { count }),
                // An hour with nothing to sell is still named with its day:
                // "15:00, nothing open" read out alone does not say which.
                full:
                  count > 0
                    ? t("book.openCellLabel", { day: dayLong(d), time: formatClockMin(h * 60), count })
                    : t("book.noneCellLabel", { day: dayLong(d), time: formatClockMin(h * 60) }),
              })}
            />
          ) : (
            <MonthGrid
              month={cursor}
              events={monthEvents}
              now={now}
              weekdayLabels={weekdayLabels}
              moreLabel={(n) => t("more", { count: n })}
              onSelect={setDetail}
              onPeek={onPeek}
              onPickDay={(d) => {
                setCursor(d);
                setView("day");
              }}
              compact={compact}
              blockClass={blockClass}
              dotClass={dotClass}
              dayHeading={(d) =>
                new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(d)
              }
              emptyLabel={t("nothingToday")}
              today={today}
              onCreateDay={(d, anchor) => openRequest({ date: isoDate(d) < today ? today : isoDate(d), hour: null, anchor })}
              ghost={ghost}
              ghostLabel={t("book.untitled")}
              createLabel={(d) => t("book.newOn", { day: dayLong(d) })}
              openDayLabel={(d) => t("openDay", { day: dayLong(d) })}
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
          onLock={doLock}
          onComplete={doComplete}
          onRelease={doRelease}
          blockedReason={detailBlocked}
          busy={acting}
        />

        {holdList && (
          <HoldList
            holds={activeHolds}
            onClose={() => setHoldList(false)}
            t={(key, values) => t(key as never, values as never)}
            dayLabel={(iso) =>
              new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`))
            }
            onGo={(h) => {
              setHoldList(false);
              setCursor(new Date(`${h.date}T12:00:00`));
              /* Straight into the panel that can release it — the list says
                 which one, the panel says everything about it. */
              const ev = events.find((e) => e.id === h.id);
              if (ev) setDetail(ev);
            }}
          />
        )}

        <BookingPanel
          compact={compact}
          request={request}
          products={sellProducts}
          resources={resources}
          staff={staff}
          operator={operatorQ.data}
          today={today}
          nowMin={nowMin}
          openHour={openHour}
          closeHour={closeHour}
          carry={carry}
          onDraft={setGhost}
          onClose={(c) => {
            setRequest(null);
            setGhost(null);
            setCarry(c);
          }}
          onHeld={(h) => {
            setRequest(null);
            setGhost(null);
            holdsQ.reload();
            toast.success(t("heldToast", { heldFor: h.heldFor }), {
              label: t("holdAgain"),
              run: async () => {
                const res = await releaseHold(h.id);
                if (res.ok) holdsQ.reload();
                else toast.error(res.error.message);
              },
            });
          }}
          onBooked={(order, name) => {
            setRequest(null);
            setGhost(null);
            setCarry(null);
            setJustBooked(order.id);
            setStamp((n) => n + 1);
            bookingsQ.reload();
            toast.success(
              name
                ? t("book.booked", { reference: order.reference, name })
                : t("book.bookedNoName", { reference: order.reference }),
              { label: t("book.viewOrder"), run: () => router.push(`/orders/${order.id}`) },
            );
          }}
          t={(key, values) => t(key as never, values as never)}
        />

        <EventPeek
          event={detail || request ? null : peek}
          anchor={peekAt}
          t={t}
          dayLabel={(d) =>
            new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(d)
          }
        />
      </div>
    </PageShell>
  );
}
