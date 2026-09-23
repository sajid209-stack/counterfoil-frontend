"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Minus, Plus, Search, Ticket, TriangleAlert, UserRound, Wallet, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { DateField } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatMoney, formatPriceShort } from "@/lib/format";
import {
  canTakeNonCash,
  checkout,
  freeGuides,
  peekBookings,
  listCustomerRows,
  matchOrCreateCustomer,
  placeHold,
  tillMethods,
  type Hold,
  type HoldKind,
  type Operator,
  type Order,
  type Product,
  type Resource,
  type Staff,
  type TillMethod,
} from "@/lib/api";
import {
  activeTiersOf,
  flexDurations,
  flexStartBlocked,
  freeProvidersAt,
  providerMinutes,
  resolveDraft,
  type Draft,
} from "@/lib/sale/selection";
import { itemBalance, itemSeats, itemSlotISO, priceSale, type SaleItem } from "@/lib/sale/saleMath";
import { DEMO_STAFF_ID } from "@/lib/session";
import { slotISO, toMinutes, toTime } from "@/lib/schedule";
import {
  anytimeOptions,
  openHours,
  openSlotsFor,
  optionsInHour,
  sessionLaneId,
  type OpenOption,
  type OpenSlot,
} from "./openSlots";
import type { Ghost } from "./model";

/**
 * When a hold with a self-release date gives its places back.
 *
 * The REAL clock, deliberately, not the demo one: `holdView` resolves expiry
 * against `Date.now()`, so a date anchored to DEMO_TODAY would read as already
 * expired the moment it was placed and the hold would release itself on sight.
 * At module scope because the compiler rules out impure calls in render.
 */
const expiryIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

/** What opened the panel: a day, maybe an hour, maybe a specific slot. */
export interface BookingRequest {
  date: string;
  hour: number | null;
  /** A slot clicked on the day grid — the lane it was on, its start and how
   *  long one of its slots runs. */
  lane?: { laneId: string; time: string; span?: number; resourceId?: string; productId?: string };
  /** A length dragged across on the grid, when it was more than one slot. */
  minutes?: number;
  /** Where to float from. Null opens it at the head of the page. */
  anchor: DOMRect | null;
}

type Pay = "later" | "deposit" | "full";
type Guest = { id: string | null; name: string; phone: string | null };

/** What a panel closed by a click elsewhere hands to the next one. */
export interface Carry {
  guest: Guest | null;
  query: string;
  phone: string;
  pay: Pay;
}

type T = (key: string, values?: Record<string, string | number>) => string;

const PANEL_W = 420;

/**
 * New booking, from an empty slot.
 *
 * Google Calendar's quick-create is the model, and the parts of it that
 * matter were copied rather than paraphrased: a block appears on the grid
 * where you clicked and follows every change made here; the panel stands
 * beside that block, not over it; the title is the thing being made, muted
 * until there is one; the when is one line you can change in place; and every
 * other question sits in a row behind an icon, so the eye runs down one edge.
 *
 * What a booking system adds is that the panel does not ask what the thing
 * IS — it already knows what can be sold at that time, so it offers exactly
 * that, priced, and nothing that cannot be sold. Then it asks only what the
 * chosen booking needs: how many for a session or a day ticket, how long for a
 * lane or a field, who for an appointment. Then who is coming and how they
 * are paying — a reservation with no name is the one nobody can chase, so
 * paying later needs a name.
 *
 * Priced by the same engine the tills use (`lib/sale`), and booked through the
 * same `checkout`, so the order, its tickets and the capacity it holds are the
 * real thing rather than a calendar-only record.
 */
export function BookingPanel({
  request,
  ...rest
}: {
  request: BookingRequest | null;
  products: Product[];
  resources: Resource[];
  staff: Staff[];
  operator: Operator | undefined;
  today: string;
  nowMin: number;
  openHour: number;
  closeHour: number;
  compact: boolean;
  carry: Carry | null;
  onDraft: (ghost: Ghost | null) => void;
  /** Closed without booking. A click elsewhere passes what was typed, so the
   *  next panel can start from it; Close and Escape pass null — a deliberate
   *  "never mind" is not something to bring back. */
  onClose: (carry: Carry | null) => void;
  onBooked: (order: Order, guestName: string | null) => void;
  /** A hold was placed from here. The page reloads and offers the way back. */
  onHeld: (hold: Hold) => void;
  t: T;
}) {
  if (!request) return null;
  // Keyed on what was clicked, so a second click on the grid starts clean
  // rather than inheriting the last slot's choices.
  const key = `${request.date}|${request.hour}|${request.lane?.laneId}|${request.lane?.time}|${request.minutes}`;
  return <Panel key={key} request={request} {...rest} />;
}

