/* membership.v1 — tiers the operator sells, and the memberships people hold.

   Two rules shape this module:

   1. **Lapsing is a date crossing, not a stored flag.** A membership whose
      period has ended is lapsed the moment the date passes, with nobody
      running a job. So `status` records what a person decided (paused,
      cancelled) and `effectiveStatus` resolves that against today.

   2. **The tier name is snapshotted onto the membership.** Renaming "Friend of
      the Museum" must not rewrite what someone bought, exactly as with product
      names on order lines. */
import { createResource, fail, notFoundError, ok, validationError } from "./client";
import { peekCustomers, resolveCustomer } from "./customers";
import type {
  ApiResult,
  ID,
  ISODate,
  ListParams,
  ListResponse,
  MemberBenefit,
  Membership,
  MembershipMember,
  MembershipStatus,
  MembershipTier,
  MembershipTierInput,
  MembershipView,
} from "./types";

const DAY = 86400000;
const EXPIRING_SOON_DAYS = 30;

const todayISO = (): ISODate => new Date().toISOString().slice(0, 10);
const daysBetween = (from: ISODate, to: ISODate) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Add one billing period to a date. Lifetime memberships get a date far
 *  enough out that every "is it still valid" check answers yes. */
export function addPeriod(from: ISODate, period: MembershipTier["billingPeriod"]): ISODate {
  const d = new Date(`${from}T00:00:00Z`);
  if (period === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (period === "quarterly") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (period === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 99);
  return d.toISOString().slice(0, 10);
}

// ── tiers ───────────────────────────────────────────────────────────────────
const tiers = createResource<MembershipTier>("membershipTiers", "Membership tier", {
  search: (t, q) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  filter: (t, f) => (f.status ? t.status === f.status : t.status !== "archived"),
  sort: { price: (a, b) => a.price - b.price, name: (a, b) => a.name.localeCompare(b.name) },
  defaultSort: "price",
});

export const listMembershipTiers = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<MembershipTier>>> => tiers.list(params);
export const getMembershipTier = (id: ID): Promise<ApiResult<MembershipTier>> => tiers.get(id);
export const peekMembershipTiers = (): MembershipTier[] => tiers.peek();
export const archiveMembershipTier = (id: ID): Promise<ApiResult<MembershipTier>> =>
  tiers.archive(id);

export function createMembershipTier(
  input: MembershipTierInput,
): Promise<ApiResult<MembershipTier>> {
  const errors = validateTier(input);
  if (errors) return Promise.resolve(fail<MembershipTier>(validationError(errors)));
  return tiers.create(input);
}

export function updateMembershipTier(
  id: ID,
  patch: Partial<MembershipTierInput>,
): Promise<ApiResult<MembershipTier>> {
  const current = tiers.peek().find((t) => t.id === id);
  if (!current) return Promise.resolve(fail<MembershipTier>(notFoundError("Membership tier")));
  const errors = validateTier({ ...current, ...patch });
  if (errors) return Promise.resolve(fail<MembershipTier>(validationError(errors)));
  return tiers.update(id, patch);
}

function validateTier(t: Partial<MembershipTierInput>): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!t.name?.trim()) errors.name = "Give the tier a name members will recognise.";
  if ((t.price ?? 0) < 0) errors.price = "A price cannot be negative.";
  if ((t.discountBps ?? 0) < 0 || (t.discountBps ?? 0) > 10000) {
    errors.discountBps = "A discount runs from 0% to 100%.";
  }
  if ((t.maxMembers ?? 1) < 1) errors.maxMembers = "A membership covers at least one person.";
  if (t.includedVisits != null && t.includedVisits < 0) {
    errors.includedVisits = "Leave this empty for unlimited visits.";
  }
  return Object.keys(errors).length ? errors : null;
}

