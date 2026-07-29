"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// OS navigation. `ready` items are live routes; the rest are placeholders for
// screens still to be built — shown but not linked, so the demo has no dead
// 404s. Flip `ready` to true as each screen lands.
const NAV: { label: string; href: string; ready: boolean }[] = [
  { label: "Dashboard", href: "/dashboard", ready: true },
  { label: "Products", href: "/products", ready: true },
  { label: "Locations", href: "/locations", ready: true },
  { label: "Counters", href: "/counters", ready: true },
  { label: "Staff", href: "/staff", ready: true },
  { label: "Roles", href: "/settings/roles", ready: true },
  { label: "Orders", href: "/orders", ready: false },
  { label: "Sales Reports", href: "/reports", ready: false },
  { label: "Calendar", href: "/calendar", ready: false },
  { label: "Business Setup", href: "/settings/business", ready: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-major bg-neutral-900 px-comfortable py-section text-paper">
      <Link href="/" className="px-comfortable">
        <span className="type-h2 text-lg text-paper">Counterfoil</span>
        <span className="ml-inline font-mono text-[11px] text-neutral-400">OS</span>
      </Link>

      <nav className="flex flex-col gap-inline">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (!item.ready) {
            return (
              <span
                key={item.href}
                className="flex items-center justify-between rounded-sm px-comfortable py-tight text-sm text-neutral-600"
              >
                {item.label}
                <span className="font-mono text-[10px] text-neutral-600">soon</span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-sm px-comfortable py-tight text-sm transition-colors duration-quick ${
                active
                  ? "bg-ember text-ink"
                  : "text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
