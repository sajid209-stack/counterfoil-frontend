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
import { useTranslations } from "next-intl";
import { ModeButton } from "@/components/ThemeProvider";
import { LocaleToggle } from "@/components/LocaleProvider";
import { Logo, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listProducts } from "@/lib/api";
import { isSlotBased } from "@/lib/schedule";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

// F10 — nav is responsive by form factor, not fixed. Phone + tablet portrait
// get a bottom tab bar (thumb zone); a tablet held in landscape gets an 88px
// left rail (thumbs sit at the screen edges there). No top tab strip anywhere.
const TABS = [
  { href: "/pos", key: "sell", icon: Store },
  { href: "/schedule", key: "schedule", icon: CalendarDays },
  { href: "/scan", key: "scan", icon: ScanLine },
  { href: "/checkin", key: "checkin", icon: UserCheck },
] as const;

const MORE_ITEMS = [
  { key: "shift", icon: Clock, href: "/shift/close" },
  { key: "mySales", icon: Banknote, action: "sales" },
  { key: "quickPass", icon: Ticket, href: "/quick-pass" },
  { key: "myProfile", icon: UserRound, href: "/profile" },
  { key: "switchUser", icon: Users, href: "/login" },
  { key: "settings", icon: Settings, href: "/settings/business" },
  { key: "help", icon: CircleHelp, action: "help" },
] as const;

export default function GoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  // Don't show an empty destination: Schedule only exists for slotted catalogues.
  const hasSlotted = (productsQ.data?.data ?? []).some((p) => isSlotBased(p.bookingType));
  const tabs = TABS.filter((t) => t.href !== "/schedule" || hasSlotted);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tabButton = (tab: (typeof TABS)[number], rail: boolean) => {
    const active = isActive(tab.href);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        onClick={() => { if (active) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className={cn(
          "relative flex min-w-12 flex-1 flex-col items-center justify-center gap-inline rounded-full transition-colors duration-quick active:bg-ember/10",
          rail ? "h-[64px] flex-none" : "h-[54px]",
          active ? "text-brand-foreground" : "text-muted",
        )}
      >
        {/* Selection is a soft ember pill behind the whole tab, the way the
            reference draws it — not a 2px rule on one edge. The heavier icon
            stroke says it a second way, so the tint is never doing it alone. */}
        {active && <span aria-hidden className="absolute inset-0 rounded-full bg-ember/15" />}
        <Icon size={22} strokeWidth={active ? 2.25 : 1.6} className="relative" />
        <span className="relative max-w-full truncate text-[11px] font-medium">{t(tab.key)}</span>
      </Link>
    );
  };

  const moreButton = (rail: boolean) => (
    <button
      type="button"
      onClick={() => setMoreOpen(true)}
      className={cn(
        "flex min-w-12 flex-1 flex-col items-center justify-center gap-inline rounded-full text-muted transition-colors duration-quick active:bg-ember/10",
        rail ? "h-[64px] flex-none" : "h-[54px]",
      )}
    >
      <Ellipsis size={22} strokeWidth={1.6} />
      <span className="max-w-full truncate text-[11px] font-medium">{t("more")}</span>
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
      <header className="flex items-center justify-between gap-tight px-section py-tight">
        <div className="flex min-w-0 items-center gap-tight">
          <Link href="/login" className="flex h-12 shrink-0 items-center">
            <Logo variant="go" size={30} />
          </Link>
          <span className="hidden shrink-0 rounded-full bg-subtle px-comfortable py-inline text-[13px] text-muted sm:block">Fort Main Gate</span>
          <span className="hidden shrink-0 font-mono text-[13px] text-muted sm:block" title="Shift open for">⏱ 3:24</span>
        </div>
        <span className="flex shrink-0 items-center gap-tight">
          <ModeButton shape="round" />
          <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-inverse font-mono text-[13px] text-inverse-fg" title="Nadia Islam — my profile">N</Link>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Tablet-landscape left rail (88px, icon over label) */}
        <nav aria-label="Go navigation" className="sticky top-0 hidden h-[calc(100vh-64px)] w-[88px] shrink-0 flex-col gap-inline p-tight rail:flex">
          {tabs.map((t) => tabButton(t, true))}
          {moreButton(true)}
        </nav>

        {/* Content clears the bottom bar (+ home indicator) except in rail mode */}
        <div className="min-w-0 flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] rail:pb-0">{children}</div>
      </div>

      {/* Bottom tab bar — phone + tablet portrait */}
      {/* Content passes BEHIND a floating bar, and the 12px of ground on
          every side of it turns that into a sliced-looking card. A gradient of
          the page colour under the bar lets the list dissolve into the page
          instead. Decorative and inert, so it is out of the a11y tree and
          never eats a tap. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[200px] bg-gradient-to-t from-surface from-70% to-transparent rail:hidden"
      />

      {/* A floating pill inset from the screen edges, not a full-bleed strip.
          It clears the home indicator on its own, and the content column above
          reserves its height (86px) so the bar never sits over a row — a fixed
          bar that overlaps content is the standing sticky-nav failure. */}
      <nav
        aria-label="Go navigation"
        className="fixed inset-x-tight z-40 flex gap-inline rounded-full p-inline go-raised sm:inset-x-comfortable rail:hidden"
        style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        {tabs.map((t) => tabButton(t, false))}
        {moreButton(false)}
      </nav>

      {/* More — bottom sheet grid */}
      {moreOpen && (
        <div className="fixed inset-0 z-50">
          <div className="go-sheet-scrim absolute inset-0 bg-inverse/40" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="go-sheet-panel absolute inset-x-0 bottom-0 rounded-t-go-lg bg-sheet p-section shadow-go-pop" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
            <div className="mb-section flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lalbagh Heritage Attractions</p>
                <p className="font-mono text-[13px] text-muted">Fort Main Gate · shift open 3:24</p>
              </div>
              <div className="flex items-center gap-tight">
                <LocaleToggle />
                <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="flex h-12 w-12 items-center justify-center rounded-full active:bg-line">
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-tight sm:grid-cols-4">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <Icon size={24} strokeWidth={1.5} />
                    <span className="text-[13px] font-medium">{t(item.key)}</span>
                  </>
                );
                return "href" in item && item.href ? (
                  <Link key={item.key} href={item.href} onClick={() => setMoreOpen(false)} className="flex h-20 flex-col items-center justify-center gap-tight rounded-go bg-subtle text-fg transition-colors duration-quick active:bg-ember/15">
                    {inner}
                  </Link>
                ) : (
                  <button key={item.key} type="button" onClick={() => runItem(item)} className="flex h-20 flex-col items-center justify-center gap-tight rounded-go bg-subtle text-fg transition-colors duration-quick active:bg-ember/15">
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
        <p className="mt-section text-[13px] text-muted">Full breakdown at shift close.</p>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <p className="text-sm text-muted">Stuck mid-queue? Call the duty manager on <span className="font-mono text-fg">01711-000000</span>, or find printable how-tos in OS under Settings.</p>
      </Modal>
    </div>
  );
}
