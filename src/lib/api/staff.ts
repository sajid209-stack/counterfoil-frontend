import { createResource, fail, validationError } from "./client";
import {
  passwordProblem,
  pinProblem,
  storeSecrets,
  verifyPin,
  type PasswordContext,
} from "./staffSecrets";
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

/**
 * What a new person is given to sign in with, besides the invite link.
 * The password and PIN are checked and then kept ONLY as a fake hash in
 * `staffSecrets`; the Staff record carries flags (hasPassword, hasPin…) and
 * never the text, so nothing that renders can show them again.
 */
export interface StaffSecretsInput {
  password?: string;
  /** Ask them to change it the first time they sign in. Defaults to true. */
  mustChangePassword?: boolean;
  pin?: string;
}

const secretErrors = (s: StaffSecretsInput, who: PasswordContext): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (s.password !== undefined) {
    const p = passwordProblem(s.password, who);
    if (p) errors.password = p;
  }
  if (s.pin !== undefined) {
    const p = pinProblem(s.pin);
    if (p) errors.pin = p;
  }
  return errors;
};

export async function createStaff(input: StaffInput, secrets?: StaffSecretsInput): Promise<ApiResult<Staff>> {
  const errors = { ...validate(input), ...(secrets ? secretErrors(secrets, input) : {}) };
  if (Object.keys(errors).length) return fail(validationError(errors));
  const flags: Partial<Staff> = {};
  if (secrets?.password !== undefined) {
    flags.hasPassword = true;
    flags.mustChangePassword = secrets.mustChangePassword ?? true;
  }
  if (secrets?.pin !== undefined) {
    flags.hasPin = true;
    flags.pinLength = secrets.pin.length;
  }
  const res = await resource.create({ ...input, ...flags, lastActiveAt: null });
  if (res.ok && secrets) storeSecrets(res.data.id, { password: secrets.password, pin: secrets.pin });
  return res;
}

/** Set a new password for someone who already has an account ("Set a new password"). */
export async function setStaffPassword(
  id: string,
  password: string,
  mustChangePassword = true,
): Promise<ApiResult<Staff>> {
  const member = resource.peek().find((s) => s.id === id);
  if (!member) return fail({ code: "not_found", message: "Staff member not found." });
  const problem = passwordProblem(password, member);
  if (problem) return fail(validationError({ password: problem }, problem));
  storeSecrets(id, { password });
  return resource.update(id, { hasPassword: true, mustChangePassword });
}

/** Set or replace a till PIN. */
export async function setStaffPin(id: string, pin: string): Promise<ApiResult<Staff>> {
  const problem = pinProblem(pin);
  if (problem) return fail(validationError({ pin: problem }, problem));
  if (!resource.peek().some((s) => s.id === id)) return fail({ code: "not_found", message: "Staff member not found." });
  storeSecrets(id, { pin });
  return resource.update(id, { hasPin: true, pinLength: pin.length });
}

/** How many digits this person's till PIN has — 4 until they set their own. */
export function staffPinLength(id: string): number {
  return resource.peek().find((s) => s.id === id)?.pinLength ?? 4;
}

/** Does this PIN open this person's till? (Mock: the demo PIN applies until they set one.) */
export const checkStaffPin = (id: string, pin: string): boolean => verifyPin(id, pin);

export {
  DEMO_PIN,
  MIN_PASSWORD,
  generatePin,
  passwordIssue,
  passwordProblem,
  passwordStrength,
  pinIssue,
  pinProblem,
} from "./staffSecrets";
export type { PasswordIssue, PinIssue, StrengthKey } from "./staffSecrets";

export function updateStaff(id: string, patch: StaffPatch): Promise<ApiResult<Staff>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return Promise.resolve(fail(validationError(errors)));
  return resource.update(id, patch);
}

export const peekStaff = () => resource.peek();

/**
 * Take back an invite nobody has accepted: the link stops working and the
 * record goes. Someone who has already signed in is suspended instead, so their
 * sales and shifts stay attributed to a person.
 */
export function revokeInvite(id: string): Promise<ApiResult<Staff>> {
  const member = resource.peek().find((s) => s.id === id);
  if (!member || member.status !== "invited") {
    return Promise.resolve(fail(validationError({ status: "Only an invite that hasn't been accepted can be revoked." })));
  }
  return resource.remove(id);
}
