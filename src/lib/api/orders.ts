import { createResource } from "./client";
import type { ApiResult, ListParams, ListResponse, Order } from "./types";

const resource = createResource<Order>("orders", "Order", {
  search: (o, q) =>
    o.reference.toLowerCase().includes(q) ||
    (o.customerName?.toLowerCase().includes(q) ?? false),
  filter: (o, f) => {
    if (f.status && o.status !== f.status) return false;
    if (f.channel && o.channel !== f.channel) return false;
    if (f.locationId && o.locationId !== f.locationId) return false;
    return true;
  },
  sort: {
    reference: (a, b) => a.reference.localeCompare(b.reference),
    total: (a, b) => a.total - b.total,
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
    status: (a, b) => a.status.localeCompare(b.status),
  },
  defaultSort: "createdAt",
});

export const listOrders = (
  params?: ListParams,
): Promise<ApiResult<ListResponse<Order>>> => resource.list(params);

export const getOrder = (id: string): Promise<ApiResult<Order>> => resource.get(id);

/** Full refund — flips status; the real endpoint would also reverse payments. */
export const refundOrder = (id: string): Promise<ApiResult<Order>> =>
  resource.update(id, { status: "refunded" });

/** Read-only access for reports/aggregation within the api layer. */
export const peekOrders = (): Order[] => resource.peek();
