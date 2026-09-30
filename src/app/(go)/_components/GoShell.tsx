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
  ScanLine,
  Settings,
  Store,
  Ticket,
  UserCheck,
  UserRound,
  Users,
  Layers,
  ShoppingBag,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ModeButton } from "@/components/ThemeProvider";
import { LocaleToggle } from "@/components/LocaleProvider";
import { Logo, Modal } from "@/components/ui";
import { TillSwitcher } from "./TillSwitcher";
import { useApiQuery } from "@/lib/useApi";
import { listProducts } from "@/lib/api";
import { isSlotBased } from "@/lib/schedule";
import { liveSaleCount, onLiveSaleChange } from "../pos/_lib/liveSale";
import { applyTillText, usePrefs } from "@/lib/prefs";

/**
 * How much of the bottom of the screen the floating tab bar owns: it sits 12px
 * off the edge and is 62px tall, plus whatever the device reserves for its
 * home indicator.
 *
 * Every piece of furniture that has to clear the bar measures from here — the
 * ground scrim, the floating cart button — so they cannot drift apart from it
 * or from each other. The content column's own padding is this plus 22px of
 * breathing room, which is the 96px it has always reserved.
 */
const BAR_CLEAR = "12px + 62px + env(safe-area-inset-bottom)";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

// F10 — nav is responsive by form factor, not fixed. Phone + tablet portrait
// get a bottom tab bar (thumb zone); a tablet held in landscape gets an 88px
// left rail (thumbs sit at the screen edges there). No top tab strip anywhere.
const TABS = [
  { href: "/pos", key: "sell", icon: Store },
  { href: "/schedule", key: "schedule", icon: CalendarDays },
  { href: "/scan", key: "scan", icon: ScanLine },
  { href: "/checkin", key: "checkin", icon: UserCheck },
] as const;

