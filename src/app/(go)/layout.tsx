import Link from "next/link";

// Go surface shell — front of house on a tablet. Minimal chrome, touch-first.
// Hard floor: 48px touch targets, 8px min spacing (staff use it outdoors, in
// gloves, with a queue). No hover-only affordances.
export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-neutral-200 px-section py-tight">
        <Link href="/" className="flex h-12 items-center gap-tight">
          <span className="type-h2 text-base">Counterfoil</span>
          <span className="font-mono text-[11px] text-neutral-400">Go</span>
        </Link>
        <span className="flex h-12 items-center rounded-sm bg-neutral-900 px-comfortable font-mono text-xs text-paper">
          NO SHIFT
        </span>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