// ── memberships ─────────────────────────────────────────────────────────────
const memberships = createResource<Membership>("memberships", "Membership", {
  search: (m, q) => {
    const customer = resolveCustomer(m.customerId);
    return (
      m.code.toLowerCase().includes(q) ||
      m.tierName.toLowerCase().includes(q) ||
      (customer?.name.toLowerCase().includes(q) ?? false) ||
      m.members.some((x) => x.name.toLowerCase().includes(q))
    );
  },
  sort: {
    expiresAt: (a, b) => a.expiresAt.localeCompare(b.expiresAt),
    startedAt: (a, b) => a.startedAt.localeCompare(b.startedAt),
  },
  defaultSort: "expiresAt",
});

export const peekMemberships = (): Membership[] => memberships.peek();

/** Resolve a stored membership against today. */
export function viewOf(m: Membership): MembershipView {
  const today = todayISO();
  const daysToExpiry = daysBetween(today, m.expiresAt);
  const tier = tiers.peek().find((t) => t.id === m.tierId);
  const included = tier?.includedVisits ?? null;

  // A cancelled or paused membership stays that way; anything else lapses on
  // the day its period ends.
  const effectiveStatus: MembershipStatus =
    m.status === "cancelled" || m.status === "paused"
      ? m.status
      : daysToExpiry < 0
        ? "lapsed"
        : "active";

  return {
    ...m,
    effectiveStatus,
    daysToExpiry,
    expiringSoon: effectiveStatus === "active" && daysToExpiry <= EXPIRING_SOON_DAYS,
    visitsLeft: included == null ? null : Math.max(0, included - m.visitsUsed),
    customerName: resolveCustomer(m.customerId)?.name ?? "Unknown customer",
  };
}

export async function listMemberships(
  params?: ListParams,
): Promise<ApiResult<ListResponse<MembershipView>>> {
  const res = await memberships.list(params);
  if (!res.ok) return res as ApiResult<ListResponse<MembershipView>>;
  const filters = params?.filters ?? {};
  let rows = res.data.data.map(viewOf);
  // Status filtering has to happen on the RESOLVED status, so it runs here
  // rather than in the collection's filter predicate.
  if (filters.effectiveStatus) {
    rows = rows.filter((m) => m.effectiveStatus === filters.effectiveStatus);
  }
  if (filters.expiringSoon === true) rows = rows.filter((m) => m.expiringSoon);
  return ok({ ...res.data, data: rows, page: { ...res.data.page, total: rows.length } });
}

export async function getMembership(id: ID): Promise<ApiResult<MembershipView>> {
  const found = memberships.peek().find((m) => m.id === id);
  return found ? ok(viewOf(found)) : fail<MembershipView>(notFoundError("Membership"));
}

