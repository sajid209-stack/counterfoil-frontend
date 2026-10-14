import { DEMO_TODAY, demoDay } from "@/lib/schedule";
import type { Minor, Order, PaymentMethod } from "@/lib/api";

/** The till methods a summary breaks the day down by, in till order. */
export const SUMMARY_METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The calendar day an order was made, in this browser's zone. */
export const orderDay = (o: Order): string => ymd(new Date(o.createdAt));

/** "Today" is the demo's today, plus the real present: the seeded week sits
 *  around the demo date, but a sale made in this session is stamped with the
 *  wall clock, and a cashier who has just sold something must see it. */
export const todayDays = (): string[] => [DEMO_TODAY, ymd(new Date())];
export const yesterdayDays = (): string[] => [demoDay(-1)];

/** Sales that count as this person's: the ones filed under them, and the
 *  counter-channel sales the till files with no name on them (it does not stamp
 *  a staff id yet). */
export const isMine = (o: Order, staffId: string): boolean => o.staffId === staffId || (o.staffId == null && o.channel === "counter");

const voided = (o: Order) => o.status === "cancelled" || o.status === "refunded";

export interface Summary {
  total: Minor;
  orders: number;
  items: number;
  cashTaken: Minor;
  cashRefunds: Minor;
  byMethod: { method: PaymentMethod; amount: Minor; count: number }[];
  best: { name: string; qty: number; amount: Minor }[];
  recent: Order[];
}

export function summarise(all: Order[], staffId: string, days: string[]): Summary {
  const mine = all.filter((o) => isMine(o, staffId) && days.includes(orderDay(o)));
  const live = mine.filter((o) => !voided(o));
  const methods = new Map<PaymentMethod, { amount: Minor; count: number }>();
  let cashTaken = 0;
  let cashRefunds = 0;
  for (const o of mine) {
    const seen = new Set<PaymentMethod>();
    for (const p of o.payments) {
      if (p.status !== "confirmed") continue;
      if (p.method === "cash") {
        if (p.amount >= 0) cashTaken += p.amount;
        else cashRefunds += -p.amount;
      }
      if (voided(o)) continue;
      const m = methods.get(p.method) ?? { amount: 0, count: 0 };
      m.amount += p.amount;
      if (!seen.has(p.method)) m.count += 1;
      seen.add(p.method);
      methods.set(p.method, m);
    }
  }
  const items = new Map<string, { qty: number; amount: Minor }>();
  let itemCount = 0;
  for (const o of live) {
    for (const l of o.lines) {
      const qty = l.quantity - (l.refundedQuantity ?? 0);
      if (qty <= 0) continue;
      itemCount += qty;
      const cur = items.get(l.productName) ?? { qty: 0, amount: 0 };
      cur.qty += qty;
      cur.amount += l.total;
      items.set(l.productName, cur);
    }
  }
  return {
    total: live.reduce((s, o) => s + o.total, 0),
    orders: live.length,
    items: itemCount,
    cashTaken,
    cashRefunds,
    byMethod: SUMMARY_METHODS.map((method) => ({ method, ...(methods.get(method) ?? { amount: 0, count: 0 }) })),
    best: [...items.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    recent: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
