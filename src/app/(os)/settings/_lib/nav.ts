import {
  BadgeCheck,
  Building2,
  CreditCard,
  Gift,
  Globe,
  LandPlot,
  LockKeyhole,
  MapPin,
  MessageSquare,
  MonitorSmartphone,
  Percent,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FEATURES } from "@/lib/features";
import { useApiQuery } from "@/lib/useApi";
import { listResources } from "@/lib/api";

export type SettingsGroupKey = "business" | "money" | "people" | "messages" | "account";
export type SettingsItemKey =
  | "business"
  | "locations"
  | "counters"
  | "resources"
  | "categories"
  | "storefront"
  | "payments"
  | "tax"
  | "memberships"
  | "loyalty"
  | "team"
  | "roles"
  | "signIn"
  | "devices"
  | "notifications"
  | "security"
  | "preferences";

export interface SettingsItem {
  key: SettingsItemKey;
  href: string;
  icon: LucideIcon;
}

export interface SettingsGroup {
  key: SettingsGroupKey;
  items: SettingsItem[];
}

/**
 * The one list of settings.
 *
 * The index and the rail both read this, so a section added here appears in
 * both — and cannot be reachable from one and missing from the other, which is
 * how Categories, Resources and Security came to sit in the old tab strip while
 * the old hub left them out. (The phone's More sheet carries one Settings entry
 * and hands over to the index.)
 *
 * Grouped by what an operator is deciding about rather than by entity type, and
 * with the person's own settings last, under a description that says they only
 * affect you: a password is yours, a tax rate is the business's, and a screen
 * that files them side by side makes every change look like it applies to
 * everyone.
 *
 * Memberships and loyalty stay behind their feature flags, exactly as the rest
 * of the product hides them until the backend can keep them.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "business",
    items: [
      { key: "business", href: "/settings/business", icon: Building2 },
      { key: "locations", href: "/settings/locations", icon: MapPin },
      { key: "counters", href: "/settings/counters", icon: Store },
      { key: "resources", href: "/settings/resources", icon: LandPlot },
      { key: "categories", href: "/settings/categories", icon: Tags },
      { key: "storefront", href: "/settings/storefront", icon: Globe },
    ],
  },
  {
    key: "money",
    items: [
      { key: "payments", href: "/settings/payments", icon: CreditCard },
      { key: "tax", href: "/settings/tax", icon: Percent },
      ...(FEATURES.memberships ? [{ key: "memberships" as const, href: "/settings/memberships", icon: BadgeCheck }] : []),
      ...(FEATURES.loyalty ? [{ key: "loyalty" as const, href: "/settings/loyalty", icon: Gift }] : []),
    ],
  },
  {
    key: "people",
    items: [
      { key: "team", href: "/settings/team", icon: Users },
      { key: "roles", href: "/settings/roles", icon: UserCog },
      { key: "signIn", href: "/settings/sign-in", icon: LockKeyhole },
      { key: "devices", href: "/settings/devices", icon: MonitorSmartphone },
    ],
  },
  {
    key: "messages",
    items: [{ key: "notifications", href: "/settings/notifications", icon: MessageSquare }],
  },
  {
    key: "account",
    items: [
      { key: "security", href: "/settings/security", icon: ShieldCheck },
      { key: "preferences", href: "/settings/preferences", icon: SlidersHorizontal },
    ],
  },
];

/** A section is current on its own page and on anything filed under it. */
export const isCurrentSettingsHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * The operator's own word for their resources — "Lanes", "Fields" — when every
 * active resource agrees on it. A turf with fields and a lane would otherwise be
 * labelled with whichever came first, so a mixed set falls back to the generic.
 */
export function resourceNoun(resources: { nounPlural: string }[]): string | null {
  return resources.length && resources.every((r) => r.nounPlural === resources[0].nounPlural)
    ? resources[0].nounPlural
    : null;
}

export function useResourceNoun(): string | null {
  const q = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  return resourceNoun(q.data?.data ?? []);
}
