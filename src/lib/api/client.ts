/* ───────────────────────────────────────────────────────────────────────────
   THE SWAP POINT.

   Today: an in-memory store seeded from `src/lib/mock/data.ts`, with simulated
   200–400ms latency so loading states get built for real.

   Later: replace the body of `createResource` with real `fetch` calls (the
   collection name maps to an endpoint, ListParams to a query string, ApiResult
   to the parsed response). Nothing else in the codebase changes — entity
   modules and components already speak only in these types.
   ────────────────────────────────────────────────────────────────────────── */
import * as seedAsWritten from "@/lib/mock/data";
import { generateSales as generateAsWritten } from "@/lib/mock/generate";
import * as doersAsWritten from "@/lib/mock/doers";
import { rebaseSeed } from "@/lib/schedule";
import type {
  AdvancePolicy,
  ApiError,
  ApiResult,
  ListParams,
  ListResponse,
  LoyaltyProgram,
  ManualDiscountPolicy,
  Operator,
  Product,
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

// The seed, dated to the real today rather than the day it was written around.
const seed = rebaseSeed(seedAsWritten);
const doers = rebaseSeed(doersAsWritten);
const generateSales = (input: Parameters<typeof generateAsWritten>[0]) => rebaseSeed(generateAsWritten(input));

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
  // Move requests work the same way (lib/api/rescheduleRequests).
  rescheduleRequests: [],
  // Write-off requests (lib/api/writeOffRequests) — asked for at the counter.
  writeOffRequests: [],
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

/* ── A new account stays new ───────────────────────────────────────────────
   The mock store lives in memory, so a reload used to drop a brand-new business
   back onto the demo. Confirming a sign-up remembers the business (its name, and
   later the currency and timezone from onboarding) in this browser; on the next
   boot, when no demo was asked for, the empty business is rebuilt from it.
   Opening any demo clears it. */
export const FRESH_KEY = "cf_fresh";
export interface FreshAccount { name: string; ownerName?: string; currency?: string; defaultTimezone?: string }
/** The dashboard's setup guide keeps its own per-browser state; a new account starts it afresh. */
const GUIDE_KEY = "cf_setup_guide";
const forgetGuide = () => { try { localStorage.removeItem(GUIDE_KEY); window.dispatchEvent(new Event("cf-setup-guide")); } catch {} };
let freshMemory: FreshAccount | null = null;
/** The remembered new account, or null when this browser is not on one. */
export function getFreshAccount(): FreshAccount | null {
  try {
    const raw = localStorage.getItem(FRESH_KEY);
    if (raw) {
      const v = JSON.parse(raw) as FreshAccount;
      if (v && typeof v.name === "string") return v;
    }
  } catch {}
  return freshMemory;
}
export const isFreshAccount = (): boolean => getFreshAccount() !== null;
const freshPatch = (f: FreshAccount): Partial<Operator> => ({
  name: f.name,
  ...(f.currency ? { currency: f.currency } : {}),
  ...(f.defaultTimezone ? { defaultTimezone: f.defaultTimezone } : {}),
});
/** Remember a new account (merging what onboarding adds later) and name the empty business. */
export function markFreshAccount(name: string, extra?: Partial<Omit<FreshAccount, "name">>): void {
  const before = getFreshAccount();
  const next: FreshAccount = { ...(before ?? { name }), ...extra, name };
  if (!before) forgetGuide();
  freshMemory = next;
  try { localStorage.setItem(FRESH_KEY, JSON.stringify(next)); } catch {}
  patchOperatorState(freshPatch(next));
}
export function clearFreshAccount(): void {
  freshMemory = null;
  forgetGuide();
  try { localStorage.removeItem(FRESH_KEY); } catch {}
}
function restoreFreshAccount(): void {
  const f = getFreshAccount();
  if (!f) return;
  startFresh();
  patchOperatorState(freshPatch(f));
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
  // Events are catalogue items (BT-15) and stay whichever demo business is shown,
  // as the separate events collection did before them.
  (store as Record<string, unknown[]>).products = structuredClone(seed.products).filter((p) => productIds.includes(p.id) || p.bookingType === "BT-15");
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
  const sales = generateSales({ products: store.products as never, locations: seed.locations, staff: seed.staff, counters: seed.counters, taxRatePct: operatorState.taxRatePct, reducedRatePct: operatorState.reducedRatePct });
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
  (store as Record<string, unknown[]>).rescheduleRequests = [];
  (store as Record<string, unknown[]>).writeOffRequests = [];
  (store as Record<string, unknown[]>).financeLines = [];
  (store as Record<string, unknown[]>).bookings = [...sales.bookings, ...keepBookings];
  rebaseSaved("default");
}

/* ── Whole-business demos ──────────────────────────────────────────────────
   `loadBusiness` filters the default seed; a prospect demo like The Doers Club
   is a different business — its own venue, counter, shelf and storefront — so
   it replaces those collections too. The choice is remembered in this browser
   (and implied by its storefront address) so a reload or a shared link opens
   the same business instead of falling back to the default seed. */
export const DEMO_KEY = "cf_demo";
const BUNDLES: Record<string, { slug: string; apply: () => void }> = {
  doers: {
    slug: "thedoersclub",
    apply: () => {
      operatorState = { ...structuredClone(seed.operator), ...doers.doersOperator };
      const S = store as Record<string, unknown[]>;
      S.products = structuredClone(doers.doersProducts);
      S.locations = structuredClone(doers.doersLocations);
      S.counters = structuredClone(doers.doersCounters);
      S.devices = structuredClone(seed.devices).filter((d) => d.counterId === "cnt_fort_main");
      S.storefronts = structuredClone(doers.doersStorefronts);
      S.inventoryItems = structuredClone(doers.doersInventoryItems);
      S.stockMovements = structuredClone(doers.doersStockMovements);
      for (const k of ["resources", "holds", "marketplaceConnections", "marketplaceListings", "ticketCredentials", "ticketScans", "refundRequests", "rescheduleRequests", "writeOffRequests"]) S[k] = [];
      const sales = generateSales({ products: doers.doersProducts, locations: doers.doersLocations, staff: seed.staff, taxRatePct: operatorState.taxRatePct, reducedRatePct: operatorState.reducedRatePct, count: 40 });
      S.orders = sales.orders;
      S.tickets = sales.tickets;
      S.bookings = sales.bookings;
    },
  },
};
/** Each whole-business demo's catalogue, for telling its item links apart. */
const BUNDLE_ITEMS: Record<string, () => Product[]> = { doers: () => doers.doersProducts };

/** A slug from a name: lower case, words joined by hyphens, Latin letters and
 *  digits only (a Bangla name falls back to "item"). */
export function slugFromName(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "item";
}

/* ── The catalogue this browser has changed ─────────────────────────────────
   There is no backend yet, so everything lives in the store above, and the store
   is rebuilt from the seed on every page load. That made a new item vanish on
   refresh and, worse, made its own link (`/b/<slug>`) answer "This page isn't
   available": "Open link" starts a new tab, and a new tab has a new store.

   So what the operator makes is kept in this browser: every row of these
   collections that differs from what the demo started with is written to
   localStorage on each change and laid back over the store on load, one set per
   demo, because a Doers Club item means nothing in the museum's catalogue. Only
   the difference is kept, so seed changes still arrive for everything untouched.
   Orders and tickets stay per tab, as they were; this is about what is on sale.

   This is the swap point's other half: with a real backend, all of it goes. */
const SAVED_KEY = "cf_saved_catalog_v1";
export const SAVE_FAILED_EVENT = "cf-catalog-save-failed";
const SAVED_COLLECTIONS = ["products", "resources", "seatLayouts"];
type SavedRows = Record<string, Row[]>;
let savedScope = "default";
let savedBaseline = new Map<string, string>();
const savedKey = (collection: string, id: string) => `${collection}:${id}`;

/** A row as compared. Links are minted into rows the first time one is read, and
 *  a minted link is not an edit; a link somebody chose is. */
function comparable(row: Row & { slug?: string; name?: string }, baseline?: string): string {
  const before = baseline ? (JSON.parse(baseline) as { slug?: string }) : null;
  const minted = before && !before.slug && row.slug && row.name && row.slug.startsWith(slugFromName(row.name));
  return JSON.stringify(minted ? { ...row, slug: undefined } : row);
}

function readSaved(): Record<string, SavedRows> {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, SavedRows>;
  } catch {
    // Blocked or corrupt storage: start from the demo rather than not at all.
    return {};
  }
}

