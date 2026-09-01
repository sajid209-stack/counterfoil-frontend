"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Landmark, Trophy, Disc3, Flower2, Clapperboard, type LucideIcon } from "lucide-react";
import { loadDemoBusiness, startFreshBusiness } from "@/lib/api";
import { DEMOS } from "@/lib/demos";
import { Logo } from "@/components/ui";

// Each demo business is marked by its own glyph rather than a photograph. The
// stock shots this wall used to carry showed the wrong places — a Californian
// fort standing in for the Dhaka museum, a watermarked shirt for the turf — and
// a wall only reads as a wall if every card is treated the same way. A drawn
// mark is honest about being a demo and stays on-brand in both modes.
const DEMO_GLYPH: Record<string, LucideIcon> = {
  museum: Landmark,
  turf: Trophy,
  bowling: Disc3,
  spa: Flower2,
  cinema: Clapperboard,
};

export default function Home() {
  const router = useRouter();

  const explore = (id: string) => {
    const d = DEMOS.find((x) => x.id === id)!;
    loadDemoBusiness(d.name, d.currency, d.productIds);
    router.push("/dashboard");
  };
  const fresh = () => {
    startFreshBusiness();
    router.push("/sign-up");
  };

  return (
    <main className="relative min-h-full overflow-hidden">
      {/* Ambient warmth — a soft ember glow bleeding in from the top-right, the
          brand colour used as atmosphere rather than decoration. */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-ember/15 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-1/2 h-96 w-96 rounded-full bg-ember/5 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-section py-hero sm:px-major">
        {/* Wordmark */}
        <Logo size={30} />

        {/* Hero — the thesis: this is the operating system for a real gate. */}
        <div className="mt-hero max-w-2xl">
          <p className="type-label text-[12px] text-brand-foreground">Operating system for venues · tours · attractions</p>
          <h1 className="type-display mt-comfortable text-5xl sm:text-6xl">
            See it as <span className="text-ember">your</span> business.
          </h1>
          <p className="type-body mt-section max-w-xl text-[15px] text-muted">
            Load a demo operation configured end-to-end — tickets, bookings, pricing, the gate — and
            walk it as if it were yours. Or start fresh and set one up.
          </p>
        </div>

        {/* Pick a business — admission-ticket cards. */}
        <p className="type-label mt-hero text-[11px] text-faint">Pick a business to explore</p>
        <div className="mt-tight grid gap-section sm:grid-cols-2 lg:grid-cols-3">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => explore(d.id)}
              className="card-surface card-interactive group relative flex flex-col overflow-hidden p-0 text-left"
            >
              {/* Banner — the vertical's glyph on a warm ground. */}
              <div className="relative flex h-28 w-full items-center justify-center overflow-hidden bg-subtle">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-ember/10 blur-3xl" />
                {(() => {
                  const Glyph = DEMO_GLYPH[d.id] ?? Landmark;
                  return <Glyph aria-hidden size={32} strokeWidth={1.5} className="relative text-muted transition-transform duration-considered group-hover:scale-110" />;
                })()}
              </div>

              {/* Ticket perforation — the counterfoil tear. The two notches sit
                  half over the card edges; overflow-hidden clips them into a
                  clean semicircular bite. */}
              <div className="relative h-3">
                <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-surface" />
                <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-surface" />
                <div className="absolute inset-x-3 top-1/2 border-t border-dashed border-strong" />
              </div>

              {/* Stub */}
              <div className="flex flex-1 flex-col p-section pt-tight">
                <span className="type-h2 text-base">{d.name}</span>
                <span className="type-body mt-inline text-[13px] text-muted">{d.tagline}</span>
                <span className="mt-tight font-mono text-[10px] uppercase leading-relaxed tracking-wide text-faint">{d.types}</span>
                <span className="mt-comfortable inline-flex items-center gap-inline text-[13px] font-medium text-ember">
                  Explore <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-quick group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          ))}

          {/* Start fresh */}
          <button
            type="button"
            onClick={fresh}
            className="card-interactive group flex min-h-[15rem] flex-col items-start justify-center gap-tight rounded-[16px] border border-dashed border-strong bg-transparent p-section text-left hover:border-ember"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-ember/10 text-ember">
              <Plus size={20} strokeWidth={1.5} />
            </span>
            <span className="type-h2 mt-tight text-base">Start fresh</span>
            <span className="type-body text-[13px] text-muted">Set up your own from an empty account — the guided path.</span>
          </button>
        </div>

        {/* Quiet dev/entry links. */}
        <div className="mt-hero flex flex-wrap gap-major border-t border-line pt-major font-mono text-xs text-faint">
          <Link href="/dashboard" className="hover:text-ember">OS admin →</Link>
          <Link href="/pos" className="hover:text-ember">Go · POS →</Link>
          <Link href="/tokens" className="hover:text-ember">Design tokens →</Link>
          <Link href="/kitchen-sink" className="hover:text-ember">Primitives →</Link>
        </div>
      </div>
    </main>
  );
}
