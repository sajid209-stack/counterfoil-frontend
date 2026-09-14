import type { Permission, Role } from "@/lib/api";

/**
 * What a role can be allowed to do, grouped by the part of the business it
 * touches.
 *
 * Roles used to be edited as ten checkboxes in no particular order, with
 * labels like "Scan & validate" and nothing to say what any of them allowed.
 * An admin deciding whether a new hire should be a Cashier or a Supervisor had
 * to guess from the names. Grouping by where the work happens — at the counter,
 * with orders and money, with what you sell, running the business — is the
 * shape the permission screens worth copying settle on, because it is how an
 * operator already thinks about a job.
 *
 * One registry, read by the role editor, the comparison table and every place a
 * role is summarised in words, so a permission added here appears in all of
 * them.
 */
export type PermissionGroupKey = "selling" | "orders" | "catalogue" | "business";

export const PERMISSION_GROUPS: { key: PermissionGroupKey; permissions: Permission[] }[] = [
  { key: "selling", permissions: ["pos.sell", "scan.validate"] },
  { key: "orders", permissions: ["orders.view", "orders.refund"] },
  { key: "catalogue", permissions: ["products.manage", "pricing.manage", "bookings.manage"] },
  { key: "business", permissions: ["reports.view", "staff.manage", "settings.manage"] },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);

/** The message key for a permission: "pos.sell" → "posSell". */
export const permissionKey = (p: Permission): string => p.replace(/\.(\w)/g, (_, c: string) => c.toUpperCase());

export const roleCan = (role: Pick<Role, "permissions">, p: Permission): boolean => role.permissions.includes(p);
