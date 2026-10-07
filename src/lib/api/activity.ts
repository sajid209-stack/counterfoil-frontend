/*
 * STORY - the activity log: who did what, when and where.
 *
 * The dashboard used to have a "Latest activity" card that was really a sales
 * feed (an order paid, a customer added). Owners of a venue ask a different
 * question: not "what sold" but "what happened here" - who signed in on which
 * till, a wrong PIN, a shift closed with the cash short, a ticket scanned
 * twice, a code replaced, a refund asked for, a device paired. Stripe events,
 * Shopify staff activity, Square team activity and Linear's audit log all
 * answer it the same way: one time-ordered list of events, each with an actor,
 * a place, a subject and a severity.
 *
 * Three sources feed it, merged here:
 *   1. DERIVED from records the mock already keeps: gate scans, credential
 *      re-issues and terminations, refund requests, order history (refunds,
 *      undone sales, discounts), holds, and a device's pairedAt.
 *   2. SEEDED history for what the mock has no record of (sign-ins, wrong PINs,
 *      shifts, bookings moved, settings changed). Deterministic - the same
 *      numbers every time - and anchored to the demo clock, never the wall
 *      clock.
 *   3. RECORDED live by the tills and screens, through `recordActivity`. A live
 *      event may name a derived one it replaces (a pairing is both a device's
 *      `pairedAt` and a live event), so nothing is listed twice.
 *
 * Language-neutral by design: an event stores what happened and a few facts,
 * never a sentence.
 */
import { demoNow } from "@/lib/schedule";
import { formatClockOf } from "@/lib/format";
import { delay, ok } from "./client";
import { peekBookings } from "./bookings";
import { peekCounters } from "./counters";
import { credentialsFor, scansFor } from "./credentials";
import { deviceForCounter, peekDevices } from "./devices";
import { CHECKOUT_HELD_FOR, peekHolds } from "./holds";
import { peekLocations } from "./locations";
import { peekOrders } from "./orders";
import { refundRequestsForOrder } from "./refundRequests";
import { peekStaff } from "./staff";
import { peekTickets } from "./tickets";
import {
  DEFAULT_SEVERITY,
  GROUP_OF,
  onDemoClock,
  peekRecordedActivity,
  recordActivity,
  type ActivityActor,
  type ActivityEvent,
  type ActivityGroup,
  type ActivityKind,
  type ActivitySeverity,
  type RawActivity,
} from "./activityLog";
import type { ApiResult, ID, ListResponse, Order, Staff, Ticket, TicketScan } from "./types";

export * from "./activityLog";

/* -- tiny deterministic helpers -------------------------------------------- */

const MIN = 60_000;
const DAY = 86_400_000;
/** How far back the seeded history reaches, in days. */
export const SEEDED_DAYS = 21;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32: a seeded stream of numbers in [0, 1). */
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd in the reader's zone - never derived with toISOString. */
export const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dayStartMs = (offset: number): number => {
  const n = demoNow();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - offset).getTime();
};
const atMin = (offset: number, minutes: number): string => new Date(dayStartMs(offset) + minutes * MIN).toISOString();
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* -- derived ---------------------------------------------------------------- */

type Ctx = {
  now: number;
  staff: Staff[];
  byName: Map<string, Staff>;
  byId: Map<ID, Staff>;
  orders: Order[];
  orderById: Map<ID, Order>;
  tickets: Ticket[];
  counterLoc: Map<ID, ID>;
};

function makeCtx(): Ctx {
  const staff = peekStaff();
  const orders = peekOrders();
  return {
    now: demoNow().getTime(),
    staff,
    byName: new Map(staff.map((s) => [s.name, s])),
    byId: new Map(staff.map((s) => [s.id, s])),
    orders,
    orderById: new Map(orders.map((o) => [o.id, o])),
    tickets: peekTickets(),
    counterLoc: new Map(peekCounters().map((c) => [c.id, c.locationId])),
  };
}

const actorOf = (ctx: Ctx, name: string | null | undefined): ActivityActor | null => {
  if (!name) return null;
  return { staffId: ctx.byName.get(name)?.id ?? null, name };
};
const actorById = (ctx: Ctx, id: ID | null | undefined): ActivityActor | null => {
  const s = id ? ctx.byId.get(id) : undefined;
  return s ? { staffId: s.id, name: s.name } : null;
};

