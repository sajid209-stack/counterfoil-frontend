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
import type {
  ApiError,
  ApiResult,
  ListParams,
  ListResponse,
} from "./types";

// ── latency + result helpers ───────────────────────────────────────────────
const MIN_MS = 200;
const MAX_MS = 400;
const delay = () =>
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
  categories: structuredClone(seed.categories),
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
  bookings: structuredClone(seed.bookings),
};

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
  update(id: string, patch: Partial<T>): Promise<ApiResult<T>>;
  /** soft-delete: sets status → "archived" (+ archivedAt when present) */
  archive(id: string): Promise<ApiResult<T>>;
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

    peek() {
      return rows();
    },
  };
}
