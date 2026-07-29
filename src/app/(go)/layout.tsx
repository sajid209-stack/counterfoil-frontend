import Link from "next/link";

const GO_NAV = [
  { href: "/pos", label: "Sell" },
  { href: "/scan", label: "Scan" },
  { href: "/bookings", label: "Arrivals" },
  { href: "/shift/close", label: "Close" },
];

// Go surface shell — front of house on a tablet. Minimal chrome, touch-first.
// Hard floor: 48px touch targets, 8px min spacing (staff use it outdoors, in
// gloves, with a queue). No hover-only affordances.
export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-neutral-200 px-section py-tight">
        <Link href="/login" className="flex h-12 items-center gap-tight">
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-neutral-400">Go</span>
        </Link>
        <nav className="flex items-center gap-inline">
          {GO_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex h-12 items-center rounded-sm px-comfortable text-sm text-ink active:bg-neutral-200"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
