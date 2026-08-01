"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChartLine,
  CreditCard,
  Ellipsis,
  LandPlot,
  LayoutDashboard,
  MapPin,
  MonitorSmartphone,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { ModeButton } from "@/components/ThemeProvider";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";

// F10 — on mobile the hamburger drawer is gone: a bottom tab bar carries the
// four daily destinations, and More opens a full-height destination grid.
// Desktop is unchanged: the ink sidebar stays.
const MOBILE_TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
];

// Same grid, same order, every time — muscle memory is the point.
const DESTINATIONS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/reports/sales", label: "Reports", icon: BarChart3 },
  { href: "/reports/sales?tab=analytics", label: "Analytics", icon: ChartLine },
  { href: "/pos", label: "Point of Sale", icon: Store },
  { href: "/settings/resources", label: "Resources", icon: LandPlot },
  { href: "/settings/counters", label: "Counters", icon: Store },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/devices", label: "Devices", icon: MonitorSmartphone },
  { href: "/settings/payments", label: "Payments", icon: CreditCard },
  { href: "/settings/roles", label: "Roles", icon: UserCog },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
  { href: "/settings/business", label: "Settings", icon: Settings },
];

export function OsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("os_sidebar_collapsed") === "1");
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("os_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  const tabActive = (href: string) => isActive(href) && !moreOpen;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen shrink-0 overflow-y-auto md:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex items-center gap-tight border-b border-line bg-card px-section py-inline md:hidden">
          <Building2 size={18} strokeWidth={1.5} className="text-faint" />
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-faint">OS</span>
          <span className="flex-1" />
          <ModeButton />
        </div>
        <div className="min-w-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="OS navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((t) => {
          const active = tabActive(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              onClick={() => { setMoreOpen(false); if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={cn(
                "relative flex h-14 min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
                active ? "text-ember" : "text-faint",
              )}
            >
              {active && <span aria-hidden className="absolute left-2 right-2 top-0 h-[2px] bg-ember" />}
              <Icon size={24} strokeWidth={1.5} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "relative flex h-14 min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
            moreOpen ? "text-ember" : "text-faint",
          )}
        >
          {moreOpen && <span aria-hidden className="absolute left-2 right-2 top-0 h-[2px] bg-ember" />}
          <Ellipsis size={24} strokeWidth={1.5} />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </nav>

      {/* More — full-height destination grid */}
      {moreOpen && (
        <div className="fixed inset-x-0 top-0 z-30 flex flex-col bg-surface md:hidden" style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between border-b border-line px-section py-tight">
            <div>
              <p className="text-sm font-medium">Lalbagh Heritage Attractions</p>
              <p className="font-mono text-[11px] text-faint">Counterfoil OS workspace</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="flex h-12 w-12 items-center justify-center rounded-sm active:bg-line">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-tight overflow-y-auto p-section" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            {DESTINATIONS.map((d) => {
              const active = isActive(d.href);
              const Icon = d.icon;
              return (
                <Link
                  key={d.label}
                  href={d.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "relative flex h-24 flex-col items-center justify-center gap-tight rounded-sm border transition-colors duration-quick active:bg-ember/10",
                    active ? "border-ember bg-ember/10 text-fg" : "border-line bg-card text-fg",
                  )}
                >
                  {active && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ember text-ink">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                  )}
                  <Icon size={24} strokeWidth={1.5} className={active ? "text-ember" : "text-muted"} />
                  <span className="text-center text-[12px] font-medium leading-tight">{d.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
