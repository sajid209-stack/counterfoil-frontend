"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo, LogoMark } from "@/components/ui";
import { cn } from "@/lib/cn";
import pkg from "../../../../package.json";
import { NAV_MAIN, NAV_OPEN, NAV_SETTINGS, type NavDestination } from "./nav";

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
            className="pointer-events-none fixed z-50 flex -translate-y-1/2 items-center gap-comfortable whitespace-nowrap rounded-sm bg-inverse px-comfortable py-inline text-[12px] font-medium text-inverse-fg shadow-md"
          >
            {label}
            {shortcut && <kbd className="rounded-xs bg-inverse-fg/15 px-1.5 font-mono text-[12px] text-inverse-fg">{shortcut}</kbd>}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * The OS rail.
 *
 * Calm, in the way Linear's, Overlay's and Notion's are — and, since the calm
 * pass, on the CHROME: white like the top bar beside it, with no line between
 * them and none down its right edge. The page is the paper frame next to it.
 *  - the logo, and beside it one small control that folds the rail — not the
 *    business, not the product, not a venue; the console says whose it is
 *    elsewhere;
 *  - no search field: Ctrl/⌘ K opens the command palette from anywhere (wired
 *    in OsShell);
 *  - the destinations as one list, one icon size and one row height (36px; 44
 *    under a coarse pointer, since a tablet gets this rail too) with a small
 *    gap between rows. The page you are on is a soft tint of the ink with the
 *    label and icon in full ink — no card, border, shadow or coloured bar;
 *  - the other apps under a hairline, marked ↗ because they leave the console;
 *  - Settings pinned at the foot, with the version in small print under it.
 *
 * It is sized to fit WITHOUT scrolling at 1280×720 and 1440×768: every row of
 * the main list plus both apps plus Settings and the version, measured against
 * the shortest laptop windows. If a window is shorter still the middle scrolls,
 * but it draws no scrollbar (`no-scrollbar`) — a bar beside a 36px row is
 * chrome on chrome. Settings and the version stay pinned either way.
 *
 * Groups are told apart by spacing and a hairline, not by uppercase labels:
 * the owner asked for "Overview" and "Settings" to go, and a row's own icon
 * and name already say what it is.
 *
 * Collapsed, it is a 64px column of the same things in the same order, as
 * icons: the mark, an expand control beneath it, then the destinations,
 * each with a tooltip. `[` toggles it from the keyboard (wired in OsShell).
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

  const isActive = (d: NavDestination) =>
    d === NAV_SETTINGS ? pathname.startsWith("/settings") : pathname === d.href || pathname.startsWith(`${d.href}/`);

  /* One row, for every destination. 36px (44 under a coarse pointer), an
     18px / 1.5 icon on a fixed edge so every label starts on one line, 14px/500
     muted text. The page you are on is a soft tint of the ink with its label and
     icon in full ink. Hover is a lighter tint, so the two never read as the
     same thing. */
  const row = (d: NavDestination, opts: { leaves?: boolean } = {}) => {
    const label = t(d.key);
    const active = isActive(d);
    const Icon = d.icon;
    return (
      <li key={d.key}>
        <RailTip label={label} enabled={narrow}>
          <Link
            href={d.href}
            data-nav={d.key}
            aria-label={narrow ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-comfortable rounded-sm text-sm font-medium transition-colors duration-quick [@media(pointer:coarse)]:h-11",
              narrow ? "mx-auto w-9 justify-center [@media(pointer:coarse)]:w-11" : "px-comfortable",
              active ? "bg-fg/[0.07] text-fg dark:bg-fg/[0.09]" : "text-muted hover:bg-fg/[0.04] hover:text-fg",
            )}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
            {!narrow && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {/* Leaving the console. Collapsed, the arrow is a corner mark on the
                icon, so the two apps are still told apart from the daily list. */}
            {opts.leaves && !narrow && <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
            {opts.leaves && narrow && <ArrowUpRight size={10} strokeWidth={2} aria-hidden className="absolute right-0.5 top-0.5 text-muted" />}
          </Link>
        </RailTip>
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
        className="flex h-9 w-9 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-fg/[0.06] hover:text-fg [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
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
            <Link href="/dashboard" data-nav="logo" aria-label="Counterfoil" className="flex items-center justify-center rounded-sm">
              <LogoMark size={28} />
            </Link>
          </div>
          {!locked && <div className="flex shrink-0 justify-center pb-tight">{toggle}</div>}
        </>
      ) : (
        <div className="flex h-14 shrink-0 items-center justify-between pl-6 pr-comfortable">
          <Link href="/dashboard" data-nav="logo" className="flex items-center rounded-sm">
            <Logo size={22} />
          </Link>
          {toggle}
        </div>
      )}

      {/* The scrolling middle. Settings is outside it, so it is always on
          screen however short the window is. */}
      <div className={cn("no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pt-1", gutter)}>
        <nav aria-label={t("main")}>
          <ul className={list}>{NAV_MAIN.map((d) => row(d))}</ul>
        </nav>

        <div aria-hidden className={hairline} />

        <ul role="group" aria-label={t("otherApps")} className={list}>
          {NAV_OPEN.map((d) => row(d, { leaves: true }))}
        </ul>
      </div>

      {/* Pinned to the foot: Settings, and the version in small print. */}
      <div className={cn("shrink-0 pt-2", gutter)}>
        <ul className={list}>{row(NAV_SETTINGS)}</ul>
        {!narrow ? (
          <p className="truncate px-comfortable pb-comfortable pt-2 text-[12px] text-muted">{t("version", { version: pkg.version })}</p>
        ) : (
          <div className="h-comfortable" />
        )}
      </div>
    </div>
  );
}