type Raw = RawActivity;
const raw = (
  id: string,
  at: string,
  kind: ActivityKind,
  rest: Partial<Omit<Raw, "id" | "at" | "kind">> = {},
): Raw => ({
  id,
  at,
  kind,
  severity: rest.severity ?? DEFAULT_SEVERITY[kind],
  actor: rest.actor ?? null,
  locationId: rest.locationId ?? null,
  counterId: rest.counterId ?? null,
  deviceId: rest.deviceId ?? null,
  subject: rest.subject ?? null,
  data: rest.data ?? {},
});

const orderSubject = (o: Order) => ({ type: "order" as const, id: o.id, label: o.reference, href: `/orders/${o.id}` });
const ticketSubject = (t: Ticket) => ({ type: "ticket" as const, id: t.id, label: t.code, href: `/tickets/${t.id}` });

function derived(ctx: Ctx): Raw[] {
  const out: Raw[] = [];

  /* Gate scans: admitted and refused, from the gate's own record. */
  for (const t of ctx.tickets) {
    for (const s of scansFor(t.id)) {
      const o = ctx.orderById.get(t.orderId);
      out.push(
        raw(`scan:${s.id}`, s.at, s.outcome === "admitted" ? "ticket.admitted" : "ticket.refused", {
          actor: actorOf(ctx, s.by),
          locationId: o?.locationId ?? null,
          counterId: o?.counterId ?? null,
          subject: ticketSubject(t),
          data: s.outcome === "admitted" ? { admitted: s.admitted ?? 1 } : { reason: s.refusal ?? "unknown" },
        }),
      );
    }
    /* A re-issued code. Only tickets whose code carries an R-number can have
       one, so the (cheap) credential read is limited to those. */
    if (/-R\d+$/.test(t.code)) {
      for (const c of credentialsFor(t.id)) {
        if (c.reason !== "reissue") continue;
        const o = ctx.orderById.get(t.orderId);
        out.push(
          raw(`reissue:${c.id}`, c.createdAt, "ticket.reissued", {
            actor: actorOf(ctx, c.issuedBy),
            locationId: o?.locationId ?? null,
            subject: ticketSubject(t),
            data: { note: c.note ?? null, code: c.code },
          }),
        );
      }
    }
    if (t.terminatedAt) {
      const o = ctx.orderById.get(t.orderId);
      out.push(
        raw(`terminated:${t.id}`, t.terminatedAt, "ticket.terminated", {
          actor: actorById(ctx, "stf_nadia"),
          locationId: o?.locationId ?? null,
          subject: ticketSubject(t),
          data: { reason: t.terminatedReason ?? null },
        }),
      );
    }
  }

  for (const o of ctx.orders) {
    /* Refund requests from the counter. */
    for (const r of refundRequestsForOrder(o.id)) {
      const base = { locationId: o.locationId, counterId: o.counterId, subject: orderSubject(o) };
      out.push(
        raw(`rr:${r.id}`, r.requestedAt, "refund.requested", {
          ...base,
          actor: actorOf(ctx, r.requestedBy),
          data: { amount: r.amount, reason: r.reason, note: r.note ?? null },
        }),
      );
      if (r.status !== "pending" && r.decidedAt) {
        out.push(
          raw(`rd:${r.id}`, r.decidedAt, r.status === "approved" ? "refund.approved" : "refund.declined", {
            ...base,
            actor: actorOf(ctx, r.decidedBy),
            data: { amount: r.amount, note: r.decisionNote ?? null },
          }),
        );
      }
    }
    /* The order's own history lines. */
    (o.history ?? []).forEach((h, i) => {
      const base = { locationId: o.locationId, counterId: o.counterId, subject: orderSubject(o), actor: actorOf(ctx, h.who) };
      if (h.text === "Sale undone at the till") {
        out.push(raw(`oh:${o.id}:${i}`, h.at, "order.undone", { ...base, data: { amount: o.total } }));
      } else if (h.text.startsWith("Refunded ") && !h.text.includes("Refund request from the counter")) {
        out.push(raw(`oh:${o.id}:${i}`, h.at, "order.refunded", { ...base, data: { note: h.text.replace(/^Refunded /, "") } }));
      }
    });
  }

  /* Holds: placed (and released, once the record says it changed). The till's
     own checkout holds are bookkeeping, not events. */
  for (const h of peekHolds()) {
    if (h.heldFor === CHECKOUT_HELD_FOR) continue;
    const subject = { type: "hold" as const, id: h.id, label: h.productName, href: null };
    const place = h.kind === "resource" ? h.resourceName ?? null : null;
    out.push(
      raw(`hold:${h.id}`, h.createdAt, "hold.placed", {
        actor: actorOf(ctx, h.placedBy),
        locationId: h.locationId,
        subject,
        data: { heldFor: h.heldFor, quantity: h.quantity, place, date: h.date },
      }),
    );
    if (h.status === "released" && h.updatedAt !== h.createdAt) {
      out.push(
        raw(`holdr:${h.id}`, h.updatedAt, "hold.released", {
          actor: actorOf(ctx, h.placedBy),
          locationId: h.locationId,
          subject,
          data: { heldFor: h.heldFor, place },
        }),
      );
    }
  }

  /* Devices: pairing. */
  const counterById = new Map(peekCounters().map((c) => [c.id, c]));
  for (const d of peekDevices()) {
    if (typeof d.pairedAt === "string" && d.pairedAt) {
      const c = d.counterId ? counterById.get(d.counterId) : undefined;
      out.push(
        raw(`pair:${d.id}`, d.pairedAt, "device.paired", {
          locationId: c?.locationId ?? null,
          counterId: d.counterId,
          deviceId: d.id,
          subject: { type: "device", id: d.id, label: d.name, href: `/settings/devices/${d.id}` },
        }),
      );
    }
  }
  return out;
}

