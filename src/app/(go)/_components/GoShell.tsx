"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CircleHelp,
  Clock,
  Ellipsis,
  Inbox,
  Palette,
  ScanLine,
  Settings,
  Store,
  Ticket,
  UserCheck,
  UserRound,
  Users,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/LocaleProvider";
import { Modal, Sheet } from "@/components/ui";
import { PageStatePicker, PreviewChip, ScreenPreview } from "@/components/screens";
import { useScreenState } from "@/lib/screenState";
import { useMediaQuery } from "@/lib/useMedia";
import { TillSwitcher } from "./TillSwitcher";
import { CounterPicker } from "./CounterPicker";
import { ActionTile, TileGrid, tileClass } from "./Tiles";
import { useActiveCounter } from "@/lib/activeCounter";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getStaff, listCounters, listProducts, peekCounters } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { isSlotBased } from "@/lib/schedule";
import { liveSaleCount, onLiveSaleChange } from "../pos/_lib/liveSale";
import { applyTillText, usePrefs } from "@/lib/prefs";

/**
 * How far the top of the tab bar stands from the bottom of the screen: the
 * floating pill's 64px, the 12px of page it floats above, and whatever the
 * device reserves for its home indicator.
 *
 * The bar is a dark pill inset 12px from the sides and the bottom, the way the
 * grocery and delivery apps draw theirs: five tabs in fixed places, the current
 * one a light pill that names itself and the others plain outline icons. The
 * content slides behind the 12px of page around it, which is why nothing the
 * till draws is parked in that band — the column's own padding is this plus
 * 12px, and the cart button and the action bars measure from here.
 *
 * Every piece of furniture that has to clear the bar measures from this one
 * number — the floating cart button, the action bars, the sale dock — so they
 * cannot drift apart from it or from each other.
 */
const BAR_CLEAR = "76px + env(safe-area-inset-bottom)";
import { cn } from "@/lib/cn";
import { DesktopSidebar } from "./shell/DesktopSidebar";
import { RAIL_QUERY, useRailCollapsed } from "./shell/rail";

/** Tailwind's sm: where the header has room for the page-state picker. */
const SM = "(min-width: 40rem)";

// F10 — nav is responsive by form factor, not fixed. Phone + tablet portrait
// get a bottom tab bar (thumb zone); a tablet held in landscape, a laptop or a
// monitor (the `rail:` variant) gets a white sidebar with the counter at its
// head (shell/DesktopSidebar). No top tab strip anywhere.
const TABS = [
  { href: "/pos", key: "sell", icon: Store },
  { href: "/schedule", key: "schedule", icon: CalendarDays },
  { href: "/scan", key: "scan", icon: ScanLine },
  { href: "/checkin", key: "checkin", icon: UserCheck },
] as const;

/* In the order a shift reaches for them: the day's tools first, then the
   till's settings and help, and the design tools — which are for whoever is
   setting the till up, not for the person selling — last. */
const MORE_ITEMS = [
  { key: "mySales", icon: Banknote, href: "/my-sales" },
  /* What this person asked a manager for, and what was said. Its label lives
     with the rest of the refund words (refunds.pos.myRequests). */
  { key: "myRequests", icon: Inbox, href: "/my-requests" },
  { key: "shift", icon: Clock, href: "/shift/close" },
  { key: "quickPass", icon: Ticket, href: "/quick-pass" },
  { key: "switchUser", icon: Users, href: "/login" },
  { key: "myProfile", icon: UserRound, href: "/profile" },
  /* The TILL's settings, not the business's. This used to open
     /settings/business — the whole admin app, mid-shift, in front of a cashier
     who wanted to turn the number pad off. The business settings are one
     explicit link away on that page. */
  { key: "settings", icon: Settings, href: "/till-settings" },
  { key: "help", icon: CircleHelp, action: "help" },
  /* The till-design chooser. It lives in More rather than in the tab bar
     because the tab bar is the shift's muscle memory, and it is the phone's
     route to the switcher the header shows from `sm` up. */
  { key: "tillDesign", icon: Layers, href: "/tills" },
  /* The design system's reference, opened on the Go configuration. */
  { key: "designSystem", icon: Palette, href: "/design-system?product=go" },
] as const;

