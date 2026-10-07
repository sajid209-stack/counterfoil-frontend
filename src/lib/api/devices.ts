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
 * PAIRING AND READINESS (added with the Add-device workflow)
 *
 * A tablet is registered in the back office with a name and a counter, told who
 * may sign in on it, and then PAIRED on the physical tablet by typing a short
 * code. Staff then sign in on it with their own till PIN. The record keeps the
 * steps honestly:
 *
 *   pairingCode / pairingExpiresAt   the code and when it stops working (15 min)
 *   pairedAt                         null = waiting to pair; ABSENT = an older
 *                                    record, treated as paired
 *   pairDevice(code)                 the tablet's side: finds the device by code
 *                                    and marks it paired; refuses an unknown,
 *                                    expired, already-used or switched-off code
 *   newPairingCode(id)               the manager's side: a fresh code, which
 *                                    ends the old one (and un-pairs the tablet,
 *                                    so a replaced tablet can pair again)
 *   deviceReadiness(device, staff)   "can it be used?": paired, on, on a
 *                                    counter, and at least one person allowed on
 *                                    it who HAS A TILL PIN. Said as a list of
 *                                    what is missing.
 *   whoCanSignInOn(device, staff)    allowed AND has a PIN: the people the
 *                                    tablet's sign-in screen lists.
 *
 * Time here is the demo's clock (see `pairingNow`), never the wall clock, so a
 * code issued now expires 15 minutes of session time later.
 *
 * Rules the api enforces (in words, beside the field): "Only these people" needs
 * at least one person; everyone listed must exist and be active; an owner must
 * exist and be active. Removing the last person from an assigned tablet is
 * refused rather than quietly opening it to everyone.
 */
import { demoNow } from "@/lib/schedule";
import { createResource, delay, fail, validationError } from "./client";
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

// ── pairing codes and the demo clock ───────────────────────────────────────

/** How long a pairing code works, in minutes. */
export const PAIRING_MINUTES = 15;

const BOOT_MS = Date.now();
/**
 * "Now" for pairing: the demo's date and hour, moving forward as the session
 * runs. The demo clock itself is pinned (so seeded dates stay put), which would
 * make a 15-minute code last forever; adding the time since the app opened lets
 * it genuinely expire without ever reading the wall clock for display.
 */
export const pairingNow = (): Date => new Date(demoNow().getTime() + (Date.now() - BOOT_MS));

/** "k7m-4qx", " 482 913 " -> "K7M4QX", "482913". Letters and digits only, upper case. */
export const normalisePairingCode = (code: string): string => code.replace(/[^a-z0-9]/gi, "").toUpperCase();

/** A six-digit code reads as "482 913"; an older code is shown as it is. */
export const formatPairingCode = (code: string): string => {
  const n = normalisePairingCode(code);
  return /^\d{6}$/.test(n) ? `${n.slice(0, 3)} ${n.slice(3)}` : code;
};

const expiryFrom = (now: Date) => new Date(now.getTime() + PAIRING_MINUTES * 60_000).toISOString();

/** A fresh six-digit code nobody else holds (digits: the easiest thing to type on a tablet). */
function genPairing(): string {
  const taken = new Set(resource.peek().map((d) => normalisePairingCode(d.pairingCode)));
  for (let i = 0; i < 100; i++) {
    const c = String(Math.floor(Math.random() * 900_000) + 100_000);
    if (!taken.has(c)) return c;
  }
  return String(Date.now()).slice(-6);
}

/** Pure: has this tablet been paired? An older record without the field counts as paired. */
export const isPaired = (d: Pick<Device, "pairedAt">): boolean => d.pairedAt !== null;