/* -- seeded history --------------------------------------------------------- */

function seeded(ctx: Ctx): Raw[] {
  const out: Raw[] = [];
  const NOW = ctx.now;
  const push = (e: Raw) => {
    if (Date.parse(e.at) <= NOW) out.push(e);
  };
  if (!ctx.staff.length) return out;

  const counters = peekCounters().filter((c) => c.status === "active");
  const devices = peekDevices();
  const nadia = ctx.byId.get("stf_nadia") ?? ctx.staff.find((s) => s.status === "active");
  const manager = ctx.staff.find((s) => s.roleId === "role_manager" && s.status === "active") ?? nadia;
  const who = (s: Staff | undefined): ActivityActor | null => (s ? { staffId: s.id, name: s.name } : null);

  /* Every day, every counter: someone signs in, opens a shift, closes it. */
  for (let d = 0; d < SEEDED_DAYS; d++) {
    counters.forEach((c) => {
      const workers = ctx.staff.filter((s) => s.status === "active" && s.counterIds.includes(c.id) && s.hasPin !== false);
      if (!workers.length) return;
      const r = rng(`${d}:${c.id}`);
      const closedDay = r() < 0.12;
      const scripted = d === 0 && c.id === "cnt_fort_main" && !!nadia;
      if (closedDay && d > 0) return;
      const worker = scripted ? nadia! : workers[Math.floor(r() * workers.length)];
      const start = scripted ? 9 * 60 + 14 : 8 * 60 + 15 + Math.floor(r() * 70);
      const dev = deviceForCounter(devices, c.id);
      const where = { locationId: c.locationId, counterId: c.id, deviceId: dev?.id ?? null, actor: who(worker) };
      const key = `${d}:${c.id}`;

      /* Sometimes the PIN is wrong first - and now and then it locks. */
      const trouble = scripted ? 0.1 : r();
      if (trouble < 0.04) {
        for (let n = 1; n <= 3; n++) push(raw(`s:pin:${key}:${n}`, atMin(d, start - 11 + n), "staff.wrong_pin", { ...where, data: { attempt: n, max: 3 } }));
        push(raw(`s:lock:${key}`, atMin(d, start - 7), "staff.locked_out", { ...where, data: { max: 3 } }));
      } else if (trouble < 0.26) {
        push(raw(`s:pin:${key}:1`, atMin(d, start - 2), "staff.wrong_pin", { ...where, data: { attempt: 1, max: 3 } }));
      }
      push(raw(`s:in:${key}`, atMin(d, start), "staff.signed_in", where));
      const floats = [300000, 500000, 1000000];
      push(raw(`s:open:${key}`, atMin(d, start + 2), "shift.opened", { ...where, data: { float: floats[Math.floor(r() * 3)] } }));

      if (d > 0) {
        const end = 17 * 60 + Math.floor(r() * 90);
        const expected = Math.round((8000 + r() * 50000) / 50) * 50 * 100;
        const pick = r();
        const diffs = [-5000, -2000, 1500, 3000, -12000, -7500, -60000];
        const diff = pick < 0.62 ? 0 : diffs[Math.floor(r() * diffs.length)];
        const sev: ActivitySeverity = diff <= -50000 ? "critical" : Math.abs(diff) >= 5000 ? "warning" : "info";
        push(raw(`s:close:${key}`, atMin(d, end - 3), "shift.closed", { ...where, severity: sev, data: { expected, counted: expected + diff, difference: diff } }));
        push(raw(`s:out:${key}`, atMin(d, end), "staff.signed_out", where));
      }
    });
  }

  /* Second scans: redeemed tickets that someone tried to use again. */
  const redeemed = ctx.tickets
    .map((t) => ({ t, ms: Date.parse(t.redeemedAt ?? "") }))
    .filter((x) => Number.isFinite(x.ms) && x.ms <= NOW - 12 * MIN)
    /* Only tickets used while a gate is open: a scan at 3 AM is not a story. */
    .filter((x) => {
      const h = new Date(x.ms).getHours();
      return h >= 9 && h <= 17;
    })
    .sort((a, b) => b.ms - a.ms || a.t.code.localeCompare(b.t.code));
  const refusalFor = (t: Ticket, at: string, usedAt: string | null, tag: string, steward?: Staff) => {
    const o = ctx.orderById.get(t.orderId);
    const counterId = o?.counterId ?? counters.find((c) => c.locationId === o?.locationId)?.id ?? null;
    const dev = counterId ? deviceForCounter(devices, counterId) : undefined;
    push(raw(`s:refuse:${tag}`, at, "ticket.refused", {
      actor: who(steward), locationId: o?.locationId ?? null, counterId, deviceId: dev?.id ?? null,
      subject: ticketSubject(t), data: { reason: "already_redeemed", usedAt },
    }));
  };
  /* Today, by hand: a second scan at each venue, so the card has something to
     say whichever venue is in the bar. */
  [["loc_fort", 11 * 60 + 42], ["loc_museum", 11 * 60 + 5]].forEach(([loc, m]) => {
    const hit = redeemed.find((x) => ctx.orderById.get(x.t.orderId)?.locationId === loc);
    if (hit) refusalFor(hit.t, atMin(0, m as number), hit.t.redeemedAt, `today:${loc}`, loc === "loc_fort" ? nadia : undefined);
  });
  redeemed
    .filter((x) => x.ms >= NOW - 14 * DAY)
    .filter((_, i) => i % 3 === 1)
    .slice(0, 8)
    .forEach(({ t, ms }) => {
      const at = new Date(ms + (7 + (hash(t.id) % 38)) * MIN).toISOString();
      refusalFor(t, at, t.redeemedAt, t.id);
    });
  [[3, 16 * 60 + 8, "CF-2026-9X4417"], [7, 12 * 60 + 33, "CF-2026-881020"], [12, 14 * 60 + 51, "CF-2025-004471"]].forEach(([d, m, code], i) => {
    const c = counters[i % Math.max(1, counters.length)];
    if (!c) return;
    const dev = deviceForCounter(devices, c.id);
    push(raw(`s:unknown:${i}`, atMin(d as number, m as number), "ticket.refused", {
      locationId: c.locationId, counterId: c.id, deviceId: dev?.id ?? null, data: { reason: "unknown", code: code as string },
    }));
  });

  /* Orders that were discounted past the counter's limit (a few of them). */
  ctx.orders
    .filter((o) => o.staffId && hash(o.id) % 19 === 0)
    .forEach((o) => {
      const at = Date.parse(o.createdAt);
      if (!(at <= NOW && at >= NOW - SEEDED_DAYS * DAY)) return;
      push(raw(`s:disc:${o.id}`, o.createdAt, "order.discount_over_limit", {
        actor: actorById(ctx, o.staffId), locationId: o.locationId, counterId: o.counterId, subject: orderSubject(o),
        data: { percent: [20, 25, 30][hash(o.id) % 3], limit: 10 },
      }));
    });

  /* Refund requests the mock has no record of: asked, then decided. */
  const reasons = ["customer_cancelled", "weather", "venue_problem", "double_booked"];
  ctx.orders
    .filter((o) => (o.status === "paid" || o.status === "partial") && o.staffId && hash(o.id) % 23 === 1)
    .filter((o) => {
      const asked = Date.parse(o.createdAt) + 26 * 60 * MIN;
      return asked <= NOW && asked >= NOW - SEEDED_DAYS * DAY;
    })
    .forEach((o, i) => {
      const asked = Date.parse(o.createdAt) + 26 * 60 * MIN;
      const base = { locationId: o.locationId, counterId: o.counterId, subject: orderSubject(o) };
      push(raw(`s:rr:${o.id}`, new Date(asked).toISOString(), "refund.requested", {
        ...base, actor: actorById(ctx, o.staffId), data: { amount: o.total, reason: reasons[hash(o.id) % reasons.length], note: null },
      }));
      /* Approved, declined or still waiting - in turn, so every state shows. */
      if (i % 3 === 0) push(raw(`s:ra:${o.id}`, new Date(asked + 45 * MIN).toISOString(), "refund.approved", { ...base, actor: who(manager), data: { amount: o.total, note: null } }));
      if (i % 3 === 1) push(raw(`s:rx:${o.id}`, new Date(asked + 30 * MIN).toISOString(), "refund.declined", { ...base, actor: who(manager), data: { amount: o.total, note: "Outside the cancellation window" } }));
    });

  /* A few bookings moved to another time. */
  let moved = 0;
  for (const b of peekBookings()) {
    if (moved >= 6) break;
    if (b.status !== "confirmed" || hash(b.id) % 11 !== 2) continue;
    const slot = Date.parse(b.slotStart);
    const at = slot - (1 + (hash(b.id) % 5)) * DAY + 30 * MIN;
    if (!(at <= NOW && at >= NOW - SEEDED_DAYS * DAY)) continue;
    const o = ctx.orderById.get(b.orderId);
    if (!o) continue;
    moved++;
    const from = hhmm(b.slotStart);
    const [fh, fm] = from.split(":").map(Number);
    const to = `${pad((fh + 1) % 24)}:${pad(fm)}`;
    push(raw(`s:move:${b.id}`, new Date(at).toISOString(), "booking.moved", {
      actor: who(manager), locationId: b.locationId, subject: { type: "booking", id: b.id, label: o.reference, href: `/orders/${o.id}` },
      data: { from, to, date: localDay(b.slotStart) },
    }));
  }

  /* A reissued code and a terminated ticket. */
  const issued = ctx.tickets.filter((t) => t.status === "issued" && !/-R\d+$/.test(t.code)).sort((a, b) => a.code.localeCompare(b.code));
  [[3, 3, 13 * 60 + 20, "Guest lost the printout"], [11, 8, 10 * 60 + 40, "Phone broke before the visit"]].forEach(([idx, d, m, note]) => {
    const t = issued[idx as number];
    if (!t) return;
    const o = ctx.orderById.get(t.orderId);
    push(raw(`s:reissue:${t.id}`, atMin(d as number, m as number), "ticket.reissued", {
      actor: who(idx === 3 ? manager : nadia), locationId: o?.locationId ?? null, subject: ticketSubject(t), data: { note: note as string, code: t.code },
    }));
  });
  const doomed = issued[20];
  if (doomed) {
    const o = ctx.orderById.get(doomed.orderId);
    push(raw(`s:term:${doomed.id}`, atMin(6, 15 * 60 + 5), "ticket.terminated", {
      actor: who(manager), locationId: o?.locationId ?? null, subject: ticketSubject(doomed), data: { reason: "Duplicate sale, refunded in cash" },
    }));
  }

  /* Settings changed, team invited, a device turned off. */
  const setting = (id: string, d: number, m: number, key: string, href: string, before: string, after: string, locationId: string | null = null) =>
    push(raw(`s:set:${id}`, atMin(d, m), "settings.changed", {
      actor: who(nadia), locationId, subject: { type: "setting", id: key, label: key, href }, data: { setting: key, before, after },
    }));
  setting("tax", 2, 11 * 60 + 5, "tax", "/settings/tax", "5%", "7.5%");
  setting("pay", 6, 9 * 60 + 40, "payment_methods", "/settings/payments", "Cash, Card", "Cash, Card, bKash");
  setting("pin", 13, 16 * 60 + 12, "pin_attempts", "/settings/sign-in", "5", "3");
  setting("hours", 17, 10 * 60 + 20, "opening_hours", "/settings/locations", "9:00 AM – 5:00 PM", "9:00 AM – 6:00 PM", "loc_fort");
  ctx.staff.filter((s) => s.status === "invited").forEach((s, i) => {
    push(raw(`s:invite:${s.id}`, atMin(5 + i * 4, 11 * 60 + 10), "team.invited", {
      actor: who(nadia), subject: { type: "staff", id: s.id, label: s.name, href: `/settings/team/${s.id}` },
    }));
  });
  devices.filter((d) => d.status === "inactive").forEach((d, i) => {
    const c = d.counterId ? counters.find((x) => x.id === d.counterId) : undefined;
    push(raw(`s:off:${d.id}`, atMin(6 + i * 3, 17 * 60 + 40), "device.off", {
      actor: who(nadia), locationId: c?.locationId ?? null, counterId: d.counterId, deviceId: d.id,
      subject: { type: "device", id: d.id, label: d.name, href: `/settings/devices/${d.id}` },
    }));
  });

  return out;
}

