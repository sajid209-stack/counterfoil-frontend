/* customers.v1 — the person behind the sale.

   Until Milestone 2 a "customer" was a free-text name on an order, so two
   spellings of the same person were two customers and nothing could be
   attached to them. This module makes the customer a record: matched on
   normalised phone/email, merge-able, consent-carrying, erasable.

   Stats are DERIVED from orders and bookings, never stored — the backend
   computes them from the ledger, and a cached copy here would drift. */
import { createResource, fail, notFoundError, ok, validationError } from "./client";
import { peekBookings } from "./bookings";
import { peekOrders } from "./orders";
import type {
  ApiResult,
  ConsentChannel,
  ConsentSource,
  Customer,
  CustomerInput,
  CustomerPatch,
  CustomerStats,
  CustomerWithStats,
  DuplicateMatch,
  ID,
  ListParams,
  ListResponse,
  Minor,
} from "./types";

// ── match keys ──────────────────────────────────────────────────────────────
/** Bangladeshi numbers arrive as 01712-345678, +8801712345678, 8801712345678.
 *  Normalise to the last 10 significant digits so all three match. */
export function phoneKeyOf(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-10);
}

export function emailKeyOf(email?: string | null): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

const nameKeyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

const resource = createResource<Customer>("customers", "Customer", {
  search: (c, q) =>
    c.name.toLowerCase().includes(q) ||
    (c.email ?? "").toLowerCase().includes(q) ||
    (c.phone ?? "").toLowerCase().includes(q) ||
    (phoneKeyOf(q) != null && c.phoneKey === phoneKeyOf(q)),
  filter: (c, f) => {
    // Merged-away tombstones never appear in a list — they only resolve lookups.
    if (c.mergedIntoId) return false;
    if (f.flagged === true && !c.flag) return false;
    if (f.consent === "email" && !hasConsent(c, "email")) return false;
    if (f.consent === "sms" && !hasConsent(c, "sms")) return false;
    if (f.tag && !c.tags.includes(f.tag as string)) return false;
    if (f.status && c.status !== f.status) return false;
    if (!f.status && c.status === "archived") return false;
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  },
  defaultSort: "name",
});

export const listCustomers = (params?: ListParams): Promise<ApiResult<ListResponse<Customer>>> =>
  resource.list(params);
export const peekCustomers = (): Customer[] => resource.peek();

/** Follow merge tombstones to the surviving record (bounded — a merge chain
 *  cannot outlive the roster). */
export function resolveCustomer(id: ID | null | undefined): Customer | undefined {
  const all = resource.peek();
  let cur = all.find((c) => c.id === id);
  for (let hops = 0; cur?.mergedIntoId && hops < 10; hops++) {
    const next: Customer | undefined = all.find((c) => c.id === cur?.mergedIntoId);
    cur = next;
  }
  return cur;
}

export async function getCustomer(id: ID): Promise<ApiResult<Customer>> {
  const found = resolveCustomer(id);
  return found ? ok(found) : fail<Customer>(notFoundError("Customer"));
}

/** The latest decision wins per channel — consents are an append-only log. */
export function hasConsent(c: Customer, channel: ConsentChannel): boolean {
  const latest = c.consents
    .filter((x) => x.channel === channel)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .at(-1);
  return latest?.granted ?? false;
}

// ── writes ──────────────────────────────────────────────────────────────────
export function createCustomer(input: CustomerInput): Promise<ApiResult<Customer>> {
  const name = input.name.trim();
  if (!name) {
    return Promise.resolve(
      fail<Customer>(validationError({ name: "Enter a name for this customer." })),
    );
  }
  return resource.create({
    name,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    phoneKey: phoneKeyOf(input.phone),
    emailKey: emailKeyOf(input.email),
    consents: [],
    notes: [],
    flag: null,
    tags: input.tags ?? [],
    mergedIntoId: null,
    erasedAt: null,
    status: "active",
  } as Omit<Customer, "id" | "createdAt" | "updatedAt">);
}

export function updateCustomer(id: ID, patch: CustomerPatch): Promise<ApiResult<Customer>> {
  const next: Partial<Customer> = { ...patch };
  if ("phone" in patch) {
    next.phone = patch.phone?.trim() || null;
    next.phoneKey = phoneKeyOf(patch.phone);
  }
  if ("email" in patch) {
    next.email = patch.email?.trim() || null;
    next.emailKey = emailKeyOf(patch.email);
  }
  return resource.update(id, next);
}

