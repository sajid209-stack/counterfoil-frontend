"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, ChartNoAxesColumn, LayoutDashboard, ReceiptText, Settings, Ticket } from "lucide-react";
import { cn } from "@/lib/cn";

// Daily surface — the things operators touch every day. Setup (including
// Resources) lives under Settings, its own section.
export function Sidebar() {
  const pathname = usePathname();

  const OPERATE = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Orders", href: "/orders", icon: ReceiptText },
    { label: "Products", href: "/products", icon: Ticket },
    { label: "Reports", href: "/reports/sales", icon: ChartNoAxesColumn },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (label: string, href: string, active: boolean, Icon?: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-tight border-l-[3px] py-tight pl-comfortable pr-comfortable text-sm font-medium transition-colors duration-quick",
        active ? "border-ember text-paper" : "border-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
      )}
    >
      {Icon && <Icon size={20} strokeWidth={1.5} className={active ? "text-ember" : ""} />}
      {label}
    </Link>
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-major bg-neutral-900 py-section text-paper">
      <Link href="/" className="px-section">
        <span className="type-h2 text-lg text-paper">Counterfoil</span>
        <span className="ml-inline font-mono text-[11px] text-neutral-600">OS</span>
      </Link>

      <nav className="flex flex-col gap-inline">
        <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">Operate</p>
        {OPERATE.map((n) => item(n.label, n.href, isActive(n.href), n.icon))}
      </nav>

      <div className="px-section">
        <Link
          href="/pos"
          className="flex items-center justify-between rounded-sm border border-neutral-800 px-comfortable py-tight text-sm font-medium text-paper hover:border-ember"
        >
          Point of Sale
          <ArrowUpRight size={16} strokeWidth={1.5} className="text-ember" />
        </Link>
      </div>

      <nav className="flex flex-col gap-inline">
        <p className="px-section pb-inline font-mono text-[10px] uppercase tracking-wider text-neutral-600">Settings</p>
        {item("Settings", "/settings", pathname.startsWith("/settings"), Settings)}
      </nav>
    </aside>
  );
}
