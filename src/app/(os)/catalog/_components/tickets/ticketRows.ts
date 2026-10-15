import type { PriceTier, PriceTierInput } from "@/lib/api/types";

/**
 * A ticket type as the ticket editor holds it — one shape for every booking
 * (docs/catalog.md §10.3). A booking sold by the person and an event sold by the
 * seat used to have two row shapes, two editors and two ideas of what a price
 * is; this is the superset of both.
 *
 * Numbers and dates are held as typed, so a half-entered "12" is not read as
 * ৳0.12 and a blank "How many" stays blank (blank means no limit).
 */
export interface TicketRow {
  id: string;
  name: string;
  /** Major units as typed. */
  price: string;
  /** "How many" exist. Blank means no limit. */
  quantity: string;
  /** What it includes, one line each. */
  perks: string;
  /** A short note about the ticket. */
  description: string;
  /** People one ticket lets in (default 1). */
  admits: string;
  ageNote: string;
  /** yyyy-mm-dd the ticket stops selling on. */
  salesEnd: string;
  /** Which days it is good for. Empty means every day. */
  dayIds: string[];
  maxPerOrder: string;
  donation: boolean;
  active: boolean;
}

export const newTicketId = () => `t_${Math.random().toString(36).slice(2, 9)}`;

export const emptyTicket = (name = ""): TicketRow => ({
  id: newTicketId(),
  name,
  price: "",
  quantity: "",
  perks: "",
  description: "",
  admits: "1",
  ageNote: "",
  salesEnd: "",
  dayIds: [],
  maxPerOrder: "",
  donation: false,
  active: true,
});

const toMinor = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** The rows as the catalogue stores them. A blank "How many" is no `capacity`
 *  at all — a capacity of 0 would read as sold out. */
export function ticketsToInputs(rows: TicketRow[]): PriceTierInput[] {
  return rows.map((r) => {
    const cap = parseInt(r.quantity, 10);
    const perks = r.perks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return {
      id: r.id,
      name: r.name.trim(),
      price: toMinor(r.price),
      maxPerOrder: r.maxPerOrder ? parseInt(r.maxPerOrder, 10) || undefined : undefined,
      admits: parseInt(r.admits, 10) || 1,
      ageNote: r.ageNote.trim() || undefined,
      note: r.description.trim() || undefined,
      donation: r.donation || undefined,
      active: r.active,
      capacity: Number.isFinite(cap) && cap > 0 ? cap : undefined,
      salesEndsAt: r.salesEnd ? `${r.salesEnd}T23:59:00+06:00` : undefined,
      perks: perks.length ? perks : undefined,
      dayIds: r.dayIds.length ? r.dayIds : undefined,
    };
  });
}

/** Saved tickets back into rows. */
export function ticketsFromTiers(tiers: PriceTier[]): TicketRow[] {
  return tiers.map((x) => ({
    id: x.id,
    name: x.name,
    price: String(x.price / 100),
    quantity: x.capacity ? String(x.capacity) : "",
    perks: (x.perks ?? []).join("\n"),
    description: x.note ?? "",
    admits: String(x.admits ?? 1),
    ageNote: x.ageNote ?? "",
    salesEnd: x.salesEndsAt ? x.salesEndsAt.slice(0, 10) : "",
    dayIds: x.dayIds ?? [],
    maxPerOrder: x.maxPerOrder ? String(x.maxPerOrder) : "",
    donation: !!x.donation,
    active: x.active,
  }));
}
