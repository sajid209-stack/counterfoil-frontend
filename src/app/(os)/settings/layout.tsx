"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const SUB_NAV = [
  { label: "Business", href: "/settings/business" },
  { label: "Locations", href: "/settings/locations" },
  { label: "Counters", href: "/settings/counters" },
  { label: "Team", href: "/settings/team" },
  { label: "Devices", href: "/settings/devices" },
  { label: "Payments", href: "/settings/payments" },
  { label: "Roles", href: "/settings/roles" },
];

// Settings shell — its own sub-nav. Setup lives here, out of the daily nav.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-neutral-200 bg-white px-major">
        <nav className="flex gap-inline overflow-x-auto">
          {SUB_NAV.map((s) => {
            const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap border-b-2 px-comfortable text-sm transition-colors duration-quick",
                  active ? "border-ink font-medium text-ink" : "border-transparent text-neutral-400 hover:text-ink",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
