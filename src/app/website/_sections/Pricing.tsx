"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ChapterHead, Container, LinkButton, Section } from "../_components/ui";
import { EVENTS_LINES, PLANS, YEARLY_IS_TWO_FREE, taka } from "./PricingData";
import { PricingChart } from "./PricingChart";
import css from "./Pricing.module.css";

type Period = "monthly" | "yearly";

export function Pricing() {
  const [period, setPeriod] = useState<Period>("monthly");
  const yearly = period === "yearly";

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const next: Period = yearly ? "monthly" : "yearly";
      setPeriod(next);
      const group = e.currentTarget.parentElement;
      requestAnimationFrame(() => (group?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
    }
  };

  return (
    <Section id="pricing" tone="ink">
      <Container>
        <ChapterHead
          n="07"
          eyebrow="Pricing"
          title={<span className="w-lit">No cut of your tickets.</span>}
          lead="A share of sales grows with every ticket you sell. A plan does not."
        />

        <div data-reveal className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div role="radiogroup" aria-label="Billing period" className="relative grid w-[260px] grid-cols-2 rounded-full bg-white/[0.07] p-1 ring-1 ring-inset ring-white/10">
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--w-paper)] transition-transform duration-500 [transition-timing-function:var(--w-ease)]"
              style={{ transform: yearly ? "translateX(100%)" : "none" }}
            />
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                tabIndex={period === p ? 0 : -1}
                onClick={() => setPeriod(p)}
                onKeyDown={onKey}
                className={cn("relative z-10 min-h-11 rounded-full text-[15px] font-medium capitalize transition-colors duration-300", period === p ? "text-[var(--w-ink)]" : "text-[var(--w-fg-ink)]")}
              >
                {p}
              </button>
            ))}
          </div>
          {YEARLY_IS_TWO_FREE && <p className="text-[14px] text-[var(--w-ember-soft)]">Pay yearly and two months are free.</p>}
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => {
            const featured = p.name === "Growth";
            const price = yearly ? p.yearly : p.monthly;
            return (
              <li
                key={p.name}
                data-reveal
                style={{ "--w-delay": `${i * 80}ms` } as CSSProperties}
                className={cn(
                  "relative flex flex-col rounded-[20px] p-6 md:p-7",
                  featured ? "bg-[var(--w-paper)] text-[var(--w-ink)] shadow-[0_40px_90px_-40px_rgb(249_74_0/0.6)] lg:-my-3" : "w-panel-ink",
                )}
              >
                {featured && (
                  <span className="absolute right-5 top-6 rounded-full bg-[var(--w-ink)] px-2.5 py-1 text-[12px] font-medium leading-none text-[var(--w-paper)]">Recommended</span>
                )}
                <h3 className="w-h3">{p.name}</h3>
                <p className={cn("mt-1 min-h-[2.5em] text-[14px] leading-snug", featured ? "text-[var(--w-muted)]" : "text-[var(--w-muted-ink)]")}>{p.who}</p>
                <div key={period} className={cn(css.swap, "mt-5")}>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{taka(price)}</span>
                    <span className={cn("text-[14px]", featured ? "text-[var(--w-muted)]" : "text-[var(--w-muted-ink)]")}>{p.monthly === 0 ? "" : yearly ? "a year" : "a month"}</span>
                  </p>
                  <p className={cn("mt-2 text-[13px]", featured ? "text-[var(--w-muted)]" : "text-[var(--w-muted-ink)]")}>
                    {p.monthly === 0 ? "Free, month to month" : yearly && YEARLY_IS_TWO_FREE ? "2 months free" : "Billed monthly"}
                  </p>
                </div>
                <ul className={cn("mt-6 flex flex-1 flex-col gap-2.5 border-t pt-5 text-[14px] leading-snug", featured ? "border-[var(--w-line)]" : "border-[var(--w-line-ink)]")}>
                  {p.lines.map((l) => (
                    <li key={l} className="flex items-start gap-2.5">
                      <Check aria-hidden size={15} strokeWidth={2.4} className={cn("mt-[2px] shrink-0", featured ? "text-[var(--w-ember-text)]" : "text-[var(--w-ember-soft)]")} />
                      {l}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <div
          data-reveal
          className="mt-4 flex flex-col gap-6 rounded-[20px] border border-[var(--w-ember)]/35 bg-[var(--w-ember)]/[0.09] p-6 md:flex-row md:items-center md:gap-10 md:px-9 md:py-7"
        >
          <div className="shrink-0">
            <p className="w-eyebrow text-[var(--w-ember-soft)]">For event organisers</p>
            <p className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em]">Events</p>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">6%</span>
            <span className="text-[16px] text-[var(--w-muted-ink)]">of ticket revenue, nothing monthly</span>
          </p>
          <ul className="flex flex-col gap-2 text-[15px] md:ml-auto">
            {EVENTS_LINES.map((l) => (
              <li key={l} className="flex items-center gap-2.5">
                <InfinityIcon aria-hidden size={16} strokeWidth={1.8} className="shrink-0 text-[var(--w-ember-soft)]" />
                {l}
              </li>
            ))}
          </ul>
        </div>

        <div data-reveal className="mt-16 md:mt-24">
          <PricingChart />
        </div>

        <div data-reveal className="mt-12 flex flex-wrap items-center gap-4">
          <LinkButton href="/sign-up" variant="primary" arrow>
            Start on Lite — free
          </LinkButton>
          <p className="text-[14px] text-[var(--w-muted-ink)]">SMS, email and waivers come with an allowance in every plan.</p>
        </div>
      </Container>
    </Section>
  );
}
