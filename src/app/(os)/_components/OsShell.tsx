"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
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
  Search,
  Settings,
  ShieldCheck,
  Store,
  TicketPercent,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ModeButton } from "@/components/ThemeProvider";
import { LocaleToggle } from "@/components/LocaleProvider";
import { LogoMark } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";

// F10 — on mobile the hamburger drawer is gone: a bottom tab bar carries the
// four daily destinations, and More opens a full-height destination grid.
// Desktop is unchanged: the ink sidebar stays.
const MOBILE_TABS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/orders", key: "orders", icon: ReceiptText },
  { href: "/products", key: "products", icon: Package },
] as const;

// Same grid, same order, every time — muscle memory is the point.
const DESTINATIONS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/orders", key: "orders", icon: ReceiptText },
  { href: "/products", key: "products", icon: Package },
  { href: "/reports/sales", key: "reports", icon: BarChart3 },
  { href: "/reports/sales?tab=analytics", key: "analytics", icon: ChartLine },
  { href: "/promotions", key: "promotions", icon: TicketPercent },
  { href: "/pos", key: "pos", icon: Store },
  { href: "/settings/resources", key: "resources", icon: LandPlot },
  { href: "/settings/counters", key: "counters", icon: Store },
  { href: "/settings/locations", key: "locations", icon: MapPin },
  { href: "/settings/team", key: "team", icon: Users },
  { href: "/settings/devices", key: "devices", icon: MonitorSmartphone },
  { href: "/settings/payments", key: "payments", icon: CreditCard },
  { href: "/settings/roles", key: "roles", icon: UserCog },
  { href: "/settings/security", key: "security", icon: ShieldCheck },
  { href: "/settings/business", key: "settings", icon: Settings },
] as const;

export function OsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const operatorQ = useApiQuery(() => getOperator(), []);
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
        {/* Mobile — glass top bar. Sticky so it stays as content scrolls. */}
        <div className="glass-navbar sticky top-0 z-30 flex items-center gap-tight px-section py-tight md:hidden">
          <LogoMark size={24} />
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-faint">OS</span>
          <span className="flex-1" />
          <LocaleToggle />
          <ModeButton />
        </div>

        {/* Desktop — slim glass navbar: search · locale · theme · operator. */}
        <div className="glass-navbar sticky top-0 z-20 hidden h-16 items-center gap-tight px-major md:flex">
          <div className="ml-auto flex items-center gap-tight">
            <div className="hidden items-center gap-tight rounded-sm border border-line bg-card/60 px-comfortable py-tight text-sm text-muted transition-colors duration-quick hover:bg-card focus-within:ring-2 focus-within:ring-ember/20 lg:flex lg:w-64">
              <Search size={16} strokeWidth={1.5} className="text-faint" />
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint"
              />
              <kbd className="rounded-xs bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</kbd>
            </div>
            <LocaleToggle />
            <ModeButton />
            <span className="ml-inline grid h-9 w-9 place-items-center rounded-sm bg-subtle text-[11px] font-bold text-fg ring-1 ring-line">
              {(operatorQ.data?.name ?? "CF").slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="OS navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/80 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_TABS.map((tab) => {
          const active = tabActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              onClick={() => { setMoreOpen(false); if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={cn(
                "relative flex h-14 min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
                active ? "text-ember" : "text-faint",
              )}
            >
              {active && <span aria-hidden className="absolute left-2 right-2 top-0 h-[2px] bg-ember" />}
              <Icon size={24} strokeWidth={1.5} />
              <span className="max-w-full truncate px-inline text-[11px] font-medium">{t(tab.key)}</span>
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
          <span className="max-w-full truncate px-inline text-[11px] font-medium">{t("more")}</span>
        </button>
      </nav>

      {/* More — full-height destination grid */}
      {moreOpen && (
        <div className="fixed inset-x-0 top-0 z-30 flex flex-col bg-surface md:hidden" style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between border-b border-line px-section py-tight">
            <div>
              <p className="text-sm font-medium">{operatorQ.data?.name ?? "Counterfoil"}</p>
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
                  key={d.href}
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
                  <span className="text-center text-[12px] font-medium leading-tight">{t(d.key)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
