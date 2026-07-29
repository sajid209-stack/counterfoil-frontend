import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  Counter,
  CounterInput,
  CounterPatch,
  ListParams,
  ListResponse,
} from "./types";

const resource = createResource<Counter>("counters", "Counter", {
  search: (c, q) => c.name.toLowerCase().includes(q),
  filter: (c, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (c.status === "archived" && !f.includeArchived) return false;
    } else if (c.status !== status) {
      return false;
    }
    if (f.locationId && c.locationId !== f.locationId) return false;
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => a.status.localeCompare(b.status),
  },
  defaultSort: "name",
});

const validate = (input: Partial<CounterInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  if ("locationId" in input && !input.locationId) errors.locationId = "Location is required.";
  return errors;
};

export const listCounters = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Counter>>> => resource.list(params);

export const getCounter = (id: string): Promise<ApiResult<Counter>> =>
  resource.get(id);

export function createCounter(input: CounterInput): Promise<ApiResult<Counter>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateCounter(
  id: string,
  patch: CounterPatch,
): Promise<ApiResult<Counter>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const archiveCounter = (id: string): Promise<ApiResult<Counter>> =>
  resource.archive(id);
