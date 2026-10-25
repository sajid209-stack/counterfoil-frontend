"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Clock,
  Inbox,
  Settings,
  ShoppingBag,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_IDLE, NAV_SELECTED, NAV_SELECTED_ICON } from "@/components/ui/navStyles";
import { PageStatePicker } from "@/components/screens";
import { cn } from "@/lib/cn";
import { listRoles } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { useMediaQuery, XL } from "@/lib/useMedia";
import { CounterPicker } from "../CounterPicker";
import { AccountMenu } from "./AccountMenu";
import { PageStateIconMenu } from "./PageStateIconMenu";
import { setRailCollapsed } from "./rail";

/**
 * The desktop shell: a white sidebar for a counter tablet held sideways, a
 * laptop or a monitor (the `rail:` variant; docs/pos-desktop.md §2 rules 1-2).
 *
 * It replaces the 88px icon-over-label rail AND the header row. Top to bottom:
 *   · the counter picker as the first row — the counter's name, the venue under
 *     it — because the counter is what a cashier says they are working at;
 *   · the destinations, an icon and a word each, 44px rows: the four tabs, a
 *     hairline, then the pages that were behind More, then Help;
 *   · a "Current sale" row when a sale is open away from the till;
 *   · the foot: a quiet shift card, ONE row for the developer's page-state
 *     picker and the fold, and the person, whose whole row is the account menu
 *     (the sales-screen choice lives in it). Folded, the foot is icons only.
 * Selected is the same neutral recipe the OS rail uses (navStyles).
 *
 * 248px with words from xl (1280); 72px, icons only, from 1024 to 1279 with a
 * tooltip (title + aria-label) on every icon. From xl a person can fold it to the
 * icon rail too; the choice is remembered (`rail.ts`).
 *
 * Its own scroll: the middle (the destinations) scrolls without drawing a bar;
 * the counter row above it and the foot below it stay put. The sidebar itself
 * clips nothing — the counter list, the account menu and the page-state list all
 * open past its edge.
 */

export interface SidebarTab {
  href: string;
  key: string;
  icon: LucideIcon;
}

/* The pages that live behind More on a phone. `tr` marks a label that lives in
   another namespace (what this person asked a manager for, with the refund
   words). Settings here is the TILL's settings, never the business's. */
const PAGES: { href: string; key: string; icon: LucideIcon; tr?: boolean; startsWith?: string }[] = [
  { href: "/my-sales", key: "mySales", icon: Banknote },
  { href: "/my-requests", key: "myRequests", icon: Inbox, tr: true },
  { href: "/shift/close", key: "shift", icon: Clock, startsWith: "/shift" },
  { href: "/quick-pass", key: "quickPass", icon: Ticket },
  { href: "/reservations", key: "reservations", icon: CalendarCheck },
  { href: "/till-settings", key: "settings", icon: Settings },
];

