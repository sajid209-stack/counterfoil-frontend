import {
  Activity,
  Boxes,
  CalendarDays,
  ChartNoAxesColumn,
  FileX,
  Gavel,
  Globe,
  HandCoins,
  LayoutDashboard,
  Palette,
  Percent,
  ReceiptText,
  RotateCcw,
  Settings,
  SquareStack,
  Store,
  Tag,
  Ticket,
  TicketCheck,
  UserRound,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Everywhere an operator can go, in ONE list.
 *
 * The rail, the collapsed rail (its tooltips), the phone's menu sheet and the
 * command palette all draw from this, in this order and under these names. They
 * had drifted into different products — the old More grid once offered two
 * things the rail did not and missed one it did — so the order is written down
 * once and every surface reads it.
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
  /**
   * Pages that belong under this one, Shopify-style: they are drawn indented
   * beneath the parent, label only, and only while the parent or one of them
   * is the page you are on. The parent row still goes to the parent's page.
   * One level deep — a menu inside a menu inside a menu is a site map.
   */
  children?: readonly NavDestination[];
  /**
   * A count drawn on the row — what is WAITING for the venue in the top bar.
   * Names the figure (see `navBadges.ts`); the row draws it as a small
   * neutral pill and nothing at all while it is zero. Neutral, not orange:
   * orange means act, and a number on a menu row is information.
   */
  badge?: "refunds" | "writeOffs";
}

/**
 * The daily destinations, grouped so the rail reads as seven places rather than
 * twelve. A child is something you only go to from its parent's context:
 *  - Activity log is the dashboard's feed, opened out;
 *  - Issued orders are the same sales as Orders, one ticket at a time;
 *  - Inventory and Marketplaces are the catalogue on the shelf and on other
 *    sites — Shopify files Inventory under Products for the same reason;
 *  - Expenses is the money going out, beside the balance it comes out of.
 *
 * Memberships and Promotions are built but hidden — the backend does not
 * implement them yet. See lib/features; restoring the flag restores the row.
 */
export const NAV_MAIN: readonly NavDestination[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    children: [{ href: "/activity", key: "activityLog", icon: Activity }],
  },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  {
    href: "/orders",
    key: "orders",
    icon: ReceiptText,
    /* Money going back, and balances nobody will chase, are answers about
       the same sales, so they sit under Orders (the owner's call, 2026-10-26).
       Each keeps its own count; while the group is closed Orders carries
       their sum (`badgeCount`). */
    children: [
      { href: "/issued-orders", key: "issuedOrders", icon: TicketCheck },
      { href: "/refunds", key: "refunds", icon: RotateCcw, badge: "refunds" },
      { href: "/write-offs", key: "writeOffs", icon: FileX, badge: "writeOffs" },
    ],
  },
  { href: "/customers", key: "customers", icon: UsersRound },
  {
    href: "/catalog",
    key: "catalog",
    icon: Ticket,
    children: [
      { href: "/inventory", key: "inventory", icon: Boxes },
      { href: "/marketplaces", key: "marketplaces", icon: Globe },
    ],
  },
  { href: "/analytics", key: "analytics", icon: ChartNoAxesColumn },
  {
    href: "/finances",
    key: "finances",
    icon: Wallet,
    children: [{ href: "/expenses", key: "expenses", icon: HandCoins }],
  },
];

/** The surfaces you leave OS for, drawn under one collapsible "Other apps"
 *  heading (Shopify's "Sales channels ›"). Each has its own glyph because the
 *  rail collapses to 64px, where every one would otherwise be an identical ↗. */
export const NAV_OPEN: readonly NavDestination[] = [
  { href: "/pos", key: "pos", icon: Store },
  { href: "/deck", key: "deck", icon: SquareStack },
  /* The documentation surface for the design system itself — tokens and
     components, live, in OS and Go and in light and dark. Outside the OS shell
     like the other two, so it carries the same ↗. A palette: not a store and
     not a stack of cards. */
  { href: "/design-system", key: "designSystem", icon: Palette },
];

