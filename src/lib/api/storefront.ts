import { createResource, conflictError, fail, notFoundError, ok, validationError } from "./client";
import { peekLocations } from "./locations";
import { peekProducts } from "./products";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  Location,
  Product,
  Storefront,
  StorefrontPatch,
} from "./types";

const resource = createResource<Storefront>("storefronts", "Storefront", {
  filter: (s, f) => f.published === undefined || s.published === f.published,
  sort: { slug: (a, b) => a.slug.localeCompare(b.slug) },
  defaultSort: "slug",
});

/**
 * A slug an operator can read, and that cannot collide with one already taken.
 *
 * The same shape the events module uses, kept separate rather than shared
 * because the two namespaces are independent: an event called "Lalbagh" and a
 * venue called "Lalbagh" do not fight, they live under /e and /s.
 */
export function storefrontSlug(name: string, taken: string[] = []): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "venue";
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const next = `${base}-${i}`;
    if (!taken.includes(next)) return next;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]*$/;

/** The words an operator reads a storefront by: its own name, or its venue's. */
export function storefrontName(sf: Storefront, location?: Pick<Location, "name"> | null): string {
  return (
    sf.name?.trim() ||
    location?.name ||
    peekLocations().find((l) => l.id === sf.locationId)?.name ||
    sf.slug
  );
}

/** A venue's first storefront is the one with the id it has always had. */
const primaryId = (locationId: string) => `sf_${locationId}`;

const byAge = (locationId: string) => (a: Storefront, b: Storefront) => {
  const pa = a.id === primaryId(locationId) ? 0 : 1;
  const pb = b.id === primaryId(locationId) ? 0 : 1;
  return pa - pb || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
};

/** Every storefront at one venue, the first one first. */
export const peekStorefrontsFor = (locationId: string): Storefront[] =>
  resource
    .peek()
    .filter((s) => s.locationId === locationId)
    .sort(byAge(locationId));

const pause = () => new Promise((r) => setTimeout(r, 200));

const validate = (patch: StorefrontPatch, id?: string): Record<string, string> => {
  const errors: Record<string, string> = {};
  const self = id ? resource.peek().find((s) => s.id === id) : undefined;
  if ("slug" in patch) {
    const slug = (patch.slug ?? "").trim();
    if (!slug) errors.slug = "Give the page an address.";
    else if (!SLUG_SHAPE.test(slug)) errors.slug = "Use lowercase letters, numbers and hyphens.";
    else if (resource.peek().some((s) => s.slug === slug && s.id !== id)) {
      errors.slug = `Another storefront is already using /s/${slug}. Choose a different address.`;
    }
  }
  if ("name" in patch) {
    const name = (patch.name ?? "").trim();
    const locationId = patch.locationId ?? self?.locationId;
    if (!name) errors.name = "Give the storefront a name, like Lalbagh Fort — Tours.";
    else if (name.length > 60) errors.name = "Keep the name under 60 characters.";
    else if (
      resource
        .peek()
        .some((s) => s.id !== id && s.locationId === locationId && s.name?.trim().toLowerCase() === name.toLowerCase())
    ) {
      errors.name = `This venue already has a storefront called ${name}. Choose a different name.`;
    }
  }
  return errors;
};

export const listStorefronts = (params?: ListParams): Promise<ApiResult<ListResponse<Storefront>>> =>
  resource.list(params);

export const peekStorefronts = (): Storefront[] => resource.peek();

export const getStorefront = (id: string): Promise<ApiResult<Storefront>> => resource.get(id);

/** Every storefront at a venue, the first one first. Mints nothing: a venue
 *  with no storefront has none, and the list says so. */
export async function listStorefrontsFor(locationId: string): Promise<ApiResult<Storefront[]>> {
  await pause();
  return ok(structuredClone(peekStorefrontsFor(locationId)));
}

/**
 * A venue's first storefront, minted when it has none — for callers that need
 * a page to exist (the editor, opened by venue). A venue that has several gets
 * the first; the list is where the others are reached.
 */
