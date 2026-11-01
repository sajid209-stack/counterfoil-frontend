"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Odometer } from "../_components/fx";
import { Label, LinkButton, Section, delay } from "../_components/ui";
import styles from "./Pricing.module.css";
import { EVENTS_LINES, PLANS, taka } from "./PricingData";
import { PricingChart } from "./PricingChart";
import { seeded } from "./ConstellationCanvas";

type Period = "monthly" | "yearly";

const STARS = (() => {
  const r = seeded(33);
  return Array.from({ length: 36 }, () => ({ x: r() * 100, y: r() * 100, o: 0.15 + r() * 0.35 }));
})();

export function Pricing() {
  const [idx, setIdx] = useState(2);
  const [period, setPeriod] = useState<Period>("monthly");
  const plan = PLANS[idx];
  const yearly = period === "yearly";
  const shown = yearly ? Math.round(plan.yearly / 12) : plan.monthly;
  const fill = `${(idx / (PLANS.length - 1)) * 100}%`;
  const group = useRef<HTMLDivElement>(null);

  return (
    <Section id="pricing" flush className="relative overflow-hidden">
      <div className="relative px-5 pb-10 pt-24 text-center md:px-12 md:pt-32">
        <span aria-hidden className={cn("pointer-events-none absolute left-1/2 top-[34%] h-[300px] w-[min(80vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cf-accent)] opacity-25 blur-[140px]", styles.glow)} />
        {STARS.map((s, i) => (
          <span key={i} aria-hidden className="pointer-events-none absolute h-px w-px rounded-full bg-[var(--cf-fg)]" style={{ left: `${s.x}%`, top: `${s.y * 0.7}%`, opacity: s.o, boxShadow: "0 0 3px 1px rgb(245 242 235 / 0.4)" }} />
        ))}

        <div className="relative">
          <div data-reveal className="flex justify-center">
            <Label>Pricing</Label>
          </div>
          <h2 className="sr-only">Pricing: {plan.name}</h2>

          <p data-reveal style={delay(60)} className="mt-6 flex items-end justify-center gap-3" aria-live="polite">
            <Odometer prefix="৳" value={shown.toLocaleString("en-US")} className="text-[clamp(4.5rem,17vw,13rem)] font-semibold tracking-[-0.06em] text-[var(--cf-fg)]" />
            <span className="pb-[1.2vw] text-[clamp(1rem,2.4vw,1.75rem)] text-[var(--cf-muted)]">/mo</span>
          </p>
          <p className="mt-3 h-6 text-[15px] text-[var(--cf-muted)]">
            {plan.monthly === 0 ? "Free, month to month" : yearly ? `billed yearly · ${taka(plan.yearly)} a year` : "billed monthly"}
          </p>

          <div className="mt-6 flex justify-center">
            <div role="radiogroup" aria-label="Billing period" className="relative grid grid-cols-2 rounded-full bg-[rgb(245_242_235/0.08)] p-1">
              {(["monthly", "yearly"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn("h-11 min-w-[104px] rounded-full px-4 text-[14px] font-medium capitalize transition-colors", period === p ? "bg-[var(--cf-fg)] text-[#050505]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {yearly && plan.monthly > 0 && <p className="cf-mono mt-3 text-[12px] uppercase tracking-[0.06em] text-[var(--cf-accent-text)]">Two months free</p>}

          <div ref={group} className="mx-auto mt-12 max-w-[640px]">
            <div className="relative">
              <input
                type="range"
                min={0}
                max={PLANS.length - 1}
                step={1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="Plan"
                aria-valuetext={`${plan.name}, ${taka(shown)} a month`}
                className={styles.range}
                style={{ ["--fill" as string]: fill }}
              />
            </div>
            <div className="relative mt-1 h-11">
              {PLANS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setIdx(i)}
                  tabIndex={-1}
                  className={cn("absolute top-0 h-11 min-w-11 -translate-x-1/2 px-2 text-[14px] font-medium transition-colors", i === idx ? "text-[var(--cf-fg)]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]")}
                  style={{ left: `calc(12px + (100% - 24px) * ${i / (PLANS.length - 1)})` }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-[520px]">
            <p className="text-[15px] text-[var(--cf-fg-2)]">
              {plan.name} <span className="text-[var(--cf-muted)]">· {plan.who}</span>
            </p>
            <ul className="mt-5 flex flex-col items-center gap-2.5 text-[14px] text-[var(--cf-fg-2)]">
              {plan.lines.map((l) => (
                <li key={`${plan.name}-${l}`} className="flex items-start gap-2.5 text-left">
                  <Check aria-hidden size={15} strokeWidth={2} className="mt-[3px] shrink-0 text-[var(--cf-accent-text)]" />
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <LinkButton href="/sign-up" variant="primary">
                {plan.monthly === 0 ? "Start for free" : `Get ${plan.name}`}
              </LinkButton>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-5 md:mx-12">
        <div data-reveal className="cf-glass mx-auto flex max-w-[960px] flex-col gap-4 p-6 md:flex-row md:items-center md:gap-10">
          <div className="shrink-0">
            <p className="cf-label">For event organisers</p>
            <h3 className="cf-h3 mt-1.5">Events</h3>
          </div>
          <p className="flex items-baseline gap-3">
            <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--cf-accent-text)]">6%</span>
            <span className="text-[14px] text-[var(--cf-muted)]">of ticket revenue, nothing monthly</span>
          </p>
          <ul className="flex flex-col gap-2 text-[14px] text-[var(--cf-fg-2)] md:ml-auto">
            {EVENTS_LINES.map((l) => (
              <li key={l} className="flex items-center gap-2.5">
                <Check aria-hidden size={14} strokeWidth={2} className="shrink-0 text-[var(--cf-accent-text)]" />
                {l}
              </li>
            ))}
          </ul>
        </div>

        <p className="mx-auto max-w-[960px] px-1 py-5 text-[13px] text-[var(--cf-muted)]">
          SMS, email, form replies and waivers come with an allowance in every plan; past it they are charged per unit, and the rate falls as the plan grows.
        </p>

        <div className="cf-glass mx-auto mb-20 max-w-[960px] overflow-hidden md:mb-28">
          <div data-reveal className="px-5 py-5 md:px-8">
            <h3 className="cf-h3">What a share costs, next to a plan</h3>
            <p className="mt-1 text-[13px] text-[var(--cf-muted)]">A month of selling tickets at ৳500 each.</p>
          </div>
          <PricingChart />
        </div>
      </div>
    </Section>
  );
}
