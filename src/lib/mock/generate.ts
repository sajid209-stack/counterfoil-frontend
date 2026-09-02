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
  Customer,
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

/* The customer roster. Two thirds of counter sales stay anonymous walk-ups —
   that is honest, and it keeps the "match a walk-up to an existing customer"
   flow meaningful. Deliberate duplicates are seeded so the merge tool has real
   work to do: Farhana Haque/Hoque share a phone (high confidence), and there
   are two unrelated Imran Hossains (name only — medium, must not auto-merge). */
const ROSTER: { name: string; phone: string | null; email: string | null }[] = [
  { name: "Ayesha Siddika", phone: "01711-204488", email: "ayesha.siddika@gmail.com" },
  { name: "Tanvir Ahmed", phone: "01812-556677", email: "tanvir.ahmed@outlook.com" },
  { name: "Nusrat Jahan", phone: "01913-889900", email: "nusrat.j@gmail.com" },
  { name: "Rafiqul Islam", phone: "01715-334455", email: null },
  { name: "Sadia Rahman", phone: "01677-112233", email: "sadia.rahman@yahoo.com" },
  { name: "Imran Hossain", phone: "01819-445566", email: "imran.hossain@gmail.com" },
  { name: "Farhana Haque", phone: "01711-000111", email: "farhana.haque@gmail.com" },
  { name: "Mahmudul Karim", phone: "01521-778899", email: null },
  { name: "Shirin Akter", phone: "01911-667788", email: "shirin.akter@gmail.com" },
  { name: "Zahid Chowdhury", phone: "01713-990011", email: "zahid.c@company.com.bd" },
  { name: "Rumana Begum", phone: null, email: "rumana.begum@gmail.com" },
  { name: "Sabbir Alam", phone: "01818-223344", email: "sabbir.alam@gmail.com" },
  { name: "Nabila Anjum", phone: "01670-556699", email: "nabila.anjum@gmail.com" },
  { name: "Kamrul Hasan", phone: "01712-445599", email: null },
  { name: "Tasnim Ferdous", phone: "01914-772211", email: "tasnim.f@gmail.com" },
  { name: "Arif Mahmud", phone: "01716-338822", email: "arif.mahmud@gmail.com" },
  { name: "Sumaiya Islam", phone: "01521-119933", email: "sumaiya.islam@gmail.com" },
  { name: "Habibur Rahman", phone: "01811-664422", email: null },
  // ── the duplicates ──────────────────────────────────────────────────────
  { name: "Farhana Hoque", phone: "+8801711000111", email: null },
  { name: "Imran Hossain", phone: "01977-221100", email: "i.hossain84@yahoo.com" },
];

const NO_SHOW_REASONS = [
  "Did not arrive",
  "Called to say they were stuck in traffic",
  "No contact",
  "Arrived after the session had started",
];

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
}): { orders: Order[]; tickets: Ticket[]; bookings: Booking[]; customers: Customer[] } {
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

  const digitsOf = (v: string | null) => {
    const d = v?.replace(/\D/g, "") ?? "";
    return d.length >= 6 ? d.slice(-10) : null;
  };
  // The roster is not all founding members. Seeding every customer at one
  // timestamp 200 days back is tidy and wrong in one visible way: a customer
  // record is created at a moment, and "customer added" is a live-activity
  // event. A roster with no recent additions can never produce one, so the
  // dashboard feed could only ever be sales. The newest four are therefore
  // minutes-to-days old — a counter sale that took a name, an online signup —
  // and the rest keep their long backdate, staggered a day apart so "newest
  // first" is a real ordering rather than a 21-way tie.
  //
  // These offsets are computed from idx, never from rand(): the seeded PRNG is
  // consumed in strict sequence by everything below, and drawing from it here
  // would shift every order, price and booking in the fixture.
  const RECENT_MIN = [12, 96, 380, 1810]; // newest-first, minutes before NOW
  const customerCreatedAt = (idx: number) => {
    const fromEnd = ROSTER.length - 1 - idx;
    return fromEnd < RECENT_MIN.length
      ? new Date(NOW - RECENT_MIN[fromEnd] * 60000).toISOString()
      : new Date(NOW - (200 - idx) * DAY).toISOString();
  };
  const customers: Customer[] = ROSTER.map((r, idx) => {
    const createdAt = customerCreatedAt(idx);
    return {
      id: `cus_${String(idx + 1).padStart(3, "0")}`,
      name: r.name,
      email: r.email,
      phone: r.phone,
      phoneKey: digitsOf(r.phone),
      emailKey: r.email ? r.email.toLowerCase() : null,
      consents: [],
      notes: [],
      flag: null,
      tags: [],
      mergedIntoId: null,
      erasedAt: null,
      status: "active" as const,
      createdAt,
      updatedAt: createdAt,
    };
  });

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
          // A booking in the past has already resolved: most parties turned
          // up (some only partly), a few did not. Without this every customer
          // reads zero visits and zero no-shows, which is not what a month of
          // trading looks like.
          const start = Date.parse(slotISO(date, time));
          const resolved: Partial<Booking> = {};
          if (start < NOW) {
            const roll = rand();
            if (roll < 0.08) {
              resolved.noShow = true;
              resolved.noShowReason = pick(NO_SHOW_REASONS);
            } else if (roll < 0.18 && party > 1) {
              resolved.checkedIn = int(1, party - 1); // part of the group came
            } else {
              resolved.checkedIn = party;
            }
          }
          bookingMade = { id: `bkg_${seq}`, orderId: `ord_${seq}`, productId: product.id, locationId: location.id, slotStart: slotISO(date, time), partySize: party, status: "confirmed", ...resolved };
          bookings.push(bookingMade);
          const first = lines.find((l) => l.productId === product.id);
          if (first) first.booking = { date, startTime: time, guests: party, durationMinutes: sch.sessionMinutes || sch.slotMinutes || undefined };
        }
      }
    }

    orders.push({
      id: `ord_${seq}`, reference, status, channel,
      locationId: location.id, counterId: null, staffId: seller?.id ?? null,
      // Online sales always identify the buyer; at the counter most people
      // stay anonymous unless staff attached them (the POS customer chip).
      ...(() => {
        const named = channel === "online" || rand() < 0.35;
        if (!named) return { customerId: null, customerName: null };
        // Only someone who already existed can be on the sale. Now that the
        // newest few records are hours old, an unfiltered pick would attach
        // them to orders that predate them by weeks. pick() draws exactly one
        // rand() whatever the array length, so narrowing it here changes WHICH
        // customer lands on an order and nothing else in the sequence.
        // Compared as instants, not as text: both sides are .toISOString() by
        // construction today, but the seed elsewhere spells timestamps with a
        // local offset, and a string compare across the two forms is nonsense.
        const bornBy = Date.parse(createdAt);
        const existing = customers.filter((x) => Date.parse(x.createdAt) <= bornBy);
        const c = pick(existing.length ? existing : customers);
        return { customerId: c.id, customerName: c.name };
      })(),
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

  return { orders, tickets, bookings, customers };
}