/** Every membership a customer holds, newest first (§63.4). */
export function membershipsFor(customerId: ID): MembershipView[] {
  return memberships
    .peek()
    .filter((m) => m.customerId === customerId)
    .map(viewOf)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

const membershipCode = (seq: number) => `CF-M-${String(seq).padStart(6, "0")}`;

/** Sell a membership (§16.7, §16.8). The period runs from today. */
export async function issueMembership(input: {
  customerId: ID;
  tierId: ID;
  orderId?: ID | null;
  members?: MembershipMember[];
  startedAt?: ISODate;
}): Promise<ApiResult<Membership>> {
  const tier = tiers.peek().find((t) => t.id === input.tierId);
  if (!tier) return fail<Membership>(notFoundError("Membership tier"));
  if (!resolveCustomer(input.customerId)) return fail<Membership>(notFoundError("Customer"));
  if ((input.members?.length ?? 0) > tier.maxMembers) {
    return fail<Membership>(
      validationError(
        {},
        `${tier.name} covers ${tier.maxMembers} ${tier.maxMembers === 1 ? "person" : "people"}.`,
      ),
    );
  }

  const startedAt = input.startedAt ?? todayISO();
  return memberships.create({
    customerId: input.customerId,
    tierId: tier.id,
    tierName: tier.name,
    code: membershipCode(memberships.peek().length + 1),
    status: "active",
    startedAt,
    expiresAt: addPeriod(startedAt, tier.billingPeriod),
    autoRenew: tier.autoRenew,
    visitsUsed: 0,
    guestPassesUsed: 0,
    members: input.members ?? [],
    orderId: input.orderId ?? null,
    pausedAt: null,
    cancelledAt: null,
  } as Omit<Membership, "id" | "createdAt" | "updatedAt">);
}

/** Renew for another period — what the backend's scheduled job will do for
 *  auto-renewing memberships (§16.11), and what a manager does by hand. */
export async function renewMembership(id: ID): Promise<ApiResult<Membership>> {
  const m = memberships.peek().find((x) => x.id === id);
  if (!m) return fail<Membership>(notFoundError("Membership"));
  const tier = tiers.peek().find((t) => t.id === m.tierId);
  if (!tier) return fail<Membership>(notFoundError("Membership tier"));
  // Renew from the later of today and the current expiry, so renewing early
  // never shortens the membership and renewing late never back-dates it.
  const from = m.expiresAt > todayISO() ? m.expiresAt : todayISO();
  return memberships.update(id, {
    status: "active",
    expiresAt: addPeriod(from, tier.billingPeriod),
    // A new period restores the included visits and guest passes.
    visitsUsed: 0,
    guestPassesUsed: 0,
    pausedAt: null,
    cancelledAt: null,
  });
}

export async function pauseMembership(id: ID): Promise<ApiResult<Membership>> {
  return memberships.update(id, { status: "paused", pausedAt: new Date().toISOString() });
}

/** Resuming extends the expiry by the time the membership sat paused — the
 *  member paid for a period and should get all of it. */
export async function resumeMembership(id: ID): Promise<ApiResult<Membership>> {
  const m = memberships.peek().find((x) => x.id === id);
  if (!m) return fail<Membership>(notFoundError("Membership"));
  const pausedDays = m.pausedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(m.pausedAt)) / DAY))
    : 0;
  const expires = new Date(`${m.expiresAt}T00:00:00Z`);
  expires.setUTCDate(expires.getUTCDate() + pausedDays);
  return memberships.update(id, {
    status: "active",
    pausedAt: null,
    expiresAt: expires.toISOString().slice(0, 10),
  });
}

export async function cancelMembership(id: ID, reason: string): Promise<ApiResult<Membership>> {
  const body = reason.trim();
  if (!body) {
    return fail<Membership>(validationError({ reason: "Say why it is being cancelled." }));
  }
  return memberships.update(id, {
    status: "cancelled",
    autoRenew: false,
    cancelledAt: new Date().toISOString(),
    cancelReason: body,
  });
}

export const setMembershipAutoRenew = (id: ID, autoRenew: boolean): Promise<ApiResult<Membership>> =>
  memberships.update(id, { autoRenew });

export const setMembershipMembers = (
  id: ID,
  members: MembershipMember[],
): Promise<ApiResult<Membership>> => memberships.update(id, { members });

// ── the gate and the till ───────────────────────────────────────────────────
/** Scan a membership at the gate (§16.10). Returns why it was refused rather
 *  than a bare false — staff have to be able to tell the member something. */
export async function scanMembership(
  code: string,
): Promise<ApiResult<{ membership: MembershipView; admitted: boolean; reason?: string }>> {
  const found = memberships.peek().find((m) => m.code.toLowerCase() === code.trim().toLowerCase());
  if (!found) {
    return fail<{ membership: MembershipView; admitted: boolean }>(notFoundError("Membership"));
  }
  const view = viewOf(found);

  if (view.effectiveStatus === "lapsed") {
    return ok({ membership: view, admitted: false, reason: "This membership has run out." });
  }
  if (view.effectiveStatus === "paused") {
    return ok({ membership: view, admitted: false, reason: "This membership is paused." });
  }
  if (view.effectiveStatus === "cancelled") {
    return ok({ membership: view, admitted: false, reason: "This membership was cancelled." });
  }
  if (view.visitsLeft === 0) {
    return ok({
      membership: view,
      admitted: false,
      reason: "Every included visit for this period has been used.",
    });
  }

  // Unlimited memberships do not count down; limited ones spend a visit.
  if (view.visitsLeft != null) {
    await memberships.update(found.id, { visitsUsed: found.visitsUsed + 1 });
  }
  return ok({ membership: viewOf(memberships.peek().find((m) => m.id === found.id)!), admitted: true });
}

