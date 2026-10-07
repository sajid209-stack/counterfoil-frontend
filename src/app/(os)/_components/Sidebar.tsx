"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronsLeft, ChevronsRight, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/ui";
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
 */
function RailTip({ label, enabled, className, children }: { label: string; enabled: boolean; className?: string; children: React.ReactNode }) {
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
            className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-sm bg-inverse px-comfortable py-inline text-[12px] font-medium text-inverse-fg shadow-md"
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * The OS rail.
 *
 * Laid out the way Linear, Vercel, Stripe, Notion and Attio lay theirs out:
 *  - a workspace header (who you are working in) instead of a bare logo;
 *  - the daily destinations as one list, one icon size and one row height,
 *    with a tonal fill and a 2px accent on the page you are on;
 *  - the other apps under a hairline, marked ↗ because they leave the console;
 *  - Settings pinned at the foot with the collapse control — nothing floats.
 *
 * Groups are told apart by spacing and a hairline, not by uppercase labels:
 * the owner asked for "Overview" and "Settings" to go, and a row's own icon
 * and name already say what it is.
 *
 * Collapsed, it is a 64px column of the same icons in the same order, each with
 * a tooltip. `[` toggles it from the keyboard (wired in OsShell).
 */
export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  workspaceName,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** The business, in the header. Falls back to the product name while it loads. */
  workspaceName?: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const workspace = workspaceName || t("product");

  const isActive = (d: NavDestination) =>
    d === NAV_SETTINGS ? pathname.startsWith("/settings") : pathname === d.href || pathname.startsWith(`${d.href}/`);

  /* One row, for every destination. 36px (44 under a coarse pointer, since a
     tablet gets this rail too), a 18px / 1.5 icon on a fixed edge so every
     label starts on one line, a tonal fill and a 2px accent when current. The
     accent sits on the rail's own left edge, 8px outside the row, so it reads
     as the rail marking where you are rather than as a part of the button. */
  const row = (d: NavDestination, opts: { leaves?: boolean } = {}) => {
    const label = t(d.key);
    const active = isActive(d);
    const Icon = d.icon;
    return (
      <li key={d.key}>
        <RailTip label={label} enabled={collapsed}>
          <Link
            href={d.href}
            data-nav={d.key}
            aria-label={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-comfortable rounded-sm text-sm font-medium transition-colors duration-quick [@media(pointer:coarse)]:h-11",
              collapsed ? "mx-auto w-10 justify-center [@media(pointer:coarse)]:w-11" : "px-comfortable",
              active ? "bg-subtle text-fg" : "text-muted hover:bg-muted-wash hover:text-fg",
            )}
          >
            {active && (
              <span
                aria-hidden
                className={cn("absolute bottom-2 top-2 w-0.5 rounded-r-full bg-ember-solid", collapsed ? "-left-comfortable" : "-left-tight")}
              />
            )}
            <Icon size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0 transition-colors duration-quick", active ? "text-fg" : "text-muted group-hover:text-fg")} />
            {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {/* Leaving the console. Collapsed, the arrow is a corner mark on the
                icon, so the two apps are still told apart from the daily list. */}
            {opts.leaves && !collapsed && <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
            {opts.leaves && collapsed && <ArrowUpRight size={10} strokeWidth={2} aria-hidden className="absolute right-1 top-1 text-muted" />}
          </Link>
        </RailTip>
      </li>
    );
  };

  const list = "flex flex-col gap-inline";
  const hairline = "mx-comfortable my-tight border-t border-line";

  const CollapseIcon = collapsed ? ChevronsRight : ChevronsLeft;
  const toggleLabel = collapsed ? t("expand") : t("collapse");

  return (
    <div
      data-rail
      data-collapsed={collapsed}
      style={{ width: collapsed ? 64 : 240 }}
      className="group/rail relative flex h-full flex-col border-r border-line bg-surface/70 text-fg backdrop-blur-xl transition-[width] duration-standard ease-counterfoil"
    >
      {/* Workspace — who you are working in. The mark, the business, and a
          chevron because the header leads to where a workspace is chosen. Not a
          third surface: it is the one place the rail says whose console this is,
          where it used to say "Counterfoil" in a 129px lockup. */}
      <div className={cn("flex h-14 shrink-0 items-center px-tight", collapsed && "justify-center")}>
        <RailTip label={workspace} enabled={collapsed} className={collapsed ? undefined : "min-w-0 flex-1"}>
          <Link
            href="/"
            data-nav="workspace"
            title={collapsed ? undefined : `${workspace} · ${t("switchWorkspace")}`}
            aria-label={collapsed ? workspace : undefined}
            className={cn(
              "flex items-center gap-comfortable rounded-sm transition-colors duration-quick hover:bg-muted-wash",
              collapsed ? "h-10 w-10 justify-center" : "h-11 min-w-0 flex-1 px-tight",
            )}
          >
            <LogoMark size={26} />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold text-fg">{workspace}</span>
                  <span className="block truncate text-[12px] text-muted">{t("product")}</span>
                </span>
                <ChevronsUpDown size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              </>
            )}
          </Link>
        </RailTip>
      </div>

      {/* The scrolling middle. Settings and the collapse control are outside it,
          so they are always on screen however short the window is. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-tight pb-tight">
        <nav aria-label={t("main")}>
          <ul className={list}>{NAV_MAIN.map((d) => row(d))}</ul>
        </nav>

        <div aria-hidden className={hairline} />

        <ul role="group" aria-label={t("otherApps")} className={list}>
          {NAV_OPEN.map((d) => row(d, { leaves: true }))}
        </ul>
      </div>

      {/* Pinned to the foot: Settings, then the collapse control and the
          version. Nothing in the rail floats; the control for the rail is a row
          of the rail. */}
      <div className="shrink-0 border-t border-line px-tight pt-tight">
        <ul className={list}>{row(NAV_SETTINGS)}</ul>

        <RailTip label={toggleLabel} enabled={collapsed}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-nav="collapse"
            aria-label={collapsed ? toggleLabel : undefined}
            aria-expanded={!collapsed}
            aria-keyshortcuts="["
            className={cn(
              "mt-inline flex h-9 items-center gap-comfortable rounded-sm text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg [@media(pointer:coarse)]:h-11",
              collapsed ? "mx-auto w-10 justify-center [@media(pointer:coarse)]:w-11" : "w-full px-comfortable",
            )}
          >
            <CollapseIcon size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left">{toggleLabel}</span>
                <kbd aria-hidden className="rounded-xs bg-subtle px-1.5 font-mono text-[12px] text-muted">[</kbd>
              </>
            )}
          </button>
        </RailTip>

        {!collapsed && <p className="truncate px-comfortable pb-comfortable pt-inline text-[12px] text-muted">{t("version", { version: pkg.version })}</p>}
        {collapsed && <div className="h-tight" />}
      </div>

      {/* The rail's edge, for a mouse: a hairline that warms and a small tab
          that appears on hover, the way Vercel's and Linear's do. It is a
          shortcut to the footer control, so it is out of the tab order and the
          accessibility tree — one button named Collapse, not two. */}
      {onToggleCollapsed && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={onToggleCollapsed}
          className={cn(
            "absolute inset-y-0 -right-px z-10 flex w-2 items-center justify-end opacity-0 transition-opacity duration-quick hover:opacity-100 max-md:hidden [@media(pointer:coarse)]:hidden",
            collapsed ? "cursor-e-resize" : "cursor-w-resize",
          )}
        >
          <span aria-hidden className="absolute inset-y-0 right-0 w-px bg-ember" />
          <span aria-hidden className="relative -mr-px flex h-8 w-4 items-center justify-center rounded-l-sm border border-r-0 border-line bg-card text-muted shadow-sm">
            <CollapseIcon size={12} strokeWidth={2} />
          </span>
        </button>
      )}
    </div>
  );
}
