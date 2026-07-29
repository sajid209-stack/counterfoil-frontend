/* Deterministic generator for transactional seed data (orders, tickets,
   bookings). Seeded PRNG → identical every run. Bookings for scheduled products
   land on REAL slot times and respect capacity, so POS shows honest remaining
   counts; some slots today/tomorrow are pre-sold. Imports types only (leaf) to
   avoid an import cycle through the api barrel. */
import type {
  Booking,
  Location,
  Order,
  OrderLine,
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
  products, locations, staff, taxRatePct, count = 150,
}: {
  products: Product[];
  locations: Location[];
  staff: Staff[];
  taxRatePct: number;
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
  const pickProduct = (): Product => {
    const total = sellable.reduce((s, p) => s + weightOf(p), 0);
    let r = rand() * total;
    for (const p of sellable) { if ((r -= weightOf(p)) <= 0) return p; }
    return sellable[0];
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
    // Try a handful of candidate dates; near-today biased when preferNear.
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

    const product = pickProduct();
    const activeTiers = product.tiers.filter((t) => t.active);
    const lines: OrderLine[] = [];
    const lineCount = product.bookingType === "BT-01" ? int(1, Math.min(2, activeTiers.length)) : 1;
    for (let j = 0; j < lineCount; j++) {
      const tier = activeTiers[j % activeTiers.length];
      const quantity = int(1, product.bookingType === "BT-09" ? 4 : 3);
      lines.push({ id: `${reference}-L${j}`, productId: product.id, productName: product.name, tierName: tier.name, quantity, unitPrice: tier.price });
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const tax = Math.round((subtotal * taxRatePct) / 100);
    const total = subtotal + tax;
    const methods: PaymentMethod[] = channel === "online" ? ["card_terminal", "bkash", "bangla_qr"] : ["cash", "bkash", "bangla_qr", "card_terminal"];
    const payments: Payment[] = [];
    if (status === "paid" || status === "refunded") payments.push({ id: `${reference}-P0`, method: pick(methods), amount: total, at: createdAt });
    else if (status === "partial") payments.push({ id: `${reference}-P0`, method: pick(methods), amount: Math.round(total / 2), at: createdAt });

    orders.push({
      id: `ord_${seq}`, reference, status, channel,
      locationId: location.id, counterId: null, staffId: seller?.id ?? null,
      customerName: channel === "online" ? `Guest ${seq}` : null,
      lines, payments, subtotal, tax, total, createdAt, updatedAt: createdAt,
    });

    const fulfilled = status === "paid" || status === "partial" || status === "refunded";
    if (!fulfilled) continue;

    // Tickets
    let t = 0;
    for (const line of lines) {
      for (let q = 0; q < line.quantity && t < 12; q++, t++) {
        const tstatus = status === "refunded" ? "void" : rand() < 0.4 ? "redeemed" : "issued";
        tickets.push({ id: `tkt_${seq}_${t}`, code: `${reference}-${pad(t + 1)}`, orderId: `ord_${seq}`, productId: line.productId, tierName: line.tierName, status: tstatus, validFor: createdAt.slice(0, 10), redeemedAt: tstatus === "redeemed" ? createdAt : null });
      }
    }

    // Booking on a real slot for scheduled products (respecting capacity).
    const sch = product.schedule;
    if (sch && status !== "refunded") {
      const party = lines.reduce((s, l) => s + l.quantity, 0);
      const date = nextOpenSlotDate(product, rand() < 0.45);
      if (date) {
        const times = slotTimes(sch);
        const cap = sch.capacityPerSession > 0 ? sch.capacityPerSession : (sch.dailyCapacity ?? 9999);
        const time = sch.capacityPerSession > 0 ? (times.length ? pick(times) : "10:00") : "10:00";
        const key = `${product.id}|${date}|${sch.capacityPerSession > 0 ? time : "*"}`;
        const taken = sold.get(key) ?? 0;
        if (taken + party <= cap) {
          sold.set(key, taken + party);
          bookings.push({ id: `bkg_${seq}`, orderId: `ord_${seq}`, productId: product.id, locationId: location.id, slotStart: slotISO(date, time), partySize: party, status: "confirmed" });
        }
      }
    }
  }

  return { orders, tickets, bookings };
}
