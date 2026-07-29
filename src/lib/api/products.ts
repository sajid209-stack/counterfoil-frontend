import { createResource, fail, validationError } from "./client";
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
    if (f.categoryId && p.categoryId !== f.categoryId) return false;
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