/** Pure: the code has run out. Only meaningful while the tablet is not paired. */
export const pairingExpired = (d: Pick<Device, "pairingExpiresAt">, now: Date = pairingNow()): boolean =>
  !!d.pairingExpiresAt && Date.parse(d.pairingExpiresAt) <= now.getTime();

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
    // A tablet still waiting for its code is not the till yet: a paired one wins.
    .sort(
      (a, b) =>
        Number(isPaired(b)) - Number(isPaired(a)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )[0];
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

/** Pure: has this person a till PIN? (The seed and "Set PIN" both set the flag.) */
export const hasTillPin = (s: Pick<Staff, "hasPin">): boolean => s.hasPin === true;

/** Pure: everyone allowed on the device, with or without a PIN. */
export const peopleAllowedOn = (device: Device, staff: Staff[]): Staff[] =>
  staff.filter((s) => staffAllowedOnDevice(device, s));

/**
 * Pure: who the tablet's sign-in screen lists — allowed on it AND with a till
 * PIN. A person without a PIN cannot sign in however they are listed.
 */
export const whoCanSignInOn = (device: Device, staff: Staff[]): Staff[] =>
  peopleAllowedOn(device, staff).filter(hasTillPin);

export type DeviceGap = "off" | "counter" | "pair" | "people";

export interface DeviceReadiness {
  /** Paired, on, on a counter, and someone can sign in on it. */
  ready: boolean;
  /** What is missing, in the order a manager would fix it. */
  gaps: DeviceGap[];
  /** "waiting" = a code is out; "expired" = it ran out and needs a new one. */
  pairing: "paired" | "waiting" | "expired";
  /** Allowed on the tablet, with or without a PIN. */
  allowed: Staff[];
  /** Allowed and able to sign in. */
  canSignIn: Staff[];
  /** Allowed but cannot sign in until they have a till PIN. */
  noPin: Staff[];
}

/** Pure: can this device be used, and if not, what is missing? */
export function deviceReadiness(device: Device, staff: Staff[], now: Date = pairingNow()): DeviceReadiness {
  const allowed = peopleAllowedOn(device, staff);
  const canSignIn = allowed.filter(hasTillPin);
  const noPin = allowed.filter((s) => !hasTillPin(s));
  const pairing = isPaired(device) ? "paired" : pairingExpired(device, now) ? "expired" : "waiting";
  const gaps: DeviceGap[] = [];
  if (device.status !== "active") gaps.push("off");
  if (!device.counterId) gaps.push("counter");
  if (pairing !== "paired") gaps.push("pair");
  if (canSignIn.length === 0) gaps.push("people");
  return { ready: gaps.length === 0, gaps, pairing, allowed, canSignIn, noPin };
}

/** Pure: the sentence that says why nobody can sign in, or null if somebody can. */
export function signInProblem(device: Device, staff: Staff[]): string | null {
  const { allowed, canSignIn, noPin } = deviceReadiness(device, staff);
  if (canSignIn.length > 0) return null;
  if (allowed.length === 0) {
    return device.counterId
      ? "No one is allowed to sign in on it yet. Choose who can, or add people to this counter in Team."
      : "Choose a counter first, so we can tell who works there.";
  }
  return noPin.length === 1
    ? `${noPin[0].name} is allowed but has no till PIN. Set a PIN in Team, or choose someone else.`
    : `${noPin.length} people are allowed but none has a till PIN. Set a PIN in Team, or choose someone else.`;
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

/**
 * Add a tablet. It starts UNPAIRED with a six-digit code that works for
 * PAIRING_MINUTES. A counter is required, and so is someone who can actually
 * sign in on it (allowed AND with a till PIN) — refused in words, per field.
 */
export function createDevice(input: DeviceInput): Promise<ApiResult<Device>> {
  const errors: Record<string, string> = {};
  if (!input.name?.trim()) errors.name = "Give the device a name.";
  if (!input.counterId) errors.counterId = "Choose the counter this tablet sells at.";
  const people = peekStaff();
  Object.assign(errors, checkDeviceAccess({ access: input.access, staffIds: input.staffIds, ownerStaffId: input.ownerStaffId }, people));
  if (Object.keys(errors).length === 0) {
    const probe = { access: "venue", staffIds: [], ownerStaffId: null, ...input } as Device;
    const problem = signInProblem(probe, people);
    if (problem) errors.staffIds = problem;
  }
  if (Object.keys(errors).length) return Promise.resolve(refuse(errors));
  return resource.create({
    access: "venue",
    staffIds: [],
    ownerStaffId: null,
    ...input,
    pairingCode: genPairing(),
    pairingExpiresAt: expiryFrom(pairingNow()),
    pairedAt: null,
    lastSeenAt: null,
  });
}

/**
 * The tablet's side: type the code, and the device it belongs to is paired.
 * Case, spaces and dashes do not matter. Every refusal says what to do next.
 */
export async function pairDevice(code: string): Promise<ApiResult<Device>> {
  await delay();
  const norm = normalisePairingCode(code);
  const refuseCode = (message: string) => fail<Device>(validationError({ code: message }, message));
  if (norm.length < 4) return refuseCode("Type the code shown on the Add device screen in the back office.");
  const device = resource.peek().find((d) => d.status !== "archived" && normalisePairingCode(d.pairingCode) === norm);
  if (!device) return refuseCode("We don't know that code. Check the numbers and try again.");
  if (isPaired(device)) {
    return refuseCode("That code has already been used. To pair a different tablet, ask a manager to show a new code.");
  }
  const now = pairingNow();
  if (pairingExpired(device, now)) return refuseCode("That code has run out. Ask a manager to show a new code.");
  if (device.status !== "active") return refuseCode(`${device.name} is turned off. Ask a manager to turn it on in Settings, Devices.`);
  if (!device.counterId) return refuseCode(`${device.name} is not on a counter yet. Ask a manager to choose one in Settings, Devices.`);
  const at = now.toISOString();
  return resource.update(device.id, { pairedAt: at, lastSeenAt: at, pairingExpiresAt: null });
}

/**
 * The manager's side: a new code. The old one stops working, and the tablet is
 * "waiting to pair" again, which is also how a replaced tablet is paired.
 */
export async function newPairingCode(id: string): Promise<ApiResult<Device>> {
  const d = resource.peek().find((x) => x.id === id);
  if (!d || d.status === "archived") return fail({ code: "not_found", message: "Device not found." });
  return resource.update(id, {
    pairingCode: genPairing(),
    pairingExpiresAt: expiryFrom(pairingNow()),
    pairedAt: null,
  });
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
