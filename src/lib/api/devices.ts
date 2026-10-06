/*
 * STORY — who can use a till tablet.
 *
 * A manager pairs a tablet to a counter. Until now ANY team member could pick
 * their name on that tablet's PIN screen, so a cashier's name was one tap from a
 * till they were never rostered on, and a phone someone carries as their own was
 * as open as the tablet bolted to the gate.
 *
 * A device now answers "who can use it" in one of two ways:
 *
 *   access "venue" (or absent)  Everyone who works at the counter it is paired
 *                               to — active staff whose counter assignments
 *                               include that counter. Exactly the old behaviour,
 *                               so no existing tablet changes.
 *   access "assigned"           Only the people in `staffIds`, wherever they
 *                               are otherwise rostered (a museum cashier covering
 *                               a fort shift can be added to the fort tablet).
 *
 * A device may also have an `ownerStaffId` — "Nadia's phone". An owned device is
 * always "assigned" with exactly that one person, and the PIN screen opens
 * straight on their PIN pad.
 *
 * Where it shows:
 *   Settings > Devices > a device   "Who can use it": the choice, a multi-select
 *                                   of people, and the own-device picker; saved
 *                                   with the page's Save bar.
 *   Settings > Devices (list)       each row says who ("Nadia, Rafi +2", or
 *                                   "Everyone at <venue>").
 *   Settings > Team > a person      "Devices": the ones they can use or own,
 *                                   Assign device and Remove, acting at once
 *                                   with Undo. A device open to everyone says so.
 *   Settings > Team (list)          a device count per person.
 *   Go > /login                     lists only the people allowed on THIS tablet.
 *                                   "This tablet" is the device paired to the
 *                                   active counter; if several share one counter
 *                                   the first ACTIVE one by date added (then id)
 *                                   decides. A limited list says so, and says where
 *                                   to change it. A tablet-less counter behaves as
 *                                   "venue". Nobody outside the list can be chosen,
 *                                   and the "someone else" door is closed when the
 *                                   list is limited.
 *
 * Rules the api enforces (in words, beside the field): "Only these people" needs
 * at least one person; everyone listed must exist and be active; an owner must
 * exist and be active. Removing the last person from an assigned tablet is
 * refused rather than quietly opening it to everyone.
 */
import { createResource, fail, validationError } from "./client";
import { peekStaff } from "./staff";
import type { ApiResult, Device, DeviceInput, DevicePatch, ListParams, ListResponse, Staff } from "./types";

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

export const peekDevices = () => resource.peek();

// ── who can use a device (see the story above) ─────────────────────────────

/** The device's access as the rules read it: absent means "venue". */
export const deviceAccess = (d: Pick<Device, "access" | "ownerStaffId">): "venue" | "assigned" =>
  d.ownerStaffId ? "assigned" : (d.access ?? "venue");

/** Pure: may this person pick their name on this device? */
export function staffAllowedOnDevice(device: Device | undefined, person: Staff): boolean {
  if (person.status !== "active") return false;
  if (!device) return true;
  if (deviceAccess(device) === "assigned") {
    return device.ownerStaffId ? device.ownerStaffId === person.id : (device.staffIds ?? []).includes(person.id);
  }
  return !!device.counterId && person.counterIds.includes(device.counterId);
}

/**
 * Pure: the tablet the till at `counterId` is. Several tablets can share a
 * counter; the first active one (earliest added, then by id) decides, so the
 * answer never changes by accident when the list is re-sorted.
 */
export function deviceForCounter(devices: Device[], counterId: string): Device | undefined {
  return devices
    .filter((d) => d.counterId === counterId && d.status === "active")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}

export interface SignInList {
  /** The tablet that decided, if the counter has one. */
  device: Device | undefined;
  /** True when the list is narrower than "everyone at the counter". */
  limited: boolean;
  /** Who may pick their name, in the order given. */
  people: Staff[];
}

/** Pure: who can sign in at the till standing at `counterId`. */
export function whoCanSignIn(devices: Device[], staff: Staff[], counterId: string): SignInList {
  const device = deviceForCounter(devices, counterId);
  const people = staff.filter((s) =>
    device ? staffAllowedOnDevice(device, s) : s.status === "active" && s.counterIds.includes(counterId),
  );
  return { device, limited: !!device && deviceAccess(device) === "assigned", people };
}

/** Pure: the devices a person can use, split by how. */
export function devicesForStaff(devices: Device[], person: Staff) {
  const live = devices.filter((d) => d.status !== "archived");
  const owned = live.filter((d) => d.ownerStaffId === person.id);
  const assigned = live.filter(
    (d) => deviceAccess(d) === "assigned" && d.ownerStaffId !== person.id && (d.staffIds ?? []).includes(person.id),
  );
  const open = live.filter((d) => deviceAccess(d) === "venue" && staffAllowedOnDevice(d, person));
  return { owned, assigned, open, count: owned.length + assigned.length + open.length };
}