/** One Settings entry, opening on the first section. Settings has no index
 *  page; every section lists the rest in its own Settings menu. */
export const NAV_SETTINGS: NavDestination = { href: "/settings/business", key: "settings", icon: Settings };

/** Every destination as one flat list — parents, then their children, in rail
 *  order. The command palette and anything that needs "every page" reads this. */
export const flatten = (list: readonly NavDestination[]): NavDestination[] =>
  list.flatMap((d) => [d, ...(d.children ?? [])]);

/** The whole list, flat, in the order every surface shows it. */
export const DESTINATIONS: readonly NavDestination[] = [...flatten(NAV_MAIN), ...NAV_OPEN, NAV_SETTINGS];

/** True when `pathname` is this destination's page or one beneath it. */
export const isAt = (d: NavDestination, pathname: string): boolean =>
  d === NAV_SETTINGS
    ? pathname.startsWith("/settings")
    : pathname === d.href || pathname.startsWith(`${d.href}/`) ||
      /* /tickets redirects to Issued orders, and a ticket record is one of its rows. */
      (d.href === "/issued-orders" && pathname.startsWith("/tickets"));

/** The parent whose group the page belongs to — itself or one of its children. */
export const groupOf = (pathname: string): NavDestination | undefined =>
  NAV_MAIN.find((d) => isAt(d, pathname) || (d.children ?? []).some((c) => isAt(c, pathname)));

/**
 * What the phone's top bar calls a page, and the glyph that stands beside it.
 *
 * The bar names the DESTINATION — the same word the rail and the menu sheet use
 * for it — not the page's own `<h1>`, which on Dashboard is the operator's
 * business name and on an order is a reference. Longest prefix wins, so
 * /settings/profile resolves before /settings. Settings sections name
 * themselves from their own registry (see OsShell); this list covers the rest.
 *
 * It lives beside the destinations because it is the same fact in a second
 * shape: a page and its icon. A destination added to the rail but missing here
 * would show its page with another page's glyph.
 */
export interface PageMeta {
  prefix: string;
  /** The `nav` message key that names it. */
  key: string;
  icon: LucideIcon;
}

export const PAGES: readonly PageMeta[] = [
  { prefix: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { prefix: "/calendar", key: "calendar", icon: CalendarDays },
  { prefix: "/orders", key: "orders", icon: ReceiptText },
  { prefix: "/refunds", key: "refunds", icon: RotateCcw },
  { prefix: "/write-offs", key: "writeOffs", icon: FileX },
  { prefix: "/issued-orders", key: "issuedOrders", icon: TicketCheck },
  /* /tickets redirects to Issued orders, and a ticket record is one of its rows. */
  { prefix: "/tickets", key: "issuedOrders", icon: TicketCheck },
  { prefix: "/activity", key: "activityLog", icon: Activity },
  { prefix: "/finances", key: "finances", icon: Wallet },
  { prefix: "/expenses", key: "expenses", icon: HandCoins },
  { prefix: "/customers", key: "customers", icon: UsersRound },
  { prefix: "/catalog", key: "catalog", icon: Ticket },
  { prefix: "/inventory", key: "inventory", icon: Boxes },
  { prefix: "/marketplaces", key: "marketplaces", icon: Globe },
  { prefix: "/booking-rules", key: "bookingRules", icon: Gavel },
  { prefix: "/pricing", key: "pricing", icon: Tag },
  { prefix: "/memberships", key: "memberships", icon: Percent },
  { prefix: "/promotions", key: "promotions", icon: Percent },
  { prefix: "/analytics", key: "analytics", icon: ChartNoAxesColumn },
  { prefix: "/settings/profile", key: "myProfile", icon: UserRound },
  { prefix: "/settings", key: "settings", icon: Settings },
];

export const pageFor = (pathname: string): PageMeta | undefined =>
  PAGES.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
