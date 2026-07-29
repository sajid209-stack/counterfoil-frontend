import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  BookingRule,
  BookingRuleInput,
  BookingRulePatch,
  ListParams,
  ListResponse,
} from "./types";

const resource = createResource<BookingRule>("bookingRules", "Booking rule", {
  search: (r, q) => r.name.toLowerCase().includes(q),
  filter: (r, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (r.status === "archived" && !f.includeArchived) return false;
    } else if (r.status !== status) {
      return false;
    }
    if (f.productId && r.productId !== f.productId) return false;
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    capacity: (a, b) => a.capacity - b.capacity,
  },
  defaultSort: "name",
});

const validate = (input: Partial<BookingRuleInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  if ("capacity" in input && (input.capacity == null || input.capacity < 0))
    errors.capacity = "Capacity must be 0 or more.";
  return errors;
};

export const listBookingRules = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<BookingRule>>> => resource.list(params);

export const getBookingRule = (id: string): Promise<ApiResult<BookingRule>> =>
  resource.get(id);

export function createBookingRule(input: BookingRuleInput): Promise<ApiResult<BookingRule>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateBookingRule(
  id: string,
  patch: BookingRulePatch,
): Promise<ApiResult<BookingRule>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const archiveBookingRule = (id: string): Promise<ApiResult<BookingRule>> =>
  resource.archive(id);
