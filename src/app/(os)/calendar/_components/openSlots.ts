import { buildDay } from "@/lib/dayModel";
import {
  applyResourceRate,
  firstFreeResource,
  getDailyRemaining,
  getResourceMatrix,
  isOpenOn,
  isResourceFreeFor,
  type Minor,
  type Product,
} from "@/lib/api";
import {
  flexDurations,
  flexTimes,
  freeProvidersAt,
  patternOf,
  providerTimes,
} from "@/lib/sale/selection";
import { productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { isDailyCapped, toMinutes } from "@/lib/schedule";

/**
 * What the calendar can still sell.
 *
 * A calendar that draws only what has been booked answers "what is
 * happening?" and nothing else. The question a front desk is asked all day is
 * the other one — *is there anything at four?* — and it was unanswerable here
 * without leaving for the till. This turns the same availability engine the
 * till and the Go schedule use into what the grid draws and what a click on
 * empty time offers, so all three agree about what is open because they are
 * asking one function.
 */

/** One way to fill an open slot: a booking, where it runs, and what it costs. */
export interface OpenOption {
  key: string;
  product: Product;
  /** How this option is sold, which decides the questions the panel asks. */
  kind: "slot" | "session" | "flexible" | "provider" | "anytime";
  date: string;
  /** Start time. Undefined for an all-day product (entry, a pass). */
  time?: string;
  /** A field or a lane; undefined for a session or an all-day product. */
  resourceId?: string;
  laneName?: string;
  /** What one of its lanes is called — "Court", "Lane" — for "any free court". */
  noun?: string;
  /** Where one booking can be sold on several fields or lanes at this time,
   *  they are one option with a choice of where, not four near-identical rows.
   *  Each carries its own price: Lane 4 is dearer than Lane 1. */
  lanes?: { resourceId: string; laneName: string; price: Minor }[];
  /** From-price: the cheapest way in, before quantities. */
  price: Minor;
  /** Sessions and day-capped products: places left. */
  remaining?: number;
  capacity?: number;
}

/** One open slot drawn on the grid: a field-hour or a departure with room. */
export interface OpenSlot {
  key: string;
  date: string;
  time: string;
  minutes: number;
  span: number;
  laneId: string;
  laneName: string;
  isSession: boolean;
  options: OpenOption[];
  remaining?: number;
  capacity?: number;
}

/** A session lane's id on the day grid. Resources keep their own ids. */
export const sessionLaneId = (productId: string) => `session:${productId}`;

const sellable = (p: Product) =>
  p.status === "active" && p.tiers.some((t) => t.active) && p.channels.includes("counter");

/** Past is not open. A slot that started before now is history, and offering
 *  to sell it would put a booking in the past with nobody able to attend. */
const isPast = (date: string, minutes: number, today: string, nowMin: number) =>
  date < today || (date === today && minutes < nowMin);

/** Every open field-hour and every departure with room, for one day. */
export function openSlotsFor(
  products: Product[],
  date: string,
  today: string,
  nowMin: number,
): OpenSlot[] {
  const day = buildDay(products.filter(sellable), date);
  const out: OpenSlot[] = [];
  for (const s of day.slots) {
    if (s.kind !== "open" || isPast(date, s.minutes, today, nowMin)) continue;
    const laneId = s.lane.isSession ? sessionLaneId(s.lane.id) : s.lane.id;
    out.push({
      key: `${date}|${laneId}|${s.time}`,
      date,
      time: s.time,
      minutes: s.minutes,
      span: s.spanMinutes,
      laneId,
      laneName: s.lane.name,
      isSession: s.lane.isSession,
      remaining: s.remaining,
      capacity: s.capacity,
      options: s.options.map((o) => ({
        key: `${o.product.id}|${laneId}|${s.time}`,
        product: o.product,
        kind: s.lane.isSession ? "session" : "slot",
        date,
        time: s.time,
        resourceId: s.lane.isSession ? undefined : s.lane.id,
        laneName: s.lane.isSession ? undefined : s.lane.name,
        price: o.price,
        remaining: s.remaining,
        capacity: s.capacity,
      })),
    });
  }

  /* A lane sold by the hour (bowling, a badminton court) has no fixed slots,
     so the shared day model has nothing to say about it and its lanes used to
     fold away as "empty" on the busiest night. Its open time is drawn the same
     way a field's is: each hour on each lane that is free for the shortest
     length it sells, priced at that length. */
  for (const prod of products.filter(sellable)) {
    if (patternOf(prod) !== "flexible") continue;
    const shortest = flexDurations(prod)[0];
    if (!shortest) continue;
    const lanes = getResourceMatrix(prod, date).map((r) => r.resource);
    for (const time of flexTimes(prod, date)) {
      const m = toMinutes(time);
      if (m % 60 !== 0 || isPast(date, m, today, nowMin)) continue;
      for (const lane of lanes) {
        if (lane.outOfService) continue;
        if (!isResourceFreeFor(lane.id, date, time, shortest, prod.bufferMinutes ?? 0)) continue;
        const key = `${date}|${lane.id}|${time}`;
        const option: OpenOption = {
          key: `${prod.id}|${lane.id}|${time}`,
          product: prod,
          kind: "flexible",
          date,
          time,
          resourceId: lane.id,
          laneName: lane.name,
          price: applyResourceRate(productDurationPrice(prod, date, time, shortest, cheapest(prod)), shortest, lane),
        };
        const existing = out.find((o) => o.key === key);
        if (existing) existing.options.push(option);
        else
          out.push({
            key,
            date,
            time,
            minutes: m,
            span: 60,
            laneId: lane.id,
            laneName: lane.name,
            isSession: false,
            options: [option],
          });
      }
    }
  }
  return out.sort((a, b) => a.minutes - b.minutes || a.laneName.localeCompare(b.laneName));
}

/**
 * Everything bookable starting inside one hour of one day.
 *
 * The grid's slots (fields and sessions) plus the two kinds that have no fixed
 * slots to draw: a lane sold by the hour (bowling) and an appointment with a
 * person (a therapist). Both are real answers to "is there anything at four?",
 * so the panel offers them even though the grid has no tile for them.
 */
export function optionsInHour(
  products: Product[],
  slots: OpenSlot[],
  date: string,
  hour: number,
  today: string,
  nowMin: number,
): OpenOption[] {
  const from = hour * 60;
  const to = from + 60;
  const out: OpenOption[] = slots
    .filter((s) => s.date === date && s.minutes >= from && s.minutes < to)
    .flatMap((s) => s.options);

  for (const p of products.filter(sellable)) {
    const pattern = patternOf(p);
    if (pattern === "flexible") {
      // Lanes already offered hour by hour say it better than "any lane".
      if (out.some((o) => o.product.id === p.id)) continue;
      // The shortest span decides whether an hour is open at all; the panel
      // then lets the length grow as far as the lane allows.
      const minutes = flexDurations(p)[0];
      if (!minutes) continue;
      const time = flexTimes(p, date).find((t) => {
        const m = toMinutes(t);
        return m >= from && m < to && !isPast(date, m, today, nowMin);
      });
      if (!time || !firstFreeResource(p, date, time, minutes)) continue;
      out.push({
        key: `${p.id}|flex|${time}`,
        product: p,
        kind: "flexible",
        date,
        time,
        noun: getResourceMatrix(p, date)[0]?.resource.nounSingular,
        price: productDurationPrice(p, date, time, minutes, cheapest(p)),
      });
    } else if (pattern === "provider") {
      const time = providerTimes(p, date).find((t) => {
        const m = toMinutes(t);
        return m >= from && m < to && !isPast(date, m, today, nowMin) && freeProvidersAt(p, date, t).length > 0;
      });
      if (!time) continue;
      out.push({
        key: `${p.id}|prov|${time}`,
        product: p,
        kind: "provider",
        date,
        time,
        price: resolveProductPrice(p, date, time, cheapest(p)),
      });
    }
  }
  return mergeLanes(out).sort(
    (a, b) => toMinutes(a.time ?? "00:00") - toMinutes(b.time ?? "00:00") || a.product.name.localeCompare(b.product.name),
  );
}

/** One row per booking and start time; the lanes it can take become a choice. */
function mergeLanes(options: OpenOption[]): OpenOption[] {
  const out: OpenOption[] = [];
  const groups = new Map<string, OpenOption[]>();
  for (const o of options) {
    if (!o.resourceId || (o.kind !== "slot" && o.kind !== "flexible")) {
      out.push(o);
      continue;
    }
    const k = `${o.product.id}|${o.time}`;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  for (const [k, list] of groups) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const first = list[0];
    out.push({
      ...first,
      key: `${k}|lanes`,
      resourceId: undefined,
      laneName: undefined,
      price: Math.min(...list.map((o) => o.price)),
      lanes: list
        .map((o) => ({ resourceId: o.resourceId!, laneName: o.laneName ?? o.resourceId!, price: o.price }))
        .sort((a, b) => a.laneName.localeCompare(b.laneName, undefined, { numeric: true })),
    });
  }
  return out;
}

/**
 * What can be sold for a day without a time at all: entry, a pass, a day with
 * a daily allowance. They are not slots, so the grid has nothing to draw for
 * them — but someone phoning to ask "can I come Saturday?" is asking exactly
 * this, so the panel offers them under the day.
 */
export function anytimeOptions(products: Product[], date: string, today: string): OpenOption[] {
  if (date < today) return [];
  const out: OpenOption[] = [];
  for (const p of products.filter(sellable)) {
    if (patternOf(p) !== "tiered") continue;
    const bt = p.bookingType;
    // Open entry, a pass that starts on a date, and a day with an allowance.
    // A credits pack is bought, not booked, and has no day to put it on.
    if (!(bt === "BT-01" || bt === "BT-02" || isDailyCapped(bt))) continue;
    if (p.schedule && !isOpenOn(p, date)) continue;
    const left = isDailyCapped(bt) ? getDailyRemaining(p, date) : undefined;
    if (left != null && left <= 0) continue;
    out.push({
      key: `${p.id}|anytime`,
      product: p,
      kind: "anytime",
      date,
      price: cheapest(p),
      remaining: left ?? undefined,
      capacity: isDailyCapped(bt) ? (p.schedule?.dailyCapacity ?? undefined) : undefined,
    });
  }
  return out.sort((a, b) => a.product.name.localeCompare(b.product.name));
}

/** Hours of one day with something open, for the panel's time picker. */
export function openHours(
  products: Product[],
  slots: OpenSlot[],
  date: string,
  today: string,
  nowMin: number,
  openHour: number,
  closeHour: number,
): { hour: number; count: number }[] {
  const out: { hour: number; count: number }[] = [];
  for (let h = openHour; h < closeHour; h++) {
    const n = optionsInHour(products, slots, date, h, today, nowMin).length;
    if (n > 0) out.push({ hour: h, count: n });
  }
  return out;
}

function cheapest(p: Product): Minor {
  const prices = p.tiers.filter((t) => t.active).map((t) => t.price);
  return prices.length ? Math.min(...prices) : 0;
}
