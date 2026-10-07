/* ───────────────────────────────────────────────────────────────────────────
   THE SWAP POINT.

   Today: an in-memory store seeded from `src/lib/mock/data.ts`, with simulated
   200–400ms latency so loading states get built for real.

   Later: replace the body of `createResource` with real `fetch` calls (the
   collection name maps to an endpoint, ListParams to a query string, ApiResult
   to the parsed response). Nothing else in the codebase changes — entity
   modules and components already speak only in these types.
   ────────────────────────────────────────────────────────────────────────── */
import * as seed from "@/lib/mock/data";
import { generateSales } from "@/lib/mock/generate";
import type {
  AdvancePolicy,
  ApiError,
  ApiResult,
  ListParams,
  ListResponse,
  LoyaltyProgram,
  ManualDiscountPolicy,
  Operator,
  TaxConfig,
} from "./types";

// ── latency + result helpers ───────────────────────────────────────────────
const MIN_MS = 200;
const MAX_MS = 400;
export const delay = () =>
  new Promise<void>((r) => setTimeout(r, MIN_MS + Math.random() * (MAX_MS - MIN_MS)));

export const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
export const fail = <T>(error: ApiError): ApiResult<T> => ({ ok: false, error });

// Error factories — the failure shapes every screen must handle.
export const notFoundError = (entity: string): ApiError => ({
  code: "not_found",
  message: `${entity} not found.`,
});
export const validationError = (
  fieldErrors: Record<string, string>,
  message = "Please fix the highlighted fields.",
): ApiError => ({ code: "validation", message, fieldErrors });
export const conflictError = (message: string): ApiError => ({
  code: "conflict",
  message,
});

// ── the mutable mock store (cloned so a session's edits persist) ────────────
type Row = { id: string; createdAt?: string; updatedAt?: string };

const store: Record<string, Row[]> = {
  products: structuredClone(seed.products),
  locations: structuredClone(seed.locations),
  counters: structuredClone(seed.counters),
  roles: structuredClone(seed.roles),
  staff: structuredClone(seed.staff),
  bookingRules: structuredClone(seed.bookingRules),
  priceRules: structuredClone(seed.priceRules),
  devices: structuredClone(seed.devices),
  resources: structuredClone(seed.resources),
  orders: structuredClone(seed.orders),
  tickets: structuredClone(seed.tickets),
  // Minted on first read rather than seeded — see lib/api/credentials.
  ticketCredentials: [],
  ticketScans: [],
  // Refund requests start empty — a counter makes them, a manager decides.
  refundRequests: [],
  // Withdrawals and deposits made this session (see lib/api/finances) — the
  // only finance lines that are written; every other line is derived.
  financeLines: [],
  // Expenses are seeded by lib/api/expenses when it loads (it holds the seed, so
  // this module need not import it) and kept for the session like any other row.
  expenses: [],
  bookings: structuredClone(seed.bookings),
  paymentAccounts: structuredClone(seed.paymentAccounts),
  seatLayouts: structuredClone(seed.seatLayouts),
  promotions: structuredClone(seed.promotions),
  coupons: structuredClone(seed.coupons),
  customers: structuredClone(seed.customers),
  membershipTiers: structuredClone(seed.membershipTiers),
  memberships: structuredClone(seed.memberships),
  loyaltyEntries: structuredClone(seed.loyaltyEntries),
  holds: structuredClone(seed.holds),
  events: structuredClone(seed.events),
  storefronts: structuredClone(seed.storefronts),
  inventoryItems: structuredClone(seed.inventoryItems),
  stockMovements: structuredClone(seed.stockMovements),
  marketplaceConnections: structuredClone(seed.marketplaceConnections),
  marketplaceListings: structuredClone(seed.marketplaceListings),
};

// ── Operator + demo-business switching ──────────────────────────────────────
let operatorState: Operator = structuredClone(seed.operator);
export const getOperatorState = (): Operator => operatorState;
export function patchOperatorState(patch: Partial<Operator>): Operator {
  operatorState = { ...operatorState, ...patch, updatedAt: new Date().toISOString() };
  return operatorState;
}

// Tax config is a singleton (per settings.v2 tax-config), not a collection.
let advancePolicyState: AdvancePolicy = structuredClone(seed.advancePolicy);
export const getAdvancePolicyState = (): AdvancePolicy => advancePolicyState;
export function patchAdvancePolicyState(patch: Partial<AdvancePolicy>): AdvancePolicy {
  advancePolicyState = { ...advancePolicyState, ...patch };
  return advancePolicyState;
}

