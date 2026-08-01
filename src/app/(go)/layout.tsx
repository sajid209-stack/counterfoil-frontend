"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CircleHelp,
  Clock,
  Ellipsis,
  ScanLine,
  Settings,
  Store,
  Ticket,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ModeButton } from "@/components/ThemeProvider";
import { Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listProducts } from "@/lib/api";
import { isSlotBased } from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

// F10 — nav is responsive by form factor, not fixed. Phone + tablet portrait
// get a bottom tab bar (thumb zone); a tablet held in landscape gets an 88px
// left rail (thumbs sit at the screen edges there). No top tab strip anywhere.
const TABS = [
  { href: "/pos", label: "Sell", icon: Store },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/checkin", label: "Check In", icon: UserCheck },
];

const MORE_ITEMS = [
  { label: "Shift", icon: Clock, href: "/shift/close" },
  { label: "My sales", icon: Banknote, action: "sales" },
  { label: "Quick pass", icon: Ticket, href: "/quick-pass" },
  { label: "My profile", icon: UserRound, href: "/profile" },
  { label: "Switch user", icon: Users, href: "/login" },
  { label: "Settings", icon: Settings, href: "/settings/business" },
  { label: "Help", icon: CircleHelp, action: "help" },
] as const;

export default function GoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  // Don't show an empty destination: Schedule only exists for slotted catalogues.
  const hasSlotted = (productsQ.data?.data ?? []).some((p) => isSlotBased(p.bookingType));
  const tabs = TABS.filter((t) => t.href !== "/schedule" || hasSlotted);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tabButton = (t: (typeof TABS)[number], rail: boolean) => {
    const active = isActive(t.href);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        onClick={() => { if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className={cn(
          "relative flex min-w-12 flex-1 flex-col items-center justify-center gap-inline transition-colors duration-quick active:bg-ember/10",
          rail ? "h-[72px] flex-none" : "h-14",
          active ? "text-ember" : "text-faint",
        )}
      >
        {/* active marker: 2px along the tab's leading edge */}
        {active && <span aria-hidden className={cn("absolute bg-ember", rail ? "left-0 top-2 bottom-2 w-[2px]" : "left-2 right-2 top-0 h-[2px]")} />}
        <Icon size={24} strokeWidth={1.5} />
        <span className="max-w-full truncate px-inline text-[11px] font-medium">{t.label}</span>
      </Link>
    );
  };

  const moreButton = (rail: boolean) => (
    <button
      type="button"
      onClick={() => setMoreOpen(true)}
      className={cn(
        "flex min-w-12 flex-1 flex-col items-center justify-center gap-inline text-faint transition-colors duration-quick active:bg-ember/10",
        rail ? "h-[72px] flex-none" : "h-14",
      )}
    >
      <Ellipsis size={24} strokeWidth={1.5} />
      <span className="max-w-full truncate px-inline text-[11px] font-medium">More</span>
    </button>
  );

  const runItem = (item: (typeof MORE_ITEMS)[number]) => {
    setMoreOpen(false);
    if ("action" in item && item.action === "sales") setSalesOpen(true);
    if ("action" in item && item.action === "help") setHelpOpen(true);
  };

  return (
    <div className="flex min-h-full flex-col bg-surface">
      {/* Context bar — business · counter · shift state. Nav does NOT live here. */}
      <header className="flex items-center justify-between gap-tight border-b border-line px-section py-tight">
        <div className="flex min-w-0 items-center gap-tight">
          <Link href="/login" className="flex h-12 shrink-0 items-center gap-tight">
            <span className="type-h2 text-base">Counterfoil</span>
            <span className="font-mono text-[11px] text-faint">Go</span>
          </Link>
          <span className="hidden shrink-0 rounded-xs border border-line px-tight py-inline text-[11px] text-muted sm:block">Fort Main Gate</span>
          <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:block" title="Shift open for">⏱ 3:24</span>
        </div>
        <span className="flex shrink-0 items-center gap-tight">
          <ModeButton />
          <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-inverse font-mono text-[13px] text-inverse-fg" title="Nadia Islam — my profile">N</Link>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Tablet-landscape left rail (88px, icon over label) */}
        <aside className="sticky top-0 hidden h-[calc(100vh-65px)] w-[88px] shrink-0 flex-col border-r border-line bg-card rail:flex">
          {tabs.map((t) => tabButton(t, true))}
          {moreButton(true)}
        </aside>

        {/* Content clears the bottom bar (+ home indicator) except in rail mode */}
        <div className="min-w-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] rail:pb-0">{children}</div>
      </div>

      {/* Bottom tab bar — phone + tablet portrait */}
      <nav
        aria-label="Go navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card rail:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((t) => tabButton(t, false))}
        {moreButton(false)}
      </nav>

      {/* More — bottom sheet grid */}
      {moreOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-inverse/40" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 rounded-t-md border-t border-line bg-sheet p-section" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <div className="mb-section flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lalbagh Heritage Attractions</p>
                <p className="font-mono text-[11px] text-faint">Fort Main Gate · shift open 3:24</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="flex h-12 w-12 items-center justify-center rounded-sm active:bg-line">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-tight sm:grid-cols-4">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <Icon size={24} strokeWidth={1.5} />
                    <span className="text-[12px] font-medium">{item.label}</span>
                  </>
                );
                return "href" in item && item.href ? (
                  <Link key={item.label} href={item.href} onClick={() => setMoreOpen(false)} className="flex h-20 flex-col items-center justify-center gap-tight rounded-sm border border-line bg-card text-fg active:bg-ember/10">
                    {inner}
                  </Link>
                ) : (
                  <button key={item.label} type="button" onClick={() => runItem(item)} className="flex h-20 flex-col items-center justify-center gap-tight rounded-sm border border-line bg-card text-fg active:bg-ember/10">
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Modal open={salesOpen} onClose={() => setSalesOpen(false)} title="My sales — this shift">
        <div className="flex flex-col gap-tight font-mono text-sm tabular-nums">
          <div className="flex justify-between border-b border-line pb-tight"><span className="font-sans text-muted">Takings</span><span>{formatMoney(1245000)}</span></div>
          <div className="flex justify-between border-b border-line pb-tight"><span className="font-sans text-muted">Sales</span><span>9</span></div>
          <div className="flex justify-between"><span className="font-sans text-muted">Cash in drawer</span><span>{formatMoney(485000)}</span></div>
        </div>
        <p className="mt-section text-[12px] text-faint">Full breakdown at shift close.</p>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <p className="text-sm text-muted">Stuck mid-queue? Call the duty manager on <span className="font-mono text-fg">01711-000000</span>, or find printable how-tos in OS under Settings.</p>
      </Modal>
    </div>
  );
}
