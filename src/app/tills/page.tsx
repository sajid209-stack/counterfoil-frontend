import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui";
import { TILLS } from "@/lib/tills";

export const metadata = { title: "Till designs · Counterfoil" };

/**
 * The chooser.
 *
 * Three designs for one job, described in terms of the difference that matters
 * to whoever is reviewing them rather than by version number — "no cart" and
 * "dense row list" are decisions someone can have an opinion about; "v2" is
 * not.
 *
 * Deliberately outside the Go chrome. This is a decision about which till to
 * look at, not a thing a cashier does mid-shift, so it should not appear to be
 * part of a shift.
 */
export default function TillsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-section py-hero">
      <div className="flex items-center justify-between gap-comfortable">
        <Logo size={28} />
        <Link
          href="/"
          className="flex items-center gap-inline font-mono text-xs text-faint hover:text-ember"
        >
          <ArrowLeft size={13} strokeWidth={1.5} /> Home
        </Link>
      </div>

      <h1 className="type-h1 mt-major text-3xl">Till designs</h1>
      <p className="type-body mt-tight max-w-xl text-muted">
        Three shapes for the same counter. They sell the same catalogue through the same
        pricing and the same order engine — what differs is how a sale is assembled.
      </p>

      <div className="mt-major flex flex-col gap-comfortable">
        {TILLS.map((till) =>
          till.ready ? (
            <Link
              key={till.id}
              href={till.href}
              className="group flex items-start gap-comfortable rounded-go border border-line bg-card p-section transition-all duration-quick hover:-translate-y-0.5 hover:border-ember/40 hover:shadow-md"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-[13px] text-muted">
                {till.short.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-tight">
                  <span className="type-h2 text-lg">{till.name}</span>
                  <span className="font-mono text-xs text-faint">{till.href}</span>
                </span>
                <span className="type-body mt-inline block text-[14px] text-muted">{till.blurb}</span>
              </span>
              <ArrowRight
                size={18}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-faint transition-transform duration-quick group-hover:translate-x-0.5 group-hover:text-ember"
              />
            </Link>
          ) : (
            /* Shown, not offered. A variant that is planned but not built says
               so — a link that 404s is worse than an honest placeholder. */
            <div
              key={till.id}
              className="flex items-start gap-comfortable rounded-go border border-dashed border-strong p-section opacity-70"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-[13px] text-faint">
                {till.short.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-tight">
                  <span className="type-h2 text-lg text-muted">{till.name}</span>
                  <span className="rounded-full bg-subtle px-tight py-inline font-mono text-xs text-faint">
                    being built
                  </span>
                </span>
                <span className="type-body mt-inline block text-[14px] text-muted">{till.blurb}</span>
              </span>
            </div>
          ),
        )}
      </div>

      <div className="mt-hero flex flex-wrap gap-major border-t border-line pt-major font-mono text-xs text-faint">
        <Link href="/dashboard" className="hover:text-ember">OS admin →</Link>
        <Link href="/tokens" className="hover:text-ember">Design tokens →</Link>
        <Link href="/kitchen-sink" className="hover:text-ember">Primitives →</Link>
      </div>
    </main>
  );
}
