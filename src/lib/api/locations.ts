import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  Location,
  LocationInput,
  LocationPatch,
} from "./types";

const resource = createResource<Location>("locations", "Location", {
  search: (l, q) =>
    l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q),
  filter: (l, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (l.status === "archived" && !f.includeArchived) return false;
    } else if (l.status !== status) {
      return false;
    }
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    city: (a, b) => a.city.localeCompare(b.city),
    status: (a, b) => a.status.localeCompare(b.status),
  },
  defaultSort: "name",
});

const validate = (input: Partial<LocationInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  if ("city" in input && !input.city?.trim()) errors.city = "City is required.";
  return errors;
};

export const listLocations = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Location>>> => resource.list(params);

export const getLocation = (id: string): Promise<ApiResult<Location>> =>
  resource.get(id);

export function createLocation(input: LocationInput): Promise<ApiResult<Location>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateLocation(
  id: string,
  patch: LocationPatch,
): Promise<ApiResult<Location>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const archiveLocation = (id: string): Promise<ApiResult<Location>> =>
  resource.archive(id);
