/* Deterministic generator for transactional seed data (orders, tickets,
   bookings). Uses a seeded PRNG so every run produces identical data — no
   hydration mismatches, stable references. Pure function: callers pass the
   config entities in to avoid a circular import with data.ts. */
import type {
  Booking,
  Counter,
  Location,
  Order,
  OrderLine,
  OrderStatus,
  Payment,
  PaymentMethod,
  Product,
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

// 2026-07-29 12:00 +06:00 as the "now" anchor; orders spread over prior 30 days.
const NOW = Date.parse("2026-07-29T12:00:00+06:00");
const DAY = 86400000;

const STATUS_WEIGHTS: [OrderStatus, number][] = [
  ["paid", 68],
  ["pending", 8],
  ["partial", 7],
  ["refunded", 9],
  ["cancelled", 8],
];

const TICKET_STATUSES = ["issued", "redeemed", "void"] as const;

export function generateSales({
  products,
  locations,
  counters,
  staff,
  taxRatePct,
  count = 160,
}: {
  products: Product[];
  locations: Location[];
  counters: Counter[];
  staff: Staff[];
  taxRatePct: number;
  count?: number;
}): { orders: Order[]; tickets: Ticket[]; bookings: Booking[] } {
  const rand = mulberry32(0x0c0ffee5);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  const sellable = products.filter((p) => p.status === "active" && p.tiers.length > 0);
  const activeLocations = locations.filter((l) => l.status !== "archived");
  const activeStaff = staff.filter((s) => s.status === "active");

  const weightedStatus = (): OrderStatus => {
    const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [status, w] of STATUS_WEIGHTS) {
      if ((r -= w) <= 0) return status;
    }
    return "paid";
  };

  const orders: Order[] = [];
  const tickets: Ticket[] = [];
  const bookings: Booking[] = [];

  for (let i = 0; i < count; i++) {
    const seq = String(1000 + i).padStart(6, "0");
    const reference = `CF-2026-${seq}`;
    const createdAt = new Date(NOW - int(0, 29) * DAY - int(0, 46800000)).toISOString();
    const location = pick(activeLocations);
    const channel = rand() < 0.55 ? "counter" : "online";
    const locCounters = counters.filter((c) => c.locationId === location.id);
    const counter = channel === "counter" && locCounters.length ? pick(locCounters) : null;
    const seller = channel === "counter" && activeStaff.length ? pick(activeStaff) : null;
    const status = weightedStatus();

    const lineCount = int(1, 3);
    const lines: OrderLine[] = [];
    for (let j = 0; j < lineCount; j++) {
      const product = pick(sellable);
      const tier = pick(product.tiers);
      const quantity = int(1, 4);
      lines.push({
        id: `${reference}-L${j}`,
        productId: product.id,
        productName: product.name,
        tierName: tier.name,
        quantity,
        unitPrice: tier.price,
      });
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const tax = Math.round((subtotal * taxRatePct) / 100);
    const total = subtotal + tax;

    const methods: PaymentMethod[] =
      channel === "online" ? ["card_terminal", "bkash", "bangla_qr"] : ["cash", "bkash", "bangla_qr", "card_terminal"];
    const payments: Payment[] = [];
    if (status === "paid" || status === "refunded") {
      payments.push({ id: `${reference}-P0`, method: pick(methods), amount: total, at: createdAt });
    } else if (status === "partial") {
      payments.push({ id: `${reference}-P0`, method: pick(methods), amount: Math.round(total / 2), at: createdAt });
    }

    orders.push({
      id: `ord_${seq}`,
      reference,
      status,
      channel,
      locationId: location.id,
      counterId: counter?.id ?? null,
      staffId: seller?.id ?? null,
      customerName: channel === "online" ? `Guest ${seq}` : null,
      lines,
      payments,
      subtotal,
      tax,
      total,
      createdAt,
      updatedAt: createdAt,
    });

    // Tickets for fulfilled orders (cap to keep totals sane).
    if (status === "paid" || status === "partial" || status === "refunded") {
      let t = 0;
      for (const line of lines) {
        for (let q = 0; q < line.quantity && t < 8; q++, t++) {
          const tstatus =
            status === "refunded"
              ? "void"
              : TICKET_STATUSES[Math.min(2, Math.floor(rand() * 2.4))];
          tickets.push({
            id: `tkt_${seq}_${t}`,
            code: `${reference}-${String(t + 1).padStart(2, "0")}`,
            orderId: `ord_${seq}`,
            productId: line.productId,
            tierName: line.tierName,
            status: tstatus,
            validFor: createdAt.slice(0, 10),
            redeemedAt: tstatus === "redeemed" ? createdAt : null,
          });
        }
      }

      // Bookings for timed/tour products.
      for (const line of lines) {
        const product = products.find((p) => p.id === line.productId);
        if (product && (product.bookingType === "BT-02" || product.bookingType === "BT-03")) {
          bookings.push({
            id: `bkg_${seq}_${line.id}`,
            orderId: `ord_${seq}`,
            productId: line.productId,
            locationId: location.id,
            slotStart: new Date(Date.parse(createdAt) + int(1, 5) * DAY).toISOString(),
            partySize: line.quantity,
            status: status === "refunded" ? "cancelled" : "confirmed",
          });
        }
      }
    }
  }

  return { orders, tickets, bookings };
}
