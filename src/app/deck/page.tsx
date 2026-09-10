import Link from "next/link";
import { ArrowLeft, SquareStack } from "lucide-react";
import { EmptyState, Logo } from "@/components/ui";

export const metadata = { title: "Deck · Counterfoil" };

/**
 * Counterfoil Deck — the surface, scaffolded.
 *
 * Deliberately outside the OS shell, the same way `/pos` and `/tills` are. The
 * sidebar link that reaches this carries the same bordered treatment and the
 * same ↗ glyph as Point of Sale, and that glyph is a promise: it says you are
 * leaving the admin app for another surface. Rendering this inside `(os)` would
 * have kept the sidebar visible and made the arrow a lie.
 *
 * What it holds is not decided yet, so this says so plainly rather than
 * dressing an empty page as a finished one. A placeholder that admits it is a
 * placeholder is the only honest kind.
 */
export default function DeckPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-section py-hero">
      <div className="flex items-center justify-between gap-comfortable">
        <Logo size={28} />
        <Link
          href="/dashboard"
          className="-my-tight inline-flex min-h-11 items-center gap-inline font-mono text-xs text-muted hover:text-ember sm:min-h-0"
        >
          <ArrowLeft size={13} strokeWidth={1.5} /> Dashboard
        </Link>
      </div>

      <h1 className="type-h1 mt-major text-3xl">Counterfoil Deck</h1>
      <p className="type-body mt-tight max-w-xl text-muted">
        A surface of its own, reached from the OS sidebar alongside Point of Sale.
      </p>

      <div className="mt-hero">
        <EmptyState
          icon={<SquareStack size={28} strokeWidth={1.5} />}
          title="Nothing here yet"
          message="The route, the link and the chrome are in place. What Deck actually shows is still to be decided."
        />
      </div>
    </main>
  );
}
