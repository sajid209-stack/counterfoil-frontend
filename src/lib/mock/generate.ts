/* Deterministic generator for transactional seed data (orders, tickets,
   bookings). Seeded PRNG → identical every run. F11: orders are MULTI-LINE and
   built by the same order engine as the POS (lib/orderMath) — mixed carts,
   add-ons as child lines, line + order discounts, split tender. Bookings for
   scheduled products land on REAL slot times and respect capacity. Imports
   types + orderMath only (leaves) to avoid an import cycle through the api
   barrel. */
import { buildOrderLines, taxRateOf, type LineInput } from "@/lib/orderMath";
import type {
  Booking,
  Location,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
  ProductSchedule,
  Staff,
  Ticket,
} from "@/lib/api/types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = Date.parse("2026-07-29T12:00:00+06:00");
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const localDate = (ms: number) => new Date(ms + 6 * 3600000).toISOString().slice(0, 10);
const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const slotISO = (date: string, time: string) => `${date}T${time}:00+06:00`;

function slotTimes(s: ProductSchedule): string[] {
  const start = toMin(s.startTime), end = toMin(s.endTime), step = s.slotMinutes || 30;
  if (end < start || step <= 0) return [];
  const out: string[] = [];
  for (let m = start; m <= end; m += step) out.push(toTime(m));
  return out;
}

const STATUS_WEIGHTS: [OrderStatus, number][] = [
  ["paid", 70], ["pending", 6], ["partial", 6], ["refunded", 10], ["cancelled", 8],
];