const MORE_ITEMS = [
  // The till-design chooser. It lives in More rather than in the tab bar
  // because the tab bar is the shift's muscle memory, and it is the phone's
  // route to the switcher the header shows from `sm` up.
  { key: "tillDesign", icon: Layers, href: "/tills" },
  { key: "shift", icon: Clock, href: "/shift/close" },
  { key: "mySales", icon: Banknote, action: "sales" },
  { key: "quickPass", icon: Ticket, href: "/quick-pass" },
  { key: "myProfile", icon: UserRound, href: "/profile" },
  { key: "switchUser", icon: Users, href: "/login" },
  /* The TILL's settings, not the business's. This used to open
     /settings/business — the whole admin app, mid-shift, in front of a cashier
     who wanted to turn the number pad off. The business settings are one
     explicit link away on that page. */
  { key: "settings", icon: Settings, href: "/till-settings" },
  { key: "help", icon: CircleHelp, action: "help" },
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

  const prefs = usePrefs();
  useEffect(() => {
    applyTillText(prefs.tillText);
    return () => applyTillText(null);
  }, [prefs.tillText]);
  const t = useTranslations("nav");
  const tp = useTranslations("pos");
  const [moreOpen, setMoreOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  // Don't show an empty destination: Schedule only exists for slotted catalogues.
  const hasSlotted = (productsQ.data?.data ?? []).some((p) => isSlotBased(p.bookingType));
  const tabs = TABS.filter((t) => t.href !== "/schedule" || hasSlotted);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tabButton = (tab: (typeof TABS)[number], rail: boolean) => {
    const active = isActive(tab.href);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        onClick={() => { if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className={cn(
          "relative flex min-w-12 flex-1 flex-col items-center justify-center gap-inline rounded-full transition-colors duration-quick active:bg-ember/10",
          rail ? "h-[64px] flex-none" : "h-[54px]",
          active ? "text-brand-foreground" : "text-muted",
        )}
      >
        {/* Selection is a soft ember pill behind the whole tab, the way the
            reference draws it — not a 2px rule on one edge. The heavier icon
            stroke says it a second way, so the tint is never doing it alone. */}
        {active && <span aria-hidden className="absolute inset-0 rounded-full bg-ember/15" />}
        <Icon size={22} strokeWidth={active ? 2.25 : 1.6} className="relative" />
        <span className="relative max-w-full truncate text-[0.6875rem] font-medium">{t(tab.key)}</span>
      </Link>
    );
  };

  const moreButton = (rail: boolean) => (
    <button
      type="button"
      onClick={() => setMoreOpen(true)}
      className={cn(
        "flex min-w-12 flex-1 flex-col items-center justify-center gap-inline rounded-full text-muted transition-colors duration-quick active:bg-ember/10",
        rail ? "h-[64px] flex-none" : "h-[54px]",
      )}
    >
      <Ellipsis size={22} strokeWidth={1.6} />
      <span className="max-w-full truncate text-[0.6875rem] font-medium">{t("more")}</span>
    </button>
  );

  const runItem = (item: (typeof MORE_ITEMS)[number]) => {
    setMoreOpen(false);
    if ("action" in item && item.action === "sales") setSalesOpen(true);
    if ("action" in item && item.action === "help") setHelpOpen(true);
  };

  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* Context bar — business · counter · shift state. Nav does NOT live here. */}
      <header className="flex items-center justify-between gap-tight px-section py-tight">
        <div className="flex min-w-0 items-center gap-tight">
          <Link href="/login" aria-label={tp("shell.signIn")} className="flex h-12 shrink-0 items-center">
            <Logo variant="go" size={30} />
          </Link>
          <span className="hidden shrink-0 rounded-full bg-subtle px-comfortable py-inline text-[0.8125rem] text-muted dark:border dark:border-line dark:bg-transparent sm:block">{tp("counter")}</span>
          <span className="hidden shrink-0 text-[0.8125rem] tabular-nums text-muted sm:block" title={tp("shell.shiftOpenFor", { time: "3:24" })}><span className="sr-only">{tp("shell.shiftOpenFor", { time: "3:24" })}</span><span aria-hidden>⏱ 3:24</span></span>
        </div>
        {/* Only on a till, and only where there is room for it. */}
        <TillSwitcher />
        <span className="flex shrink-0 items-center gap-tight">
          <ModeButton shape="round" />
          {!bare && <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse text-[0.875rem] font-semibold text-inverse-fg" title={tp("shell.myProfile", { name: "Nadia Islam" })} aria-label={tp("shell.myProfile", { name: "Nadia Islam" })}>N</Link>}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Tablet-landscape left rail (88px, icon over label) */}
        {!bare && (
          <nav aria-label={tp("shell.menu")} className="sticky top-0 hidden h-[calc(100vh-64px)] w-[88px] shrink-0 flex-col gap-inline p-tight rail:flex">
            {tabs.map((t) => tabButton(t, true))}
            {moreButton(true)}
          </nav>
        )}

        {/* Content clears the bottom bar (+ home indicator) except in rail mode */}
        {/* BAR_CLEAR + 22px of breathing room. Kept as a class so `rail:pb-0`
            can still reset it — an inline style would beat the variant. */}
        <div className={cn("min-w-0 flex-1", bare ? "pb-section" : "pb-[calc(96px+env(safe-area-inset-bottom))] rail:pb-0")}>{children}</div>
      </div>

      {/* Bottom tab bar — phone + tablet portrait */}
      {/* Content passes BEHIND a floating bar, and the 12px of ground on
          every side of it turns that into a sliced-looking card. A gradient of
          the page colour under the bar lets the list dissolve into the page
          instead. Decorative and inert, so it is out of the a11y tree and
          never eats a tap.

          It used to be a flat 200px whose opaque run ended at 140. The bar's
          top edge is only 74px from the bottom, so the veil ERASED 66px of
          content that was nowhere near it and washed out 60px more above
          that — 126px, 15% of an 844px phone, on every Go screen. That is
          what "the rows below look faded" was.

          The stops are written in the bar's own units now: opaque exactly as
          far as the bar reaches, then a 28px fade. */}
      {!bare && (<>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 rail:hidden"
        style={{
          height: `calc(${BAR_CLEAR} + 28px)`,
          background: `linear-gradient(to top, var(--color-surface) 0, var(--color-surface) calc(${BAR_CLEAR}), transparent calc(${BAR_CLEAR} + 28px))`,
        }}
      />

      {/* A floating pill inset from the screen edges, not a full-bleed strip.
          It clears the home indicator on its own, and the content column above
          reserves its height (86px) so the bar never sits over a row — a fixed
          bar that overlaps content is the standing sticky-nav failure. */}
      <nav
        aria-label={tp("shell.menu")}
        className="fixed inset-x-tight z-40 flex gap-inline rounded-full p-inline go-raised sm:inset-x-comfortable rail:hidden"
        style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        {tabs.map((t) => tabButton(t, false))}
        {moreButton(false)}
      </nav>
      </>)}

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
          className="fixed right-comfortable z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ember-solid text-white go-raised active:scale-95 rail:bottom-comfortable"
          style={{ bottom: `calc(${BAR_CLEAR} + 12px)` }}
        >
          <ShoppingBag size={22} strokeWidth={1.75} aria-hidden />
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-inverse px-1 text-[0.75rem] font-semibold text-inverse-fg"
          >
            {liveCount}
          </span>
        </Link>
      )}

      {/* More — bottom sheet grid */}
      {moreOpen && (
        <div className="fixed inset-0 z-50">
          <div className="go-sheet-scrim absolute inset-0 bg-inverse/40" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="go-sheet-panel absolute inset-x-0 bottom-0 rounded-t-go-lg bg-surface p-section shadow-go-pop" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <div className="mb-section flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lalbagh Heritage Attractions</p>
                <p className="text-[0.8125rem] text-muted">{tp("shell.shiftLine", { counter: tp("counter"), time: "3:24" })}</p>
              </div>
              <div className="flex items-center gap-tight">
                <LocaleToggle />
                <button type="button" aria-label={tp("shell.close")} onClick={() => setMoreOpen(false)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-line">
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            {/* One card of cells divided by hairlines, a picture over a word in
                each — the same drawing as the sell screen, so the menu reads as
                part of the till rather than as a different app. */}
            <div className="go-surface overflow-hidden rounded-go">
            <div className="-mb-px -mr-px grid grid-cols-3 sm:grid-cols-4">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <Icon size={24} strokeWidth={1.5} className="text-muted" aria-hidden />
                    <span className="text-[0.875rem] font-medium">{t(item.key)}</span>
                  </>
                );
                return "href" in item && item.href ? (
                  <Link key={item.key} href={item.href} onClick={() => setMoreOpen(false)} data-focus-inset className="flex h-[5.5rem] flex-col items-center justify-center gap-tight border-b border-r border-line bg-card text-fg transition-colors duration-quick active:bg-ember/10">
                    {inner}
                  </Link>
                ) : (
                  <button key={item.key} type="button" onClick={() => runItem(item)} data-focus-inset className="flex h-[5.5rem] flex-col items-center justify-center gap-tight border-b border-r border-line bg-card text-fg transition-colors duration-quick active:bg-ember/10">
                    {inner}
                  </button>
                );
              })}
            </div>
            </div>

            {/* Appearance and text size used to be drawn here as well. They are
                the till's settings and they now live on the till's own settings
                page, which is what the Settings tile opens — one control, one
                place, rather than the same two in a sheet and on a page. */}
          </div>
        </div>
      )}

      <Modal open={salesOpen} onClose={() => setSalesOpen(false)} title={tp("shell.salesTitle")}>
        <div className="flex flex-col gap-tight font-mono text-sm tabular-nums">
          <div className="flex justify-between border-b border-line pb-tight"><span className="font-sans text-muted">{tp("shell.takings")}</span><span>{formatMoney(1245000)}</span></div>
          <div className="flex justify-between border-b border-line pb-tight"><span className="font-sans text-muted">{tp("shell.sales")}</span><span>9</span></div>
          <div className="flex justify-between"><span className="font-sans text-muted">{tp("shell.cashInDrawer")}</span><span>{formatMoney(485000)}</span></div>
        </div>
        <p className="mt-section text-[0.8125rem] text-muted">{tp("shell.salesNote")}</p>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title={tp("shell.helpTitle")}>
        <p className="text-sm text-muted">{tp.rich("shell.helpBody", { phone: (c) => <span className="font-mono text-fg">{c}</span> })}</p>
      </Modal>
    </div>
  );
}