export async function addCustomerNote(
  id: ID,
  text: string,
  who: string,
): Promise<ApiResult<Customer>> {
  const c = resolveCustomer(id);
  if (!c) return fail<Customer>(notFoundError("Customer"));
  const body = text.trim();
  if (!body) return fail<Customer>(validationError({ text: "Write the note first." }));
  return resource.update(c.id, {
    notes: [...c.notes, { at: new Date().toISOString(), who, text: body }],
  });
}

export async function setCustomerConsent(
  id: ID,
  channel: ConsentChannel,
  granted: boolean,
  source: ConsentSource,
): Promise<ApiResult<Customer>> {
  const c = resolveCustomer(id);
  if (!c) return fail<Customer>(notFoundError("Customer"));
  return resource.update(c.id, {
    consents: [...c.consents, { channel, granted, capturedAt: new Date().toISOString(), source }],
  });
}

export async function flagCustomer(
  id: ID,
  reason: string,
  who: string,
): Promise<ApiResult<Customer>> {
  const body = reason.trim();
  if (!body) return fail<Customer>(validationError({ reason: "Say what staff should know." }));
  return resource.update(id, { flag: { reason: body, at: new Date().toISOString(), who } });
}

export const unflagCustomer = (id: ID): Promise<ApiResult<Customer>> =>
  resource.update(id, { flag: null });

/**
 * Merge a duplicate into the record that survives (§63.7).
 *
 * The survivor keeps its own contact details but fills blanks from the loser;
 * consents and notes are unioned in time order; every order that pointed at
 * the loser is repointed. The loser is NOT deleted — it becomes a tombstone so
 * any surviving reference still resolves to the survivor.
 */
export async function mergeCustomers(loserId: ID, survivorId: ID): Promise<ApiResult<Customer>> {
  if (loserId === survivorId) {
    return fail<Customer>(validationError({}, "Pick two different customers."));
  }
  const loser = resolveCustomer(loserId);
  const survivor = resolveCustomer(survivorId);
  if (!loser || !survivor) return fail<Customer>(notFoundError("Customer"));

  const merged = await resource.update(survivor.id, {
    email: survivor.email ?? loser.email,
    phone: survivor.phone ?? loser.phone,
    emailKey: survivor.emailKey ?? loser.emailKey,
    phoneKey: survivor.phoneKey ?? loser.phoneKey,
    consents: [...loser.consents, ...survivor.consents].sort((a, b) =>
      a.capturedAt.localeCompare(b.capturedAt),
    ),
    notes: [...loser.notes, ...survivor.notes].sort((a, b) => a.at.localeCompare(b.at)),
    flag: survivor.flag ?? loser.flag,
    tags: [...new Set([...survivor.tags, ...loser.tags])],
  });
  if (!merged.ok) return merged;

  for (const o of peekOrders()) {
    if (o.customerId === loser.id) {
      o.customerId = survivor.id;
      o.customerName = survivor.name;
    }
  }
  await resource.update(loser.id, { mergedIntoId: survivor.id, status: "archived" });
  return merged;
}

/**
 * Erase personal data on request (§63.11). The row survives with its id so
 * orders keep aggregating — what goes is the identity, irreversibly.
 */
export async function eraseCustomerData(id: ID, who: string): Promise<ApiResult<Customer>> {
  const c = resolveCustomer(id);
  if (!c) return fail<Customer>(notFoundError("Customer"));
  const at = new Date().toISOString();
  for (const o of peekOrders()) {
    if (o.customerId === c.id) o.customerName = "Erased customer";
  }
  return resource.update(c.id, {
    name: "Erased customer",
    email: null,
    phone: null,
    phoneKey: null,
    emailKey: null,
    consents: [],
    notes: [{ at, who, text: "Personal data erased on request." }],
    tags: [],
    flag: null,
    erasedAt: at,
    status: "archived",
  });
}

// ── derived reads ───────────────────────────────────────────────────────────
const COUNTED_STATUSES = new Set(["paid", "partial", "partly_refunded"]);