export async function getStorefrontFor(locationId: string): Promise<ApiResult<Storefront>> {
  const existing = peekStorefrontsFor(locationId)[0];
  if (existing) return ok(existing);
  const location = peekLocations().find((l) => l.id === locationId);
  if (!location) return fail(notFoundError("Location"));
  const taken = resource.peek().map((s) => s.slug);
  const ts = new Date().toISOString();
  const row: Storefront = {
    id: primaryId(locationId),
    locationId,
    slug: storefrontSlug(location.name, taken),
    published: false,
    featured: [],
    links: [],
    accent: null,
    createdAt: ts,
    updatedAt: ts,
  };
  resource.peek().push(row);
  return ok(row);
}

/**
 * Add a storefront to a venue.
 *
 * A venue can have several: the same grounds sell tours from one page and
 * court bookings from another, each with its own address and its own list of
 * bookings. The address is unique across the whole business — it is the one
 * thing two pages cannot share — and a taken address is refused in words
 * rather than quietly changed, because an operator who typed one meant it. An
 * address that was not typed is made from the name and numbered until it is
 * free.
 */
export async function createStorefront(input: {
  locationId: string;
  name: string;
  slug?: string;
  /** Which bookings appear; empty is every booking sold online at the venue. */
  featured?: string[];
}): Promise<ApiResult<Storefront>> {
  await pause();
  const location = peekLocations().find((l) => l.id === input.locationId);
  if (!location) return fail(notFoundError("Location"));
  const name = input.name.trim();
  const typed = input.slug?.trim();
  const errors = validate({ name, locationId: input.locationId, ...(typed ? { slug: typed } : {}) });
  if (Object.keys(errors).length) return fail(validationError(errors));
  const taken = resource.peek().map((s) => s.slug);
  const sellable = new Set(
    peekProducts()
      .filter((p) => p.status === "active" && p.channels.includes("online") && p.locationIds.includes(input.locationId))
      .map((p) => p.id),
  );
  const ts = new Date().toISOString();
  const first = !resource.peek().some((s) => s.id === primaryId(input.locationId));
  const row: Storefront = {
    id: first ? primaryId(input.locationId) : `sf_${input.locationId}_${Math.random().toString(36).slice(2, 7)}`,
    locationId: input.locationId,
    name,
    /* Two pages at one venue would otherwise open with the same headline, the venue's
       name. Starting from this page's own name tells them apart until somebody
       writes something better. */
    headline: name,
    slug: typed || storefrontSlug(name, taken),
    published: false,
    featured: (input.featured ?? []).filter((id) => sellable.has(id)),
    links: [],
    accent: null,
    createdAt: ts,
    updatedAt: ts,
  };
  resource.peek().push(row);
  return ok(structuredClone(row));
}

/** "Lalbagh Fort — Tours (copy)", then "(copy 2)" — the first one not taken. */
function copyName(source: Storefront): string {
  const base = storefrontName(source);
  const used = new Set(
    resource
      .peek()
      .filter((s) => s.locationId === source.locationId)
      .map((s) => storefrontName(s).toLowerCase()),
  );
  for (let i = 1; i < 100; i++) {
    const next = i === 1 ? `${base} (copy)` : `${base} (copy ${i})`;
    if (!used.has(next.toLowerCase())) return next;
  }
  return `${base} (copy ${Date.now().toString(36)})`;
}

/**
 * Copy a storefront — its words, colour, links, contact details and list of
 * bookings — as a new page that is NOT online. A copy that went live the
 * moment it was made would put two pages with the same words on the internet
 * before anybody had changed either.
 */
export async function duplicateStorefront(id: string): Promise<ApiResult<Storefront>> {
  await pause();
  const source = resource.peek().find((s) => s.id === id);
  if (!source) return fail(notFoundError("Storefront"));
  const taken = resource.peek().map((s) => s.slug);
  const ts = new Date().toISOString();
  const row: Storefront = {
    ...structuredClone(source),
    id: `sf_${source.locationId}_${Math.random().toString(36).slice(2, 7)}`,
    name: copyName(source),
    slug: storefrontSlug(`${source.slug}-copy`, taken),
    published: false,
    links: source.links.map((l) => ({ ...l, id: `lnk_${Math.random().toString(36).slice(2, 8)}` })),
    createdAt: ts,
    updatedAt: ts,
  };
  resource.peek().push(row);
  return ok(structuredClone(row));
}

