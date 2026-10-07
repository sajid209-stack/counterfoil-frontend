"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, Check, Ellipsis, LayoutDashboard, ReceiptText, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoMark, Sheet } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { BarTitleContext } from "@/lib/barTitle";
import { AccountMenu } from "./AccountMenu";
import { LocationSwitcher } from "./LocationSwitcher";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { DESTINATIONS, NAV_MAIN, NAV_OPEN, NAV_SETTINGS, type NavDestination } from "./nav";
import { SETTINGS_GROUPS } from "../settings/_lib/nav";

// F10 — on mobile the hamburger drawer is gone: a bottom tab bar carries the
// four daily destinations, and More opens a full-height destination grid.
// Desktop is unchanged: the ink sidebar stays.
const MOBILE_TABS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/orders", key: "orders", icon: ReceiptText },
  { href: "/catalog", key: "catalog", icon: Ticket },
] as const;

/*
 * Everywhere a phone can go is the desktop rail's own list (`./nav`), in its
 * own order and under its own names. The More grid below draws it in the same
 * three groups the rail does — the daily destinations, the other apps, Settings.
 *
 * The four in MOBILE_TABS repeat there on purpose: `nav-hierarchy` separates
 * primary from secondary navigation, and a person who opens More looking for
 * Orders should find it rather than be told to close the sheet.
 */

/**
 * What the phone's top bar is allowed to say.
 *
 * The owner asked for the bar to carry "the current page name", and the page
 * name is not the page's H1 — on Dashboard that is the operator's business
 * name, on an order it is a reference. It is the name of the destination, the
 * same word the tab bar and the rail use for it, so the bar answers "where am
 * I" with the word the person navigated by.
 *
 * Longest prefix wins, which is why /settings/profile resolves before /settings
 * and why every settings section names itself rather than all
 * sixteen of them reading "Settings".
 */
