"use client";

import { useId, useRef, useState, useSyncExternalStore, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo, LogoMark } from "@/components/ui";
import { NAV_PARENT_OF_SELECTED, NAV_IDLE, NAV_SELECTED, NAV_SELECTED_ICON } from "@/components/ui/navStyles";
import { cn } from "@/lib/cn";
import pkg from "../../../../package.json";
import { NAV_MAIN, NAV_OPEN, NAV_SETTINGS, groupOf, isAt, type NavDestination } from "./nav";

/**
 * A label for an icon, drawn beside it on hover or focus.
 *
 * The collapsed rail is icons only, and a native `title` takes a second to
 * appear and never on a keyboard. This is drawn in a portal rather than inside
 * the rail: the rail scrolls, and anything inside it is clipped at its edge.
 * The icon's accessible name is its own `aria-label`; this is only the visual.
 * `shortcut` is the key that does the same thing, drawn as a small keycap.
 */
function RailTip({
  label,
  shortcut,
  enabled,
  className,
  children,
}: {
  label: string;
  shortcut?: string;
  enabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = () => {
    if (!enabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setAt({ top: r.top + r.height / 2, left: r.right + 8 });
  };
  return (
    <div
      ref={ref}
      className={className}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
      onKeyDown={(e) => e.key === "Escape" && setAt(null)}
    >
      {children}
      {enabled &&
        at &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: at.top, left: at.left }}
            className="pointer-events-none fixed z-50 flex -translate-y-1/2 items-center gap-comfortable whitespace-nowrap rounded-control bg-inverse px-comfortable py-inline text-xs font-medium text-inverse-fg shadow-float"
          >
            {label}
            {shortcut && <kbd className="rounded-xs border border-strong px-1.5 font-mono text-xs text-inverse-fg">{shortcut}</kbd>}
          </div>,
          document.body,
        )}
    </div>
  );
}

/* "Other apps" open/closed, remembered per browser. A store rather than state
   plus an effect: the server (and the first client render) draw it open, and
   useSyncExternalStore swaps in the saved choice after hydration without a
   mismatch. Storage can throw (private window, blocked site data), so the last
   choice is also held in memory and the toggle still works for the session. */