let taxConfigState: TaxConfig = structuredClone(seed.taxConfig);
export const getTaxConfigState = (): TaxConfig => taxConfigState;
export function patchTaxConfigState(patch: Partial<TaxConfig>): TaxConfig {
  taxConfigState = { ...taxConfigState, ...patch };
  return taxConfigState;
}

// The loyalty programme is a singleton per operator (loyalty.v1 program).
let loyaltyProgramState: LoyaltyProgram = structuredClone(seed.loyaltyProgram);
export const getLoyaltyProgramState = (): LoyaltyProgram => loyaltyProgramState;
export function patchLoyaltyProgramState(patch: Partial<LoyaltyProgram>): LoyaltyProgram {
  loyaltyProgramState = { ...loyaltyProgramState, ...patch };
  return loyaltyProgramState;
}

// Manual-discount policy is a singleton (per-location in the backend).
let manualDiscountPolicyState: ManualDiscountPolicy = structuredClone(seed.manualDiscountPolicy);
export const getManualDiscountPolicyState = (): ManualDiscountPolicy => manualDiscountPolicyState;
export function patchManualDiscountPolicyState(patch: Partial<ManualDiscountPolicy>): ManualDiscountPolicy {
  manualDiscountPolicyState = { ...manualDiscountPolicyState, ...patch };
  return manualDiscountPolicyState;
}

/** Swap the whole mock to a demo business: its operator, its products, and a
 *  fresh 30-day order history for them. Shared entities (locations, staff,
 *  counters, resources) stay so the demo is coherent. */
export function loadBusiness(name: string, currency: string, productIds: string[]): void {
  // Contact details belong to the seeded business; another demo prints none.
  operatorState = { ...structuredClone(seed.operator), name, currency, contactPhone: undefined, contactEmail: undefined, website: undefined };
  (store as Record<string, unknown[]>).products = structuredClone(seed.products).filter((p) => productIds.includes(p.id));
  // Only the resources this business actually books on. Copying all of them
  // meant a turf owner opened Settings and found four bowling lanes, and a
  // museum found fields — a demo that shows someone else's kit is not a demo
  // of their business.
  const usedResourceIds = new Set(
    (store.products as { resourceIds?: string[] }[]).flatMap((p) => p.resourceIds ?? []),
  );
  (store as Record<string, unknown[]>).resources = structuredClone(seed.resources).filter((r) =>
    usedResourceIds.has(r.id),
  );
  const sales = generateSales({ products: store.products as never, locations: seed.locations, staff: seed.staff, taxRatePct: operatorState.taxRatePct, reducedRatePct: operatorState.reducedRatePct });
  // Keep the hand-authored seed rows that belong to this business: the demo
  // credits pass and the explicit turf/guide bookings (the sharing proofs).
  const keepTickets = structuredClone(seed.tickets).filter((t) => t.creditsUsed != null && productIds.includes(t.productId));
  const keepBookings = structuredClone(seed.bookings).filter((b) => b.orderId === "ord_seed" && productIds.includes(b.productId));
  (store as Record<string, unknown[]>).orders = sales.orders;
  (store as Record<string, unknown[]>).tickets = [...sales.tickets, ...keepTickets];
  // A new business's tickets are new tickets; their credentials mint on read.
  (store as Record<string, unknown[]>).ticketCredentials = [];
  (store as Record<string, unknown[]>).ticketScans = [];
  (store as Record<string, unknown[]>).refundRequests = [];
  (store as Record<string, unknown[]>).financeLines = [];
  (store as Record<string, unknown[]>).bookings = [...sales.bookings, ...keepBookings];
}

/** Empty the operator's data for the golden path ("Start fresh"). */
export function startFresh(): void {
  operatorState = { ...structuredClone(seed.operator), name: "" };
  for (const k of ["products", "orders", "tickets", "ticketCredentials", "ticketScans", "bookings", "locations", "counters", "staff", "devices", "resources", "paymentAccounts", "customers", "membershipTiers", "memberships", "loyaltyEntries", "holds", "inventoryItems", "stockMovements", "financeLines", "expenses"]) {
    (store as Record<string, unknown[]>)[k] = [];
  }
}

