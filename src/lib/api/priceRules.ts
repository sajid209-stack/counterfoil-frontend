import { createResource, fail, validationError } from "./client";
import type {
  ApiResult,
  ListParams,
  ListResponse,
  PriceRule,
  PriceRuleInput,
  PriceRulePatch,
} from "./types";

const resource = createResource<PriceRule>("priceRules", "Price rule", {
  search: (r, q) => r.name.toLowerCase().includes(q),
  filter: (r, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (r.status === "archived" && !f.includeArchived) return false;
    } else if (r.status !== status) {
      return false;
    }
    if (f.kind && r.kind !== f.kind) return false;
    return true;
  },
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    adjustmentPct: (a, b) => a.adjustmentPct - b.adjustmentPct,
  },
  defaultSort: "name",
});

const validate = (input: Partial<PriceRuleInput>): Record<string, string> => {
  const errors: Record<string, string> = {};
  if ("name" in input && !input.name?.trim()) errors.name = "Name is required.";
  return errors;
};

export const listPriceRules = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<PriceRule>>> => resource.list(params);

export const getPriceRule = (id: string): Promise<ApiResult<PriceRule>> =>
  resource.get(id);

export function createPriceRule(input: PriceRuleInput): Promise<ApiResult<PriceRule>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.create(input);
}

export function updatePriceRule(
  id: string,
  patch: PriceRulePatch,
): Promise<ApiResult<PriceRule>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const archivePriceRule = (id: string): Promise<ApiResult<PriceRule>> =>
  resource.archive(id);
