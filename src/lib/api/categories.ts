import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  Category,
  CategoryInput,
  CategoryPatch,
  ListParams,
  ListResponse,
} from "./types";

const resource = createResource<Category>("categories", "Category", {
  search: (c, q) => c.name.toLowerCase().includes(q),
  filter: (c, f) =>
    f.active === undefined || c.active === f.active,
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    sortOrder: (a, b) => a.sortOrder - b.sortOrder,
  },
  defaultSort: "sortOrder",
});

const validate = (input: Partial<CategoryInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  return errors;
};

export const listCategories = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Category>>> => resource.list(params);

export const getCategory = (id: string): Promise<ApiResult<Category>> =>
  resource.get(id);

export function createCategory(input: CategoryInput): Promise<ApiResult<Category>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<ApiResult<Category>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}
