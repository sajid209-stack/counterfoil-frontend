/* One entry per till route: which skeleton shape draws its loading state, and
 * what its empty state says. The copy lives in the "screens" messages under
 * empty.<id>.* (en + bn).
 *
 * Left out on purpose, because they never draw a screen of their own:
 *   /pos/payment   bounces to /pos (the cash step moved into the sell screen)
 *   /pair          redirects to /login/pair
 * A route with no entry falls back to a generic pos-list skeleton, so even
 * those are never blank.
 *
 * "self" as an action means "this page, live": in the page-state preview it
 * returns to the real page. It is used where the empty state is only "look
 * again" or "start filling it in" (the sell wall, scan, the cash count).
 */
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock,
  Inbox,
  KeyRound,
  ReceiptText,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  TabletSmartphone,
  Ticket,
  UserCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import type { ScreenEntry } from "./types";

export const GO_ENTRIES: readonly ScreenEntry[] = [
  /* The sell screens: the wall of things to sell, then the sale itself. */
  { pattern: "/pos", surface: "go", shape: "pos-wall", empty: { id: "go-sell", icon: Store, action: "self" } },
  { pattern: "/pos/cart", surface: "go", shape: "pos-list", empty: { id: "go-cart", icon: ShoppingBag, action: "/pos" } },
  { pattern: "/pos/complete", surface: "go", shape: "pos-list", empty: { id: "go-complete", icon: ReceiptText, action: "/pos" } },
  { pattern: "/sell", surface: "go", shape: "pos-wall", empty: { id: "go-sell-scroll", icon: Store, action: "self" } },
  { pattern: "/sell/complete", surface: "go", shape: "pos-list", empty: { id: "go-sell-complete", icon: ReceiptText, action: "/sell" } },
  { pattern: "/classic", surface: "go", shape: "pos-wall", empty: { id: "go-classic", icon: Store, action: "self" } },
  { pattern: "/classic/complete", surface: "go", shape: "pos-list", empty: { id: "go-classic-complete", icon: ReceiptText, action: "/classic" } },

  /* The day: the board you book from, who is arriving, what was booked. */
  { pattern: "/schedule", surface: "go", shape: "pos-board", empty: { id: "go-schedule", icon: CalendarDays, action: "/pos" } },
  { pattern: "/checkin", surface: "go", shape: "pos-list", empty: { id: "go-checkin", icon: UserCheck, action: "/schedule" } },
  { pattern: "/reservations", surface: "go", shape: "pos-list", empty: { id: "go-reservations", icon: ClipboardList, action: "/pos" } },
  { pattern: "/my-sales", surface: "go", shape: "pos-list", empty: { id: "go-my-sales", icon: Banknote, action: "/pos" } },
  { pattern: "/my-requests", surface: "go", shape: "pos-list", empty: { id: "myRequests", icon: Inbox, action: "/pos" } },

  /* The gate. */
  { pattern: "/scan", surface: "go", shape: "pos-scan", empty: { id: "go-scan", icon: ScanLine, action: "self" } },

  /* Forms: a pass, the cash count at either end of a shift, the cashier's own pages. */
  { pattern: "/quick-pass", surface: "go", shape: "pos-form", empty: { id: "go-quick-pass", icon: Ticket, action: "/pos" } },
  { pattern: "/shift/open", surface: "go", shape: "pos-form", empty: { id: "go-shift-open", icon: Wallet, action: "self" } },
  { pattern: "/shift/close", surface: "go", shape: "pos-form", empty: { id: "go-shift-close", icon: Clock, action: "self" } },
  { pattern: "/profile", surface: "go", shape: "pos-form", empty: { id: "go-profile", icon: UserRound, action: "/login" } },
  { pattern: "/till-settings", surface: "go", shape: "pos-form", empty: { id: "go-till-settings", icon: Settings, action: "/pos" } },

  /* Signing in and pairing a tablet. Both are doors, so they are the tightest
     previews: the shape is the form the page really is, and the empty state is
     the real "nobody can sign in" / "not paired yet" case. */
  { pattern: "/login", surface: "go", shape: "pos-form", empty: { id: "go-login", icon: KeyRound, action: "/login/pair" } },
  { pattern: "/login/pair", surface: "go", shape: "pos-form", empty: { id: "go-pair", icon: TabletSmartphone, action: "self" } },
];
