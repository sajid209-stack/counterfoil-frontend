"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, ChartNoAxesColumn, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, Ticket, TicketPercent, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type IconType = React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

// Daily surface — the things operators touch every day. Setup (including
// Resources) lives under Settings, its own section. Collapses to a 64px icon
// rail (tooltips via title) with a 200ms width transition.
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
    { label: t("products"), href: "/products", icon: Ticket },
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
        "flex items-center gap-tight border-l-[3px] py-tight text-sm font-medium transition-colors duration-quick",
        collapsed ? "justify-center pl-0 pr-[3px]" : "pl-comfortable pr-comfortable",
        active ? "border-ember text-paper" : "border-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
      )}
    >
      {Icon && <Icon size={20} strokeWidth={1.5} className={active ? "text-ember" : ""} />}
      {!collapsed && label}
    </Link>
  );

  return (
    <div style={{ width: collapsed ? 64 : 240 }} className="flex h-full flex-col bg-neutral-900 text-paper transition-[width] duration-standard ease-counterfoil dark:border-r dark:border-line">
      {/* Header — always visible (never scrolls): logo + the collapse/expand
          toggle. This is the reliable expand affordance in both states. */}
      <div className={cn("flex shrink-0 items-center py-section", collapsed ? "justify-center" : "justify-between px-section")}>
        {!collapsed && (
          <Link href="/" className="flex items-center" title="Counterfoil OS">
            <span className="type-h2 text-lg text-paper">Counterfoil</span>
            <span className="ml-inline font-mono text-[11px] text-neutral-600">OS</span>
          </Link>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="flex h-9 w-9 items-center justify-center rounded-sm text-neutral-400 transition-colors duration-quick hover:bg-neutral-800 hover:text-neutral-200"
          >
            {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      {/* Scrollable nav — overflow lives here so the header toggle stays put. */}
      <div className="flex min-h-0 flex-1 flex-col gap-major overflow-y-auto pb-section">
        <nav className="flex flex-col gap-inline">
          {!collapsed && <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">{t("overview")}</p>}
          {OPERATE.map((n) => item(n.label, n.href, isActive(n.href), n.icon))}
        </nav>

        <div className={collapsed ? "px-inline" : "px-section"}>
          <Link
            href="/pos"
            title={collapsed ? t("pos") : undefined}
            className={cn(
              "flex items-center rounded-sm border border-neutral-800 py-tight text-sm font-medium text-paper hover:border-ember",
              collapsed ? "justify-center" : "justify-between px-comfortable",
            )}
          >
            {!collapsed && t("pos")}
            <ArrowUpRight size={16} strokeWidth={1.5} className="text-ember" />
          </Link>
        </div>

        <nav className="flex flex-col gap-inline">
          {!collapsed && <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">{t("settings")}</p>}
          {item(t("settings"), "/settings", pathname.startsWith("/settings"), Settings)}
        </nav>
      </div>
    </div>
  );
}