function overlaySaved(rows: SavedRows | undefined): void {
  for (const c of SAVED_COLLECTIONS) {
    const list = store[c];
    for (const row of rows?.[c] ?? []) {
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = row;
      else list.push(row);
    }
  }
}

/** The demo in front of the operator changed: remember how it started, then put back what they made in it. */
function rebaseSaved(scope: string): void {
  if (typeof window === "undefined") return;
  savedScope = scope;
  savedBaseline = new Map();
  for (const c of SAVED_COLLECTIONS) for (const row of store[c]) savedBaseline.set(savedKey(c, row.id), JSON.stringify(row));
  overlaySaved(readSaved()[scope]);
}

function writeSaved(): void {
  if (typeof window === "undefined") return;
  const rows: SavedRows = {};
  for (const c of SAVED_COLLECTIONS) {
    const changed = store[c].filter((row) => {
      const before = savedBaseline.get(savedKey(c, row.id));
      return !before || comparable(row, before) !== before;
    });
    if (changed.length) rows[c] = changed;
  }
  const file = readSaved();
  if (Object.keys(rows).length) file[savedScope] = rows;
  else delete file[savedScope];
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(file));
  } catch {
    // Full, usually from photos. Say so: losing work silently is the bug this fixes.
    window.dispatchEvent(new Event(SAVE_FAILED_EVENT));
  }
  for (const fn of catalogueWriteListeners) fn();
}

