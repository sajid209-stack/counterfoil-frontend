import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  Staff,
  StaffInput,
  StaffPatch,
} from "./types";

const resource = createResource<Staff>("staff", "Staff member", {
  search: (s, q) =>
    s.name.toLowerCase().includes(q) ||
    (s.email?.toLowerCase().includes(q) ?? false),
  filter: (s, f) => {
    if (f.status && s.status !== f.status) return false;
    if (f.roleId && s.roleId !== f.roleId) return false;
    if (f.locationId && !s.locationIds.includes(f.locationId as string)) return false;
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => a.status.localeCompare(b.status),
    lastActiveAt: (a, b) => (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? ""),
  },
  defaultSort: "name",
});

const validate = (input: Partial<StaffInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  // At least one contact method — email or phone.
  if ("email" in input || "phone" in input) {
    const hasEmail = !!input.email?.trim();
    const hasPhone = !!input.phone?.trim();
    if (!hasEmail && !hasPhone)
      errors.email = "Provide an email or a phone number.";
  }
  return errors;
};

export const listStaff = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Staff>>> => resource.list(params);

export const getStaff = (id: string): Promise<ApiResult<Staff>> => resource.get(id);

export function createStaff(input: StaffInput): Promise<ApiResult<Staff>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create({ ...input, lastActiveAt: null });
}

export function updateStaff(id: string, patch: StaffPatch): Promise<ApiResult<Staff>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const peekStaff = () => resource.peek();
