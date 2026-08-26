"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, LandPlot, MapPin, MonitorSmartphone, ShieldCheck, Store, UserCog, Users } from "lucide-react";
import { PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listResources } from "@/lib/api";

type IconType = React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

// Settings hub — a card grid over the sub-nav. Each card is one setup area,
// in plain language, so the operator can see the whole surface at a glance
// instead of hunting through a tab strip.
export default function SettingsHub() {
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100, filters: { status: "active" } }), []);
  const resources = resourcesQ.data?.data ?? [];
  const resourceLabel = resources.length && resources.every((r) => r.nounPlural === resources[0].nounPlural)
    ? resources[0].nounPlural
    : "Resources";

  const CARDS: { title: string; desc: string; href: string; icon: IconType }[] = [
    { title: "Business", desc: "Name, contact, currency, tax and receipt template.", href: "/settings/business", icon: Building2 },
    { title: "Locations", desc: "Venues you sell from — addresses and opening hours.", href: "/settings/locations", icon: MapPin },
    { title: "Counters", desc: "Physical points of sale mapped to each location.", href: "/settings/counters", icon: Store },
    { title: resourceLabel, desc: "Spaces and equipment that bookings occupy.", href: "/settings/resources", icon: LandPlot },
    { title: "Team", desc: "Staff members, their PINs and what they can do.", href: "/settings/team", icon: Users },
    { title: "Devices", desc: "Tablets and scanners paired to your workspace.", href: "/settings/devices", icon: MonitorSmartphone },
    { title: "Payments", desc: "Payment accounts, payouts and how money is taken.", href: "/settings/payments", icon: CreditCard },
    { title: "Roles", desc: "Permission sets and discount limits per role.", href: "/settings/roles", icon: UserCog },
    { title: "Security", desc: "Password, two-step, backup codes and sessions.", href: "/settings/security", icon: ShieldCheck },
  ];

  return (
    <PageShell title="Settings" description="Configure your workspace — everything that shapes how you sell, book and get paid.">
      <div className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ title, desc, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="card-surface card-interactive group flex flex-col gap-comfortable p-section"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-ember/10 text-ember">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <ArrowUpRight size={18} strokeWidth={1.5} className="text-faint transition-colors duration-quick group-hover:text-ember" />
            </div>
            <div>
              <p className="type-h2 text-base">{title}</p>
              <p className="type-body mt-inline text-[13px] text-muted">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