const catalogueWriteListeners = new Set<() => void>();
/** Something in the catalogue changed. `publish.ts` listens, to keep public pages up to date. */
export const onCatalogueWrite = (fn: () => void): void => void catalogueWriteListeners.add(fn);

/** Which demo the catalogue in front of the operator belongs to. */
export const currentSavedScope = (): string => savedScope;

/** A published item as its visitors' browsers receive it. Its shape is the server's contract: see `publish.ts`. */
export interface PublishedSnapshot {
  v: 1;
  slug: string;
  product: Product;
  location: Row;
  storefront: Row;
  resources: Row[];
  seatLayouts: Row[];
  team: Row[];
  operator: Partial<Operator>;
}

/** A visitor's browser takes in somebody's published item. It is theirs to read, not this browser's own
 *  work, so it joins the baseline: nothing here saves it again or publishes it back. */
export function adoptPublished(doc: PublishedSnapshot): void {
  const upsert = (collection: string, row: Row) => {
    const list = store[collection];
    const i = list.findIndex((r) => r.id === row.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    savedBaseline.set(savedKey(collection, row.id), JSON.stringify(row));
  };
  upsert("products", doc.product as unknown as Row);
  upsert("locations", doc.location);
  upsert("storefronts", doc.storefront);
  for (const r of doc.resources) upsert("resources", r);
  for (const l of doc.seatLayouts) upsert("seatLayouts", l);
  for (const s of doc.team) upsert("staff", s);
  operatorState = { ...operatorState, ...doc.operator };
}

/** Forget what this browser made in a demo: "Start fresh" means empty. */
export function forgetSaved(scope: string): void {
  const file = readSaved();
  delete file[scope];
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(file));
  } catch {}
}

/** Made here rather than seeded, so no other browser can have it until there is a backend. */
export const isCreatedInThisBrowser = (collection: string, id: string): boolean =>
  typeof window !== "undefined" && !savedBaseline.has(savedKey(collection, id));

