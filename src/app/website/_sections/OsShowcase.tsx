"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Browser, Clip } from "../_components/media";
import { useInView } from "../_components/motion";
import { Heading, Section } from "../_components/ui";
import styles from "./Stage.module.css";

const TABS = [
  { id: "dashboard", name: "Dashboard", clip: "os-dashboard", caption: "Today's sales, capacity and arrivals, live as the tills sell.", chip: "Live · updates as tills sell", label: "Counterfoil OS dashboard" },
  { id: "calendar", name: "Calendar", clip: "os-calendar", caption: "Every session and resource on one calendar, with holds hatched and never sold.", chip: "Holds hatched, never sold", label: "Counterfoil OS calendar" },
  { id: "customers", name: "Customers", clip: "os-customers", caption: "One record per person: their visits, notes and orders in one place.", chip: "One record per person", label: "Counterfoil OS customers" },
  { id: "catalog", name: "Catalog", clip: "os-catalog", caption: "Everything you sell, set up once and sold at every counter.", chip: "Set up once, sold everywhere", label: "Counterfoil OS catalog" },
  { id: "analytics", name: "Analytics", clip: "os-analytics", caption: "Revenue, busiest hours and what sells, ready when you close.", chip: "Ready at close", label: "Counterfoil OS analytics" },
] as const;

const ADVANCE_S = 10;

/** Tabs over a big browser playing the real OS, with an auto-advancing ember fill. */
export function OsShowcase() {
  const [active, setActive] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { once: false, margin: "0px", threshold: 0.3 });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();

  const go = (i: number, focus = false) => {
    const n = (i + TABS.length) % TABS.length;
    setActive(n);
    if (focus) tabRefs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(active + 1, true);
    else if (e.key === "ArrowLeft") go(active - 1, true);
    else if (e.key === "Home") go(0, true);
    else if (e.key === "End") go(TABS.length - 1, true);
    else return;
    e.preventDefault();
  };

  return (
    <Section id="os" flush>
      <div className="px-5 pb-10 pt-20 md:px-12 md:pt-28">
        <Heading
          label="Counterfoil OS"
          title={<>Run the whole venue <span className="cf-accent">from one screen.</span></>}
          dim="Bookings, people, money and the day ahead."
        />
      </div>
      <div className="px-5 pb-20 md:px-12 md:pb-28">
        <div role="tablist" aria-label="Counterfoil OS screens" onKeyDown={onKey} className="mx-auto flex max-w-[1120px] flex-wrap justify-center gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`${uid}-t-${t.id}`}
              aria-selected={i === active}
              aria-controls={`${uid}-p`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => go(i)}
              className={cn(
                "relative min-h-11 overflow-hidden rounded-full px-5 text-[14px] font-medium transition-colors",
                i === active ? "bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]" : "bg-[var(--cf-bg-2)] text-[var(--cf-fg-2)] hover:bg-[var(--color-brand-50,#fff5ee)]",
              )}
            >
              {t.name}
              {i === active && (
                <span
                  key={active}
                  aria-hidden
                  onAnimationEnd={() => go(active + 1)}
                  className={cn("absolute inset-x-0 bottom-0 h-[3px] bg-[var(--cf-accent)]", styles.fill)}
                  style={{ "--dur": `${ADVANCE_S}s`, animationPlayState: inView ? "running" : "paused" } as CSSProperties}
                />
              )}
            </button>
          ))}
        </div>

        <div ref={stage} id={`${uid}-p`} role="tabpanel" aria-labelledby={`${uid}-t-${TABS[active].id}`} className="relative mx-auto mt-8 max-w-[1120px] overflow-hidden rounded-[32px] px-4 pb-6 pt-10 md:px-12 md:pb-12 md:pt-16">
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(165deg,#fff,#fff5ee)]" />
          <div aria-hidden className={cn("absolute left-[20%] top-[10%] h-[70%] w-[60%] rounded-full bg-[#ffb88a] opacity-50 blur-[90px]", styles.spot)} />
          <div className="relative">
            <Browser url={`app.counterfoil.app/${TABS[active].id}`}>
              <div className="relative h-full w-full">
                {TABS.map((t, i) => (
                  <div key={t.id} className={cn("absolute inset-0 transition-opacity duration-500", i === active ? "opacity-100" : "opacity-0")}>
                    <Clip name={t.clip} label={t.label} playing={i === active} />
                  </div>
                ))}
              </div>
            </Browser>
            <div aria-hidden className="absolute -top-5 right-2 z-10 md:-right-4 md:-top-6">
              <span key={active} className="cf-pop inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--cf-fg)] shadow-[0_22px_44px_-16px_rgb(140_50_0/0.34),0_4px_12px_-4px_rgb(0_0_0/0.08)]">
                <span className="h-2 w-2 rounded-full bg-[var(--cf-accent)]" />
                {TABS[active].chip}
              </span>
            </div>
          </div>
          <p className="relative mt-6 text-center text-[15px] text-[var(--cf-fg-2)]" aria-live="polite">
            {TABS[active].caption}
          </p>
        </div>
      </div>
    </Section>
  );
}
