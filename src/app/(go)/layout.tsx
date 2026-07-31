"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const GO_NAV = [
  { href: "/pos", label: "Sell" },
  { href: "/schedule", label: "Schedule" },
  { href: "/scan", label: "Scan" },
  { href: "/checkin", label: "Check-in" },
  { href: "/quick-pass", label: "Pass" },
  { href: "/shift/close", label: "Shift" },
];

// Go surface shell — front of house on a tablet. Minimal chrome, touch-first.
// Hard floor: 48px touch targets, 8px min spacing (staff use it outdoors, in
// gloves, with a queue). No hover-only affordances. Active tab = 3px ember.
export default function GoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="flex items-center justify-between gap-tight border-b border-neutral-200 px-section py-tight">
        <div className="flex min-w-0 items-center gap-tight">
          <Link href="/login" className="flex h-12 shrink-0 items-center gap-tight">
            <span className="type-h2 text-base">Counterfoil</span>
            <span className="font-mono text-[11px] text-neutral-400">Go</span>
          </Link>
          <span className="hidden shrink-0 rounded-xs border border-neutral-200 px-tight py-inline text-[11px] text-neutral-600 sm:block">Fort Main Gate</span>
          <span className="hidden shrink-0 font-mono text-[11px] text-neutral-400 sm:block" title="Shift open for">⏱ 3:24</span>
        </div>
        <nav className="flex items-center gap-inline overflow-x-auto">
          {GO_NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`) || (n.href === "/pos" && pathname.startsWith("/pos"));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center whitespace-nowrap border-b-[3px] px-comfortable text-sm text-ink active:bg-ember/10",
                  active ? "border-ember font-medium" : "border-transparent",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] text-paper" title="Nadia Islam">N</span>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
