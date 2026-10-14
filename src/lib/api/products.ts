import { bundleProductLists, createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  PriceTier,
  PriceTierInput,
  Product,
  ProductInput,
  ProductPatch,
} from "./types";

const resource = createResource<Product>("products", "Product", {
  search: (p, q) =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tiers.some((t) => t.name.toLowerCase().includes(q)),
  filter: (p, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (p.status === "archived" && !f.includeArchived) return false;
    } else if (p.status !== status) {
      return false;
    }
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => a.status.localeCompare(b.status),
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
    updatedAt: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  },
  defaultSort: "name",
});

const genTierId = () => `tier_${globalThis.crypto.randomUUID().slice(0, 8)}`;

function assembleTiers(tiers: PriceTierInput[]): PriceTier[] {
  return tiers.map((t) => ({ ...t, id: t.id ?? genTierId() }));
}

/** Shared validation for create + update. Returns field errors keyed for forms. */
function validate(input: Partial<ProductInput>): Record<string, string> {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) {
    errors.name = "Name is required.";
  }
  if ("tiers" in input) {
    const tiers = input.tiers ?? [];
    if (tiers.length === 0) {
      errors.tiers = "Add at least one price tier.";
    } else {
      tiers.forEach((t, i) => {
        if (!t.name?.trim()) errors[`tiers.${i}.name`] = "Tier name is required.";
        if (!Number.isInteger(t.price) || t.price < 0)
          errors[`tiers.${i}.price`] = "Price must be a whole number ≥ 0.";
      });
    }
  }
  return errors;
}

export const listProducts = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Product>>> => resource.list(params);

export const getProduct = (id: string): Promise<ApiResult<Product>> =>
  resource.get(id);

export function createProduct(input: ProductInput): Promise<ApiResult<Product>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create({
    ...input,
    tiers: assembleTiers(input.tiers),
    archivedAt: null,
  });
}

export function updateProduct(
  id: string,
  patch: ProductPatch,
): Promise<ApiResult<Product>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  const { tiers, ...rest } = patch;
  const next: Partial<Product> = { ...rest };
  if (tiers) next.tiers = assembleTiers(tiers);
  return resource.update(id, next);
}

export const archiveProduct = (id: string): Promise<ApiResult<Product>> =>
  resource.archive(id);

export const peekProducts = () => resource.peek();

// ── The item's own link (/b/<slug>) ─────────────────────────────────────────
// docs/catalog.md §2: every item sold online has its own link, listed on the
// storefront or not. A slug is unique across the business and is minted from
// the name the first time it is needed, so items written before links existed
// still get one without a migration.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

/** Is this slug well formed? Refused in words by the caller when not. */
export const isSlugValid = (slug: string) => SLUG_RE.test(slug) && slug.length <= 60;

/** The slugs in use, each item's own or the one its name would mint. Every
 *  item is listed exactly once, in a stable order, so minting is deterministic. */
function slugsInUse(exceptId?: string): Map<string, string> {
  const used = new Map<string, string>();
  for (const p of resource.peek()) {
    if (p.id === exceptId) continue;
    let s = p.slug ?? slugFromName(p.name);
    if (!p.slug) {
      let n = 2;
      const base = s;
      while (used.has(s)) s = `${base}-${n++}`;
    }
    used.set(s, p.id);
  }
  return used;
}

/** Is a slug free for this item (or for a new one when `exceptId` is absent)? */
export const isSlugFree = (slug: string, exceptId?: string) => !slugsInUse(exceptId).has(slug);

/** The item's link slug: its own, or the one minted from its name. */
export function slugOf(p: Pick<Product, "id" | "slug" | "name">): string {
  if (p.slug) return p.slug;
  for (const [s, id] of slugsInUse()) if (id === p.id) return s;
  return slugFromName(p.name);
}

/** A free slug for a new item named `name`. */
export function freeSlugFor(name: string, exceptId?: string): string {
  const used = slugsInUse(exceptId);
  const base = slugFromName(name);
  let s = base;
  let n = 2;
  while (used.has(s)) s = `${base}-${n++}`;
  return s;
}

/** Is there an item sold online at this link in one of the whole-business demos (The Doers
 *  Club…)? The server holds only the default seed, so without this it would refuse a demo's
 *  own item links as unknown. Slugs are minted the way `slugsInUse` mints them. */
export function demoItemAtSlug(slug: string): boolean {
  for (const list of bundleProductLists()) {
    const used = new Set<string>();
    for (const p of list) {
      let s = p.slug ?? slugFromName(p.name);
      if (!p.slug) {
        let n = 2;
        const base = s;
        while (used.has(s)) s = `${base}-${n++}`;
      }
      used.add(s);
      if (s === slug) return p.status === "active" && p.channels.includes("online");
    }
  }
  return false;
}

/** The item at a link, whatever its state; the caller decides what a visitor
 *  may see (online, active). */
export function productBySlug(slug: string): Product | null {
  const id = slugsInUse().get(slug);
  return id ? (resource.peek().find((p) => p.id === id) ?? null) : null;
}
