"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, ChartNoAxesColumn, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, Ticket } from "lucide-react";
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

  const OPERATE: { label: string; href: string; icon: IconType }[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Orders", href: "/orders", icon: ReceiptText },
    { label: "Products", href: "/products", icon: Ticket },
    { label: "Reports", href: "/reports/sales", icon: ChartNoAxesColumn },
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
    <div style={{ width: collapsed ? 64 : 240 }} className="flex h-full flex-col gap-major bg-neutral-900 py-section text-paper transition-[width] duration-standard ease-counterfoil">
      <Link href="/" className={cn("flex items-center", collapsed ? "justify-center" : "px-section")} title={collapsed ? "Counterfoil OS" : undefined}>
        {collapsed ? (
          <span className="type-h2 text-lg text-paper">C</span>
        ) : (
          <span>
            <span className="type-h2 text-lg text-paper">Counterfoil</span>
            <span className="ml-inline font-mono text-[11px] text-neutral-600">OS</span>
          </span>
        )}
      </Link>

      <nav className="flex flex-col gap-inline">
        {!collapsed && <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">Operate</p>}
        {OPERATE.map((n) => item(n.label, n.href, isActive(n.href), n.icon))}
      </nav>

      <div className={collapsed ? "px-inline" : "px-section"}>
        <Link
          href="/pos"
          title={collapsed ? "Point of Sale" : undefined}
          className={cn(
            "flex items-center rounded-sm border border-neutral-800 py-tight text-sm font-medium text-paper hover:border-ember",
            collapsed ? "justify-center" : "justify-between px-comfortable",
          )}
        >
          {!collapsed && "Point of Sale"}
          <ArrowUpRight size={16} strokeWidth={1.5} className="text-ember" />
        </Link>
      </div>

      <nav className="flex flex-col gap-inline">
        {!collapsed && <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">Settings</p>}
        {item("Settings", "/settings", pathname.startsWith("/settings"), Settings)}
      </nav>

      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("mt-auto flex items-center gap-tight py-tight text-neutral-400 hover:text-neutral-200", collapsed ? "justify-center" : "px-comfortable")}
        >
          {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
          {!collapsed && <span className="text-[12px]">Collapse</span>}
        </button>
      )}
    </div>
  );
}