/** Which whole-business demo this browser made an item in, from its link alone. */
function savedBundleForSlug(slug: string): string | undefined {
  const file = readSaved();
  return Object.keys(BUNDLES).find((id) =>
    ((file[id]?.products ?? []) as (Row & { slug?: string; name?: string })[]).some((p) => (p.slug ?? slugFromName(p.name ?? "")) === slug),
  );
}

if (typeof window !== "undefined") {
  // A change made in another tab is the same operator's: an open tab must not
  // write its older copy of the catalogue over it.
  window.addEventListener("storage", (e) => {
    if (e.key === SAVED_KEY) overlaySaved(readSaved()[savedScope]);
  });
}

export const isBundleDemo = (id: string) => id in BUNDLES;
/** The catalogues of the whole-business demos, so a server that only holds the default seed can
 *  still tell a demo's item link from a made-up one (see `demoItemAtSlug`). */
export const bundleProductLists = (): Product[][] => [doers.doersProducts];
/** Load a whole-business demo and remember it for this browser. */
export function loadBundleDemo(id: string): void {
  clearFreshAccount();
  BUNDLES[id]?.apply();
  rebaseSaved(id);
  try { localStorage.setItem(DEMO_KEY, id); } catch {}
}
/** Forget any remembered whole-business demo (the other demos and "Start fresh"). */
export function forgetBundleDemo(): void {
  try { localStorage.removeItem(DEMO_KEY); } catch {}
}
// On first load in the browser: a demo's own storefront address or demo link
// opens that demo; any other storefront is the default seed's; otherwise the
// demo this browser last chose.
if (typeof window !== "undefined") {
  try {
    const path = window.location.pathname;
    let id: string | null = localStorage.getItem(DEMO_KEY);
    const slugHit = Object.entries(BUNDLES).find(([, b]) => path === `/s/${b.slug}` || path.startsWith(`/s/${b.slug}/`));
    // An item's own link (/b/<slug>) opens the demo whose catalogue holds it.
    const itemSlug = path.match(/^\/b\/([^/]+)/)?.[1];
    const itemHit = itemSlug ? Object.entries(BUNDLE_ITEMS).find(([, list]) => list().some((p) => p.slug === itemSlug)) : undefined;
    if (slugHit) id = slugHit[0];
    else if (itemHit) id = itemHit[0];
    else if (itemSlug && savedBundleForSlug(itemSlug)) id = savedBundleForSlug(itemSlug) ?? null;
    else if (path.startsWith("/s/") || itemSlug) id = null;
    const demoHit = path.match(/^\/demo\/([a-z-]+)/);
    if (demoHit) id = Object.keys(BUNDLES).find((k) => demoHit[1].startsWith(k)) ?? id;
    if (id && BUNDLES[id]) {
      BUNDLES[id].apply();
      rebaseSaved(id);
    } else {
      restoreFreshAccount();
      if (!isFreshAccount()) rebaseSaved("default");
    }
  } catch {}
}

/** Empty the operator's data for the golden path ("Start fresh"). */
export function startFresh(): void {
  operatorState = { ...structuredClone(seed.operator), name: "" };
  for (const k of ["products", "orders", "tickets", "ticketCredentials", "ticketScans", "bookings", "locations", "counters", "staff", "devices", "resources", "paymentAccounts", "customers", "membershipTiers", "memberships", "loyaltyEntries", "holds", "inventoryItems", "stockMovements", "financeLines", "expenses"]) {
    (store as Record<string, unknown[]>)[k] = [];
  }
  rebaseSaved("fresh");
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
  const keep = () => {
    if (SAVED_COLLECTIONS.includes(name)) writeSaved();
  };

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
      keep();
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
      keep();
      return created;
    },

    async update(id, patch) {
      await delay();
      const list = rows();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return fail<T>(notFoundError(label));
      const next = { ...list[idx], ...patch, updatedAt: nowISO() } as T;
      list[idx] = next;
      keep();
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
      keep();
      return ok(next);
    },

    async remove(id) {
      await delay();
      const list = rows();
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return fail<T>(notFoundError(label));
      const [removed] = list.splice(idx, 1);
      keep();
      return ok(removed);
    },

    peek() {
      return rows();
    },
  };
}
