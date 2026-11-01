"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Odometer, Tilt } from "../_components/fx";
import styles from "./Pricing.module.css";
import { Heading, LinkButton, Section, delay } from "../_components/ui";
import { EVENTS_LINES, PLANS } from "./PricingData";
import { PricingChart } from "./PricingChart";

type Period = "monthly" | "yearly";
const PERIODS: { id: Period; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = PERIODS.findIndex((p) => p.id === value);
  const move = (to: number) => {
    const n = (to + PERIODS.length) % PERIODS.length;
    onChange(PERIODS[n].id);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") move(idx + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(idx - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(PERIODS.length - 1);
    else return;
    e.preventDefault();
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Billing period" onKeyDown={onKey} className="relative grid grid-cols-2 rounded-[10px] bg-[var(--cf-bg-3)] p-1">
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[7px] bg-white shadow-[0_1px_2px_rgb(17_17_16/0.14),0_2px_6px_-2px_rgb(17_17_16/0.1)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${idx * 100}%)` }}
        />
        {PERIODS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            tabIndex={value === p.id ? 0 : -1}
            onClick={() => onChange(p.id)}
            className={cn(
              "relative z-10 h-11 min-w-[96px] rounded-[7px] px-4 text-[14px] font-medium transition-colors md:h-8",
              value === p.id ? "text-[var(--cf-fg)]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className={cn("cf-mono text-[12px] uppercase tracking-[0.06em] transition-colors", value === "yearly" ? "text-[var(--cf-accent-text)]" : "text-[var(--cf-muted)]")}>
        Yearly: 2 months free
      </span>
    </div>
  );
}

export function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");
  return (
    <Section id="pricing" flush>
      <div className="px-5 pb-12 pt-20 md:px-12 md:pb-16 md:pt-28">
        <Heading label="Pricing" title="No cut of your tickets." dim="A plan doesn’t grow with your sales."
          lead="A marketplace takes a share of every ticket, for as long as you sell. A Counterfoil plan costs the same whether you sell ten tickets or ten thousand." />
        <div data-reveal style={delay(200)} className="mt-8">
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      </div>

      <div data-reveal className="cf-cells grid-cols-1 px-5 md:grid-cols-2 md:px-12 lg:grid-cols-4" style={{ background: "transparent" }}>
        {PLANS.map((p) => {
          const price = period === "monthly" ? p.monthly : p.yearly;
          return (
            <div key={p.name} className={cn("relative min-w-0", p.featured && styles.bob)} style={{ background: "transparent" }}>
              {p.featured && <span aria-hidden className={cn("pointer-events-none absolute inset-3 rounded-2xl bg-[var(--cf-accent)] blur-2xl", styles.glow)} />}
              <Tilt className="flex h-full min-w-0 flex-col rounded-2xl bg-[var(--cf-bg-2)] p-6 md:p-7" style={p.featured ? { background: "var(--cf-accent-wash)" } : undefined}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="cf-h3">{p.name}</h3>
                {p.featured && <span className="cf-mono rounded-full bg-[var(--cf-accent)] px-2 py-1 text-[12px] font-medium uppercase leading-none tracking-[0.06em] text-[#111110]">Recommended</span>}
              </div>
              <p className="mt-1 text-[13px] text-[var(--cf-muted)]">{p.who}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                  <Odometer prefix="৳" value={price.toLocaleString("en-US")} />
                </span>
                <span className="text-[13px] text-[var(--cf-muted)]">{price === 0 ? "free" : period === "monthly" ? "a month" : "a year"}</span>
              </p>
              <p className="mt-2 h-5 text-[13px] text-[var(--cf-muted)]">{p.monthly === 0 ? "Month to month" : period === "yearly" ? "Two months free" : "Billed monthly"}</p>
              <LinkButton href="/sign-up" variant={p.featured ? "primary" : "secondary"} className="mt-5 w-full">
                {p.monthly === 0 ? "Start free" : "Get started"}
              </LinkButton>
              <ul className="mt-6 flex flex-col gap-2.5 text-[13px] leading-[1.45] text-[var(--cf-fg-2)]">
                {p.lines.map((l) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <Check aria-hidden size={14} strokeWidth={2} className="mt-[2px] shrink-0 text-[var(--color-brand-foreground)]" />
                    {l}
                  </li>
                ))}
              </ul>
              </Tilt>
            </div>
          );
        })}

        <div className="flex flex-col gap-5 p-6 md:col-span-2 md:p-7 lg:col-span-4 lg:flex-row lg:items-center lg:gap-10">
          <div className="shrink-0">
            <p className="cf-label">For event organisers</p>
            <h3 className="cf-h3 mt-1.5">Events</h3>
          </div>
          <p className="flex items-baseline gap-3">
            <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--cf-accent)]">6%</span>
            <span className="text-[13px] text-[var(--cf-muted)]">of ticket revenue, nothing monthly</span>
          </p>
          <ul className="flex flex-col gap-2 text-[13px] text-[var(--cf-fg-2)] sm:flex-row sm:flex-wrap sm:gap-x-6 lg:ml-auto">
            {EVENTS_LINES.map((l) => (
              <li key={l} className="flex items-center gap-2.5">
                <Check aria-hidden size={14} strokeWidth={2} className="shrink-0 text-[var(--color-brand-foreground)]" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="px-5 py-5 text-[13px] text-[var(--cf-muted)] md:px-12">
        SMS, email, form replies and waivers come with an allowance in every plan; past it they are charged per unit, and the rate falls as the plan grows.
      </p>

      <div className="mx-5 mb-16 overflow-hidden rounded-2xl bg-[var(--cf-bg-2)] md:mx-12 md:mb-24">
        <div data-reveal className="px-5 py-5 md:px-8">
          <h3 className="cf-h3">What a share costs, next to a plan</h3>
          <p className="mt-1 text-[13px] text-[var(--cf-muted)]">A month of selling tickets at ৳500 each.</p>
        </div>
        <PricingChart />
      </div>
    </Section>
  );
}