/* -- reading ---------------------------------------------------------------- */

export interface ActivityQuery {
  groups?: ActivityGroup[];
  kinds?: ActivityKind[];
  /** A staff id. */
  actorId?: ID;
  /** Events at this venue, plus the ones that belong to the whole business. */
  locationId?: ID;
  severities?: ActivitySeverity[];
  /** yyyy-mm-dd, inclusive, in the reader's zone. */
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Everything the log knows, newest first, with places and names resolved. */
export function allActivity(): ActivityEvent[] {
  const ctx = makeCtx();
  const recorded = peekRecordedActivity();
  const replaced = new Set(recorded.map((e) => e.replaces).filter(Boolean) as string[]);
  const merged = [
    ...seeded(ctx),
    ...derived(ctx).filter((e) => !replaced.has(e.id)).map((e) => ({ ...e, at: onDemoClock(e.at) })),
    ...recorded,
  ];

  const locations = new Map(peekLocations().map((l) => [l.id, l.name]));
  const counters = new Map(peekCounters().map((c) => [c.id, c]));
  const devices = new Map(peekDevices().map((d) => [d.id, d.name]));

  return merged
    .map<ActivityEvent>((e) => {
      const counter = e.counterId ? counters.get(e.counterId) : undefined;
      /* Where the counter is wins over where the sale was made: a ticket sold
         at one venue can be scanned at another's gate. */
      const locationId = counter?.locationId ?? e.locationId ?? null;
      return {
        id: e.id,
        at: e.at,
        kind: e.kind,
        group: GROUP_OF[e.kind],
        severity: e.severity,
        actor: e.actor,
        locationId,
        venue: locationId ? locations.get(locationId) ?? null : null,
        counter: counter?.name ?? null,
        device: e.deviceId ? devices.get(e.deviceId) ?? null : null,
        subject: e.subject,
        data: e.data,
      };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
}

function matches(e: ActivityEvent, q: ActivityQuery): boolean {
  if (q.groups?.length && !q.groups.includes(e.group)) return false;
  if (q.kinds?.length && !q.kinds.includes(e.kind)) return false;
  if (q.actorId && e.actor?.staffId !== q.actorId) return false;
  if (q.locationId && e.locationId !== null && e.locationId !== q.locationId) return false;
  if (q.severities?.length && !q.severities.includes(e.severity)) return false;
  if (q.from || q.to) {
    const day = localDay(e.at);
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
  }
  const s = q.search?.trim().toLowerCase();
  if (s) {
    /* The kind in words ("staff wrong pin"), so what is typed matches what is read. */
    const hay = [e.actor?.name, e.subject?.label, e.venue, e.counter, e.device, e.kind.replace(/[._]/g, " "), e.group, ...Object.values(e.data)]
      .filter((v) => v !== null && v !== undefined)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
}

/** The matching events without paging - for an export. */
export const filterActivity = (q: ActivityQuery = {}): ActivityEvent[] => allActivity().filter((e) => matches(e, q));

export async function listActivity(q: ActivityQuery = {}): Promise<ApiResult<ListResponse<ActivityEvent>>> {
  await delay();
  const all = filterActivity(q);
  const pageSize = q.pageSize ?? 50;
  const page = Math.max(1, q.page ?? 1);
  const total = all.length;
  return ok<ListResponse<ActivityEvent>>({
    data: all.slice((page - 1) * pageSize, page * pageSize),
    page: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

/** The few most recent events, synchronously (the dashboard card). */
export const latestActivity = (q: ActivityQuery = {}, count = 6): ActivityEvent[] => filterActivity(q).slice(0, count);

/** A staff member who has something in the log, for the Person filter. */
export function activityPeople(): ActivityActor[] {
  const seen = new Map<string, ActivityActor>();
  for (const e of allActivity()) if (e.actor?.staffId && !seen.has(e.actor.staffId)) seen.set(e.actor.staffId, e.actor);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The same, as the promise a screen's query hook wants. */
export async function listActivityPeople(): Promise<ApiResult<ActivityActor[]>> {
  await delay();
  return ok(activityPeople());
}

/* -- live helpers ----------------------------------------------------------- */

/**
 * File one scan the gate has just recorded. The richer live event takes the
 * scan's place in the log, so it is listed once - and it knows the counter and
 * the code that was shown, which the stored scan does not.
 */
export function recordScanActivity(scan: TicketScan, extra: { counterId?: ID | null; deviceId?: ID | null } = {}): void {
  const t = peekTickets().find((x) => x.id === scan.ticketId);
  const o = t ? peekOrders().find((x) => x.id === t.orderId) : undefined;
  const staff = peekStaff().find((s) => s.name === scan.by);
  recordActivity({
    kind: scan.outcome === "admitted" ? "ticket.admitted" : "ticket.refused",
    actor: scan.by ? { staffId: staff?.id ?? null, name: scan.by } : null,
    locationId: o?.locationId ?? null,
    counterId: extra.counterId ?? o?.counterId ?? null,
    deviceId: extra.deviceId ?? null,
    subject: t ? { type: "ticket", id: t.id, label: t.code, href: `/tickets/${t.id}` } : null,
    data:
      scan.outcome === "admitted"
        ? { admitted: scan.admitted ?? 1 }
        : { reason: scan.refusal ?? "unknown", usedAt: scan.refusal === "already_redeemed" ? t?.redeemedAt ?? null : null },
    replaces: `scan:${scan.id}`,
  });
}

/* -- export ----------------------------------------------------------------- */

const cell = (v: string | number | null | undefined): string => {
  let s = v === null || v === undefined ? "" : String(v);
  /* A spreadsheet runs anything that starts like a formula. */
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface ActivityCsvLabels {
  headers: [string, string, string, string, string, string, string, string];
  kind: (e: ActivityEvent) => string;
  text: (e: ActivityEvent) => string;
  severity: (e: ActivityEvent) => string;
}

/** When, type, person, what happened, venue, counter, device, severity. */
export function activityCsv(events: ActivityEvent[], labels: ActivityCsvLabels): string {
  const head = labels.headers.map(cell).join(",");
  const body = events.map((e) =>
    [
      `${localDay(e.at)} ${formatClockOf(e.at)}`,
      labels.kind(e),
      e.actor?.name ?? "",
      labels.text(e),
      e.venue ?? "",
      e.counter ?? "",
      e.device ?? "",
      labels.severity(e),
    ]
      .map(cell)
      .join(","),
  );
  return [head, ...body].join("\r\n");
}
