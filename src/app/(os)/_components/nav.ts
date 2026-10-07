import {
  Boxes,
  CalendarDays,
  ChartNoAxesColumn,
  Globe,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Settings,
  SquareStack,
  Store,
  Ticket,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Everywhere an operator can go, in ONE list.
 *
 * The rail, the collapsed rail (its tooltips), the phone's More grid and the
 * command palette all draw from this, in this order and under these names. They
 * had drifted into different products — the More grid once offered two things
 * the rail did not and missed one it did — so the order is written down once
 * and every surface reads it.
 *
 * Three groups, separated by a hairline and spacing rather than by uppercase
 * labels:
 *  - `main`   the daily destinations;
 *  - `open`   the other apps, which LEAVE the admin console (hence the ↗);
 *  - Settings, pinned at the foot of the rail.
 */
export interface NavDestination {
  /** Where it goes. */
  href: string;
  /** The `nav` message key that names it. */
  key: string;
  icon: LucideIcon;
}

/**
 * Memberships and Promotions are built but hidden — the backend does not
 * implement them yet. See lib/features; restoring the flag restores the row.
 */
export const NAV_MAIN: readonly NavDestination[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/orders", key: "orders", icon: ReceiptText },
  { href: "/customers", key: "customers", icon: UsersRound },
  /* One door for everything sold. Bookings and Events were two rows that each
     held half the answer to "what do we sell?". */
  { href: "/catalog", key: "catalog", icon: Ticket },
  /* Beside the catalogue on purpose: one answers "what can somebody buy", the
     other "what is on the shelf", and an operator moves between the two
     constantly. */
  { href: "/inventory", key: "inventory", icon: Boxes },
  /* Beside the catalogue, because that is what it lists: the marketplaces are
     where the same catalogue is sold by somebody else. */
  { href: "/marketplaces", key: "marketplaces", icon: Globe },
  { href: "/analytics", key: "analytics", icon: ChartNoAxesColumn },
  /* Finances is the venue's money with Counterfoil — one balance. */
  { href: "/finances", key: "finances", icon: Wallet },
  /* Expenses is what the venue spends, straight after the money it takes in.
     Not a receipt or a wallet: Orders is already the receipt and Finances the
     wallet, and at 18px a second one is the first one with a different name. */
  { href: "/expenses", key: "expenses", icon: HandCoins },
];

/** The surfaces you leave OS for. Each has its own glyph because the rail
 *  collapses to 64px, where every one would otherwise be an identical ↗. */
export const NAV_OPEN: readonly NavDestination[] = [
  { href: "/pos", key: "pos", icon: Store },
  { href: "/deck", key: "deck", icon: SquareStack },
];

/** One Settings entry, opening on the first section. Settings has no index
 *  page; every section lists the rest in its own Settings menu. */
export const NAV_SETTINGS: NavDestination = { href: "/settings/business", key: "settings", icon: Settings };

/** The whole list, in the order every surface shows it. */
export const DESTINATIONS: readonly NavDestination[] = [...NAV_MAIN, ...NAV_OPEN, NAV_SETTINGS];
