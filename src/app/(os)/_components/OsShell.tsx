"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { BarTitleContext } from "@/lib/barTitle";
import { AccountMenu } from "./AccountMenu";
import { LocationSwitcher } from "./LocationSwitcher";
import { CommandPalette } from "./CommandPalette";
import { MenuButton, MobileNav } from "./MobileNav";
import { LAST_APP_KEY, SettingsChrome } from "./SettingsChrome";
import { Sidebar } from "./Sidebar";
import { DESTINATIONS, pageFor } from "./nav";
import { SETTINGS_GROUPS } from "../settings/_lib/nav";

/*
 * The OS shell — three pieces of CHROME around one page.
 *
 *   rail ─┐                      white (dark: the card colour), no lines
 *   bar  ─┤  between or round them
 *   frame ┘  the page itself: the warm paper ground in a rounded panel that
 *            scrolls on its own while the chrome stands still
 *
 * Below md there is no rail. The phone gets Shopify admin mobile's shape: a top
 * bar that says where you are (the page's glyph and name) with the page's one
 * create action and a round "⋯" for its other actions; and a round menu button
 * floating at the bottom-left that opens everything else in a full-height
 * sheet. No logo and no account in the bar — they are in the menu.
 *
 * Settings, on md and up, adds a second chrome column beside the (folded) rail.
 * See `SettingsChrome`.
 */

/**
 * ⌘ or Ctrl — the hint has to be true on the machine reading it.
 *
 * It was hardcoded to ⌘K, which is wrong on every Windows and Linux desktop,
 * and this product's own operators run Windows. Read through
 * `useSyncExternalStore` rather than an effect so the server render and the
 * first client render agree: the server has no navigator, so it emits the
 * Ctrl form and the client corrects it on hydration if it is a Mac.
 */
const subscribeNothing = () => () => {};
const isMacClient = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function useShortcutKey(): string {
  const mac = useSyncExternalStore(subscribeNothing, isMacClient, () => false);
  return mac ? "⌘K" : "Ctrl K";
}