const nowISO = () => new Date().toISOString();
const genId = (name: string) =>
  `${name}_${globalThis.crypto.randomUUID().slice(0, 8)}`;

// ── resource config: how a collection searches, filters, sorts ──────────────
export interface ResourceConfig<T> {
  /** free-text search predicate */
  search?: (row: T, q: string) => boolean;
  /** structured filter predicate; always called so it can apply defaults
   *  (e.g. hide archived unless a status filter is present) */
  filter?: (row: T, filters: Record<string, unknown>) => boolean;
  /** named comparators for sortable columns */
  sort?: Record<string, (a: T, b: T) => number>;
  defaultSort?: string;
}

export interface Resource<T> {
  list(params?: ListParams): Promise<ApiResult<ListResponse<T>>>;
  get(id: string): Promise<ApiResult<T>>;
  create(record: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<T>>;
  /**
   * Synchronous write, for a derived record the api layer mints while reading.
   *
   * `create` awaits simulated latency, which a read cannot do — a synchronous
   * read that had to await its own backfill would hand every caller an empty
   * list on the first paint and a full one on the second. A record given its
   * own `createdAt` keeps it, because a backfilled row is dated from the thing
   * it was derived from rather than from the moment somebody looked at it.
   */
  insert(record: Omit<T, "id"> & { createdAt?: string }): T;
  update(id: string, patch: Partial<T>): Promise<ApiResult<T>>;
  /** soft-delete: sets status → "archived" (+ archivedAt when present) */
  archive(id: string): Promise<ApiResult<T>>;
  /** hard delete: only for a record nothing else can point at (a role nobody holds) */
  remove(id: string): Promise<ApiResult<T>>;
  /** unmediated read for cross-entity lookups within the api layer only */
  peek(): T[];
}

export function createResource<T extends Row>(
  name: string,
  label: string,
  config: ResourceConfig<T> = {},
): Resource<T> {
  const rows = () => store[name] as unknown as T[];

  return {
    async list(params = {}) {
      await delay();
      const { page = 1, pageSize = 20, sort, order = "asc", search, filters } = params;

      let data = rows().slice();
      if (search && config.search) {
        const q = search.trim().toLowerCase();
        if (q) data = data.filter((row) => config.search!(row, q));
      }
      if (config.filter) {
        data = data.filter((row) => config.filter!(row, filters ?? {}));
      }

      const cmpKey = sort ?? config.defaultSort;
      const cmp = cmpKey ? config.sort?.[cmpKey] : undefined;
      if (cmp) {
        data.sort(cmp);
        if (order === "desc") data.reverse();
      }

      const total = data.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      const pageData = data.slice(start, start + pageSize);

      return ok<ListResponse<T>>({
        data: pageData,
        page: { page, pageSize, total, totalPages },
      });
    },

    async get(id) {
      await delay();
      const found = rows().find((r) => r.id === id);
      return found ? ok(found) : fail<T>(notFoundError(label));
    },

    async create(record) {
      await delay();
      const ts = nowISO();
      const created = {
        ...(record as object),
        id: genId(name),
        createdAt: ts,
        updatedAt: ts,
      } as T;
      rows().push(created);
      return ok(created);
    },

    insert(record) {
      const ts = nowISO();
      const created = {
        createdAt: ts,
        updatedAt: ts,
        ...(record as object),
        id: genId(name),
      } as T;
      rows().push(created);
      return created;
    },

    async update(id, patch) {
      await delay();
      const list = rows();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return fail<T>(notFoundError(label));
      const next = { ...list[idx], ...patch, updatedAt: nowISO() } as T;
      list[idx] = next;
      return ok(next);
    },

    async archive(id) {
      await delay();
      const list = rows();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return fail<T>(notFoundError(label));
      const current = list[idx] as Row & { status?: string; archivedAt?: string | null };
      const next = {
        ...current,
        status: "archived",
        ...("archivedAt" in current ? { archivedAt: nowISO() } : {}),
        updatedAt: nowISO(),
      } as unknown as T;
      list[idx] = next;
      return ok(next);
    },

    async remove(id) {
      await delay();
      const list = rows();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return fail<T>(notFoundError(label));
      const [removed] = list.splice(idx, 1);
      return ok(removed);
    },

    peek() {
      return rows();
    },
  };
}
