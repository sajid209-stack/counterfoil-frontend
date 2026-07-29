"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listResources } from "@/lib/api";

// Daily surface — the things operators touch every day. Setup lives under
// Settings (its own section). The Resources item appears once resources exist,
// labelled with the operator's own word (Fields / Courts / Lanes…).
export function Sidebar() {
  const pathname = usePathname();
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = resourcesQ.data?.data ?? [];
  const resourceLabel = resources.length
    ? resources.every((r) => r.nounPlural === resources[0].nounPlural)
      ? resources[0].nounPlural
      : "Resources"
    : null;

  const OPERATE = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Calendar", href: "/calendar" },
    { label: "Orders", href: "/orders" },
    { label: "Products", href: "/products" },
    ...(resourceLabel ? [{ label: resourceLabel, href: "/resources" }] : []),
    { label: "Reports", href: "/reports/sales" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center border-l-[3px] py-tight pl-comfortable pr-comfortable text-sm font-medium transition-colors duration-quick",
        active ? "border-ember text-paper" : "border-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
      )}
    >
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
        {OPERATE.map((n) => item(n.label, n.href, isActive(n.href)))}
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
        {item("Settings", "/settings", pathname.startsWith("/settings"))}
      </nav>
    </aside>
  );
}