function Panel({
  request,
  products,
  resources,
  staff,
  operator,
  today,
  nowMin,
  openHour,
  closeHour,
  compact,
  carry,
  onDraft,
  onClose,
  onBooked,
  onHeld,
  t,
}: {
  request: BookingRequest;
  products: Product[];
  resources: Resource[];
  staff: Staff[];
  operator: Operator | undefined;
  today: string;
  nowMin: number;
  openHour: number;
  closeHour: number;
  compact: boolean;
  carry: Carry | null;
  onDraft: (ghost: Ghost | null) => void;
  onClose: (carry: Carry | null) => void;
  onBooked: (order: Order, guestName: string | null) => void;
  onHeld: (hold: Hold) => void;
  t: T;
}) {
  const enumL = useEnumLabels();
  /* The hold vocabulary is shared with the till — what moved was the page,
     not the mechanism — so it keeps its own namespace. */
  const th = useTranslations("holds");
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const guestRef = useRef<HTMLInputElement>(null);

  /* ── booking, or holding ──────────────────────────────────────────────
     Two things you can do with an open slot, and they ask nearly the same
     questions: what, when, where, how many. A hold differs in what it wants
     at the end — a name to explain it rather than a guest to bill — so it is
     a mode of this panel rather than a screen of its own. Declared here,
     above the draft, because the draft drawn on the grid has to say which
     one it is. */
  const [mode, setMode] = useState<"book" | "hold">("book");

  const [date, setDate] = useState(request.date);
  const [hour, setHour] = useState<number | null>(request.hour);
  /* The lane and the length the grid said only hold while the panel still
     points where the grid did. Move the hour and "Outdoor Field at 14:00"
     no longer describes anything. */
  const atRequest = date === request.date && hour === request.hour;
  const reqLane = atRequest ? request.lane : undefined;
  const wantMinutes = atRequest ? request.minutes : undefined;

  // ── what is open ─────────────────────────────────────────────────────────
  const slots = useMemo(() => openSlotsFor(products, date, today, nowMin), [products, date, today, nowMin]);
  const hours = useMemo(
    () => openHours(products, slots, date, today, nowMin, openHour, closeHour),
    [products, slots, date, today, nowMin, openHour, closeHour],
  );
  const timed = useMemo(
    () => (hour == null ? [] : optionsInHour(products, slots, date, hour, today, nowMin)),
    [products, slots, date, hour, today, nowMin],
  );
  const anytime = useMemo(() => anytimeOptions(products, date, today), [products, date, today]);
  /* With no hour chosen — a click on a day in the month, or "Any time" — the
     question is "what can they do that day, and when?". One row per booking
     with its start times as chips answers it in one look; opening on the
     first hour anything was free (06:00 for the courts) answered a question
     nobody asked. */
  const dayRows = useMemo(() => {
    if (hour != null) return [];
    const rows = new Map<string, { product: Product; from: number; starts: { hour: number; option: OpenOption }[] }>();
    for (const h of hours) {
      for (const o of optionsInHour(products, slots, date, h.hour, today, nowMin)) {
        const row = rows.get(o.product.id) ?? { product: o.product, from: o.price, starts: [] };
        row.from = Math.min(row.from, o.price);
        if (!row.starts.some((x) => x.option.time === o.time)) row.starts.push({ hour: h.hour, option: o });
        rows.set(o.product.id, row);
      }
    }
    return [...rows.values()].sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [hour, hours, products, slots, date, today, nowMin]);
  const [allStarts, setAllStarts] = useState<string[]>([]);

  /* Clicked on a field: what can go ON that field leads, and everything else
     open at that hour waits behind one line. Somebody who clicked Outdoor
     Field at two o'clock meant Outdoor Field. */
  const fitsLane = (o: OpenOption) => {
    if (!reqLane) return true;
    return reqLane.resourceId
      ? o.resourceId === reqLane.resourceId || !!o.lanes?.some((x) => x.resourceId === reqLane.resourceId)
      : o.product.id === reqLane.productId;
  };
  const here = reqLane ? timed.filter(fitsLane) : timed;
  const elsewhere = reqLane && here.length > 0 ? timed.filter((o) => !fitsLane(o)) : [];
  const leading = here.length > 0 ? here : timed;
  const all = [...timed, ...anytime];

  /* A slot clicked on the day grid has already said which field, and often
     which booking. Where one option fits, it is chosen; where two bookings
     share the field (Cricket and Futsal), both are offered and neither is
     guessed. */
  const [presetKey] = useState<string | null>(() => {
    const lane = request.lane;
    if (!lane) return timed.length === 1 ? timed[0].key : null;
    const fits = timed.filter(
      (o) =>
        o.time === lane.time &&
        (lane.resourceId
          ? o.resourceId === lane.resourceId || !!o.lanes?.some((l) => l.resourceId === lane.resourceId)
          : o.product.id === lane.productId),
    );
    return fits.length === 1 ? fits[0].key : null;
  });
  const [chosenKey, setChosenKey] = useState<string | null>(presetKey);
  const chosen = all.find((o) => o.key === chosenKey) ?? null;
  /** The option list, open. It folds to the one chosen once there is one: a
   *  list of seven options stays on screen only while it is the question. */
  const [listOpen, setListOpen] = useState(presetKey == null);
  const [anytimeOpen, setAnytimeOpen] = useState(false);
  const [elsewhereOpen, setElsewhereOpen] = useState(false);

  // ── the chosen booking's own questions ───────────────────────────────────
  /** Which field or lane was picked in the panel. The one clicked on the day
   *  grid if that is how the panel opened; otherwise none, and the cheapest
   *  lane free for the whole booking is used. */
  const [laneId, setLaneId] = useState<string | null>(request.lane?.resourceId ?? null);

  /* A field's hours that follow the chosen one, free on the same field for the
     same booking — what "2 hrs" can actually take. Two hours of the outdoor
     field is two slots, and the engine books each as its own line. */
  const runOf = (o: OpenOption | null, resourceId: string | undefined): OpenSlot[] => {
    if (!o || o.kind !== "slot" || !resourceId || !o.time) return [];
    const mine = slots
      .filter((s) => s.laneId === resourceId && s.options.some((x) => x.product.id === o.product.id))
      .sort((a, b) => a.minutes - b.minutes);
    const start = mine.findIndex((s) => s.time === o.time);
    if (start < 0) return [];
    const out = [mine[start]];
    for (let i = start + 1; i < mine.length && out.length < 6; i++) {
      const prev = out[out.length - 1];
      if (mine[i].minutes !== prev.minutes + prev.span) break;
      out.push(mine[i]);
    }
    return out;
  };
  const slotSpan = (o: OpenOption) => o.product.schedule?.sessionMinutes || 60;
  /** The places this booking could go at its time. */
  const placesOf = (o: OpenOption): string[] =>
    o.lanes ? o.lanes.map((l) => l.resourceId) : o.resourceId ? [o.resourceId] : [];
  /**
   * Whether one lane can take this booking for this long.
   *
   * The list of lanes is drawn from what is free for the SHORTEST length a
   * booking sells, so "Lane 1" was on offer for three hours of bowling when a
   * game on Lane 1 started an hour in — a double booking the panel would
   * have taken. Every lane is now asked about the whole span, by the same
   * rule the till uses (`flexStartBlocked`: taken, past, or running past
   * close); a field, about its run of free hours.
   */
  const fits = (o: OpenOption, resourceId: string | undefined, m: number): boolean => {
    if (!o.time) return true;
    if (o.kind === "flexible") return flexStartBlocked(o.product, date, o.time, m, resourceId, nowMin) === null;
    if (o.kind === "slot") return !!resourceId && runOf(o, resourceId).length * slotSpan(o) >= m;
    return true;
  };
  /** Every length the booking sells here, before asking what is free. */
  const lengthsOf = (o: OpenOption | null): number[] => {
    if (!o) return [];
    if (o.kind === "flexible") return flexDurations(o.product);
    if (o.kind === "slot") {
      const longest = Math.max(0, ...placesOf(o).map((r) => runOf(o, r).length));
      return Array.from({ length: longest }, (_, i) => (i + 1) * slotSpan(o));
    }
    return [];
  };
  /** A length is on offer when somewhere can take it — any lane, for "any". */
  const lengthFits = (o: OpenOption, m: number) => {
    const places = placesOf(o);
    return places.length ? places.some((r) => fits(o, r, m)) : fits(o, undefined, m);
  };
  /** The length a drag asked for, or the longest that fits below it. */
  const lengthFor = (o: OpenOption | null): number | null => {
    const list = o ? lengthsOf(o).filter((m) => lengthFits(o, m)) : [];
    if (!list.length) return null;
    if (!wantMinutes) return list[0];
    const fit = list.filter((m) => m <= wantMinutes);
    return fit.length ? fit[fit.length - 1] : list[0];
  };
  const [length, setLength] = useState<number | null>(() => lengthFor(all.find((x) => x.key === presetKey) ?? null));
  const lengths = lengthsOf(chosen);
  const okLengths = chosen ? lengths.filter((m) => lengthFits(chosen, m)) : [];
  // A length nothing can take any more (another lane was picked) falls back.
  const len = length != null && okLengths.includes(length) ? length : (okLengths[0] ?? null);
  /* Nine lengths in quarter hours is a keypad, not a choice. Draw the whole
     and half hours — what people actually ask for — and always the one in
     force, so a dragged 2 hr 15 min is on screen as the thing chosen. */
  const lengthChips = (() => {
    if (lengths.length <= 6) return lengths;
    const round = lengths.filter((m) => m % 30 === 0).slice(0, 6);
    return len != null && !round.includes(len) ? [...round, len].sort((a, b) => a - b) : round;
  })();

  /** What the booking costs on one lane for one length — priced by the same
   *  engine that will charge it, and asked of every lane before one is
   *  chosen, so "cheapest" means cheapest for THIS booking. Ranking by the
   *  one-hour list price put Lane 1 first for a three-hour game that costs
   *  ৳400 more there than on Lane 4. */
  const priceFor = (o: OpenOption, rid: string, m: number | null): number => {
    if (!o.time) return o.price;
    const d: Draft =
      o.kind === "slot"
        ? {
            productId: o.product.id,
            date,
            qty: {},
            slots: runOf(o, rid)
              .slice(0, Math.max(1, Math.round((m ?? slotSpan(o)) / slotSpan(o))))
              .map((x) => ({ date, time: x.time, resourceId: rid })),
          }
        : { productId: o.product.id, date, qty: {}, slotTime: o.time, resourceId: rid, durationMinutes: m ?? flexDurations(o.product)[0] };
    return resolveDraft(o.product, d, "p", { resources, team: staff }).amount;
  };

  /* The lane actually used: the one picked if it can take the whole booking,
     otherwise the cheapest that can. A lane that cannot is drawn as busy,
     never silently booked. */
  const laneFree = (id: string) => !!chosen && (len == null || fits(chosen, id, len));
  const lane = chosen?.lanes
    ? (chosen.lanes.find((l) => l.resourceId === laneId && laneFree(l.resourceId)) ??
      [...chosen.lanes]
        .filter((l) => laneFree(l.resourceId))
        .sort(
          (a, b) =>
            priceFor(chosen, a.resourceId, len) - priceFor(chosen, b.resourceId, len) ||
            a.laneName.localeCompare(b.laneName, undefined, { numeric: true }),
        )[0] ??
      null)
    : null;
  const resourceIdOf = (o: OpenOption) => o.resourceId ?? lane?.resourceId;
  /** Nowhere can take the booking as asked: say so, and do not book it. */
  const noRoom = !!chosen && lengths.length > 0 && okLengths.length === 0;

  /* One of the first ticket is the commonest sale, and a panel that opens on
     zero makes every booking two clicks longer than it needs to be. */
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const o = all.find((x) => x.key === presetKey);
    const first = o ? activeTiersOf(o.product)[0] : undefined;
    return first ? { [first.id]: 1 } : {};
  });
  const [party, setParty] = useState<number | null>(null);
  const [providerId, setProviderId] = useState<string>("");

  const choose = (o: OpenOption) => {
    setChosenKey(o.key);
    setListOpen(false);
    const first = activeTiersOf(o.product)[0];
    setQty(first ? { [first.id]: 1 } : {});
    setParty(null);
    setProviderId("");
    setLaneId(null);
    setLength(lengthFor(o));
  };

  const draft: Draft | null = (() => {
    if (!chosen) return null;
    const base: Draft = { productId: chosen.product.id, date, qty };
    switch (chosen.kind) {
      case "slot": {
        const where = resourceIdOf(chosen)!;
        const run = runOf(chosen, where);
        const n = Math.max(1, Math.round((len ?? slotSpan(chosen)) / slotSpan(chosen)));
        const times = run.length ? run.slice(0, n).map((s) => s.time) : [chosen.time!];
        return { ...base, slots: times.map((time) => ({ date, time, resourceId: where })) };
      }
      case "session":
        return { ...base, slotTime: chosen.time, guideId: freeGuides(chosen.product, date, chosen.time!)[0] };
      case "flexible":
        return {
          ...base,
          slotTime: chosen.time,
          resourceId: resourceIdOf(chosen),
          durationMinutes: len ?? flexDurations(chosen.product)[0],
        };
      case "provider":
        return { ...base, slotTime: chosen.time, providerId: providerId || undefined };
      default:
        return { ...base, validityId: chosen.product.validityOptions?.[0]?.id };
    }
  })();

  const resolved = chosen && draft ? resolveDraft(chosen.product, draft, "cal", { resources, team: staff }) : null;

  /** Why a lane cannot take the booking: when it is next taken, or that the
   *  booking would run past closing. "Busy" alone left the desk to guess. */
  const whyBusy = (rid: string): string => {
    if (!chosen?.time || len == null) return t("book.busy");
    const start = toMinutes(chosen.time);
    if (chosen.kind === "flexible" && flexStartBlocked(chosen.product, date, chosen.time, len, rid, nowMin) === "closes") {
      return t("book.pastClose");
    }
    const buffer = chosen.product.bufferMinutes ?? 0;
    const next = peekBookings()
      .filter((b) => b.status === "confirmed" && b.resourceId === rid && b.slotStart.slice(0, 10) === date)
      .map((b) => toMinutes(b.slotStart.slice(11, 16)))
      .filter((m) => m + buffer > start && m < start + len + buffer)
      .sort((a, b) => a - b)[0];
    return next != null ? t("book.busyFrom", { time: toTime(Math.max(start, next)) }) : t("book.busy");
  };

  /* A field or a lane is priced per booking, so its size is a head count
     rather than a ticket count — the till's "Group of 2". Bounded by the
     booking's own policy. */
  const partyMin = chosen?.product.policies?.partyMin ?? 1;
  const partyMax = chosen?.product.policies?.partyMax ?? 30;
  const items: SaleItem[] =
    !chosen || (chosen.kind !== "slot" && chosen.kind !== "flexible")
      ? (resolved?.items ?? [])
      : (resolved?.items ?? []).map((i) => ({ ...i, partySize: party ?? partyMin }));

  const totals = priceSale(items, { products, operator });
  const balanceAtArrival = items.reduce((s, i) => s + itemBalance(i, products), 0);
  /* The same arithmetic the till uses: the deposit policy says what is held
     back until arrival, and what is due now is the rest of the total. */
  const depositNow = Math.max(0, totals.total - balanceAtArrival);

  // ── the block on the grid ────────────────────────────────────────────────
  /* What the grid draws for this booking, recomputed from the same choices
     that price it — so the block and the total can never disagree about which
     lane, or for how long. */
  const rawGhost: Ghost | null = (() => {
    if (chosen) {
      if (chosen.kind === "anytime" || !chosen.time) {
        return { date, start: 0, end: 0, allDay: true, title: chosen.product.name };
      }
      const start = toMinutes(chosen.time);
      const first = items[0];
      switch (chosen.kind) {
        case "slot":
        case "flexible": {
          const where = first?.resourceId ?? resourceIdOf(chosen);
          const end = start + (len ?? (chosen.kind === "slot" ? slotSpan(chosen) : flexDurations(chosen.product)[0]));
          return {
            date,
            start,
            end,
            laneId: where,
            title: chosen.product.name,
            sub: first?.resourceLabel ?? (where ? (lane?.laneName ?? chosen.laneName ?? null) : null),
          };
        }
        case "session":
          return {
            date,
            start,
            end: start + (chosen.product.schedule?.sessionMinutes || chosen.product.schedule?.slotMinutes || 60),
            laneId: sessionLaneId(chosen.product.id),
            title: chosen.product.name,
          };
        default:
          return {
            date,
            start,
            end: start + providerMinutes(chosen.product),
            laneId: first?.resourceId ?? (providerId || undefined),
            title: chosen.product.name,
            sub: first?.providerLabel ?? null,
          };
      }
    }
    if (hour == null) return null;
    const start = reqLane ? toMinutes(reqLane.time) : hour * 60;
    return {
      date,
      start,
      end: start + (wantMinutes ?? reqLane?.span ?? 60),
      laneId: reqLane?.laneId,
      title: null,
    };
  })();
  /* Marked as a hold before it leaves the panel, so the block on the grid is
     hatched the moment the mode changes rather than at the moment it lands. */
  const ghost: Ghost | null = rawGhost && mode === "hold" ? { ...rawGhost, hold: true } : rawGhost;
  const ghostKey = ghost ? JSON.stringify(ghost) : "";

  /* A booking of this product with no lane is using one — the availability
     engine does not count it, so the lanes offered may be one too many. The
     panel cannot fix the engine; it can stop the desk from trusting a count
     that is wrong. */
  const unassigned = (() => {
    if (!chosen?.time || (chosen.kind !== "slot" && chosen.kind !== "flexible") || !ghost || ghost.allDay) return [];
    return peekBookings().filter((b) => {
      if (b.status !== "confirmed" || b.productId !== chosen.product.id || b.resourceId || b.slotStart.slice(0, 10) !== date) return false;
      const m = toMinutes(b.slotStart.slice(11, 16));
      const end = b.slotEnd ? toMinutes(b.slotEnd.slice(11, 16)) : m + 60;
      return m < ghost.end && end > ghost.start;
    });
  })();

  useEffect(() => {
    onDraft(ghost);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the value, not the object
  }, [ghostKey]);

  // ── who, and how they pay ────────────────────────────────────────────────
  const [guest, setGuest] = useState<Guest | null>(carry?.guest ?? null);
  const [query, setQuery] = useState(carry?.query ?? "");
  const [phone, setPhone] = useState(carry?.phone ?? "");
  const [payPick, setPay] = useState<Pay>(carry?.pay ?? "later");
  const payOptions: Pay[] = ["later", ...(balanceAtArrival > 0 ? (["deposit"] as const) : []), "full"];
  // A deposit carried over to a booking that takes none is paying later.
  const pay: Pay = payOptions.includes(payPick) ? payPick : "later";
  const methods = useMemo<TillMethod[]>(() => tillMethods(canTakeNonCash()), []);
  const [method, setMethod] = useState<TillMethod>(methods[0] ?? "cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Book was pressed with something missing: say what, where it is. */
  const [tried, setTried] = useState(false);

  const [heldFor, setHeldFor] = useState("");
  const [holdQty, setHoldQty] = useState(1);
  /** Everything left on the session, rather than a number of places. */
  const [holdAll, setHoldAll] = useState(false);
  /** Days until it releases itself. Empty holds until someone releases it. */
  const [holdDays, setHoldDays] = useState("");
  const heldForRef = useRef<HTMLInputElement>(null);

  /* A hold's kind is DERIVED from what was chosen, never asked. An operator
     who has clicked 18:00 on Lane 3 has already said it is a resource hold;
     making them pick "Resource" from a list of four is asking a question the
     click answered. */
  const holdResourceId = ghost?.laneId && !ghost.laneId.startsWith("session:") ? ghost.laneId : null;
  const holdKind: HoldKind = holdResourceId ? "resource" : holdAll ? "session" : "capacity";
  /** Places a session has left — the ceiling on a capacity hold. */
  const holdMax = chosen?.remaining ?? chosen?.capacity ?? 99;
  const holdQtyNow = Math.min(Math.max(1, holdQty), Math.max(1, holdMax));

  const guestName = guest?.name ?? query.trim();
  const payNow = pay === "later" ? 0 : pay === "deposit" ? depositNow : totals.total;

  const missing: "what" | "tickets" | "more" | "room" | "name" | null = !chosen
    ? "what"
    : noRoom || (chosen.lanes && !lane)
      ? "room"
      : resolved?.missing === "tickets"
      ? "tickets"
      : resolved?.missing
        ? "more"
        : pay === "later" && !guestName
          ? "name"
          : null;

  const carryNow = (): Carry | null =>
    guest || query.trim() || phone.trim() || pay !== "later" ? { guest, query, phone, pay } : null;

  const book = async () => {
    if (busy) return;
    /* The button is never disabled. A greyed button that will not say why is
       the commonest dead end in a form; this one says what is missing, next
       to the thing that is missing, and puts the cursor there. */
    if (missing || !chosen) {
      setTried(true);
      if (missing === "name") guestRef.current?.focus();
      else if (missing === "what") {
        setListOpen(true);
        requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus());
      } else detailsRef.current?.querySelector<HTMLElement>("button:not(:disabled), select")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let customerId = guest?.id ?? null;
    let name: string | null = guest?.name ?? null;
    if (!guest && guestName) {
      const made = await matchOrCreateCustomer({ name: guestName, phone: phone.trim() || null });
      if (made.ok) {
        customerId = made.data.id;
        name = made.data.name;
      } else {
        name = guestName;
      }
    }
    const res = await checkout({
      channel: "counter",
      locationId: chosen.product.locationIds[0] ?? "loc_fort",
      counterId: null,
      staffId: DEMO_STAFF_ID,
      customerName: name,
      customerId,
      lines: totals.lines,
      orderDiscount: totals.orderDiscount,
      bookings: items
        .filter((e) => e.slotDate)
        .map((e) => ({
          productId: e.productId,
          resourceId: e.resourceId ?? null,
          slotStart: itemSlotISO(e)!,
          slotEnd: e.slotEnd,
          partySize: itemSeats(e, products),
        })),
      taxPct: operator?.taxRatePct ?? 0,
      method,
      amountTendered: payNow,
      payNow,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    onBooked(res.data.order, name);
  };

  /* Holding, as the other thing you can do with an open slot. It goes through
     the same `placeHold` the register used to, so a hold placed here is the
     same record the till and the availability engine already read. */
  const hold = async () => {
    if (busy) return;
    if (!chosen) {
      setTried(true);
      setListOpen(true);
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus());
      return;
    }
    if (!heldFor.trim()) {
      setTried(true);
      heldForRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const allDay = !ghost || ghost.allDay;
    const days = parseInt(holdDays, 10);
    const res = await placeHold({
      productId: chosen.product.id,
      locationId: chosen.product.locationIds[0] ?? null,
      kind: holdKind,
      date,
      slotStart: allDay ? null : slotISO(date, toTime(ghost!.start)),
      slotEnd: allDay ? null : slotISO(date, toTime(ghost!.end)),
      quantity: holdKind === "capacity" ? holdQtyNow : 1,
      resourceId: holdResourceId,
      resourceName: holdResourceId ? (resources.find((r) => r.id === holdResourceId)?.name ?? null) : null,
      heldFor: heldFor.trim(),
      placedBy: staff.find((x) => x.id === DEMO_STAFF_ID)?.name ?? "Counter",
      expiresAt: Number.isFinite(days) && days > 0 ? expiryIn(days) : null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    onHeld(res.data);
  };

  const submit = () => void (mode === "hold" ? hold() : book());

  // ── placement ────────────────────────────────────────────────────────────
  /* Beside the draft, the way Google's quick-create stands beside the block it
     is making: to the right if there is room, otherwise to the left, never
     over it, and clamped inside the window. A phone gets a sheet from the
     bottom edge, the shape a thumb can reach. */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /* Re-placed whenever the panel changes size — a guest search that grows it
     by 150px must not push its own footer below the window. */
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || compact) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  useLayoutEffect(() => {
    if (compact) return;
    const el = panel.current;
    const h = el?.offsetHeight ?? 560;
    const vh = window.innerHeight;
    /* Placed once, then left alone. Choosing a booking folds the list and the
       panel shrinks by 200px; re-centring it on every change of height made
       it jump down the screen under the pointer that had just clicked. It
       moves only when it would otherwise run off the bottom. */
    setPos((cur) => {
      if (cur) {
        const top = cur.top + h > vh - 16 ? Math.max(16, vh - h - 16) : cur.top;
        return top === cur.top ? cur : { left: cur.left, top };
      }
      const a = request.anchor;
      const vw = window.innerWidth;
      let left: number;
      let top: number;
      if (a) {
        left = a.right + 12 + PANEL_W <= vw - 16 ? a.right + 12 : a.left - 12 - PANEL_W;
        top = a.top - 24;
      } else {
        left = vw - PANEL_W - 32;
        top = 96;
      }
      left = Math.min(Math.max(16, left), vw - PANEL_W - 16);
      top = Math.min(Math.max(16, top), Math.max(16, vh - h - 16));
      return { left, top };
    });
  }, [request.anchor, compact, height]);

  /* Focus goes to the next decision. With the booking already chosen by the
     click, that is the guest's name — Google puts the cursor in the title for
     the same reason. Otherwise it is the first thing that can be booked. A
     phone gets the heading instead: focusing a field there throws a keyboard
     over the sheet before anyone has read it. */
  const placed = compact || pos != null;
  useEffect(() => {
    if (!placed) return;
    if (!compact && chosen && !guest) guestRef.current?.focus({ preventScroll: true });
    else if (!compact && !chosen) listRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
    // Once, when the panel first lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed]);

  /* Escape and Close are "never mind". A click elsewhere is usually "not
     that one, this one" — so what was typed goes with it to the next panel. */
  const latestCarry = useRef<() => Carry | null>(() => null);
  useEffect(() => {
    latestCarry.current = carryNow;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A date picker open inside the panel takes its own Escape.
      const inner = (e.target as HTMLElement | null)?.closest?.('[role="dialog"]');
      if (inner && inner !== panel.current) return;
      onClose(null);
    };
    const down = (e: PointerEvent) => {
      const el = panel.current;
      if (!el || el.contains(e.target as Node)) return;
      // A date picker renders its own floating panel; clicks inside it are ours.
      if ((e.target as HTMLElement).closest?.("[data-date-picker]")) return;
      onClose(latestCarry.current());
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down);
    };
  }, [onClose]);

  const cur = operator?.currency;
  const modKey = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const whenText = ghost && !ghost.allDay ? `${toTime(ghost.start)} – ${toTime(ghost.end)}` : null;
  const where = ghost?.sub ?? null;
  /* "1.5 hrs" rather than "1 hr 30 min": five lengths in the short form fit
     one row of the panel, in the long form they wrapped to two. Quarter
     hours keep the long form — "2.25 hrs" is arithmetic, not a length. */
  const lengthText = (m: number) =>
    m % 30 === 0 && m >= 60
      ? t("book.hours", { count: m / 60 })
      : m > 60
        ? t("book.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 })
        : t("book.minutes", { count: m });
  /** The shortest a booking runs for its from-price. */
  const durationOf = (o: OpenOption): number | null => {
    if (o.kind === "slot") return slotSpan(o);
    if (o.kind === "flexible") return flexDurations(o.product)[0] ?? null;
    if (o.kind === "session") return o.product.schedule?.sessionMinutes || o.product.schedule?.slotMinutes || null;
    if (o.kind === "provider") return providerMinutes(o.product);
    return null;
  };

  return (
    <>
      {/* A sheet over a phone needs the page behind it to recede; a floating
          panel on a desktop does not, because the grid it came from is the
          context it is being read against. */}
      {compact && <div aria-hidden onClick={() => onClose(carryNow())} className="go-sheet-scrim fixed inset-0 z-40 bg-inverse/30" />}
      <div
        ref={panel}
        role="dialog"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          // Ctrl/⌘+Enter books from anywhere in the panel, as it saves in Google's.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className={cn(
          "fixed z-50 flex flex-col border border-line bg-sheet shadow-[0_24px_60px_-16px_rgb(0_0_0/0.30),0_4px_12px_-4px_rgb(0_0_0/0.10)]",
          compact ? "go-sheet-panel inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg" : "max-h-[calc(100dvh-32px)] rounded-lg",
        )}
        style={compact ? undefined : { width: PANEL_W, left: pos?.left ?? -9999, top: pos?.top ?? 0 }}
      >
        {compact && <span aria-hidden className="mx-auto mt-tight h-1 w-10 shrink-0 rounded-full bg-strong" />}

        {/* ── the title is the booking ────────────────────────────────── */}
        <div className="flex items-start gap-tight px-card pt-section">
          <div className="min-w-0 flex-1 min-[480px]:pl-[32px]">
            <p className="type-label text-[12px] text-muted">{mode === "hold" ? th("eyebrow") : t("book.title")}</p>
            <h2
              id={titleId}
              ref={heading}
              tabIndex={-1}
              className={cn(
                "mt-0.5 break-words text-[20px] font-semibold leading-tight tracking-tight outline-none",
                !chosen && "text-muted",
              )}
            >
              {chosen ? chosen.product.name : mode === "hold" ? th("chooseWhat") : t("book.chooseWhat")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onClose(null)}
            aria-label={t("book.close")}
            className="-mr-tight -mt-inline flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg md:h-9 md:w-9"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {/* ── book it, or hold it ────────────────────────────────────────
            The same slot answers two questions: sell it, or take it off sale
            for somebody. Holding used to be a page of its own, which meant
            leaving the day you were looking at to describe it again from a
            form. */}
        <div className="px-card pt-comfortable">
          <div role="tablist" aria-label={t("book.modeLabel")} className="flex gap-inline rounded-sm bg-muted-wash p-inline">
            {(["book", "hold"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setTried(false); setError(null); }}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center rounded-xs text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                  mode === m ? "bg-card text-fg shadow-sm ring-1 ring-strong" : "text-muted hover:text-fg",
                )}
              >
                {t(m === "book" ? "book.modeBook" : "book.modeHold")}
              </button>
            ))}
          </div>
        </div>
        <div className="px-card pt-comfortable">
        {/* ── when: outside the scroll, so it stays in view and its date
            picker is never clipped by the body ─────────────────────────── */}
          <Row icon={<Clock3 size={18} strokeWidth={1.5} />}>
            <div className="-ml-tight flex flex-wrap items-center gap-x-0.5 gap-y-inline">
              <DateField
                value={date}
                onChange={(iso) => {
                  setDate(iso);
                  setChosenKey(null);
                  setListOpen(true);
                }}
                today={today}
                min={today}
                shape="inline"
                labels={{ previousMonth: t("book.prevMonth"), nextMonth: t("book.nextMonth"), today: t("book.today"), open: t("book.pickDate") }}
              />
              <label className="sr-only" htmlFor={`${titleId}-hour`}>
                {t("book.time")}
              </label>
              {/* The chosen hour's option reads as the booking's real span —
                  "16:15 – 17:15" for a show that starts at a quarter past —
                  so the control and the block on the grid say one thing. */}
              <select
                id={`${titleId}-hour`}
                value={hour ?? ""}
                onChange={(e) => {
                  setHour(e.target.value === "" ? null : Number(e.target.value));
                  setChosenKey(null);
                  setListOpen(true);
                }}
                className="h-9 min-w-0 cursor-pointer appearance-none rounded-sm bg-transparent px-tight text-[14px] font-medium tabular-nums text-fg outline-none transition-colors duration-quick hover:bg-muted-wash focus-visible:bg-muted-wash"
              >
                <option value="">{t("book.anyTime")}</option>
                {hours.map((h) => (
                  <option key={h.hour} value={h.hour}>
                    {h.hour === hour && whenText ? whenText : toTime(h.hour * 60)}
                  </option>
                ))}
              </select>
            </div>
            {(where || (chosen && len != null) || ghost?.allDay) && (
              <p className="mt-0.5 text-[12px] text-muted">
                {[ghost?.allDay ? t("book.allDayShort") : null, chosen && len != null ? lengthText(len) : null, where]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </Row>

        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-section overflow-y-auto px-card pb-section pt-section">
          {/* ── what ───────────────────────────────────────────────────
              In both modes: you cannot hold a slot without saying what is
              being held on it. What a sale asks and a hold does not — how
              many of each ticket, which guest, which therapist — is gated
              inside. */}
          <Row icon={<Ticket size={18} strokeWidth={1.5} />}>
            <section aria-labelledby={`${titleId}-what`}>
              {chosen && !listOpen ? (
                <div className="flex items-start gap-tight">
                  <div className="min-w-0 flex-1">
                    <h3 id={`${titleId}-what`} className="sr-only">{t("book.whatLabel")}</h3>
                    <OptionRow
                      option={chosen}
                      on
                      onChoose={() => setListOpen(true)}
                      cur={cur}
                      t={t}
                      atLane={reqLane?.resourceId}
                      lanePick={lane}
                      /* A lane for three hours is not the one-hour price the
                         list quoted; once chosen, the row says what THIS
                         booking costs before tax. Tickets stay per head. */
                      priceNow={(chosen.kind === "slot" || chosen.kind === "flexible") && resolved?.amount ? resolved.amount : undefined}
                      durationOf={() => (chosen.kind === "slot" || chosen.kind === "flexible" ? len : durationOf(chosen))}
                      lengthLabel={lengthText}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setListOpen(true)}
                    className="h-11 shrink-0 rounded-sm px-tight text-[13px] font-medium text-brand-foreground transition-colors duration-quick hover:bg-subtle md:h-9"
                  >
                    {t("book.change")}
                  </button>
                </div>
              ) : (
                <div ref={listRef}>
                  <h3 id={`${titleId}-what`} className="type-label mb-tight text-[12px] text-muted">
                    {hour == null
                      ? dayRows.length > 0
                        ? t("book.whatDay")
                        : t("book.allDay")
                      : reqLane?.resourceId && here.length > 0
                        ? t("book.whatOn", { lane: laneNameOf(reqLane.resourceId, here) ?? "" })
                        : t("book.whatAt", { count: timed.length, time: toTime(hour * 60) })}
                  </h3>
                  {tried && missing === "what" && <Hint>{t("book.needWhat")}</Hint>}

                  {hour != null && timed.length === 0 && (
                    /* Nothing at the hour asked for is not a dead end: offer the
                       nearest hours that do have something, the way a good
                       booking page offers the next available time rather than
                       a refusal. */
                    <div className="rounded-sm border border-dashed border-line px-comfortable py-comfortable">
                      <p className="text-[13px] text-fg">{t("book.nothingAt", { time: toTime(hour * 60) })}</p>
                      {nearest(hours, hour).length > 0 && (
                        <div className="mt-tight flex flex-wrap gap-tight">
                          {nearest(hours, hour).map((h) => (
                            <button
                              key={h.hour}
                              type="button"
                              onClick={() => setHour(h.hour)}
                              className="flex h-11 items-center rounded-sm border border-line px-comfortable font-mono text-[13px] font-medium transition-colors duration-quick hover:border-ember hover:text-brand-foreground md:h-9"
                            >
                              {toTime(h.hour * 60)}
                              <span className="ml-inline font-sans font-normal text-muted">· {t("book.openCount", { count: h.count })}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {hour == null && dayRows.length > 0 && (
                    <ul aria-label={t("book.whatLabel")} className="flex flex-col gap-inline">
                      {dayRows.map((r) => {
                        const open = allStarts.includes(r.product.id);
                        const shown = open ? r.starts : r.starts.slice(0, 4);
                        return (
                          <li key={r.product.id} className="rounded-sm border border-line px-comfortable py-tight">
                            <div className="flex items-baseline gap-comfortable">
                              <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug">{r.product.name}</span>
                              <span className="shrink-0 text-[13px] font-medium tabular-nums">
                                {t("book.fromPrice", { amount: formatPriceShort(r.from, cur) })}
                              </span>
                            </div>
                            <div className="mt-tight flex flex-wrap gap-inline">
                              {shown.map((st) => (
                                <button
                                  key={st.option.key}
                                  type="button"
                                  aria-label={t("book.startAt", { what: r.product.name, time: st.option.time ?? "" })}
                                  onClick={() => {
                                    setHour(st.hour);
                                    choose(st.option);
                                  }}
                                  className="flex h-11 items-center rounded-sm border border-line px-tight font-mono text-[12px] font-medium tabular-nums transition-colors duration-quick hover:border-ember hover:bg-ember/5 hover:text-brand-foreground md:h-8"
                                >
                                  {st.option.time}
                                </button>
                              ))}
                              {r.starts.length > 4 && !open && (
                                <button
                                  type="button"
                                  onClick={() => setAllStarts((x) => [...x, r.product.id])}
                                  className="flex h-11 items-center rounded-sm px-tight text-[12px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:h-8"
                                >
                                  {t("book.moreTimes", { count: r.starts.length - 4 })}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {leading.length > 0 && (
                    <OptionList options={leading} chosenKey={chosenKey} onChoose={choose} cur={cur} t={t} atLane={reqLane?.resourceId} durationOf={durationOf} lengthLabel={lengthText} />
                  )}
                  {elsewhere.length > 0 &&
                    (elsewhereOpen || elsewhere.some((o) => o.key === chosenKey) ? (
                      <div className="mt-section">
                        <h4 className="type-label mb-tight text-[12px] text-muted">
                          {t("book.elsewhere", { time: toTime((hour ?? 0) * 60) })}
                        </h4>
                        <OptionList options={elsewhere} chosenKey={chosenKey} onChoose={choose} cur={cur} t={t} durationOf={durationOf} lengthLabel={lengthText} />
                      </div>
                    ) : (
                      <MoreLine onClick={() => setElsewhereOpen(true)}>
                        {t("book.alsoElsewhere", { count: elsewhere.length, time: toTime((hour ?? 0) * 60) })}
                      </MoreLine>
                    ))}

                  {/* Day tickets and passes are real answers, but they are not
                      what a click on 20:00 asked about — so where the hour has
                      its own answers they wait behind one line rather than
                      doubling the list. With nothing at the hour, or no hour
                      at all, they lead. */}
                  {anytime.length > 0 &&
                    (timed.length > 0 && !anytimeOpen && !anytime.some((o) => o.key === chosenKey) ? (
                      <MoreLine onClick={() => setAnytimeOpen(true)}>{t("book.alsoAllDay", { count: anytime.length })}</MoreLine>
                    ) : (
                      <div className={cn(timed.length > 0 || hour != null ? "mt-section" : "")}>
                        <h4 className="type-label mb-tight text-[12px] text-muted">{t("book.allDay")}</h4>
                        <OptionList options={anytime} chosenKey={chosenKey} onChoose={choose} cur={cur} t={t} />
                      </div>
                    ))}
                </div>
              )}

              {/* The chosen booking's own questions, under it. */}
              {chosen && (
                <div ref={detailsRef} aria-label={t("book.details")} role="group" className="mt-comfortable flex flex-col gap-comfortable">
                  {chosen.lanes && (
                    <ChipGroup label={t("book.where")}>
                      {chosen.lanes.map((l) => {
                        const free = laneFree(l.resourceId);
                        /* What THIS booking costs on each lane — for three
                           hours, not the one-hour rate the list quoted — and
                           only where the lanes differ: four lanes at one price
                           say the price four times. */
                        const totals = chosen.lanes!.filter((x) => laneFree(x.resourceId)).map((x) => priceFor(chosen, x.resourceId, len));
                        const priced = new Set(totals).size > 1;
                        return (
                          <Chip
                            key={l.resourceId}
                            on={lane?.resourceId === l.resourceId}
                            disabled={!free}
                            onClick={() => setLaneId(l.resourceId)}
                            sub={!free ? whyBusy(l.resourceId) : priced ? formatPriceShort(priceFor(chosen, l.resourceId, len), cur) : undefined}
                          >
                            {l.laneName}
                          </Chip>
                        );
                      })}
                    </ChipGroup>
                  )}

                  {lengths.length > 1 && (
                    <ChipGroup label={t("book.howLong")}>
                      {lengthChips.map((m) => (
                        <Chip key={m} on={len === m} disabled={!okLengths.includes(m)} onClick={() => setLength(m)}>
                          {lengthText(m)}
                        </Chip>
                      ))}
                    </ChipGroup>
                  )}
                  {unassigned.length > 0 && (
                    <Hint tone="warning">
                      {t("book.unassignedNote", {
                        count: unassigned.length,
                        what: chosen.product.name,
                        noun: (resources.find((r) => placesOf(chosen).includes(r.id))?.nounSingular ?? t("book.lane")).toLowerCase(),
                        time: unassigned[0].slotStart.slice(11, 16),
                      })}
                    </Hint>
                  )}
                  {(missing === "room" || (chosen.kind === "flexible" && resolved?.missing === "resource")) && (
                    <Hint tone="warning">{t("book.noLaneForLength")}</Hint>
                  )}

                  {mode === "book" && (chosen.kind === "slot" || chosen.kind === "flexible") && (
                    <Stepper
                      label={t("book.guests")}
                      value={party ?? partyMin}
                      min={partyMin}
                      max={partyMax}
                      onChange={setParty}
                      t={t}
                    />
                  )}

                  {mode === "book" && chosen.kind === "provider" && (
                    <label className="block">
                      <span className="type-label mb-tight block text-[12px] text-muted">{t("book.with")}</span>
                      <select
                        value={providerId}
                        onChange={(e) => setProviderId(e.target.value)}
                        className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
                      >
                        <option value="">{t("book.firstAvailable")}</option>
                        {freeProvidersAt(chosen.product, date, chosen.time!).map((id) => (
                          <option key={id} value={id}>
                            {staff.find((s) => s.id === id)?.name ?? id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {mode === "book" && (chosen.kind === "session" || chosen.kind === "provider" || chosen.kind === "anytime") && (
                    <div className="flex flex-col gap-tight">
                      {activeTiersOf(chosen.product).map((tier) => (
                        <Stepper
                          key={tier.id}
                          label={tier.name}
                          hint={formatMoney(tier.price, cur)}
                          value={qty[tier.id] ?? 0}
                          min={0}
                          max={chosen.remaining ?? 50}
                          onChange={(n) => setQty((q) => ({ ...q, [tier.id]: n }))}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                  {mode === "book" && tried && (missing === "tickets" || missing === "more") && (
                    <Hint>{t(missing === "tickets" ? "book.needHowMany" : "book.needMore")}</Hint>
                  )}
                </div>
              )}
            </section>
          </Row>

          {/* ── who ─────────────────────────────────────────────────────
              A sale asks for a guest to bill. A hold asks for the reason it
              exists: in six weeks the name is the only thing that tells a
              block apart from a bug, which is why the API will not take a
              hold without one. */}
          {mode === "book" ? (
          <Row icon={<UserRound size={18} strokeWidth={1.5} />}>
            <GuestField
              inputRef={guestRef}
              guest={guest}
              query={query}
              phone={phone}
              onQuery={setQuery}
              onPhone={setPhone}
              onPick={(g) => {
                setGuest(g);
                setQuery("");
              }}
              onClear={() => {
                setGuest(null);
                requestAnimationFrame(() => guestRef.current?.focus());
              }}
              onEnter={() => void book()}
              required={pay === "later"}
              invalid={tried && missing === "name"}
              t={t}
            />
          </Row>
          ) : (
            <>
              <Row icon={<UserRound size={18} strokeWidth={1.5} />}>
                <label className="flex flex-col gap-inline">
                  <span className="type-label text-[12px] text-muted">{th("fieldHeldFor")}</span>
                  <input
                    ref={heldForRef}
                    value={heldFor}
                    onChange={(e) => setHeldFor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                    placeholder={th("heldForPlaceholder")}
                    aria-invalid={tried && !heldFor.trim() ? true : undefined}
                    className={cn(
                      "h-11 w-full rounded-sm border bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9",
                      tried && !heldFor.trim() ? "border-danger" : "border-line",
                    )}
                  />
                  {tried && !heldFor.trim() ? <Hint>{th("needHeldFor")}</Hint> : <span className="text-[12px] text-muted">{th("heldForHelp")}</span>}
                </label>
              </Row>

              {/* How much of it — a number of places, or everything left.
                  Not offered on a resource: a lane is held whole or not at
                  all, and the click already said which lane. */}
              {!holdResourceId && (
                <Row icon={<Ticket size={18} strokeWidth={1.5} />}>
                  <div className="flex flex-col gap-tight">
                    <div className="flex flex-wrap items-center gap-tight">
                      <span className="type-label text-[12px] text-muted">{th("fieldQuantity")}</span>
                      <Stepper
                        value={holdAll ? holdMax : holdQtyNow}
                        min={1}
                        max={holdMax}
                        onChange={(n) => { setHoldQty(n); setHoldAll(false); }}
                        label={th("fieldQuantity")}
                        t={t}
                      />
                      {chosen?.remaining != null && (
                        <span className="text-[12px] text-muted">{t("book.leftOf", { count: chosen.remaining })}</span>
                      )}
                    </div>
                    <label className="flex items-center gap-tight text-[13px]">
                      <input
                        type="checkbox"
                        checked={holdAll}
                        onChange={(e) => setHoldAll(e.target.checked)}
                        className="h-5 w-5 accent-[var(--color-ember-solid)]"
                      />
                      {th("wholeSession")}
                    </label>
                    <p className="text-[12px] text-muted">{th(holdAll ? "kindHelp_session" : "kindHelp_capacity")}</p>
                  </div>
                </Row>
              )}

              {/* When it gives the capacity back. Empty is the honest default:
                  most holds end when somebody decides they have. */}
              <Row icon={<Wallet size={18} strokeWidth={1.5} />}>
                <label className="flex flex-col gap-inline">
                  <span className="type-label text-[12px] text-muted">{th("fieldExpiry")}</span>
                  <span className="flex items-center gap-tight">
                    <input
                      value={holdDays}
                      inputMode="numeric"
                      onChange={(e) => setHoldDays(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="—"
                      className="h-11 w-20 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
                    />
                    <span className="text-[13px] text-muted">{th("days")}</span>
                  </span>
                  {/* The resolved date, live: "14" is arithmetic somebody has
                      to do, and an empty field reading "—" looks like a value
                      rather than the default it is. */}
                  <span className="text-[12px] text-muted">
                    {(() => {
                      const n = parseInt(holdDays, 10);
                      return Number.isFinite(n) && n > 0
                        ? th("expiryOn", { date: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.parse(`${date}T12:00:00`) + n * 86400000)) })
                        : th("expiryHelp");
                    })()}
                  </span>
                </label>
              </Row>
            </>
          )}

          {/* ── how they pay ──────────────────────────────────────────── */}
          {mode === "book" && (
          <Row icon={<Wallet size={18} strokeWidth={1.5} />}>
            <section aria-labelledby={`${titleId}-pay`}>
              <h3 id={`${titleId}-pay`} className="sr-only">
                {t("book.payment")}
              </h3>
              <div role="radiogroup" aria-labelledby={`${titleId}-pay`} className="grid grid-flow-col gap-inline rounded-sm bg-muted-wash p-inline">
                {payOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={pay === p}
                    onClick={() => setPay(p)}
                    className={cn(
                      "min-h-11 rounded-xs px-tight text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                      // A ring as well as the fill: in dark the card and the
                      // track are the same colour, and a fill alone vanished.
                      pay === p ? "bg-card text-fg shadow-sm ring-1 ring-strong" : "text-muted hover:text-fg",
                    )}
                  >
                    {t(p === "later" ? "book.payLater" : p === "deposit" ? "book.payDeposit" : "book.payFull")}
                  </button>
                ))}
              </div>
              {pay !== "later" && methods.length > 1 && (
                <label className="mt-tight block">
                  <span className="sr-only">{t("book.method")}</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as TillMethod)}
                    className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {enumL.method(m)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="mt-tight text-[12px] text-muted">
                {pay === "later"
                  ? t("book.payLaterNote")
                  : pay === "deposit"
                    ? t("book.payDepositNote", { amount: formatMoney(Math.max(0, totals.total - depositNow), cur) })
                    : t("book.payFullNote")}
              </p>
            </section>
          </Row>
          )}

          {error && (
            <p role="alert" className="rounded-sm bg-danger-wash px-comfortable py-tight text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>

        {/* ── what it costs, and the one action ──────────────────────────── */}
        <div className="flex items-center gap-comfortable border-t border-hairline px-card py-comfortable">
          {/* Nothing chosen, nothing to total: a ৳0.00 there reads as a price. */}
          <div className="min-w-0 flex-1">
            {/* A hold has no price. What it has instead is a consequence, and
                the old register said it in plain words before you pressed —
                which is the one thing from that page worth keeping. */}
            {mode === "hold" ? (
              <p className="text-[12px] leading-snug text-muted">
                {chosen
                  ? th(holdKind === "session" ? "preview_session" : holdKind === "resource" ? "preview_resource" : "preview_capacity", {
                      what: holdKind === "resource" ? (ghost?.sub ?? th("somethingChosen")) : String(holdQtyNow),
                      product: chosen.product.name,
                      when: whenText ? `${whenText}` : th("allDay"),
                      heldFor: heldFor.trim() || th("someoneShort"),
                    })
                  : th("chooseWhat")}
              </p>
            ) : chosen && items.length > 0 ? (
              <>
                <p className="text-[18px] font-semibold leading-tight tabular-nums">{formatMoney(totals.total, cur)}</p>
                {/* "৳600 + ৳90 VAT", not "incl. ৳90 VAT": the rows above quote
                    prices before tax, and a total that does not visibly add
                    up from them reads as an overcharge. */}
                <p className="text-[12px] leading-snug text-muted tabular-nums">
                  {[
                    totals.tax > 0
                      ? t("book.plusTax", { net: formatMoney(totals.total - totals.tax, cur), tax: formatMoney(totals.tax, cur) })
                      : null,
                    pay === "deposit" ? t("book.nowShort", { amount: formatMoney(payNow, cur) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : compact ? null : (
              <p className="text-[12px] text-muted">{t("book.shortcutHint", { key: modKey })}</p>
            )}
          </div>
          <button
            type="button"
            onClick={submit}
            aria-busy={busy}
            className={cn(
              "flex min-h-11 shrink-0 items-center justify-center rounded-sm px-section text-[14px] font-semibold transition-colors duration-quick",
              /* Quiet until there is something to book. Still pressable — it
                 then says what is missing and goes there — but an ember
                 "Reserve" over an empty form promised an action it could not
                 take. */
              chosen
                ? "bg-ember-solid text-white hover:bg-ember-solid/90"
                : "border border-line bg-card text-muted hover:border-strong hover:text-fg",
              busy && "cursor-progress opacity-80",
            )}
          >
            {busy
              ? t("book.booking")
              : mode === "hold"
                ? th("placeHold")
                : pay === "later"
                  ? t("book.reserve")
                  : t("book.bookAndPay", { amount: formatMoney(payNow, cur) })}
          </button>
        </div>
      </div>
    </>
  );
}

/** One line of the panel: an icon in the margin, the question beside it. */
function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-0 min-[480px]:gap-comfortable">
      <span aria-hidden className="hidden h-9 w-5 shrink-0 items-center justify-center text-muted min-[480px]:flex">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-[1px]">{children}</div>
    </div>
  );
}

/** What is missing, beside where it goes. */
function Hint({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "warning" }) {
  return (
    <p role="alert" className={cn("mb-tight flex items-start gap-inline text-[13px] font-medium", tone === "danger" ? "text-danger" : "text-warning")}>
      {tone === "warning" && <TriangleAlert size={14} strokeWidth={1.5} aria-hidden className="mt-[3px] shrink-0" />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function MoreLine({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-inline flex min-h-11 w-full items-center justify-between rounded-sm px-tight text-left text-[13px] text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg md:min-h-9"
    >
      <span>{children}</span>
      <Plus size={14} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label mb-tight text-[12px] text-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-tight">
        {children}
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  sub,
  disabled = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  sub?: string;
  /** Cannot take the booking as asked — shown, so the reason is visible, but
   *  not choosable. Hatched, the app's "you cannot have this". */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-col items-start justify-center rounded-sm border px-comfortable py-inline text-left transition-colors duration-quick md:min-h-9",
        disabled
          ? "cursor-not-allowed border-dashed border-line bg-[repeating-linear-gradient(45deg,var(--color-muted-wash),var(--color-muted-wash)_3px,transparent_3px,transparent_7px)] text-muted"
          : on
            ? "border-ember bg-ember/10"
            : "border-line hover:border-strong",
      )}
    >
      <span className={cn("text-[13px] font-medium leading-tight", on && !disabled && "text-brand-foreground")}>{children}</span>
      {sub && <span className="text-[12px] leading-tight text-muted">{sub}</span>}
    </button>
  );
}

/** The things that can be booked, as one list you pick from. */
function OptionList({
  options,
  chosenKey,
  onChoose,
  cur,
  t,
  atLane,
  durationOf,
  lengthLabel,
}: {
  /** The field that was clicked: an option that can go there says so. */
  atLane?: string;
  options: OpenOption[];
  chosenKey: string | null;
  onChoose: (o: OpenOption) => void;
  cur: string | undefined;
  t: T;
  durationOf?: (o: OpenOption) => number | null;
  lengthLabel?: (m: number) => string;
}) {
  return (
    <div role="radiogroup" aria-label={t("book.whatLabel")} className="flex flex-col gap-inline">
      {options.map((o) => (
        <OptionRow
          key={o.key}
          option={o}
          on={o.key === chosenKey}
          onChoose={() => onChoose(o)}
          cur={cur}
          t={t}
          atLane={atLane}
          durationOf={durationOf}
          lengthLabel={lengthLabel}
        />
      ))}
    </div>
  );
}

function OptionRow({
  option: o,
  on,
  onChoose,
  cur,
  t,
  atLane,
  lanePick,
  priceNow,
  durationOf,
  lengthLabel,
}: {
  option: OpenOption;
  on: boolean;
  onChoose: () => void;
  cur: string | undefined;
  t: T;
  atLane?: string;
  /** The lane picked in the panel, once the row stands for the choice made. */
  lanePick?: { laneName: string; price: number } | null;
  /** What the booking as configured costs, once it is the one chosen. */
  priceNow?: number;
  durationOf?: (o: OpenOption) => number | null;
  lengthLabel?: (m: number) => string;
}) {
  // A court whose only booking shares its name would read "Badminton
  // Court · Badminton Court"; the second says nothing.
  const clicked = atLane ? o.lanes?.find((l) => l.resourceId === atLane) : undefined;
  // Under "On Outdoor Field", "14:00 · Outdoor Field" says the field twice.
  const onClicked = !!atLane && (o.resourceId === atLane || !!clicked);
  const where = lanePick
    ? lanePick.laneName
    : onClicked
      ? null
      : o.lanes
        ? t("book.lanesFree", { count: o.lanes.length })
        : o.laneName && o.laneName !== o.product.name
          ? o.laneName
          : o.kind === "flexible" && !o.laneName
            ? t("book.anyFree", { noun: (o.noun ?? t("book.lane")).toLowerCase() })
            : null;
  const left = o.remaining != null ? t("book.left", { count: o.remaining }) : null;
  const price = priceNow ?? lanePick?.price ?? o.price;
  /* How long the price buys. "Bowling Lane ৳1,000" and "Planetarium ৳600"
     are not comparable until one says an hour and the other 45 minutes. */
  const minutes = durationOf?.(o);
  const offHour = !!o.time && !o.time.endsWith(":00");
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onChoose}
      className={cn(
        "flex min-h-11 w-full items-center gap-comfortable rounded-sm border px-comfortable py-tight text-left transition-colors duration-quick",
        on ? "border-ember bg-ember/5" : "border-line hover:border-strong hover:bg-subtle/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          on ? "border-ember-solid bg-ember-solid text-white" : "border-strong",
        )}
      >
        {on && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[13px] font-medium leading-snug">{o.product.name}</span>
        <span className="block text-[12px] leading-snug text-muted">
          {/* A show at a quarter past, under an hour that was clicked on the
              hour, says so in colour as well as in digits. */}
          {o.time && <span className={cn("tabular-nums", offHour && "font-medium text-brand-foreground")}>{o.time}</span>}
          {[minutes ? lengthLabel?.(minutes) : null, where, left]
            .filter(Boolean)
            .map((x) => ` · ${x}`)
            .join("")}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium tabular-nums">
        {!lanePick && priceNow == null && o.lanes && new Set(o.lanes.map((l) => l.price)).size > 1
          ? t("book.fromPrice", { amount: formatPriceShort(o.price, cur) })
          : formatPriceShort(price, cur)}
      </span>
    </button>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  t,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  t: T;
}) {
  return (
    <div className="flex items-center gap-comfortable">
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[13px] font-medium leading-snug">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-inline">
        <button
          type="button"
          aria-label={t("book.less", { what: label })}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg transition-colors duration-quick hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-35 md:h-8 md:w-8"
        >
          <Minus size={14} strokeWidth={2} />
        </button>
        <span aria-live="polite" className="w-7 text-center text-[14px] font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={t("book.more", { what: label })}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg transition-colors duration-quick hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-35 md:h-8 md:w-8"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/**
 * Who is coming. A search first — attaching the record someone already has
 * keeps their history in one place, which is the whole point of having
 * customer records — then, if nobody matches, the name and number typed become
 * a new one.
 */
function GuestField({
  inputRef,
  guest,
  query,
  phone,
  onQuery,
  onPhone,
  onPick,
  onClear,
  onEnter,
  required,
  invalid,
  t,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  guest: Guest | null;
  query: string;
  phone: string;
  onQuery: (q: string) => void;
  onPhone: (p: string) => void;
  onPick: (g: Guest) => void;
  onClear: () => void;
  /** Enter with nothing to pick: book. */
  onEnter: () => void;
  required: boolean;
  invalid: boolean;
  t: T;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const phoneRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const matchesQ = useApiQuery(
    () =>
      q.length >= 2
        ? listCustomerRows({ search: q, pageSize: 4, sort: "spent", order: "desc" })
        : Promise.resolve({ ok: true as const, data: { data: [], page: { page: 1, pageSize: 4, total: 0, totalPages: 1 } } }),
    [q],
  );
  const matches = matchesQ.data?.data ?? [];
  /* A combobox: the matches, and "add as new" as the last row of the same
     list. The new-customer form used to sit under the matches, so a match
     and an invitation to create a duplicate of it were on screen at once and
     nobody could say which one Enter would take. Now the highlighted row is
     what Enter takes, and the phone field appears once "new" is chosen — or
     at once, when nobody matches. */
  const [addingFor, setAddingFor] = useState<string | null>(phone ? q : null);
  const adding = q.length >= 2 && (addingFor === q || (!matchesQ.loading && matches.length === 0) || !!phone);
  const [activeFor, setActiveFor] = useState<{ q: string; i: number }>({ q: "", i: 0 });
  const active = activeFor.q === q ? activeFor.i : 0;
  const listOpen = q.length >= 2 && !adding && matches.length > 0;
  const rows = matches.length + 1;
  const addNew = () => {
    setAddingFor(q);
    requestAnimationFrame(() => phoneRef.current?.focus());
  };

  if (guest) {
    return (
      <section aria-labelledby={`${id}-h`}>
        <h3 id={`${id}-h`} className="sr-only">
          {t("book.guest")}
        </h3>
        <div className="flex min-h-9 items-center gap-comfortable">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-wash text-[12px] font-semibold text-brand-foreground">
            {initials(guest.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-[14px] font-medium leading-tight">{guest.name}</span>
            {guest.phone && <span className="block text-[12px] text-muted normal-nums">{guest.phone}</span>}
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label={t("book.changeGuest")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:h-8 md:w-8"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="sr-only">
        {t(required ? "book.guestRequired" : "book.guest")}
      </h3>
      <div className="relative">
        <Search size={15} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-comfortable top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (listOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              const i = e.key === "ArrowDown" ? Math.min(rows - 1, active + 1) : Math.max(0, active - 1);
              setActiveFor({ q, i });
              return;
            }
            if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            if (listOpen) {
              if (active < matches.length) onPick({ id: matches[active].id, name: matches[active].name, phone: matches[active].phone });
              else addNew();
            } else onEnter();
          }}
          placeholder={t(required ? "book.guestPlaceholderRequired" : "book.guestPlaceholder")}
          aria-labelledby={`${id}-h`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-11 w-full rounded-sm border bg-card pl-[36px] pr-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9",
            invalid ? "border-danger" : "border-line",
          )}
        />
      </div>
      {invalid && <p role="alert" className="mt-inline text-[13px] font-medium text-danger">{t("book.needName")}</p>}
      {listOpen && (
        <ul id={listId} role="listbox" aria-label={t("book.matches")} className="mt-inline flex flex-col gap-0.5 rounded-sm border border-line p-inline">
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActiveFor({ q, i })}
              onClick={() => onPick({ id: c.id, name: c.name, phone: c.phone })}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-comfortable rounded-xs px-tight py-inline",
                active === i && "bg-muted-wash",
              )}
            >
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember-wash text-[12px] font-semibold text-brand-foreground">
                {initials(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[13px] font-medium">{c.name}</span>
                <span className="block text-[12px] text-muted normal-nums">
                  {[c.phone, t("book.orders", { count: c.stats.orders })].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
          <li
            id={`${listId}-${matches.length}`}
            role="option"
            aria-selected={active === matches.length}
            onMouseEnter={() => setActiveFor({ q, i: matches.length })}
            onClick={addNew}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-comfortable rounded-xs px-tight py-inline text-[13px] font-medium text-brand-foreground",
              active === matches.length && "bg-muted-wash",
            )}
          >
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-ember/60">
              <Plus size={14} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 break-words">{t("book.addNew", { name: q })}</span>
          </li>
        </ul>
      )}
      {adding && (
        <div className="mt-tight">
          <p className="mb-inline text-[12px] text-muted">{t("book.newGuest", { name: q })}</p>
          <input
            ref={phoneRef}
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                onEnter();
              }
            }}
            type="tel"
            inputMode="tel"
            placeholder={t("book.phonePlaceholder")}
            aria-label={t("book.phone")}
            className="h-11 w-full rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none placeholder:text-muted focus:border-inverse md:h-9"
          />
        </div>
      )}
    </section>
  );
}

/** "Sabbir Alam" → "SA". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** The name of a field, from the options that can go on it. */
function laneNameOf(resourceId: string, options: OpenOption[]): string | null {
  for (const o of options) {
    if (o.resourceId === resourceId && o.laneName) return o.laneName;
    const l = o.lanes?.find((x) => x.resourceId === resourceId);
    if (l) return l.laneName;
  }
  return null;
}

/** The two open hours either side of the one asked for. */
function nearest(hours: { hour: number; count: number }[], hour: number) {
  return [...hours]
    .sort((a, b) => Math.abs(a.hour - hour) - Math.abs(b.hour - hour) || a.hour - b.hour)
    .slice(0, 3)
    .sort((a, b) => a.hour - b.hour);
}
