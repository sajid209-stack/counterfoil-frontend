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
import { useActiveCounter } from "@/lib/activeCounter";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getStaff, listCounters, listProducts, peekCounters } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { isSlotBased } from "@/lib/schedule";
import { liveSaleCount, onLiveSaleChange } from "../pos/_lib/liveSale";
import { applyTillText, usePrefs } from "@/lib/prefs";

/**
 * How much of the bottom of the screen the tab bar owns: a docked bar, 64px
 * tall including its top hairline, plus whatever the device reserves for its
 * home indicator.
 *
 * Material 3 draws a bottom navigation bar at 80dp and iOS a tab bar at 49pt;
 * 64 is the till's middle — a 24px icon in a 32px indicator, a 13px label, and
 * a 64px-tall target that clears the 48px touch floor with room for a thumb.
 * It is full width and flush with the edge, like both of them, rather than a
 * floating pill: a floating bar leaves a gap of page on every side that
 * content shows through, and needs a scrim to hide it.
 *
 * Every piece of furniture that has to clear the bar measures from here — the
 * floating cart button, the action bars — so they cannot drift apart from it
 * or from each other. The content column's own padding is this plus 24px.
 */
const BAR_CLEAR = "64px + env(safe-area-inset-bottom)";
import { cn } from "@/lib/cn";
import { NAV_SELECTED_TEXT, NAV_TAB_ACTIVE } from "@/components/ui/navStyles";

/** Tailwind's sm: where the header has room for the page-state picker. */
const SM = "(min-width: 40rem)";