export function generateSales({
  products, locations, staff, taxRatePct, reducedRatePct = 7.5, count = 150,
}: {
  products: Product[];
  locations: Location[];
  staff: Staff[];
  taxRatePct: number;
  reducedRatePct?: number;
  count?: number;
}): { orders: Order[]; tickets: Ticket[]; bookings: Booking[] } {
  const rand = mulberry32(0x0c0ffee7);
  const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const sellable = products.filter((p) => p.status === "active" && p.tiers.some((t) => t.active));
  const activeLocations = locations.filter((l) => l.status !== "archived");
  const activeStaff = staff.filter((s) => s.status === "active");

  // Weight: admission most common, tour least (but its 2 small slots fill fast).
  const weightOf = (p: Product) => (p.bookingType === "BT-01" ? 5 : p.bookingType === "BT-09" ? 2 : 3);
  const pickProduct = (not?: Product): Product => {
    const pool = sellable.filter((p) => p.id !== not?.id);
    const total = pool.reduce((s, p) => s + weightOf(p), 0);
    let r = rand() * total;
    for (const p of pool) { if ((r -= weightOf(p)) <= 0) return p; }
    return pool[0] ?? sellable[0];
  };

  const weightedStatus = (): OrderStatus => {
    const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [st, w] of STATUS_WEIGHTS) { if ((r -= w) <= 0) return st; }
    return "paid";
  };

  const orders: Order[] = [];
  const tickets: Ticket[] = [];
  const bookings: Booking[] = [];
  const sold = new Map<string, number>(); // productId|date|time -> seats taken

  const nextOpenSlotDate = (p: Product, preferNear: boolean): string | null => {
    const sch = p.schedule;
    if (!sch) return null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const offset = preferNear ? int(0, 2) : int(-25, 1);
      const date = localDate(NOW + offset * DAY);
      if (sch.openDays.includes(dowOf(date)) && !sch.exceptions.some((e) => e.date === date && e.kind === "closed")) {
        return date;
      }
    }
    return null;
  };

  for (let i = 0; i < count; i++) {
    const seq = String(1000 + i).padStart(6, "0");
    const reference = `CF-2026-${seq}`;
    let dayOffset = int(0, 29);
    if (![5, 6].includes(dowOf(localDate(NOW - dayOffset * DAY))) && rand() < 0.4) dayOffset = int(0, 29);
    const createdAt = new Date(NOW - dayOffset * DAY - int(0, 46800000)).toISOString();
    const location = pick(activeLocations);
    const channel = rand() < 0.55 ? "counter" : "online";
    const seller = channel === "counter" && activeStaff.length ? pick(activeStaff) : null;
    const status = weightedStatus();

    // ── Mixed carts: 1–2 products, tier lines w/ admits, add-ons as children.
    const chosen = [pickProduct()];
    if (rand() < 0.35) chosen.push(pickProduct(chosen[0]));

    const inputs: LineInput[] = [];
    for (const product of chosen) {
      const rate = taxRateOf(product.taxClass, taxRatePct, reducedRatePct);
      const activeTiers = product.tiers.filter((t) => t.active);
      const parentIndex = inputs.length;
      const tierCount = product.bookingType === "BT-01" ? int(1, Math.min(2, activeTiers.length)) : 1;
      for (let j = 0; j < tierCount; j++) {
        const tier = activeTiers[j % activeTiers.length];
        const quantity = int(1, product.bookingType === "BT-09" ? 4 : 3);
        inputs.push({
          productId: product.id, productName: product.name,
          tierId: tier.id, tierName: tier.name, admits: tier.admits ?? 1,
          quantity, unitPrice: tier.price,
          taxClass: product.taxClass ?? "standard", taxRate: rate,
          // 15% of tier lines carry a line-level discount (5 or 10%).
          lineDiscount: rand() < 0.15 ? Math.round((tier.price * quantity * (rand() < 0.5 ? 5 : 10)) / 100) : 0,
        });
      }
      // Add-ons attach to the product's first line via parentIndex — their own
      // product identity so reports attribute them separately (bib hire ≠ turf).
      if (product.addOns?.length && rand() < 0.3) {
        const a = pick(product.addOns);
        inputs.push({
          productId: `addon_${a.id}`, productName: a.name,
          tierName: a.perPerson ? "Per person" : "Each", admits: 0,
          quantity: int(1, 4), unitPrice: a.price,
          taxClass: "standard", taxRate: taxRatePct / 100,
          parentIndex,
        });
      }
    }

    // 20% of orders carry a cart-level discount (allocated pro rata by the engine).
    const preBase = inputs.reduce((s, l) => s + l.unitPrice * l.quantity - (l.lineDiscount ?? 0), 0);
    const orderDiscount = rand() < 0.2 ? Math.round((preBase * (rand() < 0.6 ? 5 : 10)) / 100) : 0;

    const { lines, totals } = buildOrderLines(inputs, orderDiscount, reference);
    const total = totals.total;

    const methods: PaymentMethod[] = channel === "online" ? ["card_terminal", "bkash", "bangla_qr"] : ["cash", "bkash", "bangla_qr", "card_terminal"];
    const payments: Payment[] = [];
    const pay = (method: PaymentMethod, amount: number) =>
      payments.push({
        id: `${reference}-P${payments.length}`, method, amount, status: "confirmed", createdAt,
        ...(method === "cash" ? { tendered: Math.ceil(amount / 50000) * 50000, change: Math.ceil(amount / 50000) * 50000 - amount } : {}),
        ...(method === "bkash" ? { reference: `TX${seq}${payments.length}` } : {}),
      });
    if (status === "paid" || status === "refunded") {
      // 15% split tender → the "Mixed" bucket in payment cross-tabs has content.
      if (channel === "counter" && rand() < 0.15 && total > 100000) {
        const first = Math.round(total * 0.6);
        pay("cash", first);
        pay(pick(["bkash", "bangla_qr", "card_terminal"]), total - first);
      } else {
        pay(pick(methods), total);
      }
    } else if (status === "partial") {
      pay(pick(methods), Math.round(total / 2));
    }

    // Booking on a real slot for scheduled products (respecting capacity) —
    // snapshotted onto the product's first line.
    const product = chosen[0];
    const sch = product.schedule;
    let bookingMade: Booking | null = null;
    const fulfilled = status === "paid" || status === "partial" || status === "refunded";
    if (sch && fulfilled && status !== "refunded") {
      const party = lines.filter((l) => l.productId === product.id).reduce((s, l) => s + l.quantity * Math.max(1, l.admits), 0);
      const date = nextOpenSlotDate(product, rand() < 0.45);
      if (date) {
        const times = slotTimes(sch);
        const cap = sch.capacityPerSession > 0 ? sch.capacityPerSession : (sch.dailyCapacity ?? 9999);
        const time = sch.capacityPerSession > 0 ? (times.length ? pick(times) : "10:00") : "10:00";
        const key = `${product.id}|${date}|${sch.capacityPerSession > 0 ? time : "*"}`;
        const taken = sold.get(key) ?? 0;
        if (taken + party <= cap) {
          sold.set(key, taken + party);
          bookingMade = { id: `bkg_${seq}`, orderId: `ord_${seq}`, productId: product.id, locationId: location.id, slotStart: slotISO(date, time), partySize: party, status: "confirmed" };
          bookings.push(bookingMade);
          const first = lines.find((l) => l.productId === product.id);
          if (first) first.booking = { date, startTime: time, guests: party, durationMinutes: sch.sessionMinutes || sch.slotMinutes || undefined };
        }
      }
    }

    orders.push({
      id: `ord_${seq}`, reference, status, channel,
      locationId: location.id, counterId: null, staffId: seller?.id ?? null,
      customerName: channel === "online" ? `Guest ${seq}` : null,
      lines, payments, ...totals, createdAt, updatedAt: createdAt,
    });

    if (!fulfilled) continue;

    // Tickets per line: quantity × admits — child add-on lines mint nothing.
    let t = 0;
    for (const line of lines) {
      if (line.parentLineId || line.admits <= 0) continue;
      for (let q = 0; q < line.quantity && t < 12; q++, t++) {
        const tstatus = status === "refunded" ? "void" : rand() < 0.4 ? "redeemed" : "issued";
        tickets.push({ id: `tkt_${seq}_${t}`, code: `${reference}-${pad(t + 1)}`, orderId: `ord_${seq}`, lineId: line.id, productId: line.productId, tierName: line.tierName, admits: line.admits, status: tstatus, validFor: createdAt.slice(0, 10), redeemedAt: tstatus === "redeemed" ? createdAt : null });
      }
    }
  }

  return { orders, tickets, bookings };
}
