"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Heading, LinkButton, Section, delay } from "../_components/ui";
import { EVENTS_LINES, PLANS, taka } from "./PricingData";
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
    <div role="radiogroup" aria-label="Billing period" onKeyDown={onKey} className="inline-grid grid-cols-2 rounded-full bg-[var(--cf-paper)] p-1">
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
            "h-11 min-w-[104px] rounded-full px-5 text-[15px] font-medium transition-colors duration-150",
            value === p.id ? "bg-white text-[var(--cf-fg)] shadow-[var(--cf-shadow-frame)]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");
  return (
    <Section id="pricing" tone="white">
      <Heading
        align="center"
        eyebrow="Pricing"
        title="No cut of your tickets."
        lead="A marketplace takes a share of every ticket, for as long as you sell. A plan costs the same whether you sell ten tickets or ten thousand."
      />
      <div data-reveal style={delay(200)} className="mt-9 flex justify-center">
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div data-reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const price = period === "monthly" ? p.monthly : p.yearly;
          return (
            <div
              key={p.name}
              className={cn(
                "flex min-w-0 flex-col rounded-[20px] p-6 md:p-7",
                p.featured ? "bg-white shadow-[var(--cf-shadow-frame)]" : "bg-[var(--cf-paper)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="cf-h3">{p.name}</h3>
                {p.featured && <span className="rounded-full bg-[var(--cf-paper)] px-2.5 py-1 text-[12px] font-medium leading-none text-[var(--cf-fg)]">Recommended</span>}
              </div>
              <p className="cf-body mt-1 min-h-[48px] text-[14px]">{p.who}</p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{taka(price)}</span>
              </p>
              <p className="mt-2 text-[14px] text-[var(--cf-muted)]">{p.monthly === 0 ? "free, month to month" : period === "monthly" ? "per month" : "per year"}</p>
              <LinkButton href="/sign-up" variant={p.featured ? "primary" : "secondary"} className="mt-6 w-full">
                {p.monthly === 0 ? "Start free" : "Get started"}
              </LinkButton>
              <ul className="mt-6 flex flex-col gap-3 text-[14px] leading-[1.45] text-[var(--cf-fg)]">
                {p.lines.map((l) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <Check aria-hidden size={15} strokeWidth={2} className="mt-[2px] shrink-0 text-[var(--cf-accent)]" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div data-reveal className="mt-4 flex flex-col gap-5 rounded-[20px] bg-[var(--cf-paper)] p-6 md:p-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="shrink-0">
          <h3 className="cf-h3">Events</h3>
          <p className="cf-body mt-1 text-[14px]">For event organisers</p>
        </div>
        <p className="flex items-baseline gap-3">
          <span className="text-[40px] font-semibold leading-none tracking-[-0.03em]">6%</span>
          <span className="text-[14px] text-[var(--cf-muted)]">of ticket revenue, nothing monthly</span>
        </p>
        <ul className="flex flex-col gap-2 text-[14px] text-[var(--cf-fg)] sm:flex-row sm:flex-wrap sm:gap-x-6 lg:ml-auto">
          {EVENTS_LINES.map((l) => (
            <li key={l} className="flex items-center gap-2.5">
              <Check aria-hidden size={15} strokeWidth={2} className="shrink-0 text-[var(--cf-accent)]" />
              {l}
            </li>
          ))}
        </ul>
      </div>

      <p className="cf-body mt-5 text-[14px]">
        SMS, email, form replies and waivers come with an allowance in every plan; past it they are charged per unit, and the rate falls as the plan grows.
      </p>

      <div className="mt-16 rounded-[20px] bg-[var(--cf-paper)] p-5 md:p-8">
        <h3 className="cf-h3">What a share costs, next to a plan</h3>
        <p className="cf-body mb-6 mt-1 text-[14px]">A month of selling tickets at ৳500 each.</p>
        <PricingChart />
      </div>
    </Section>
  );
}