const PAGE_NAMES: readonly { prefix: string; key: string }[] = [
  { prefix: "/dashboard", key: "dashboard" },
  { prefix: "/calendar", key: "calendar" },
  { prefix: "/orders", key: "orders" },
  { prefix: "/finances", key: "finances" },
  { prefix: "/expenses", key: "expenses" },
  { prefix: "/customers", key: "customers" },
  { prefix: "/catalog", key: "catalog" },
  { prefix: "/inventory", key: "inventory" },
  { prefix: "/marketplaces", key: "marketplaces" },
  { prefix: "/booking-rules", key: "bookingRules" },
  { prefix: "/pricing", key: "pricing" },
  { prefix: "/memberships", key: "memberships" },
  { prefix: "/promotions", key: "promotions" },
  { prefix: "/analytics", key: "analytics" },
  { prefix: "/settings/profile", key: "myProfile" },
  { prefix: "/settings", key: "settings" },
] as const;

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
     task with its own way out; the phone's tab bar would only compete with the
     form's pinned Back and Continue for the bottom of the screen. */
  const focused = /^\/catalog\/(new(\/|$)|events\/[^/]+\/edit$)/.test(pathname);
  const t = useTranslations("nav");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const operatorQ = useApiQuery(() => getOperator(), []);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // The bar firms up once anything has scrolled under it. Passive listener,
  // and it only ever flips a boolean — no layout is read on scroll.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
    // Settings → Preferences writes the same key and says so, so the rail
    // follows the switch without a reload.
    const onPrefs = () => setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
    window.addEventListener("cf-prefs", onPrefs);
    return () => window.removeEventListener("cf-prefs", onPrefs);
  }, []);

  // Search is the rail's field; Ctrl/⌘ K opens the same command palette,
  // so a page or a settings section is one keyword away from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    // First read on the next frame rather than synchronously in the effect
    // body — a sync setState here cascades a render, and the frame also lets a
    // browser-restored scroll position settle before we read it.
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
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
     ⌘ [ are the browser's Back. */
  useEffect(() => {
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
  }, [toggleCollapsed]);


  const isActive = (href: string) => {
    // Settings is lit on every section, not only the one its door opens on.
    const path = href.startsWith("/settings/") ? "/settings" : href.split("?")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  const tabActive = (href: string) => isActive(href) && !moreOpen;

  // A settings section names itself; everything else uses its nav word.
  const section = SETTINGS_GROUPS.flatMap((g) => g.items).find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  const page = PAGE_NAMES.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  const pageName = section ? tSettings(`nav.items.${section.key}.title`) : page ? t(page.key) : "Counterfoil";

  /* Which venue the console is looking at is a lens on the whole of it, so it
     lives in the bar rather than among a page's own filters — and it governs
     every page except Settings, where a venue is a RECORD being edited rather
     than a lens being looked through. Scoping the list of venues to one venue
     is a circle.

     `/deck` is the other exception: it renders outside this shell entirely. */
  const venueScoped = !pathname.startsWith("/settings");
  /* Which bar draws the switcher — one of them, never both. Both bars are in
     the DOM at every width and merely hidden by a media query, so rendering it
     in each put two comboboxes named "Venue" on every page, with the invisible
     one FIRST in document order. This app has been caught by that four times;
     the gate is the one PageShell already uses for the same reason. */
  const wide = useMediaQuery(MD);

  /* One tile of the More grid. Same size and shape for every destination; the
     current page carries a tick, and an app that leaves the console carries ↗. */
  const moreTile = (d: NavDestination, leaves = false) => {
    const active = isActive(d.href);
    const Icon = d.icon;
    return (
      <li key={d.key} className="contents">
        <Link
          href={d.href}
          data-more-tile={d.key}
          aria-current={active ? "page" : undefined}
          onClick={() => setMoreOpen(false)}
          className={cn(
            "relative flex h-[5.25rem] flex-col items-center justify-center gap-tight rounded-sm border transition-colors duration-quick active:bg-ember/10",
            active ? "border-ember bg-ember/10 text-fg" : "border-line bg-card text-fg",
          )}
        >
          {active && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ember-solid text-white">
              <Check size={11} strokeWidth={3} />
            </span>
          )}
          {leaves && <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="absolute right-1.5 top-1.5 text-muted" />}
          <Icon size={22} strokeWidth={1.5} className={active ? "text-brand-foreground" : "text-muted"} />
          <span className="px-inline text-center text-[12px] font-medium leading-tight">{t(d.key)}</span>
        </Link>
      </li>
    );
  };

  return (
    /* What the bar is calling this page, published so a page's own heading can
       stand down where it would only say it again — see `lib/barTitle`. */
    <BarTitleContext value={pageName}>
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen shrink-0 overflow-y-auto md:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* overflow-x-CLIP, not hidden. `overflow-x: hidden` forces overflow-y to
          `auto`, which makes this element a scroll container — and a sticky
          child then sticks to THIS scrollport while the page scrolls on <html>,
          so the top bar rides up and away. Measured: it left the viewport at
          top:-688. `clip` clips on x exactly the same way but creates no scroll
          container, so overflow-y stays visible and sticky resolves against the
          viewport. The x-overflow guard (rule 5) is unchanged. */}
      <main className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        {/* Mobile — where you are, then the two controls a phone needs.
            It used to be the wordmark and the language and mode switchers:
            no page name, no search at any width below lg, and 140px spent on
            a preference nobody changes twice. The mark stays because it is
            24px and it is the only brand anchor on a phone; the name beside
            it is what the bar is for. */}
        <div data-scrolled={scrolled} className="glass-navbar sticky top-0 z-30 flex items-center gap-tight px-gutter py-inline md:hidden">
          <LogoMark size={24} className="shrink-0" />
          {/* A <p>, not a heading. The bar names the destination; the page's
              own <h1> renders in the content below it on a phone, and a
              heading above that h1 puts the document's outline out of order. */}
          {/* The venue takes the width on a phone where there is more than
              one, because it is the thing that changes what every figure below
              means; the page's own name is in the tab bar beneath. */}
          {venueScoped ? (
            <span className="flex min-w-0 flex-1 items-center gap-tight">
              <span className="min-w-0 shrink truncate text-[15px] font-semibold text-fg">{pageName}</span>
              {!wide && <LocationSwitcher compact />}
            </span>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{pageName}</p>
          )}
          {/* The page's create action, as a plus. Empty on a page that has
              none, and it takes its gap with it. */}
          <div id="os-page-actions-mobile" className="flex shrink-0 items-center gap-inline empty:hidden" />
          <AccountMenu name={operatorQ.data?.name} compact />
        </div>

        {/* Desktop — the glass pane now carries the PAGE HEADER as well as the
            chrome. Measured on the Aura reference: its sticky header is a
            65px bar holding the page title and its subtitle on the left with
            search, actions and the avatar on the right — one bar, not a bar
            above a header.

            Counterfoil had them as two stacked blocks: a 56px pane whose left
            737px were empty, and a separate page header under it, which put
            the first card 183px down. The title moves into that empty space
            and the two collapse into one.

            #os-page-header is a portal target, not a prop chain: PageShell is
            rendered by ~30 route files inside {children}, so the alternative
            was threading title/description/actions through every one of them,
            or a context whose `actions` node changes identity on every render
            and would set state in a loop. A portal has neither problem, and
            PageShell stays the single owner of what a page header is. */}
        {/* 8px of padding, not 12, and centred rather than top-aligned: with
            the single-word breadcrumb gone the title is one line beside 44px
            controls, and top-aligning them left the title riding 5px high of
            the buttons it shares the bar with. */}
        <div data-scrolled={scrolled} className="glass-navbar sticky top-0 z-20 hidden items-center justify-between gap-major px-gutter py-tight md:flex">
          <div id="os-page-header" className="min-w-0 flex-1" />
          {/* The bar is app chrome: the page name, the venue, the account.
              A page's own buttons, status and back link render in the page
              (PageShell), never up here. */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-tight">
            {/* The venue first: it qualifies everything to its left, so it
                reads as part of where you are rather than as one more of the
                page's controls. */}
            {venueScoped && wide && <LocationSwitcher />}
            <AccountMenu name={operatorQ.data?.name} />
          </div>
        </div>

        <div className={cn("min-w-0 flex-1 md:pb-0", focused ? "pb-0" : "pb-[calc(56px+env(safe-area-inset-bottom))]")}>{children}</div>
      </main>

      {/* Mounted only while open, so it comes up empty by construction. */}
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} destinations={DESTINATIONS} shortcutKey={shortcutKey} />}

      {/* Mobile bottom tab bar — stood down while something is being made, so
          the form's own Back and Continue can have the bottom of the screen. */}
      {!focused && (
      <nav
        aria-label="OS navigation"
        /* 95%, not 80%. At 80 the bar is tinted by whatever happens to be
           scrolled under it, and measured on /events a dark green status pill
           took the "Dashboard" label to 3.72:1 — an 11px navigation label whose
           legibility depends on the page behind it. The blur still reads; the
           backdrop no longer votes. */
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((tab) => {
          const active = tabActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              onClick={() => { setMoreOpen(false); if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={cn(
                "relative flex h-14 min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
                active ? "text-brand-foreground" : "text-muted",
              )}
            >
              {active && <span aria-hidden className="absolute left-2 right-2 top-0 h-[2px] bg-ember" />}
              <Icon size={24} strokeWidth={1.5} />
              <span className="max-w-full truncate px-inline text-[11px] font-medium">{t(tab.key)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "relative flex h-14 min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
            moreOpen ? "text-brand-foreground" : "text-muted",
          )}
        >
          {moreOpen && <span aria-hidden className="absolute left-2 right-2 top-0 h-[2px] bg-ember" />}
          <Ellipsis size={24} strokeWidth={1.5} />
          <span className="max-w-full truncate px-inline text-[11px] font-medium">{t("more")}</span>
        </button>
      </nav>
      )}

      {/* More — a sheet from the bottom, which is where it is opened from.
          It used to be a full-height panel dropped from the TOP while the
          finger that summoned it was at the bottom of the screen, and it
          covered the whole page rather than reading as something over it. */}
      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t("more")}
        closeLabel={tCommon("close")}
        lead={<p className="truncate font-mono text-[12px] text-muted">{operatorQ.data?.name ?? "Counterfoil"}</p>}
        className="md:hidden"
      >
        {/* The rail's order and its three groups: the daily destinations, the
            other apps (↗ — they leave the console) and Settings. Hairlines and
            spacing tell the groups apart; there are no labels. */}
        <div className="flex flex-col gap-tight p-card">
          <ul className="grid auto-rows-min grid-cols-3 gap-tight" data-more="main">
            {NAV_MAIN.map((d) => moreTile(d))}
          </ul>
          <div aria-hidden className="my-inline border-t border-line" />
          <ul className="grid auto-rows-min grid-cols-3 gap-tight" data-more="open">
            {NAV_OPEN.map((d) => moreTile(d, true))}
            {moreTile(NAV_SETTINGS)}
          </ul>
        </div>
      </Sheet>
    </div>
    </BarTitleContext>
  );
}
