/**
 * Issued orders — every ticket that has been issued, as a list you can read.
 *
 * One row per TICKET (not per order): the same thing the gate scans. Nothing
 * here is stored. A row is a ticket joined to the order and order line that
 * minted it, so the booking name, the variant, the start time and the moment it
 * was issued are all the sale's own snapshots, and renaming a product later
 * cannot rewrite this list.
 *
 * Contract for the backend lane: `GET /tickets/issued` taking `IssuedQuery`,
 * returning rows + page info + the counts for the whole filtered set.
 *
 *   - `state` is derived: `void` when the ticket was refunded or cancelled,
 *     `used` when every admission is spent, `part` when a group ticket has been
 *     used by some of its people, else `unused`.
 *   - "Issued" is the moment of the sale (`Order.createdAt`).
 *   - The date range is inclusive and counts the day the ticket was ISSUED.
 *   - Scoped to the venue the order was sold at.
 */
import { delay, ok } from "./client";
import { peekOrders } from "./orders";
import { peekProducts } from "./products";
import { peekTickets, ticketAdmits } from "./tickets";
import type { ApiResult, ID, ISODate, ISODateTime, Order, OrderLine, Ticket } from "./types";

export const ISSUED_STATES = ["unused", "part", "used", "void"] as const;
export type IssuedState = (typeof ISSUED_STATES)[number];

export type IssuedSortKey = "code" | "state" | "start" | "customer" | "booking" | "variant" | "issued" | "order";

/** One issued ticket with everything the list needs to draw it. */
export interface IssuedTicket {
  id: ID;
  code: string;
  state: IssuedState;
  /** People through the gate so far, and how many the ticket admits. */
  used: number;
  admits: number;
  orderId: ID;
  orderReference: string;
  locationId: ID;
  /** Who the sale was for; null for a walk-up. */
  customerName: string | null;
  productId: ID;
  /** What was booked, as sold. */
  bookingName: string;
  /** The ticket type / variant, as sold. */
  variantName: string;
  /** The day the guest turns up, and the time when the booking has one. */
  startDate: ISODate;
  startTime?: string;
  issuedAt: ISODateTime;
}

