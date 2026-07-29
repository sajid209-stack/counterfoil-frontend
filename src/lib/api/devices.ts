import { createResource, fail, validationError } from "./client";
import type { ApiResult, Device, DeviceInput, DevicePatch, ListParams, ListResponse } from "./types";

const resource = createResource<Device>("devices", "Device", {
  search: (d, q) => d.name.toLowerCase().includes(q) || d.pairingCode.toLowerCase().includes(q),
  filter: (d, f) => {
    const status = f.status as string | undefined;
    if (!status || status === "all") {
      if (d.status === "archived" && !f.includeArchived) return false;
    } else if (d.status !== status) {
      return false;
    }
    if (f.counterId && d.counterId !== f.counterId) return false;
    return true;
  },
  sort: { name: (a, b) => a.name.localeCompare(b.name), status: (a, b) => a.status.localeCompare(b.status) },
  defaultSort: "name",
});

const genPairing = () => `PAIR-${String(Math.floor(Date.parse(new Date().toISOString()) % 9000) + 1000)}`;

export const listDevices = (params?: ListParams): Promise<ApiResult<ListResponse<Device>>> => resource.list(params);
export const getDevice = (id: string): Promise<ApiResult<Device>> => resource.get(id);

export function createDevice(input: DeviceInput): Promise<ApiResult<Device>> {
  if (!input.name?.trim()) return Promise.resolve(fail(validationError({ name: "Give the device a name." })));
  return resource.create({ ...input, pairingCode: genPairing(), lastSeenAt: null });
}

export const updateDevice = (id: string, patch: DevicePatch): Promise<ApiResult<Device>> => resource.update(id, patch);
export const archiveDevice = (id: string): Promise<ApiResult<Device>> => resource.archive(id);
