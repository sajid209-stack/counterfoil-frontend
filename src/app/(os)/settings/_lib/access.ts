import type { AccessPolicy, Permission, Role } from "@/lib/api";

/**
 * Who a sign-in rule reaches.
 *
 * "Managers" is a set of powers rather than a job title. An operator can call a
 * role anything, and a Supervisor who can refund is exactly the person whose
 * stolen password costs money — so the rule reads what each role is allowed to
 * do. The Sign-in rules page counts who it applies to and your own Security page
 * says whether it applies to you, and both ask here, so they cannot disagree.
 */
export const ELEVATED: Permission[] = ["orders.refund", "staff.manage", "settings.manage"];

export const isElevated = (role: Pick<Role, "permissions"> | undefined): boolean =>
  !!role && ELEVATED.some((p) => role.permissions.includes(p));

export function twoStepApplies(rule: AccessPolicy["twoStep"], role: Pick<Role, "permissions"> | undefined): boolean {
  if (rule === "everyone") return true;
  if (rule === "managers") return isElevated(role);
  return false;
}
