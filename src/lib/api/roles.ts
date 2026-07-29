import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  Role,
  RoleInput,
  RolePatch,
} from "./types";

const resource = createResource<Role>("roles", "Role", {
  search: (r, q) => r.name.toLowerCase().includes(q),
  sort: { name: (a, b) => a.name.localeCompare(b.name) },
  defaultSort: "name",
});

const validate = (input: Partial<RoleInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  if ("discountLimitPct" in input && input.discountLimitPct != null) {
    const v = input.discountLimitPct;
    if (!Number.isInteger(v) || v < 0 || v > 100)
      errors.discountLimitPct = "Discount limit must be a whole percent 0–100.";
  }
  return errors;
};

export const listRoles = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Role>>> => resource.list(params);

export const getRole = (id: string): Promise<ApiResult<Role>> => resource.get(id);

export function createRole(input: RoleInput): Promise<ApiResult<Role>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateRole(id: string, patch: RolePatch): Promise<ApiResult<Role>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}