const APPS_KEY = "cf_nav_apps";
let appsMemory: boolean | null = null;
const appsListeners = new Set<() => void>();
const readApps = () => {
  try {
    const v = localStorage.getItem(APPS_KEY);
    if (v !== null) return v !== "0";
  } catch {
    /* fall through to the in-memory choice */
  }
  return appsMemory ?? true;
};
const subscribeApps = (cb: () => void) => {
  appsListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    appsListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const writeApps = (next: boolean) => {
  appsMemory = next;
  try {
    localStorage.setItem(APPS_KEY, next ? "1" : "0");
  } catch {
    /* kept in memory above */
  }
  appsListeners.forEach((f) => f());
};

/* One row's look, from one place: the selected row, the parent of the selected
   row, or idle. The weight is only set on idle because the other two carry
   their own. */
const stateClass = (selected: boolean, parentOf: boolean) =>
  selected ? NAV_SELECTED : parentOf ? NAV_PARENT_OF_SELECTED : cn("font-medium", NAV_IDLE);

/* A parent row: 36px (44 under a coarse pointer). Open it carries a label;
   collapsed it is a centred 36px square holding the icon alone. */
const parentRowClass = (narrow: boolean, selected: boolean, parentOf: boolean) =>
  cn(
    "group relative flex h-9 items-center gap-comfortable rounded-control text-base transition-colors duration-quick [@media(pointer:coarse)]:h-11",
    narrow ? "mx-auto w-9 justify-center [@media(pointer:coarse)]:w-11" : "px-comfortable",
    stateClass(selected, parentOf),
  );

/* A child's label starts where its parent's label starts: the row's own
   padding, the 18px icon and the gap after it. Written from the same tokens so
   the two cannot drift apart. */
const CHILD_INDENT = "calc(var(--spacing-comfortable) * 2 + 18px)";

/**
 * A collapsed parent that has children: the icon, and a card of links beside it
 * on hover or keyboard focus.
 *
 * Portalled for the same reason RailTip is (the rail clips). The card's left
 * edge touches the icon's, with an 8px transparent pad in front of it, so the
 * pointer never crosses dead air on its way in; the 150ms grace covers the rest.
 * The card's links are not in the rail's tab order (they live in <body>), so the
 * keyboard reaches them from the icon with ArrowRight, ArrowDown or Tab, moves
 * between them with the arrow keys, and Escape (or Tab off the end) returns to
 * the icon. They carry data-flyout-item rather than data-nav, because the icon
 * already is data-nav={key}.
 */
function RailFlyout({ d, group }: { d: NavDestination; group: NavDestination | undefined }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const id = useId();
  const kids = d.children ?? [];
  const label = t(d.key);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const open = () => {
    clearTimeout(timer.current);
    if (!wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    /* Keep the card on screen near the foot of a short window: rows are at most
       44px, plus the card's own padding. */
    const rows = kids.length + 1;
    const est = rows * 44 + (rows - 1) * 2 + 12;
    setAt({ top: Math.max(8, Math.min(r.top - 4, window.innerHeight - est - 8)), left: r.right });
  };
  const closeNow = () => {
    clearTimeout(timer.current);
    setAt(null);
  };
  const closeSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAt(null), 150);
  };
  const leftFlyout = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && (wrap.current?.contains(next) || card.current?.contains(next))) return;
    closeNow();
  };
  const links = () => Array.from(card.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
  const backToIcon = () => {
    icon.current?.focus();
    closeNow();
  };

  const onIconKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && at) {
      e.preventDefault();
      backToIcon();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      if (!at) open();
      else {
        e.preventDefault();
        links()[0]?.focus();
      }
    } else if (e.key === "Tab" && !e.shiftKey && at) {
      e.preventDefault();
      links()[0]?.focus();
    }
  };
  const onCardKey = (e: React.KeyboardEvent) => {
    const list = links();
    const i = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "Tab") {
      e.preventDefault();
      backToIcon();
    } else if (e.key === "ArrowDown" && list.length) {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp" && list.length) {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    }
  };

  const here = group === d;
  const itemClass = (selected: boolean, parentOf: boolean) =>
    cn(
      "flex h-9 items-center whitespace-nowrap rounded-control px-comfortable text-base transition-colors duration-quick [@media(pointer:coarse)]:h-11",
      stateClass(selected, parentOf),
    );
  const parentHere = isAt(d, pathname);

  return (
    <div ref={wrap} onMouseEnter={open} onMouseLeave={closeSoon} onFocus={open} onBlur={leftFlyout} onKeyDown={onIconKey}>
      <Link
        ref={icon}
        href={d.href}
        data-nav={d.key}
        aria-label={label}
        aria-current={parentHere ? "page" : undefined}
        aria-haspopup="true"
        aria-expanded={!!at}
        aria-controls={at ? id : undefined}
        className={parentRowClass(true, here, false)}
      >
        <d.icon size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0", here && NAV_SELECTED_ICON)} />
      </Link>
      {at &&
        createPortal(
          <div
            id={id}
            ref={card}
            style={{ top: at.top, left: at.left }}
            className="fixed z-50 pl-tight"
            onMouseEnter={open}
            onMouseLeave={closeSoon}
            onBlur={leftFlyout}
            onKeyDown={onCardKey}
          >
            <nav
              aria-label={t("flyout", { label })}
              data-flyout={d.key}
              className="min-w-48 rounded-card border border-line bg-card p-inline shadow-float"
            >
              <ul className="flex flex-col gap-0.5">
                <li>
                  <Link
                    href={d.href}
                    data-flyout-item={d.key}
                    aria-current={parentHere ? "page" : undefined}
                    onClick={closeNow}
                    className={itemClass(parentHere, here && !parentHere)}
                  >
                    {label}
                  </Link>
                </li>
                {kids.map((c) => {
                  const sel = isAt(c, pathname);
                  return (
                    <li key={c.key}>
                      <Link
                        href={c.href}
                        data-flyout-item={c.key}
                        aria-current={sel ? "page" : undefined}
                        onClick={closeNow}
                        className={itemClass(sel, false)}
                      >
                        {t(c.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * The OS rail.
 *
 * Calm, in the way Linear's, Overlay's, Notion's and Shopify admin's are — and
 * on the CHROME: white like the top bar beside it, with no line between them.
 * The page is the paper frame next to it.
 *  - the logo, and beside it one small control that folds the rail — not the
 *    business, not the product, not a venue; the console says whose it is
 *    elsewhere;
 *  - no search field: Ctrl/⌘ K opens the command palette from anywhere (wired
 *    in OsShell);
 *  - the destinations as one list, one icon size and one row height (36px; 44px
 *    under a coarse pointer, since a tablet gets this rail too) with a small
 *    gap between rows;
 *  - Shopify-style nesting: a parent that has children shows them, indented to
 *    its label, ONLY while you are on the parent or on one of them. Exactly one
 *    row on screen is the selected one (the page you are on); when that is a
 *    child its parent stays in bold ink without the fill;
 *  - the other apps under a collapsible "Other apps ›" heading, marked ↗ because
 *    they leave the console. The choice is remembered;
 *  - Settings pinned at the foot, with the version in small print under it.
 *
 * It is sized to fit WITHOUT scrolling at 1280×720 and 1440×768 with the
 * nesting open. If a window is shorter still the middle scrolls, but it draws
 * no scrollbar (`no-scrollbar`) — a bar beside a 36px row is chrome on chrome.
 * Settings and the version stay pinned either way.
 *
 * Collapsed, it is a 64px column of the same things as icons: the mark, an
 * expand control beneath it, then the parents (the one holding the current page
 * carries the selected look, since its children are hidden). A parent with
 * children opens a flyout of links on hover or focus; the rest get a tooltip.
 * `[` toggles it from the keyboard (wired in OsShell).
 *
 * `locked` is the Shopify-style Settings mode: the rail is held collapsed
 * while a second column of settings sections stands beside it. The person's own
 * choice is untouched — it is simply not consulted — so the rail opens again
 * as it was the moment they leave Settings. There is nothing to fold, so there
 * is no fold control while it is locked.
 */
export function Sidebar({
  collapsed = false,
  locked = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  locked?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const narrow = collapsed || locked;
  const group = groupOf(pathname);
  const appsOpen = useSyncExternalStore(subscribeApps, readApps, () => true);
  const appsId = useId();

  /* One row, for a parent with no flyout and for every other destination. 36px
     (44 under a coarse pointer), an 18px / 1.5 icon on a fixed edge so every
     label starts on one line. The look comes from NAV_* (see navStyles). */
  const row = (d: NavDestination, opts: { selected: boolean; parentOf?: boolean; leaves?: boolean }) => {
    const label = t(d.key);
    const exact = isAt(d, pathname);
    const Icon = d.icon;
    return (
      <RailTip label={label} enabled={narrow}>
        <Link
          href={d.href}
          data-nav={d.key}
          aria-label={narrow ? label : undefined}
          aria-current={exact ? "page" : undefined}
          className={parentRowClass(narrow, opts.selected, !!opts.parentOf)}
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0", opts.selected && NAV_SELECTED_ICON)} />
          {!narrow && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {/* Leaving the console. Collapsed, the arrow is a corner mark on the
              icon, so the other apps are still told apart from the daily list. */}
          {opts.leaves && !narrow && <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
          {opts.leaves && narrow && <ArrowUpRight size={10} strokeWidth={2} aria-hidden className="absolute right-0.5 top-0.5 text-muted" />}
        </Link>
      </RailTip>
    );
  };

  const mainItem = (d: NavDestination) => {
    const kids = d.children ?? [];
    const exact = isAt(d, pathname);
    const here = group === d;
    if (narrow && kids.length) return <li key={d.key}><RailFlyout d={d} group={group} /></li>;
    /* Collapsed with no children, the parent is the whole group. */
    if (narrow) return <li key={d.key}>{row(d, { selected: here })}</li>;
    return (
      <li key={d.key}>
        {row(d, { selected: exact, parentOf: here && !exact && kids.length > 0 })}
        {here && kids.length > 0 && (
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {kids.map((c) => {
              const sel = isAt(c, pathname);
              return (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    data-nav={c.key}
                    aria-current={sel ? "page" : undefined}
                    style={{ paddingLeft: CHILD_INDENT }}
                    className={cn(
                      "flex h-8 items-center rounded-control pr-comfortable text-base transition-colors duration-quick [@media(pointer:coarse)]:h-11",
                      stateClass(sel, false),
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t(c.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const list = "flex flex-col gap-0.5";
  const hairline = "mx-comfortable my-2 border-t border-hairline";

  const CollapseIcon = collapsed ? ChevronsRight : ChevronsLeft;
  const toggleLabel = collapsed ? t("expand") : t("collapse");

  /* The fold control: one glyph, 36px to hit (44 under a coarse pointer), muted
     until pointed at. It says what it does in its tooltip and its name, and
     carries the `[` shortcut so the keyboard path is discoverable. */
  const toggle = (
    <RailTip label={toggleLabel} shortcut="[" enabled>
      <button
        type="button"
        onClick={onToggleCollapsed}
        data-nav="collapse"
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        aria-keyshortcuts="["
        className="flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
      >
        <CollapseIcon size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </RailTip>
  );

  /* The rail's own side padding: 12px open and collapsed alike, so a 36px row
     (or a 44px touch row) centres inside 64px. */
  const gutter = "px-comfortable";

  return (
    <div
      data-rail
      data-collapsed={narrow}
      data-locked={locked}
      style={{ width: narrow ? 64 : 240 }}
      className="relative flex h-full flex-col overflow-hidden bg-chrome text-fg transition-[width] duration-standard ease-counterfoil"
    >
      {/* The top row is as tall as the page bar beside it (56px), so the logo
          sits on the bar's own centre line. Open: the lockup on the same left
          edge as every icon below it (12 + 12), the fold control at the far
          end. Collapsed: the mark alone, with the expand control under it —
          or the mark alone when Settings is holding the rail collapsed. */}
      {narrow ? (
        <>
          <div className="flex h-14 shrink-0 items-center justify-center">
            <Link href="/dashboard" data-nav="logo" aria-label="Counterfoil" className="flex items-center justify-center rounded-control">
              <LogoMark size={28} />
            </Link>
          </div>
          {!locked && <div className="flex shrink-0 justify-center pb-tight">{toggle}</div>}
        </>
      ) : (
        <div className="flex h-14 shrink-0 items-center justify-between pl-6 pr-comfortable">
          <Link href="/dashboard" data-nav="logo" className="flex items-center rounded-control">
            <Logo size={22} />
          </Link>
          {toggle}
        </div>
      )}

      {/* The scrolling middle. Settings is outside it, so it is always on
          screen however short the window is. */}
      <div className={cn("no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pt-1", gutter)}>
        <nav aria-label={t("main")}>
          <ul className={list}>{NAV_MAIN.map((d) => mainItem(d))}</ul>
        </nav>

        <div aria-hidden className={hairline} />

        {/* Like Shopify's "Sales channels ›": a small muted heading that folds the
            list. Collapsed there is no heading — the three rows are icons. */}
        {!narrow && (
          <button
            type="button"
            data-nav="otherApps"
            onClick={() => writeApps(!appsOpen)}
            aria-expanded={appsOpen}
            aria-controls={appsId}
            className="mb-0.5 flex h-8 w-full items-center gap-inline rounded-control px-comfortable text-left text-sm font-medium text-muted transition-colors duration-quick hover:text-fg [@media(pointer:coarse)]:h-11"
          >
            <span className="min-w-0 truncate">{t("otherApps")}</span>
            <ChevronRight
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className={cn("shrink-0 transition-transform duration-quick", appsOpen && "rotate-90")}
            />
          </button>
        )}
        <ul id={appsId} role="group" aria-label={t("otherApps")} hidden={!narrow && !appsOpen} className={cn(list, !narrow && !appsOpen && "hidden")}>
          {NAV_OPEN.map((d) => (
            <li key={d.key}>{row(d, { selected: isAt(d, pathname), leaves: true })}</li>
          ))}
        </ul>
      </div>

      {/* Pinned to the foot: Settings, and the version in small print. */}
      <div className={cn("shrink-0 pt-2", gutter)}>
        <ul className={list}>
          <li>{row(NAV_SETTINGS, { selected: isAt(NAV_SETTINGS, pathname) })}</li>
        </ul>
        {!narrow ? (
          <p className="truncate px-comfortable pb-comfortable pt-2 text-xs text-muted">{t("version", { version: pkg.version })}</p>
        ) : (
          <div className="h-comfortable" />
        )}
      </div>
    </div>
  );
}