export function DesktopSidebar({
  tabs,
  isActive,
  collapsed,
  saleCount,
  showSaleRow,
  onHelp,
  myName,
  myRoleId,
  rail,
}: {
  tabs: readonly SidebarTab[];
  isActive: (href: string) => boolean;
  /** The person folded it (matters from xl; below xl it is always icons). */
  collapsed: boolean;
  /** Lines in the sale in progress. */
  saleCount: number;
  /** Whether to offer the way back to that sale (not on a till, which shows it). */
  showSaleRow: boolean;
  onHelp: () => void;
  myName: string;
  myRoleId: string | undefined;
  /** The desktop media query. The pickers render only when it holds. */
  rail: boolean;
}) {
  const t = useTranslations("nav");
  const tp = useTranslations("pos");
  const tr = useTranslations("refunds");
  const pathname = usePathname();
  const xl = useMediaQuery(XL);
  const iconOnly = !xl || collapsed;

  /* One row, from one place. Words show from xl unless folded; below xl the row
     is a centred icon and the label is in the title and the aria-label. */
  const rowClass = (active: boolean) =>
    cn(
      "relative flex h-11 w-full shrink-0 items-center rounded-control text-base transition-colors duration-quick",
      collapsed ? "justify-center" : "justify-center xl:justify-start xl:gap-comfortable xl:px-comfortable",
      active ? NAV_SELECTED : cn("font-medium", NAV_IDLE),
    );
  const labelClass = cn("min-w-0 flex-1 truncate text-left", collapsed ? "hidden" : "hidden xl:block");
  const iconProps = (active: boolean) => ({
    size: 20,
    strokeWidth: active ? 2 : 1.5,
    "aria-hidden": true as const,
    className: cn("shrink-0", active && NAV_SELECTED_ICON),
  });

  const pageActive = (p: (typeof PAGES)[number]) => {
    const base = p.startsWith ?? p.href;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <aside
      data-go-sidebar
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 self-start flex-col bg-chrome transition-[width] duration-standard motion-reduce:transition-none rail:flex",
        /* Not `rail:w-18`: custom variants are emitted after the breakpoints, so it
         would beat `xl:w-62` at the same specificity. The aside is hidden below
         `rail` already, so a plain base width is all it needs. */
        collapsed ? "w-18" : "w-18 xl:w-62",
      )}
    >
      {/* The counter — the first row, outside the scroll so its list can open. */}
      <div className="shrink-0 px-tight pb-inline pt-tight">{rail && <CounterPicker saleCount={saleCount} variant="sidebar" iconOnly={iconOnly} />}</div>

      <nav aria-label={tp("shell.menu")} className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-tight py-inline">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const label = t(tab.key);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={iconOnly ? label : undefined}
              onClick={() => {
                if (active) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={rowClass(active)}
            >
              <Icon {...iconProps(active)} />
              <span className={labelClass}>{label}</span>
            </Link>
          );
        })}

        <div role="separator" className="mx-comfortable my-tight border-t border-hairline" />

        {PAGES.map((p) => {
          const active = pageActive(p);
          const label = p.tr ? tr("pos.myRequests") : t(p.key);
          const Icon = p.icon;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={iconOnly ? label : undefined}
              className={rowClass(active)}
            >
              <Icon {...iconProps(active)} />
              <span className={labelClass}>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onHelp}
          aria-haspopup="dialog"
          aria-label={t("help")}
          title={iconOnly ? t("help") : undefined}
          className={rowClass(false)}
        >
          <CircleHelp {...iconProps(false)} />
          <span className={labelClass}>{t("help")}</span>
        </button>

        {/* A sale in progress is reachable from anywhere: on the till the sale
            panel says the same thing, so this is only for the other pages. */}
        {showSaleRow && (
          <Link
            href="/pos/cart"
            aria-label={tp("shell.currentSale", { count: saleCount })}
            title={iconOnly ? tp("shell.currentSale", { count: saleCount }) : undefined}
            className={cn(
              "relative mt-tight flex h-11 w-full shrink-0 items-center rounded-control bg-ember-wash text-base font-semibold text-brand-foreground transition-colors duration-quick hover:bg-nav-hover",
              collapsed ? "justify-center" : "justify-center xl:justify-start xl:gap-comfortable xl:px-comfortable",
            )}
          >
            <ShoppingBag size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className={labelClass}>{tp("shell.currentSale", { count: saleCount })}</span>
            <span
              aria-hidden
              className={cn(
                "absolute right-0.5 top-0.5 min-w-5 rounded-full bg-ember-solid px-1 text-center text-sm font-semibold leading-5 text-on-solid",
                collapsed ? "" : "xl:hidden",
              )}
            >
              {saleCount}
            </span>
          </Link>
        )}
      </nav>

      <SidebarFoot
        collapsed={collapsed}
        iconOnly={iconOnly}
        rail={rail}
        myName={myName}
        myRoleId={myRoleId}
      />
    </aside>
  );
}