export function customerStats(id: ID): CustomerStats {
  const orders = peekOrders().filter((o) => o.customerId === id);
  const orderIds = new Set(orders.map((o) => o.id));
  const bookings = peekBookings().filter((b) => orderIds.has(b.orderId));
  const now = new Date().toISOString();

  let spent: Minor = 0;
  let outstanding: Minor = 0;
  for (const o of orders) {
    if (!COUNTED_STATUSES.has(o.status)) continue;
    const paid = o.payments
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + p.amount, 0);
    spent += paid;
    outstanding += Math.max(0, o.total - paid);
  }

  const dates = orders.map((o) => o.createdAt).sort();
  return {
    orders: orders.length,
    spent,
    visits: bookings.filter((b) => (b.checkedIn ?? 0) > 0).length,
    noShows: bookings.filter((b) => b.noShow).length,
    firstSeen: dates[0] ?? null,
    lastSeen: dates.at(-1) ?? null,
    outstanding,
    upcoming: bookings.filter((b) => b.status === "confirmed" && b.slotStart > now).length,
  };
}

export const getCustomerStats = async (id: ID): Promise<ApiResult<CustomerStats>> =>
  ok(customerStats(id));

/** The list the Customers screen renders. The backend returns these totals on
 *  the list endpoint, so the screen must not compute them itself — it asks for
 *  rows and gets rows. */
export async function listCustomerRows(
  params?: ListParams,
): Promise<ApiResult<ListResponse<CustomerWithStats>>> {
  const res = await resource.list(params);
  if (!res.ok) return res as ApiResult<ListResponse<CustomerWithStats>>;
  return ok({
    ...res.data,
    data: res.data.data.map((c) => ({ ...c, stats: customerStats(c.id) })),
  });
}

/**
 * Match a walk-up purchase to an existing customer (§63.13). Phone is the
 * strong key, email next; a bare name match is only ever a suggestion — two
 * people really do share a name, so that match is never applied on its own.
 */
export function findCustomerMatches(input: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): { exact: Customer | undefined; suggestions: Customer[] } {
  const live = resource.peek().filter((c) => !c.mergedIntoId && !c.erasedAt);
  const pk = phoneKeyOf(input.phone);
  const ek = emailKeyOf(input.email);

  const exact =
    (pk ? live.find((c) => c.phoneKey === pk) : undefined) ??
    (ek ? live.find((c) => c.emailKey === ek) : undefined);
  if (exact) return { exact, suggestions: [] };

  const nk = input.name ? nameKeyOf(input.name) : "";
  const suggestions = nk ? live.filter((c) => nameKeyOf(c.name) === nk).slice(0, 5) : [];
  return { exact: undefined, suggestions };
}

/** Attach a sale to a customer: reuse the match if there is one, else create. */
export async function matchOrCreateCustomer(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<ApiResult<Customer>> {
  const { exact } = findCustomerMatches(input);
  if (exact) {
    // Fill a detail we did not have before, but never overwrite one we did.
    const patch: CustomerPatch = {};
    if (!exact.phone && input.phone) patch.phone = input.phone;
    if (!exact.email && input.email) patch.email = input.email;
    if (Object.keys(patch).length) return updateCustomer(exact.id, patch);
    return ok(exact);
  }
  return createCustomer(input);
}

/** Duplicate candidates for the merge tool (§63.7). */
export async function findDuplicateCustomers(): Promise<ApiResult<DuplicateMatch[]>> {
  const live = peekCustomers().filter((c) => !c.mergedIntoId && !c.erasedAt);
  const out: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const pairKey = (a: Customer, b: Customer) => [a.id, b.id].sort().join("|");
  const scan = (
    key: (c: Customer) => string | null,
    on: DuplicateMatch["on"],
    confidence: DuplicateMatch["confidence"],
  ) => {
    const buckets = new Map<string, Customer[]>();
    for (const c of live) {
      const k = key(c);
      if (!k) continue;
      buckets.set(k, [...(buckets.get(k) ?? []), c]);
    }
    for (const group of buckets.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pk = pairKey(group[i], group[j]);
          if (seen.has(pk)) continue;
          seen.add(pk);
          out.push({ a: group[i], b: group[j], on, confidence });
        }
      }
    }
  };

  scan((c) => c.phoneKey, "phone", "high");
  scan((c) => c.emailKey, "email", "high");
  scan((c) => nameKeyOf(c.name), "name", "medium");
  return ok(out);
}