/**
 * Delete a storefront.
 *
 * **The only live storefront at a venue cannot be deleted** — take it offline
 * first. Deleting it would close the venue's public page in one press, and
 * that address may already be printed on a poster or sitting in a customer's
 * messages; going offline first is the same result with one more deliberate
 * step, and it can be undone. Anything else (a draft, or one of several live
 * pages) goes at once, after the screen has asked.
 */
export async function deleteStorefront(id: string): Promise<ApiResult<{ id: string }>> {
  await pause();
  const list = resource.peek();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return fail(notFoundError("Storefront"));
  const row = list[idx];
  if (row.published && !list.some((s) => s.id !== id && s.locationId === row.locationId && s.published)) {
    const where = peekLocations().find((l) => l.id === row.locationId)?.name ?? "this venue";
    return fail(conflictError(`This is the only storefront online at ${where}. Take it offline first, then delete it.`));
  }
  list.splice(idx, 1);
  return ok({ id });
}

export function updateStorefront(id: string, patch: StorefrontPatch): Promise<ApiResult<Storefront>> {
  const errors = validate(patch, id);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

/** Publishing refuses a page with nothing on it: a live address that shows an
 *  empty venue is worse than an address that is not live yet. */
export async function setStorefrontPublished(id: string, published: boolean): Promise<ApiResult<Storefront>> {
  const row = resource.peek().find((s) => s.id === id);
  if (!row) return fail(notFoundError("Storefront"));
  if (published && storefrontProducts(row).length === 0) {
    return fail(conflictError("There is nothing to show on this page yet. Add a booking that sells online at this venue."));
  }
  return resource.update(id, { published });
}

/**
 * What appears on a page, in order.
 *
 * The default — an empty `featured` — is every booking sold online at that
 * venue, so an operator who never opens the editor still gets a page that is
 * right. An explicit list is respected exactly, minus anything that has since
 * been archived or taken off the online channel, because a storefront must not
 * advertise something the till would refuse.
 */
export function storefrontProducts(sf: Storefront, all: Product[] = peekProducts()): Product[] {
  const sellable = all.filter(
    (p) => p.status === "active" && p.channels.includes("online") && p.locationIds.includes(sf.locationId),
  );
  if (!sf.featured.length) return sellable;
  const byId = new Map(sellable.map((p) => [p.id, p]));
  return sf.featured.map((id) => byId.get(id)).filter((p): p is Product => !!p);
}

/** Readable, stable product addresses within one venue's page. Derived rather
 *  than stored: a product has no slug on the contract, and minting one here
 *  from a deterministic order means the same booking keeps the same URL. */
export function productSlugs(products: Product[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken: string[] = [];
  for (const p of [...products].sort((a, b) => a.id.localeCompare(b.id))) {
    const slug = storefrontSlug(p.name, taken);
    taken.push(slug);
    out.set(p.id, slug);
  }
  return out;
}

export interface StorefrontPage {
  storefront: Storefront;
  location: Location;
  products: Product[];
  slugs: Record<string, string>;
}

/** Everything a public page needs, in one call — and nothing at all when the
 *  page is not published, so an unpublished address is indistinguishable from
 *  one that was never created. */
export async function getStorefrontPage(slug: string): Promise<ApiResult<StorefrontPage>> {
  const sf = resource.peek().find((s) => s.slug === slug && s.published);
  if (!sf) return fail(notFoundError("Storefront"));
  const location = peekLocations().find((l) => l.id === sf.locationId);
  if (!location) return fail(notFoundError("Location"));
  const products = storefrontProducts(sf);
  return ok({
    storefront: structuredClone(sf),
    location: structuredClone(location),
    products: structuredClone(products),
    slugs: Object.fromEntries(productSlugs(products)),
  });
}