export interface IssuedQuery {
  /** The venue in the bar. Absent = every venue. */
  locationId?: ID;
  /** Inclusive days the ticket was issued on. */
  from?: ISODate;
  to?: ISODate;
  /** Empty or absent = every state / every booking. */
  states?: IssuedState[];
  productIds?: ID[];
  /** Code, order reference, customer, booking or variant. */
  search?: string;
  /** Default: newest issued first. */
  sort?: IssuedSortKey;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface IssuedSummary {
  /** Tickets matched, all pages. */
  issued: number;
  unused: number;
  part: number;
  used: number;
  void: number;
}

export interface IssuedPage {
  data: IssuedTicket[];
  page: { page: number; pageSize: number; total: number; totalPages: number };
  summary: IssuedSummary;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** The local calendar day an instant falls on. */
const dayOf = (iso: string): ISODate => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function issuedState(t: Ticket): IssuedState {
  if (t.status === "void" || t.terminatedAt) return "void";
  if (t.status === "redeemed") return "used";
  return (t.admitted ?? 0) > 0 ? "part" : "unused";
}

function rowOf(t: Ticket, order: Order | undefined): IssuedTicket {
  const line: OrderLine | undefined = order?.lines.find((l) => l.id === t.lineId);
  const admits = ticketAdmits(t);
  return {
    id: t.id,
    code: t.code,
    state: issuedState(t),
    used: t.admitted ?? (t.status === "redeemed" ? admits : 0),
    admits,
    orderId: t.orderId,
    orderReference: order?.reference ?? "",
    locationId: order?.locationId ?? "",
    customerName: order?.customerName ?? null,
    productId: t.productId,
    bookingName: line?.productName ?? t.tierName,
    variantName: line?.tierName ?? t.tierName,
    startDate: line?.booking?.date ?? t.validFor,
    startTime: line?.booking?.startTime,
    issuedAt: order?.createdAt ?? `${t.validFor}T00:00:00`,
  };
}

/** Every issued ticket, before any filter. */
function allRows(): IssuedTicket[] {
  const orders = new Map(peekOrders().map((o) => [o.id, o]));
  return peekTickets().map((t) => rowOf(t, orders.get(t.orderId)));
}

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
const startKey = (r: IssuedTicket) => `${r.startDate}T${r.startTime ?? "00:00"}`;

const COMPARE: Record<IssuedSortKey, (a: IssuedTicket, b: IssuedTicket) => number> = {
  code: (a, b) => text(a.code, b.code),
  state: (a, b) => ISSUED_STATES.indexOf(a.state) - ISSUED_STATES.indexOf(b.state),
  start: (a, b) => (startKey(a) < startKey(b) ? -1 : startKey(a) > startKey(b) ? 1 : 0),
  customer: (a, b) => text(a.customerName ?? "", b.customerName ?? ""),
  booking: (a, b) => text(a.bookingName, b.bookingName),
  variant: (a, b) => text(a.variantName, b.variantName),
  issued: (a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt),
  order: (a, b) => text(a.orderReference, b.orderReference),
};

/** Every ticket the filters match, sorted, not yet paged. Synchronous: also
 *  what the CSV and the tests read. */
export function matchIssuedTickets(q: IssuedQuery = {}): IssuedTicket[] {
  const needle = (q.search ?? "").trim().toLowerCase();
  const states = q.states ?? [];
  const products = q.productIds ?? [];
  const rows = allRows().filter((r) => {
    if (q.locationId && r.locationId !== q.locationId) return false;
    const day = dayOf(r.issuedAt);
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
    if (states.length && !states.includes(r.state)) return false;
    if (products.length && !products.includes(r.productId)) return false;
    if (needle) {
      const hay = `${r.code} ${r.orderReference} ${r.customerName ?? ""} ${r.bookingName} ${r.variantName}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const key = q.sort ?? "issued";
  const dir = (q.order ?? (key === "issued" || key === "start" ? "desc" : "asc")) === "asc" ? 1 : -1;
  /* Ties break on the newest issue then the code, so a sort never shuffles rows
     that compare equal from one load to the next. */
  return rows.sort((a, b) => COMPARE[key](a, b) * dir || Date.parse(b.issuedAt) - Date.parse(a.issuedAt) || text(a.code, b.code));
}

export function summariseIssued(rows: IssuedTicket[]): IssuedSummary {
  const s: IssuedSummary = { issued: rows.length, unused: 0, part: 0, used: 0, void: 0 };
  for (const r of rows) s[r.state] += 1;
  return s;
}

/** One page of issued tickets, with the counts for the whole filtered set. */
export async function listIssuedTickets(q: IssuedQuery = {}): Promise<ApiResult<IssuedPage>> {
  await delay();
  const rows = matchIssuedTickets(q);
  const pageSize = Math.max(1, q.pageSize ?? 20);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), totalPages);
  return ok({
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    page: { page, pageSize, total: rows.length, totalPages },
    summary: summariseIssued(rows),
  });
}

/** The bookings that have tickets at a venue, for the Booking filter. */
export async function listIssuedBookings(locationId?: ID): Promise<ApiResult<{ id: ID; name: string }[]>> {
  await delay();
  const ids = new Set(allRows().filter((r) => !locationId || r.locationId === locationId).map((r) => r.productId));
  const names = new Map(peekProducts().map((p) => [p.id, p.name]));
  return ok([...ids].map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => text(a.name, b.name)));
}

/** A spreadsheet cell. Text that begins like a formula is defused. */
const cell = (v: string) => {
  const s = /^[=+@\t\r]|^-(?![\d.])/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The filtered list as CSV — every page, not the one on screen. The caller
 *  supplies the words so the file speaks the screen's language. */
export function issuedTicketsCsv(
  q: IssuedQuery,
  words: { headers: string[]; state: (s: IssuedState) => string; walkIn: string; start: (r: IssuedTicket) => string; issued: (r: IssuedTicket) => string },
): string {
  const rows = matchIssuedTickets(q);
  const lines = [
    words.headers,
    ...rows.map((r) => [
      r.code,
      words.state(r.state),
      words.start(r),
      r.customerName ?? words.walkIn,
      r.bookingName,
      r.variantName,
      words.issued(r),
      r.orderReference,
    ]),
  ];
  return lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}
