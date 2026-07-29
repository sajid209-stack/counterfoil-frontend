import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  Resource,
  ResourceInput,
  ResourcePatch,
} from "./types";

const resource = createResource<Resource>("resources", "Resource", {
  search: (r, q) => r.name.toLowerCase().includes(q),
  filter: (r, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (r.status === "archived" && !f.includeArchived) return false;
    } else if (r.status !== status) {
      return false;
    }
    if (f.locationId && r.locationId !== f.locationId) return false;
    return true;
  },
  sort: { name: (a, b) => a.name.localeCompare(b.name), status: (a, b) => a.status.localeCompare(b.status) },
  defaultSort: "name",
});

const validate = (input: Partial<ResourceInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Give it a name (e.g. Field 1).";
  return errors;
};

export const listResources = (params?: ListParams): Promise<ApiResult<ListResponse<Resource>>> =>
  resource.list(params);
export const getResource = (id: string): Promise<ApiResult<Resource>> => resource.get(id);
export const peekResources = (): Resource[] => resource.peek();

export function createResourceRecord(input: ResourceInput): Promise<ApiResult<Resource>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updateResource(id: string, patch: ResourcePatch): Promise<ApiResult<Resource>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const archiveResource = (id: string): Promise<ApiResult<Resource>> => resource.archive(id);

/** The operator's plural word for their resources (for nav/labels). Falls back
 *  to "Resources" when there are none or the naming is mixed. */
export function resourceNounPlural(): string {
  const rs = resource.peek().filter((r) => r.status !== "archived");
  if (rs.length === 0) return "Resources";
  const first = rs[0].nounPlural;
  return rs.every((r) => r.nounPlural === first) ? first : "Resources";
}
