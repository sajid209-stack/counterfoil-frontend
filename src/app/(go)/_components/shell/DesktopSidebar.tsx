"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Inbox,
  Settings,
  ShoppingBag,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_IDLE, NAV_SELECTED, NAV_SELECTED_ICON } from "@/components/ui/navStyles";
import { cn } from "@/lib/cn";
import { listRoles } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { useMediaQuery, XL } from "@/lib/useMedia";
import { CounterPicker } from "../CounterPicker";
import { AccountMenu } from "./AccountMenu";
import { PageStateIconMenu } from "./PageStateIconMenu";
import { setMoreOpen, setRailCollapsed, useMoreOpen } from "./rail";

/**
 * The desktop shell: a white sidebar for a counter tablet held sideways, a
 * laptop or a monitor (the `rail:` variant; docs/pos-desktop.md §2 rules 1-2).
 *
 * It replaces the 88px icon-over-label rail AND the header row. Top to bottom:
 *   · the header band — 64px, the counter picker (the counter's name, the venue
 *     under it) and, from xl, the fold toggle. It shares its height and its
 *     vertical centre with the wall toolbar and the sale panel's header, and
 *     GoShell draws one hairline under all three (Linear / Shopify admin);
 *   · the destinations, an icon and a word each, 44px rows: the four tabs, then
 *     ONE collapsible "More" group holding the pages that were behind More
 *     (closed until opened or until the current page is inside it; remembered).
 *     On the 72px icon rail the group is not a header: its icons sit under a
 *     hairline. Help lives in the account menu. Shift is the shift line below,
 *     not a second row;
 *   · a "Current sale" row when a sale is open away from the till;
 *   · the foot, fixed-size: one quiet shift line (a green dot, how long, End
 *     shift) and the person (avatar, name, role: the account menu) with the
 *     developer's page-state picker as a small icon button beside it. Folded,
 *     the foot is icons only.
 * Selected is the same neutral recipe the OS rail uses (navStyles).
 *
 * 248px with words from xl (1280); 72px, icons only, from 1024 to 1279 with a
 * tooltip (title + aria-label) on every icon. From xl a person can fold it to the
 * icon rail too; the choice is remembered (`rail.ts`).
 *
 * Its own scroll: the middle (the destinations) scrolls without drawing a bar;
 * the header band above it and the foot below it stay put and never shrink, so
 * on a short window the list scrolls rather than running under the foot. The
 * sidebar itself clips nothing — the counter list, the account menu and the
 * page-state list all open past its edge.
 */

export interface SidebarTab {
  href: string;
  key: string;
  icon: LucideIcon;
}

/* The pages that live behind More on a phone, now the sidebar's "More" group.
   `tr` marks a label that lives in another namespace (what this person asked a
   manager for, with the refund words). Settings here is the TILL's settings,
   never the business's. */