export function OsShell({ children }: { children: React.ReactNode }) {
  const shortcutKey = useShortcutKey();
  const pathname = usePathname();
  /* Making something — a new booking or event, or editing an event — is a
     task with its own way out; the floating menu button would only compete with
     the form's pinned Back and Continue for the bottom of the screen. */
  const focused = /^\/catalog\/(new(\/|$)|events\/[^/]+\/edit$)/.test(pathname);
  const isSettings = pathname.startsWith("/settings");
  const t = useTranslations("nav");
  const tSettings = useTranslations("settings");
  const operatorQ = useApiQuery(() => getOperator(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  /* The frame's own scroller (md and up). `more` is true while there is content
     below the fold of it, which is what draws the fade at its foot. */
  const frameRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
    // Settings → Preferences writes the same key and says so, so the rail
    // follows the switch without a reload.
    const onPrefs = () => setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
    window.addEventListener("cf-prefs", onPrefs);
    return () => window.removeEventListener("cf-prefs", onPrefs);
  }, []);

  /* Settings' "‹ Settings" goes back to the last page that was not Settings.
     Remembered per tab, so it survives a reload and a trip through several
     settings sections; a tab opened straight onto Tax has none and goes to the
     dashboard. */
  useEffect(() => {
    if (isSettings) return;
    try {
      sessionStorage.setItem(LAST_APP_KEY, pathname);
    } catch {
      /* private mode: Settings falls back to the dashboard */
    }
  }, [pathname, isSettings]);

  // Ctrl/⌘ K opens the command palette, so a page or a settings section is one
  // keyword away from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* From md the page scrolls INSIDE the frame, never on the window. Two jobs:
     keep `more` honest (scroll, resize, and content that grows after data
     arrives) and, on a route change, return the frame to the top the way the
     browser does for the window. */
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const read = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    read();
    return () => {
      el.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    frameRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem("os_sidebar_collapsed", c ? "0" : "1");
      // Tell Preferences, outside this updater so no listener sets state mid-render.
      queueMicrotask(() => window.dispatchEvent(new Event("cf-prefs")));
      return !c;
    });
  }, []);

  /* `[` folds the rail, as it does in Linear and Notion. Only where there IS a
     rail (md and up), never while typing, and never with a modifier — Ctrl [ and
     ⌘ [ are the browser's Back. Not in Settings: the rail is held folded there,
     so the key would change a preference the person cannot see take effect. */
  useEffect(() => {
    if (isSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest('[role="dialog"]'))) return;
      if (!window.matchMedia(MD).matches) return;
      e.preventDefault();
      toggleCollapsed();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapsed, isSettings]);

  /* What the phone's top bar is allowed to say.

     The page name is not the page's H1 — on Dashboard that is the operator's
     business name, on an order it is a reference. It is the name of the
     destination, the same word the rail and the menu use for it, so the bar
     answers "where am I" with the word the person navigated by. A settings
     section names itself rather than all sixteen of them reading "Settings". */
  const section = SETTINGS_GROUPS.flatMap((g) => g.items).find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  const page = pageFor(pathname);
  const pageName = section ? tSettings(`nav.items.${section.key}.title`) : page ? t(page.key) : "Counterfoil";
  const PageIcon = page?.icon ?? LayoutDashboard;

  /* Which venue the console is looking at is a lens on the whole of it, so it
     lives in the bar rather than among a page's own filters — and it governs
     every page except Settings, where a venue is a RECORD being edited rather
     than a lens being looked through. Scoping the list of venues to one venue
     is a circle.

     `/deck` is the other exception: it renders outside this shell entirely. */
  const venueScoped = !isSettings;
  /* Which bar draws the switcher — one of them, never both. Both bars are in
     the DOM at every width and merely hidden by a media query, so rendering it
     in each put two comboboxes named "Venue" on every page, with the invisible
     one FIRST in document order. This app has been caught by that four times;
     the gate is the one PageShell already uses for the same reason. (On a phone
     the venue lives in the menu sheet instead.) */
  const wide = useMediaQuery(MD);

  return (
    /* What the bar is calling this page, published so a page's own heading can
       stand down where it would only say it again — see `lib/barTitle`. */
    <BarTitleContext value={pageName}>
      {/* The chrome's own white is the window's ground from md: the rail and the
          bar are painted ON it, and the frame is the paper panel set into it.
          On a phone the ground is the paper, with the white bar on top. */}
      <div className="flex min-h-screen bg-surface md:h-dvh md:overflow-hidden md:bg-chrome">
        <aside className="sticky top-0 hidden h-screen shrink-0 md:block md:h-dvh">
          <Sidebar collapsed={collapsed} locked={isSettings} onToggleCollapsed={toggleCollapsed} />
        </aside>

        {/* Settings: the second chrome column (and the phone's section sheet). */}
        {isSettings && <SettingsChrome open={settingsOpen} onClose={() => setSettingsOpen(false)} />}

        {/* overflow-x-CLIP, not hidden. `overflow-x: hidden` forces overflow-y to
            `auto`, which makes this element a scroll container — and a sticky
            child then sticks to THIS scrollport while the page scrolls on <html>,
            so the top bar rides up and away. `clip` clips on x exactly the same
            way but creates no scroll container, so overflow-y stays visible and
            sticky resolves against the viewport. */}
        <main className="flex min-w-0 flex-1 flex-col overflow-x-clip md:h-dvh md:overflow-hidden">
          {/* Phone — where you are, then the page's actions.
              Left: the page's glyph and its name (on a settings page the glyph
              is a back chevron that opens the list of sections). Right: the
              page's one create action as an ink "+", and a round "⋯" holding
              its other actions — both portalled in by PageShell. No logo and no
              account: they are in the menu. A <p>, not a heading — the page's
              own <h1> renders in the content below it.

              53px, and it must stay 53: sticky headers further down the page
              (the activity log's day headings) pin themselves to exactly that. */}
          <div data-os-bar="phone" className="glass-navbar sticky top-0 z-30 flex h-[53px] shrink-0 items-center gap-tight bg-chrome px-gutter md:hidden">
            {/* A page with a way back puts it here as an arrow (PageShell's BarBack),
                and the glyph or chevron beside it steps aside — see `peer`. */}
            <div id="os-page-back-mobile" className="peer flex shrink-0 items-center empty:hidden" />
            {isSettings ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label={t("settingsSections")}
                aria-haspopup="dialog"
                data-settings-back-phone
                className="-ml-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors duration-quick hover:bg-fg/[0.06] active:bg-fg/[0.08] peer-[:not(:empty)]:hidden"
              >
                <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
              </button>
            ) : (
              <PageIcon size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted peer-[:not(:empty)]:hidden" />
            )}
            <p className="min-w-0 flex-1 truncate text-[17px] font-semibold text-fg">{pageName}</p>
            <div id="os-page-actions-mobile" className="flex shrink-0 items-center gap-0.5 empty:hidden" />
          </div>

          {/* Desktop — the page's name on the left; the venue and the account on
              the right; one row on the chrome, with no line under it.

              #os-page-header is a portal target, not a prop chain: PageShell is
              rendered by ~30 route files inside {children}, so the alternative
              was threading title/description through every one of them, or a
              context whose node changes identity on every render and would set
              state in a loop. A portal has neither problem, and PageShell stays
              the single owner of what a page header is.

              The bar is app chrome: the page name, the venue, the account. A
              page's own buttons, status and back link render in the page
              (PageShell), never up here. */}
          <div data-os-bar="desktop" className="glass-navbar hidden min-h-14 shrink-0 items-center justify-between gap-major bg-chrome px-gutter py-1.5 md:flex">
            <div id="os-page-header" className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center justify-end gap-tight">
              {/* The venue first: it qualifies everything to its left, so it
                  reads as part of where you are rather than as one more of the
                  page's controls. */}
              {venueScoped && wide && <LocationSwitcher />}
              <AccountMenu name={operatorQ.data?.name} />
            </div>
          </div>

          {/* The FRAME. The rail and the bar above are the chrome; the page is a
              separate rounded panel on the paper ground, and it is the thing that
              scrolls (md and up) — so the chrome never moves and a sticky header
              sticks to the frame's top edge. No border: paper against white
              reads as a panel by itself. Below md there is no rail: the frame is
              the page, edge to edge, and the window scrolls as it always did.
              The fade is a sibling of the scroller, not a child, so it stays put
              while the content moves. */}
          <div className="os-frame relative min-w-0 flex-1 bg-surface md:mb-2 md:mr-2 md:min-h-0 md:overflow-hidden md:rounded-[16px]">
            <div
              ref={frameRef}
              data-os-scroll
              className={cn(
                "os-frame-scroll min-w-0 md:h-full md:overflow-y-auto md:overscroll-contain md:pb-0",
                /* Room for the floating menu button, so it never covers the last row. */
                focused ? "pb-0" : "pb-[var(--os-fab-clear)]",
              )}
            >
              {children}
            </div>
            <div aria-hidden data-more={more} className="os-frame-fade" />
          </div>
        </main>

        {/* Mounted only while open, so it comes up empty by construction. */}
        {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} destinations={DESTINATIONS} shortcutKey={shortcutKey} />}

        {/* Phone: the round menu button and the sheet it opens. Stood down while
            something is being made, so the form's own Back and Continue can
            have the bottom of the screen. */}
        {!focused && <MenuButton open={menuOpen} onOpen={() => setMenuOpen(true)} />}
        <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} business={operatorQ.data?.name} />
      </div>
    </BarTitleContext>
  );
}
