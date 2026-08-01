"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listResources } from "@/lib/api";

// Settings shell — its own sub-nav. Setup lives here, out of the daily nav.
// Resources sit between Counters and Team, labelled with the operator's noun.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = resourcesQ.data?.data ?? [];
  const resourceLabel = resources.length && resources.every((r) => r.nounPlural === resources[0].nounPlural)
    ? resources[0].nounPlural
    : "Resources";

  const SUB_NAV = [
    { label: "Business", href: "/settings/business" },
    { label: "Locations", href: "/settings/locations" },
    { label: "Counters", href: "/settings/counters" },
    { label: resourceLabel, href: "/settings/resources" },
    { label: "Team", href: "/settings/team" },
    { label: "Devices", href: "/settings/devices" },
    { label: "Payments", href: "/settings/payments" },
    { label: "Roles", href: "/settings/roles" },
    { label: "Security", href: "/settings/security" },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-line bg-card px-major">
        <nav className="flex gap-inline overflow-x-auto">
          {SUB_NAV.map((s) => {
            const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap border-b-2 px-comfortable text-sm transition-colors duration-quick",
                  active ? "border-inverse font-medium text-fg" : "border-transparent text-faint hover:text-fg",
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
