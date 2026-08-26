"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { loadDemoBusiness, startFreshBusiness } from "@/lib/api";
import { DEMOS } from "@/lib/demos";

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
    <main className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-section py-hero">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>
      <h1 className="type-display mt-tight text-5xl">See it as your business.</h1>
      <p className="type-body mt-section max-w-xl text-muted">
        Load a demo operation to explore Counterfoil configured end-to-end — or start fresh
        and set one up yourself.
      </p>

      <div className="mt-major grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => explore(d.id)}
            className="group flex flex-col card-surface p-section text-left transition-all duration-quick hover:-translate-y-0.5 hover:border-ember/40 hover:shadow-sm active:bg-ember/5"
          >
            <span className="type-h2 text-base">{d.name}</span>
            <span className="type-body mt-inline text-[13px] text-muted">{d.tagline}</span>
            <span className="mt-tight font-mono text-[10px] uppercase tracking-wide text-faint">{d.types}</span>
            <span className="mt-tight inline-flex items-center gap-inline text-[13px] text-ember">
              Explore <ArrowRight size={14} strokeWidth={1.5} />
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={fresh}
          className="flex flex-col justify-center rounded-md border border-dashed border-line bg-card p-section text-left transition-all duration-quick hover:border-ember/40 hover:shadow-sm"
        >
          <span className="type-h2 text-base">Start fresh</span>
          <span className="type-body mt-inline text-[13px] text-muted">Set up your own from an empty account — the guided path.</span>
        </button>
      </div>

      <div className="mt-major flex flex-wrap gap-major font-mono text-xs text-faint">
        <Link href="/dashboard" className="hover:text-ember">OS admin →</Link>
        <Link href="/pos" className="hover:text-ember">Go / POS →</Link>
        <Link href="/tokens" className="hover:text-ember">Design tokens →</Link>
        <Link href="/kitchen-sink" className="hover:text-ember">Primitives →</Link>
      </div>
    </main>
  );
}