const PAGES: { href: string; key: string; icon: LucideIcon; tr?: boolean; startsWith?: string }[] = [
  { href: "/my-sales", key: "mySales", icon: Banknote },
  { href: "/my-requests", key: "myRequests", icon: Inbox, tr: true },
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
  const moreStored = useMoreOpen();
  /* Closing the group while the current page is inside it is a choice for THIS
     page only: the next page inside it opens the group again. */
  const [closedAt, setClosedAt] = useState<string | null>(null);

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
  const inside = PAGES.some(pageActive);
  const moreOpen = inside ? closedAt !== pathname : moreStored;
  const toggleMore = () => {
    if (inside) setClosedAt(closedAt === pathname ? null : pathname);
    else setMoreOpen(!moreStored);
  };

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

  const pageLink = (p: (typeof PAGES)[number]) => {
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
      {/* The header band: the counter — the first row, outside the scroll so its
          list can open — and, from xl, the fold. 64px with its own hairline, the
          same band the wall toolbar and the sale panel's header sit in. */}
      <div data-top-band className="flex h-16 shrink-0 items-center gap-inline border-b border-hairline px-tight">
        <div className="min-w-0 flex-1">{rail && <CounterPicker saleCount={saleCount} variant="sidebar" iconOnly={iconOnly} />}</div>
        {!iconOnly && foldButton}
      </div>

      <nav aria-label={tp("shell.menu")} className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-tight py-tight">
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

        {iconOnly ? (
          <>
            <div role="separator" className="mx-comfortable my-tight border-t border-hairline" />
            {PAGES.map(pageLink)}
          </>
        ) : (
          <div role="group" aria-label={t("more")} className="mt-tight flex flex-col gap-0.5 border-t border-hairline pt-tight">
            {/* One header, one chevron, like the OS rail's "Other apps". Closed
                while the current page is outside the group; when it is inside
                and the group is folded away, the header still says where you are. */}
            <button
              type="button"
              onClick={toggleMore}
              aria-expanded={moreOpen}
              aria-controls="go-more-pages"
              className={cn(
                "flex h-11 w-full shrink-0 items-center gap-comfortable rounded-control px-comfortable text-left text-sm font-medium transition-colors duration-quick hover:bg-nav-hover",
                inside && !moreOpen ? "text-fg" : "text-muted",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{t("more")}</span>
              {inside && !moreOpen && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ember-solid" />}
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cn("shrink-0 transition-transform duration-quick", !moreOpen && "-rotate-90")} />
            </button>
            {moreOpen && (
              <div id="go-more-pages" className="flex flex-col gap-0.5">
                {PAGES.map(pageLink)}
              </div>
            )}
          </div>
        )}

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
        iconOnly={iconOnly}
        rail={rail}
        myName={myName}
        myRoleId={myRoleId}
        foldButton={foldButton}
        onHelp={onHelp}
      />
    </aside>
  );
}

/* The foot: fixed-size, never scrolls and never shrinks, so nothing can run
   under it. Rendered separately so the roles query is only paid for on a
   desktop.

   Expanded (248px): one shift line — a green dot, how long the shift has been
   open, and End shift — then the person (avatar, name, role: the account menu,
   which also carries Help and the sales-screen choice) with the developer's
   page-state picker as a 44px icon button beside it. 8 + 44 + 4 + 48 + 8.

   Icon rail (72px): icons only, each one 44px with a tooltip and a name — the
   shift (a clock with a small green dot), the page state, the person's disc
   (the account menu) and, from xl, the toggle that unfolds the rail. Nothing
   in it has a label to wrap or a second control to overlap. */
function SidebarFoot({
  iconOnly,
  rail,
  myName,
  myRoleId,
  foldButton,
  onHelp,
}: {
  iconOnly: boolean;
  rail: boolean;
  myName: string;
  myRoleId: string | undefined;
  foldButton: React.ReactNode;
  onHelp: () => void;
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

  return (
    <div className="shrink-0 border-t border-hairline p-tight">
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
          {rail && <AccountMenu name={myName} role={role} iconOnly onHelp={onHelp} />}
          {rail && foldButton}
        </div>
      ) : (
        <>
          {/* The shift, quietly: a dot, how long it has been open, and the way
              to end it. The whole line is the link, so the target is the row. */}
          <Link
            href="/shift/close"
            aria-current={onShift ? "page" : undefined}
            className="flex h-11 items-center gap-comfortable rounded-control px-comfortable transition-colors duration-quick hover:bg-nav-hover"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-success-solid" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">{shiftText}</span>
            <span className="shrink-0 text-sm font-semibold text-fg">{tp("shell.endShift")}</span>
          </Link>

          {rail && (
            <div className="mt-inline flex items-center gap-inline">
              <div className="min-w-0 flex-1">
                <AccountMenu name={myName} role={role} iconOnly={false} onHelp={onHelp} />
              </div>
              <PageStateIconMenu />
            </div>
          )}
        </>
      )}
    </div>
  );
}