/**
 * What the till should know about the attached customer (§16.9). Returns the
 * benefit of their best active membership, or null if they hold none.
 */
export function memberBenefitFor(customerId: ID | null | undefined): MemberBenefit | null {
  if (!customerId) return null;
  const active = memberships
    .peek()
    .filter((m) => m.customerId === customerId)
    .map(viewOf)
    .filter((m) => m.effectiveStatus === "active");
  if (active.length === 0) return null;

  // Best = the largest discount. An operator selling two tiers to one person
  // is unusual, but the till must not have to guess.
  const best = active
    .map((m) => ({ m, tier: tiers.peek().find((t) => t.id === m.tierId) }))
    .filter((x) => x.tier)
    .sort((a, b) => (b.tier?.discountBps ?? 0) - (a.tier?.discountBps ?? 0))[0];
  if (!best?.tier) return null;

  const { m, tier } = best;
  return {
    membershipId: m.id,
    tierName: m.tierName,
    discountBps: tier.discountBps,
    productIds: tier.discountScope === "all" ? null : tier.discountProductIds,
    categoryIds: tier.discountScope === "categories" ? tier.discountCategoryIds : [],
    visitsLeft: m.visitsLeft,
    includedProductIds: tier.includedProductIds,
  };
}

/** The till asks for this whenever the attached customer changes. */
export const getMemberBenefit = async (
  customerId: ID | null | undefined,
): Promise<ApiResult<MemberBenefit | null>> => ok(memberBenefitFor(customerId));

/** Spend an included visit (§16.5) — used when a member takes a covered
 *  product at the till rather than at the gate. */
export async function useIncludedVisit(membershipId: ID): Promise<ApiResult<Membership>> {
  const m = memberships.peek().find((x) => x.id === membershipId);
  if (!m) return fail<Membership>(notFoundError("Membership"));
  return memberships.update(membershipId, { visitsUsed: m.visitsUsed + 1 });
}

/** Counts for the memberships screen header (§16.14). */
export function countsOf(): {
  active: number;
  expiringSoon: number;
  lapsed: number;
  paused: number;
  cancelled: number;
} {
  const views = memberships.peek().map(viewOf);
  return {
    active: views.filter((m) => m.effectiveStatus === "active").length,
    expiringSoon: views.filter((m) => m.expiringSoon).length,
    lapsed: views.filter((m) => m.effectiveStatus === "lapsed").length,
    paused: views.filter((m) => m.effectiveStatus === "paused").length,
    cancelled: views.filter((m) => m.effectiveStatus === "cancelled").length,
  };
}

export const membershipCounts = async (): Promise<
  ApiResult<ReturnType<typeof countsOf>>
> => ok(countsOf());

/** How many memberships sit on each tier — the number that decides whether a
 *  tier can be quietly retired or has to be wound down. */
export async function membershipCountsByTier(): Promise<ApiResult<Record<ID, number>>> {
  const out: Record<ID, number> = {};
  for (const m of memberships.peek()) out[m.tierId] = (out[m.tierId] ?? 0) + 1;
  return ok(out);
}

/** Customers with no membership — who a manager might sell one to. */
export const customersWithoutMembership = (): ID[] => {
  const held = new Set(
    memberships
      .peek()
      .map(viewOf)
      .filter((m) => m.effectiveStatus === "active")
      .map((m) => m.customerId),
  );
  return peekCustomers()
    .filter((c) => !c.mergedIntoId && !held.has(c.id))
    .map((c) => c.id);
};