/* The foot: the shift, one calm row, the person. Rendered separately so the
   roles query is only paid for on a desktop.

   Expanded (248px): the shift card first, then ONE row holding the page-state
   picker and the fold toggle, then the person, whose whole row opens the
   account menu (which also carries the sales-screen choice).

   Icon rail (72px): icons only, each one 44px with a tooltip and a name — the
   shift (a clock with a small green dot), the page state, the person's disc
   (the account menu) and, from xl, the toggle that unfolds the rail. Nothing
   in it has a label to wrap or a second control to overlap. */
function SidebarFoot({
  collapsed,
  iconOnly,
  rail,
  myName,
  myRoleId,
}: {
  collapsed: boolean;
  iconOnly: boolean;
  rail: boolean;
  myName: string;
  myRoleId: string | undefined;
}) {
  const tp = useTranslations("pos");
  const pathname = usePathname();
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const role = myRoleId ? rolesQ.data?.data.find((r) => r.id === myRoleId)?.name : undefined;

  /* TODO(data): the elapsed shift time has no reader yet (no shift record
     carries its start), so the 3:24 is still the demo value, as it is in the
     phone header and the More sheet. */
  const shiftText = tp("shell.shiftOpenFor", { time: "3:24" });
  const onShift = pathname.startsWith("/shift");
  const foldLabel = collapsed ? tp("shell.expand") : tp("shell.collapse");

  const foldButton = (
    <button
      type="button"
      onClick={() => setRailCollapsed(!collapsed)}
      aria-label={foldLabel}
      title={foldLabel}
      className={cn(
        "hidden size-11 shrink-0 place-items-center rounded-control text-muted transition-colors duration-quick hover:bg-nav-hover hover:text-fg xl:grid",
        iconOnly && "mx-auto",
      )}
    >
      {collapsed ? <ChevronsRight size={20} strokeWidth={1.5} aria-hidden /> : <ChevronsLeft size={20} strokeWidth={1.5} aria-hidden />}
    </button>
  );

  return (
    <div className="shrink-0 border-t border-hairline px-tight pb-tight pt-tight">
      {iconOnly ? (
        <div className="flex flex-col items-center">
          <Link
            href="/shift/close"
            aria-current={onShift ? "page" : undefined}
            aria-label={tp("shell.endShift")}
            title={`${tp("shell.endShift")} · ${shiftText}`}
            className="relative grid size-11 place-items-center rounded-control text-fg-secondary transition-colors duration-quick hover:bg-nav-hover hover:text-fg"
          >
            <Clock size={20} strokeWidth={1.5} aria-hidden />
            <span aria-hidden className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-chrome bg-success-solid" />
          </Link>
          {rail && <PageStateIconMenu />}
          {rail && <AccountMenu name={myName} role={role} iconOnly />}
          {rail && foldButton}
        </div>
      ) : (
        <>
          {/* The shift, quietly: how long it has been open, and the way to end
              it. The whole row is the link, so the target is the row. */}
          <Link
            href="/shift/close"
            aria-current={onShift ? "page" : undefined}
            className="flex min-h-11 items-center gap-comfortable rounded-control px-inline py-inline transition-colors duration-quick hover:bg-nav-hover"
          >
            <span aria-hidden className="relative grid size-9 shrink-0 place-items-center rounded-control bg-subtle text-fg-secondary">
              <Clock size={18} strokeWidth={1.5} />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-chrome bg-success-solid" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-base font-semibold text-fg">{tp("shell.endShift")}</span>
              <span className="truncate text-sm text-muted">{shiftText}</span>
            </span>
          </Link>

          {/* The developer's page-state preview and the fold: one row. */}
          {rail && (
            <div className="mt-inline flex items-center gap-inline">
              <PageStatePicker size="md" className="min-w-0 flex-1 w-full!" />
              {foldButton}
            </div>
          )}

          {rail && (
            <div className="mt-inline">
              <AccountMenu name={myName} role={role} iconOnly={false} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
