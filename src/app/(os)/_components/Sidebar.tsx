"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BadgeCheck, CalendarDays, Lock, ChartNoAxesColumn, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, Ticket, TicketPercent, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/cn";

type IconType = React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

// Aura light-glass sidebar. Daily surface — the things operators touch every
// day. Setup lives under Settings, its own section. Collapses to a 64px icon
// rail (tooltips via title) with a 200ms width transition. Active items get a
// subtle filled pill + an ember dot; the ember accent moves off the border.
export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const OPERATE: { label: string; href: string; icon: IconType }[] = [
    { label: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("calendar"), href: "/calendar", icon: CalendarDays },
    { label: t("orders"), href: "/orders", icon: ReceiptText },
    { label: t("customers"), href: "/customers", icon: UsersRound },
    { label: t("memberships"), href: "/memberships", icon: BadgeCheck },
    { label: t("holds"), href: "/holds", icon: Lock },
    { label: t("products"), href: "/bookings", icon: Ticket },
    { label: t("reports"), href: "/reports/sales", icon: ChartNoAxesColumn },
    { label: t("promotions"), href: "/promotions", icon: TicketPercent },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (label: string, href: string, active: boolean, Icon?: IconType) => (
    <Link
      key={href}
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The reference's nav item is a FLAT tonal fill — bg neutral-100, 6px,
        // 8/12 padding, 14px/500, no shadow and no ring. Ours was a raised
        // white card (shadow-sm + ring-1) which made the selected row read as
        // an object sitting on the sidebar rather than part of it; that is the
        // "not smooth" of it. 12px gap, as the reference sets.
        "group flex items-center gap-comfortable rounded-sm py-tight text-sm font-medium transition-colors duration-quick",
        collapsed ? "justify-center px-0" : "px-comfortable",
        active
          ? "bg-subtle text-fg"
          : "text-muted hover:bg-subtle/60 hover:text-fg",
      )}
    >
      {/* 18px, not 20 — the reference draws these at 16. Stroke stays 1.5: the
          reference uses 2, but 1.5 on a 24 grid is the brand icon spec, and a
          typeface-level brand rule outranks matching a reference exactly. The
          active glyph takes the foreground colour, with ember left to the dot,
          so one accent marks the row rather than two. */}
      {Icon && <Icon size={18} strokeWidth={1.5} className={active ? "text-fg" : "text-muted group-hover:text-fg"} />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && active && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />}
    </Link>
  );

  return (
    <div
      style={{ width: collapsed ? 64 : 240 }}
      className="flex h-full flex-col border-r border-line bg-surface/70 text-fg backdrop-blur-xl transition-[width] duration-standard ease-counterfoil"
    >
      {/* Header — always visible (never scrolls): logo + the collapse/expand
          toggle. This is the reliable expand affordance in both states. */}
      <div className={cn("flex shrink-0 items-center py-section", collapsed ? "justify-center" : "justify-between px-comfortable")}>
        {!collapsed && (
          <Link href="/" title="Counterfoil OS">
            <Logo size={30} />
          </Link>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg"
          >
            {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      {/* Scrollable nav — overflow lives here so the header toggle stays put. */}
      <div className="flex min-h-0 flex-1 flex-col gap-major overflow-y-auto px-comfortable pb-section">
        <nav className="flex flex-col gap-inline">
          {!collapsed && <p className="px-comfortable pb-inline font-mono text-[12px] uppercase tracking-wider text-muted">{t("overview")}</p>}
          {OPERATE.map((n) => item(n.label, n.href, isActive(n.href), n.icon))}
        </nav>

        <div>
          <Link
            href="/pos"
            title={collapsed ? t("pos") : undefined}
            className={cn(
              "flex items-center rounded-sm border border-line py-tight text-sm font-medium text-fg transition-colors duration-quick hover:border-ember hover:bg-subtle/60",
              collapsed ? "justify-center px-0" : "justify-between px-comfortable",
            )}
          >
            {!collapsed && t("pos")}
            <ArrowUpRight size={16} strokeWidth={1.5} className="text-brand-foreground" />
          </Link>
        </div>

        <nav className="flex flex-col gap-inline">
          {!collapsed && <p className="px-comfortable pb-inline font-mono text-[12px] uppercase tracking-wider text-muted">{t("settings")}</p>}
          {item(t("settings"), "/settings", pathname.startsWith("/settings"), Settings)}
        </nav>
      </div>
    </div>
  );
}
