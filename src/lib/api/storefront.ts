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
  StorefrontInput,
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

const validate = (patch: StorefrontPatch, id?: string): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("slug" in patch) {
    const slug = (patch.slug ?? "").trim();
    if (!slug) errors.slug = "Give the page an address.";
    else if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) errors.slug = "Use lowercase letters, numbers and hyphens.";
    else if (resource.peek().some((s) => s.slug === slug && s.id !== id)) {
      errors.slug = "Another venue is already using this address.";
    }
  }
  return errors;
};

export const listStorefronts = (params?: ListParams): Promise<ApiResult<ListResponse<Storefront>>> =>
  resource.list(params);

export const peekStorefronts = (): Storefront[] => resource.peek();

export const getStorefront = (id: string): Promise<ApiResult<Storefront>> => resource.get(id);

/** The record for a location, minted on first read rather than at seed time —
 *  a location created today has a page too, and nothing has to remember to
 *  create one alongside it. */
export async function getStorefrontFor(locationId: string): Promise<ApiResult<Storefront>> {
  const existing = resource.peek().find((s) => s.locationId === locationId);
  if (existing) return ok(existing);
  const location = peekLocations().find((l) => l.id === locationId);
  if (!location) return fail(notFoundError("Location"));
  const taken = resource.peek().map((s) => s.slug);
  const input: StorefrontInput = {
    locationId,
    slug: storefrontSlug(location.name, taken),
    published: false,
    featured: [],
    links: [],
    accent: null,
  };
  const created = await resource.create(input);
  if (!created.ok) return created;
  // createResource mints its own id; this record's id has to be derivable from
  // the location, because every screen reaches it that way.
  const row = resource.peek().find((s) => s.id === created.data.id);
  if (row) row.id = `sf_${locationId}`;
  return ok({ ...created.data, id: `sf_${locationId}` });
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