export function GoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /*
   * How many lines the sale in progress holds. An external store, read the way
   * this codebase reads external stores — the server has no sessionStorage, so
   * its snapshot is 0 and the button simply appears after hydration rather
   * than mismatching. sessionStorage fires no event in the tab that wrote it,
   * which is why `liveSale` announces its own changes.
   */
  const liveCount = useSyncExternalStore(onLiveSaleChange, liveSaleCount, () => 0);
  const path = pathname;

  /*
   * The till's text size.
   *
   * Set on <html>, because a root font size is the browser's own scaling
   * mechanism and every size in the till was converted off pixels so that it
   * would follow. Applied here rather than in `applyPrefs` because it is
   * route-scoped: the admin app still carries pixel sizes, so scaling it would
   * move some of its text and not the rest. `PREFS_BOOT` sets the same value
   * before the first paint on a cold load, from the same list of paths, so
   * there is no flick into size.
   *
   * The cleanup is the point of the effect: leaving the till puts the document
   * back, so a cashier who set 20px does not find the reports at 20px too.
   */
  /* The other till designs are tills too: a cart button on /sell would point
     at /pos/cart, which is a different sale. It belongs on the screens that
     have no till on them at all. */
  const onATill = ["/pos", "/sell", "/classic"].some((x) => path === x || path.startsWith(x + "/"));
  /* Signing in is a door, not a room: no tabs, no rail, no cart and nobody's
     initial in the corner. With the tab bar on the PIN screen, anyone could
     walk past sign-in with one tap on Sell. */
  const bare = path === "/login" || path.startsWith("/login/");

  /* The developer's page-state preview, as in the admin shell: anything but Live
     replaces the page with the face of the chosen state (skeleton, empty page,
     error…) and the chrome stays exactly where it is. */
  const screenState = useScreenState();
  const face = screenState === "live" ? null : <ScreenPreview state={screenState} pathname={pathname} />;
  /* The picker is rendered in exactly ONE place. Below sm the header has no
     room beside the counter, so it lives in the More sheet and the header
     carries only the chip that exits a preview; from sm up it sits in the
     header. Two copies behind `hidden` would put two "Page state" comboboxes
     in the DOM, the invisible one first — the trap the admin shell avoids the
     same way. */
  const roomy = useMediaQuery(SM);
  /* The desktop shell. The phone header and the bottom bar are drawn below it
     only, the sidebar's pickers on it only: a counter picker or a page-state
     picker is in the DOM once, never twice with one hidden. */
  const rail = useMediaQuery(RAIL_QUERY);
  const collapsed = useRailCollapsed();

  const prefs = usePrefs();
  useEffect(() => {
    applyTillText(prefs.tillText);
    return () => applyTillText(null);
  }, [prefs.tillText]);
  /* The Go product theme lives on <html> so that portalled dialogs, menus and
     toasts get it too. The boot script sets it before the first paint on a
     full load; this keeps it in step on client-side navigation into and out of
     the till. */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.product = "go";
    return () => {
      delete root.dataset.product;
    };
  }, []);
  const t = useTranslations("nav");
  const tp = useTranslations("pos");
  const tr = useTranslations("refunds");
  const moreLabel = (key: (typeof MORE_ITEMS)[number]["key"]) => (key === "myRequests" ? tr("pos.myRequests") : t(key));
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const { counter: activeCounter } = useActiveCounter(countersQ.data?.data ?? peekCounters());
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /* Who is signed in and whose business this is, read from the records rather
     than typed here: a hard-coded name is a name that is wrong for every other
     operator. */
  const operatorQ = useApiQuery(() => getOperator(), []);
  const staffQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const myName = staffQ.data?.name ?? "";
  const myInitial = myName.trim().charAt(0).toUpperCase() || "•";
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  // Don't show an empty destination: Schedule only exists for slotted catalogues.
  const hasSlotted = (productsQ.data?.data ?? []).some((p) => isSlotBased(p.bookingType));
  const tabs = TABS.filter((t) => t.href !== "/schedule" || hasSlotted);

  /* The scrolling till is the Sell tab too: it is another design of the same
     job, and a till with no tab lit leaves a cashier asking where they are. */
  /* Pages opened from More light no tab of their own, so More wears the light
     pill while you are on one of them: the bar always says where you are. */
  const onMorePage = (["/my-sales", "/my-requests", "/quick-pass", "/till-settings", "/reservations", "/profile", "/shift"] as const).some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const moreLit = moreOpen || onMorePage;
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/pos" && (pathname === "/sell" || pathname.startsWith("/sell/")));

  /* The floating bar's tab. Five of them share the pill, so a tab is as wide
     as it needs to be and no wider: an outline icon in a 44px-or-wider target,
     and the current one grown to hold its name. The width is animated through
     flex-grow, which a browser can interpolate and "width: auto" it cannot. */
  const barTab = (active: boolean) =>
    cn(
      "flex h-12 min-w-11 basis-0 items-center justify-center gap-inline overflow-hidden rounded-full transition-[flex-grow,background-color,color] duration-standard ease-counterfoil motion-reduce:transition-none",
      active
        ? "bg-neutral-50 px-tight text-neutral-950"
        : "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 active:scale-95 dark:hover:bg-neutral-700",
    );
  const barTabGrow = (active: boolean) => ({ flexGrow: active ? 2.5 : 1 });

  /* The floating bar's tab: an outline icon, and — only for the current
     tab — a light pill that holds the icon AND its name. The inactive tabs
     are named for a screen reader by their label. While the More sheet is
     open the pill is More's: one light pill at a time, so the bar never has
     to find room for two labels. (A desktop has the sidebar instead.) */
  const tabButton = (tab: (typeof TABS)[number]) => {
    const active = isActive(tab.href);
    const Icon = tab.icon;
    const lit = active && !moreLit;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        aria-label={lit ? undefined : t(tab.key)}
        onClick={() => { if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className={barTab(lit)}
        style={barTabGrow(lit)}
      >
        <Icon size={24} strokeWidth={lit ? 2 : 1.5} aria-hidden className="shrink-0" />
        {lit && <span className="min-w-0 truncate text-sm font-semibold leading-none">{t(tab.key)}</span>}
      </Link>
    );
  };

  /* More lights while its sheet is open, so the bar always says where you are. */
  const moreButton = () => (
    <button
      type="button"
      onClick={() => setMoreOpen(true)}
      aria-expanded={moreOpen}
      aria-haspopup="dialog"
      aria-label={moreLit ? undefined : t("more")}
      aria-current={onMorePage ? "page" : undefined}
      className={barTab(moreLit)}
      style={barTabGrow(moreLit)}
    >
      <Ellipsis size={24} strokeWidth={moreLit ? 2 : 1.5} aria-hidden className="shrink-0" />
      {moreLit && <span className="min-w-0 truncate text-sm font-semibold leading-none">{t("more")}</span>}
    </button>
  );

  const runItem = (item: (typeof MORE_ITEMS)[number]) => {
    setMoreOpen(false);
    if ("action" in item && item.action === "help") setHelpOpen(true);
  };

  return (
    <div className="flex min-h-full flex-col bg-surface rail:flex-row">
      {/* The desktop shell (the `rail:` variant): a white sidebar that carries
          the counter, the destinations, the shift and the person. It replaces
          the header row and the icon rail below. Not on /login, which is a
          door and gets nothing. */}
      {!bare && (
        <DesktopSidebar
          tabs={tabs}
          isActive={isActive}
          collapsed={collapsed}
          saleCount={liveCount}
          showSaleRow={liveCount > 0 && !onATill}
          onHelp={() => setHelpOpen(true)}
          myName={myName}
          myRoleId={staffQ.data?.roleId}
          rail={rail}
        />
      )}

      {/* On a desktop one hairline runs under the sidebar header, the page header
          (or the wall toolbar) and the sale panel header: the three share a 64px
          band, and this draws the line across the columns beside the sidebar. */}
      <div className={cn("flex min-w-0 flex-1 flex-col", !bare && "relative rail:before:pointer-events-none rail:before:absolute rail:before:inset-x-0 rail:before:top-16 rail:before:z-10 rail:before:h-px rail:before:bg-hairline")}>
        {/* Context bar — counter · shift state. Nav does NOT live here.
            Phones and tablets held upright only: on a desktop the sidebar
            carries the counter and the person, and each page draws its own
            title. (Sign-in keeps this bar at every width, as a bare row.) */}
        {/* One compact row, 56px, and no logo at any width: the till is the
            cashier's, and the counter they are selling at is what the top left
            should say. The counter chip is the FIRST thing in the row and takes
            the room that is left; the theme and the cashier sit on the right.
            The chip truncates; nothing else flexes.

            The row's inset is the page's, so the chip's edge is the edge of what
            is under it: the till's wall is inset 12px, every other Go screen 16. */}
        {(bare || !rail) && (
          <header className={cn("flex items-center gap-tight py-inline", onATill ? "px-comfortable" : "px-section", !bare && "rail:hidden")}>
            {bare ? <span className="flex-1" /> : <CounterPicker saleCount={liveCount} />}
            {/* Beside the counter, 48px like every other control on the till. */}
            {roomy ? <PageStatePicker size="lg" /> : <PreviewChip compact />}
            {!bare && (
              <span className="hidden shrink-0 text-sm tabular-nums text-muted sm:block" title={tp("shell.shiftOpenFor", { time: "3:24" })}><span className="sr-only">{tp("shell.shiftOpenFor", { time: "3:24" })}</span><span aria-hidden>⏱ 3:24</span></span>
            )}
            <span className="flex-1 max-sm:hidden" />
            {/* Only on a till, and only where there is room for it. */}
            <TillSwitcher />
            <span className="flex shrink-0 items-center gap-tight">
              {!bare && <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse text-base font-semibold text-inverse-fg" title={tp("shell.myProfile", { name: myName })} aria-label={tp("shell.myProfile", { name: myName })}>{myInitial}</Link>}
            </span>
          </header>
        )}

        {/* Content clears the bottom bar (+ home indicator) below the sidebar.
            One place for every Go page: 76px of bar plus 28px of room, so the
            last thing on any screen ends clear of the bar with space to spare
            (it used to be 12px, which read as touching). A page with its own
            dock above the bar adds the dock's height itself. Kept as a class so
            `rail:pb-0` can still reset it — an inline style would beat the
            variant. */}
        <div className={cn("min-w-0 flex-1", bare ? "pb-section" : "pb-[calc(104px+env(safe-area-inset-bottom))] rail:pb-0")}>{face ?? children}</div>
      </div>

      {/* Bottom tab bar — phone + tablet portrait. A floating dark pill, 12px
          in from the sides and the bottom (and the home indicator), 64px tall.
          Five tabs in fixed places; the current one is a light pill holding the
          icon and its name, the rest are outline icons. In dark mode the pill is
          a raised neutral-800 so it still reads against the near-black page.
          It stands off the edge, so page shows round it: the column above
          reserves its height plus a gap, and nothing is ever parked behind it.
          The pill is capped and centred on a tablet held upright. */}
      {!bare && !rail && (
        <>
          {/* The page's own colour from the top of the pill to the bottom of the
              screen, with a short fade above it, so a list dissolves into the
              bar instead of showing through the 12px of page round the pill.
              Under the pill (z-40) and under a dock (z-30), whose own backdrop
              covers this one where there is a dock. Not drawn on the landscape
              rail, which has no pill. */}
          <span
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 z-20 rail:hidden"
            style={{ height: `calc(${BAR_CLEAR})` }}
          >
            <span className="absolute inset-0 bg-surface" />
            <span className="absolute inset-x-0 bottom-full h-6 bg-linear-to-t from-surface to-transparent" />
          </span>
          <nav
            aria-label={tp("shell.menu")}
            className="fixed inset-x-comfortable z-40 mx-auto flex h-16 max-w-md items-center rounded-full border border-line bg-neutral-950 px-1.5 py-1.5 shadow-go-pop dark:border-strong dark:bg-neutral-800 rail:hidden"
            style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
          >
            {tabs.map((t) => tabButton(t))}
            {moreButton()}
          </nav>
        </>
      )}

      {/* A sale in progress is reachable from anywhere.
          `PosScreen` is mounted only on /pos and /pos/cart, so a cashier who
          steps over to Schedule or the gate has no way back to the sale but
          the Sell tab — and until the sale was made to survive that trip,
          there was nothing to go back TO. It appears only when there IS a
          sale: a cart button over an empty cart is furniture.
          Not on the till itself, where the summary bar already says the same
          thing in more words — two cart affordances on one screen is the
          redundancy the cart work removed once already. And it measures its
          clearance from BAR_CLEAR, because stacking fixed furniture without
          accounting for what is already there is how a control ends up
          untappable. */}
      {liveCount > 0 && !onATill && !bare && !rail && (
        <Link
          href="/pos/cart"
          aria-label={t("cartFab", { count: liveCount })}
          className="fixed right-comfortable z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ember-solid text-on-solid go-raised active:scale-95 rail:hidden"
          style={{ bottom: `calc(${BAR_CLEAR} + 12px)` }}
        >
          <ShoppingBag size={22} strokeWidth={1.75} aria-hidden />
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-inverse px-1 text-sm font-semibold text-inverse-fg"
          >
            {liveCount}
          </span>
        </Link>
      )}

      {/* More — the shared bottom sheet: dialog role, focus trap, Escape, scrim and
          drag-down all come from the kit, so this menu behaves like every other
          sheet in the product. */}
      <Sheet
        open={moreOpen && !rail}
        onClose={() => setMoreOpen(false)}
        title={operatorQ.data?.name ?? t("more")}
        closeLabel={tp("shell.close")}
      >
        <div className="bg-surface p-section">
          <div className="mb-section flex items-center justify-between gap-tight">
            {/* TODO(data): the elapsed shift time has no reader yet (no shift record
                carries its start), so the 3:24 in this line is still the demo value. */}
            <p className="min-w-0 text-sm text-muted">{tp("shell.shiftLine", { counter: activeCounter?.name ?? tp("counter"), time: "3:24" })}</p>
            <LocaleToggle />
          </div>
          {/* Every destination is its own tile, the icon in a soft round over a
              word — the same drawing as the wall, so the menu reads as part of
              the till. Links are composed here from the tile classes (a tile is
              a button; a destination should stay a link). */}
          <TileGrid cols={3} className="sm:grid-cols-4">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              return "href" in item && item.href ? (
                <Link key={item.key} href={item.href} onClick={() => setMoreOpen(false)} className={tileClass({ className: "h-[5.5rem] gap-tight" })}>
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-subtle text-fg [&_svg]:size-5">
                    <Icon strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-medium leading-tight">{moreLabel(item.key)}</span>
                </Link>
              ) : (
                <ActionTile key={item.key} icon={<Icon strokeWidth={1.5} />} label={moreLabel(item.key)} onClick={() => runItem(item)} />
              );
            })}
          </TileGrid>
          {/* The page-state preview, for phones: the header has no room for it. */}
          {!roomy && <div className="mt-section"><PageStatePicker size="lg" full /></div>}
          {/* Appearance and text size live on the till settings page, which is what
              the Settings tile opens — one control, one place. */}
        </div>
      </Sheet>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title={tp("shell.helpTitle")}>
        <p className="text-base text-muted">{tp.rich("shell.helpBody", { phone: (c) => <span className="font-mono text-fg">{c}</span> })}</p>
      </Modal>
    </div>
  );
}