// F10 — nav is responsive by form factor, not fixed. Phone + tablet portrait
// get a bottom tab bar (thumb zone); a tablet held in landscape gets an 88px
// left rail (thumbs sit at the screen edges there). No top tab strip anywhere.
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
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/pos" && (pathname === "/sell" || pathname.startsWith("/sell/")));

  /* One tab, in one anatomy, for the bottom bar and the landscape rail:
       a 24px icon inside a 56 x 32 pill, a 13px label under it, 4px apart —
       Material 3 Expressive's bar (64 tall, a 56-wide indicator).

       The current tab is the one thing that reads at a glance, the way iOS and
       Material both mark it: the indicator is SOLID — ink, with the icon
       knocked out in white (the light pill and dark icon in dark mode) — and
       the label is ink at 600. Every other tab is a grey outline icon over a
       grey label. A pale grey wash was the first version here and on a white
       bar it measured about 1.2:1: a cashier who cannot read the labels could
       not see which tab they were on either. Ink rather than orange, because
       on the till orange means "act": the primary button and what is chosen
       in a sale.

       The whole cell is the target; pressing it presses the pill in. */
  const tabCell = (active: boolean, rail: boolean) =>
    cn(
      "group flex min-w-0 flex-1 flex-col items-center justify-center gap-inline",
      rail ? "h-16 flex-none" : "h-full",
      active ? NAV_SELECTED_TEXT : "font-medium text-muted hover:text-fg",
    );
  const tabPill = (active: boolean) =>
    cn(
      "flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,color,transform] duration-quick group-active:scale-95",
      active ? NAV_TAB_ACTIVE : "group-hover:bg-muted-wash",
    );

  const tabButton = (tab: (typeof TABS)[number], rail: boolean) => {
    const active = isActive(tab.href);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        onClick={() => { if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className={tabCell(active, rail)}
      >
        <span className={tabPill(active)}>
          <Icon size={24} strokeWidth={active ? 2 : 1.75} aria-hidden />
        </span>
        <span className="max-w-full truncate text-sm leading-tight">{t(tab.key)}</span>
      </Link>
    );
  };

  /* More lights while its sheet is open, so the bar always says where you are. */
  const moreButton = (rail: boolean) => (
    <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} aria-haspopup="dialog" className={tabCell(moreOpen, rail)}>
      <span className={tabPill(moreOpen)}>
        <Ellipsis size={24} strokeWidth={moreOpen ? 2 : 1.75} aria-hidden />
      </span>
      <span className="max-w-full truncate text-sm leading-tight">{t("more")}</span>
    </button>
  );

  const runItem = (item: (typeof MORE_ITEMS)[number]) => {
    setMoreOpen(false);
    if ("action" in item && item.action === "help") setHelpOpen(true);
  };

  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* Context bar — counter · shift state. Nav does NOT live here. */}
      {/* One compact row, 56px, and no logo at any width: the till is the
          cashier's, and the counter they are selling at is what the top left
          should say. The counter chip is the FIRST thing in the row and takes
          the room that is left; the theme and the cashier sit on the right.
          The chip truncates; nothing else flexes.

          The row's inset is the page's, so the chip's edge is the edge of what
          is under it: the till's wall is inset 12px, every other Go screen 16.
          On the landscape rail the chip lines up with the rail's own tabs
          (8px) instead, because that is the column it sits above. */}
      <header className={cn("flex items-center gap-tight py-inline rail:px-tight", onATill ? "px-comfortable" : "px-section")}>
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

      <div className="flex min-h-0 flex-1">
        {/* Tablet-landscape left rail (88px, icon over label) */}
        {!bare && (
          <nav aria-label={tp("shell.menu")} className="sticky top-0 hidden h-[calc(100dvh-64px)] w-[88px] shrink-0 flex-col gap-tight p-tight rail:flex">
            {tabs.map((t) => tabButton(t, true))}
            {moreButton(true)}
          </nav>
        )}

        {/* Content clears the bottom bar (+ home indicator) except in rail mode */}
        {/* BAR_CLEAR + 24px of breathing room. Kept as a class so `rail:pb-0`
            can still reset it — an inline style would beat the variant. */}
        <div className={cn("min-w-0 flex-1", bare ? "pb-section" : "pb-[calc(88px+env(safe-area-inset-bottom))] rail:pb-0")}>{face ?? children}</div>
      </div>

      {/* Bottom tab bar — phone + tablet portrait. Docked: full width, flush
          with the bottom edge, a hairline on top, and the device's home-indicator
          inset inside it. Content scrolls under nothing — the bar is opaque — so
          there is no scrim and no gap of page showing around it. The content
          column above reserves its height, so the bar never sits over a row. */}
      {!bare && (
        <nav
          aria-label={tp("shell.menu")}
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] rail:hidden"
          style={{ height: `calc(${BAR_CLEAR})` }}
        >
          {tabs.map((t) => tabButton(t, false))}
          {moreButton(false)}
        </nav>
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
      {liveCount > 0 && !onATill && !bare && (
        <Link
          href="/pos/cart"
          aria-label={t("cartFab", { count: liveCount })}
          className="fixed right-comfortable z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ember-solid text-on-solid go-raised active:scale-95 rail:bottom-comfortable"
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
        open={moreOpen}
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
          {/* One card of cells divided by hairlines, a picture over a word in
              each — the same drawing as the sell screen, so the menu reads as
              part of the till rather than as a different app. */}
          <div className="card-surface overflow-hidden">
            <div className="-mb-px -mr-px grid grid-cols-3 sm:grid-cols-4">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <Icon size={24} strokeWidth={1.5} className="text-muted" aria-hidden />
                    <span className="text-base font-medium">{t(item.key)}</span>
                  </>
                );
                return "href" in item && item.href ? (
                  <Link key={item.key} href={item.href} onClick={() => setMoreOpen(false)} data-focus-inset className="flex h-[5.5rem] flex-col items-center justify-center gap-tight border-b border-r border-line bg-card text-fg transition-colors duration-quick active:bg-muted-wash">
                    {inner}
                  </Link>
                ) : (
                  <button key={item.key} type="button" onClick={() => runItem(item)} data-focus-inset className="flex h-[5.5rem] flex-col items-center justify-center gap-tight border-b border-r border-line bg-card text-fg transition-colors duration-quick active:bg-muted-wash">
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
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