/** Pure: access fields that are valid together, or the words that say why not. */
export function checkDeviceAccess(
  next: Pick<Device, "access" | "staffIds" | "ownerStaffId">,
  staff: Staff[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const byId = new Map(staff.map((s) => [s.id, s]));
  if (next.ownerStaffId) {
    const o = byId.get(next.ownerStaffId);
    if (!o) errors.ownerStaffId = "That person is not on the team.";
    else if (o.status !== "active") errors.ownerStaffId = `${o.name} can't sign in right now, so they can't own a device.`;
    return errors;
  }
  if (next.access === "assigned") {
    const ids = next.staffIds ?? [];
    if (ids.length === 0) {
      errors.staffIds = "Choose at least one person, or switch back to everyone who works here.";
    } else if (ids.some((id) => !byId.has(id))) {
      errors.staffIds = "Someone you chose is not on the team any more.";
    } else {
      const bad = ids.map((id) => byId.get(id)!).find((s) => s.status !== "active");
      if (bad) errors.staffIds = `${bad.name} can't sign in right now. Take them off the list or unblock them first.`;
    }
  }
  return errors;
}

const refuse = <T,>(errors: Record<string, string>): ApiResult<T> =>
  fail(validationError(errors, Object.values(errors)[0]));

/** Fold a patch into a device's access fields so the three always agree. */
function normaliseAccess(current: Device, patch: DevicePatch): DevicePatch {
  if (!("access" in patch) && !("staffIds" in patch) && !("ownerStaffId" in patch)) return patch;
  const owner = "ownerStaffId" in patch ? (patch.ownerStaffId ?? null) : (current.ownerStaffId ?? null);
  if (owner) return { ...patch, ownerStaffId: owner, access: "assigned", staffIds: [owner] };
  const access = patch.access ?? current.access ?? "venue";
  const staffIds = [...new Set(patch.staffIds ?? current.staffIds ?? [])];
  return { ...patch, ownerStaffId: null, access, staffIds };
}

export function createDevice(input: DeviceInput): Promise<ApiResult<Device>> {
  if (!input.name?.trim()) return Promise.resolve(fail(validationError({ name: "Give the device a name." })));
  const errors = checkDeviceAccess({ access: input.access, staffIds: input.staffIds, ownerStaffId: input.ownerStaffId }, peekStaff());
  if (Object.keys(errors).length) return Promise.resolve(refuse(errors));
  return resource.create({ access: "venue", staffIds: [], ownerStaffId: null, ...input, pairingCode: genPairing(), lastSeenAt: null });
}

export function updateDevice(id: string, patch: DevicePatch): Promise<ApiResult<Device>> {
  const current = resource.peek().find((d) => d.id === id);
  if (!current) return resource.update(id, patch);
  const folded = normaliseAccess(current, patch);
  if (folded !== patch) {
    const errors = checkDeviceAccess({ ...current, ...folded }, peekStaff());
    if (Object.keys(errors).length) return Promise.resolve(refuse(errors));
  }
  return resource.update(id, folded);
}
export const archiveDevice = (id: string): Promise<ApiResult<Device>> => resource.archive(id);

/**
 * Let one more person use a tablet. On a tablet open to everyone at its counter
 * this does NOT narrow it to the one person: it becomes "Only these people",
 * made of everyone who could use it already plus the newcomer, so nobody loses
 * a till by someone else being added. The caller offers Undo with the previous
 * record.
 */
export function assignDeviceToStaff(deviceId: string, staffId: string): Promise<ApiResult<Device>> {
  const d = resource.peek().find((x) => x.id === deviceId);
  if (!d) return Promise.resolve(fail({ code: "not_found", message: "Device not found." }));
  if (d.ownerStaffId && d.ownerStaffId !== staffId) {
    return Promise.resolve(refuse({ staffIds: "That is someone's own device. Take it off them first." }));
  }
  const people = peekStaff();
  const base = deviceAccess(d) === "assigned" ? (d.staffIds ?? []) : people.filter((s) => staffAllowedOnDevice(d, s)).map((s) => s.id);
  return updateDevice(deviceId, { access: "assigned", staffIds: [...new Set([...base, staffId])] });
}

/** Take one person off a tablet. Refused if it would leave nobody on it. */
export function removeStaffFromDevice(deviceId: string, staffId: string): Promise<ApiResult<Device>> {
  const d = resource.peek().find((x) => x.id === deviceId);
  if (!d) return Promise.resolve(fail({ code: "not_found", message: "Device not found." }));
  if (deviceAccess(d) !== "assigned") {
    return Promise.resolve(refuse({ staffIds: "This tablet is open to everyone who works here. Choose \"Only these people\" on the device to limit it." }));
  }
  const rest = (d.staffIds ?? []).filter((id) => id !== staffId);
  if (rest.length === 0) {
    return Promise.resolve(refuse({ staffIds: "That is the only person on this tablet. Add someone else first, or open it to everyone who works here." }));
  }
  return updateDevice(deviceId, { access: "assigned", staffIds: rest, ownerStaffId: d.ownerStaffId === staffId ? null : (d.ownerStaffId ?? null) });
}
