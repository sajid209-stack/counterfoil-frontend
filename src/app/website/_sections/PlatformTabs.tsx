"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion } from "../_components/motion";
import { AdmitDemo, GrowDemo, ReconcileDemo, SellDemo, SetupDemo } from "./PlatformDemos";
import styles from "./Platform.module.css";

const TABS = [
  {
    name: "Set up",
    title: <><span className="cf-accent">Describe</span> it once.</>,
    dim: "The schedule builds itself.",
    body: "Type an interval and the hours, and Counterfoil lays out every session for the day with its seats and prices. No spreadsheet of start times.",
    facts: ["A live preview of every session", "Tiers like Family that admit 4", "VAT set per line, not per shop"],
    Demo: SetupDemo,
  },
  {
    name: "Sell",
    title: <>Sold <span className="cf-accent">once</span>,</>,
    dim: "at any counter.",
    body: "Pick the field and the hour on the till. Repeat weekly checks every date against live capacity and skips the ones already taken, before anyone pays.",
    facts: ["A booked slot cannot be sold twice", "Cash, bKash, Bangla QR or card", "Skipped dates are listed, not hidden"],
    Demo: SellDemo,
  },
  {
    name: "Admit",
    title: <>A scan that <span className="cf-accent">answers</span>.</>,
    dim: "Admit, part-admit or refuse.",
    body: "Group tickets let people in one by one or all at once. A second scan of the same code is refused, with the time it was first used.",
    facts: ["A Family ticket admits 4", "Refusals say when it was admitted", "Ready for the next scan on its own"],
    Demo: AdmitDemo,
  },
  {
    name: "Reconcile",
    title: <>Close the drawer <span className="cf-accent">square</span>.</>,
    dim: "Expected against counted.",
    body: "At close the till compares the cash it expects with what was counted. Sales by hour and the payment mix come from the same orders.",
    facts: ["Cash variance flagged for the manager", "Sales by hour, from the ledger", "Cash, bKash, Bangla QR and card in one mix"],
    Demo: ReconcileDemo,
  },
  {
    name: "Grow",
    title: <>Know who <span className="cf-accent">came back</span>.</>,
    dim: "Memberships and points follow them.",
    body: "Phone numbers match across formats, so one person is one record. Memberships, loyalty points and consent live on that record.",
    facts: ["Duplicates found and merged", "Consent logged per channel", "Points earned after each paid sale"],
    Demo: GrowDemo,
  },
] as const;

const ADVANCE_MS = 8000;

export function PlatformTabs() {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: false, threshold: 0.15 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [hover, setHover] = useState(false);
  const [focusIn, setFocusIn] = useState(false);

  const select = (i: number) => {
    setActive(i);
    setNonce((n) => n + 1);
  };
  const next = () => select((active + 1) % TABS.length);
  const running = inView && !hover && !focusIn && !reduce;

  // Keep the active tab visible inside a scrolling tab bar on phones.
  useEffect(() => {
    const bar = list.current;
    const tab = tabRefs.current[active];
    if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = TABS.length - 1;
    let to = -1;
    if (e.key === "ArrowRight") to = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") to = active === 0 ? last : active - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to < 0) return;
    e.preventDefault();
    select(to);
    tabRefs.current[to]?.focus();
  };

  const t = TABS[active];
  const Demo = t.Demo;
  const tabId = (i: number) => `${uid}-tab-${i}`;
  const panelId = `${uid}-panel`;

  return (
    <div
      ref={root}
      className="flex flex-col gap-3"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={(e) => setFocusIn(e.target.matches(":focus-visible"))}
      onBlur={() => setFocusIn(false)}
    >
      <div ref={list} role="tablist" aria-label="One day at the venue" onKeyDown={onKey} className={cn("flex gap-1.5 overflow-x-auto md:grid md:grid-cols-5 md:overflow-visible", styles.noscroll)}>
        {TABS.map((tab, i) => {
          const on = i === active;
          return (
            <button
              key={tab.name}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={tabId(i)}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className={cn(
                "relative flex h-14 min-w-[132px] shrink-0 items-center gap-2.5 rounded-2xl px-4 text-left transition-colors duration-200 md:min-w-0",
                on ? "bg-card text-fg shadow-[0_1px_2px_rgb(17_17_16/0.06),0_4px_12px_-6px_rgb(17_17_16/0.10)]" : "text-muted hover:bg-[var(--cf-bg-3)] hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "cf-mono inline-flex h-6 w-6 items-center justify-center rounded-lg text-[12px] font-medium transition-colors duration-200",
                  on ? "bg-ember-solid text-on-solid" : "bg-subtle text-muted",
                )}
              >
                {i + 1}
              </span>
              <span className="text-[14px] font-medium tracking-[-0.01em]">{tab.name}</span>
              <span aria-hidden className="absolute inset-x-4 bottom-1.5 h-[2px] overflow-hidden rounded-full">
                {on && (
                  <span
                    key={`${active}-${nonce}`}
                    className={cn("block h-full rounded-full bg-ember-solid", !reduce && styles.fill)}
                    style={{ animationPlayState: running ? "running" : "paused", animationDuration: `${ADVANCE_MS}ms` }}
                    onAnimationEnd={next}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} tabIndex={0} className="grid gap-3 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div key={`text-${active}`} className={cn("flex flex-col rounded-2xl bg-card px-6 py-8 md:px-8 md:py-10", styles.enter)}>
          <h3 className="text-[24px] font-semibold leading-[1.15] tracking-[-0.03em]">
            {t.title} <span className="cf-dimtext">{t.dim}</span>
          </h3>
          <p className="cf-body mt-4">{t.body}</p>
          <ul className="mt-6 flex flex-col gap-1.5 md:mt-auto">
            {t.facts.map((f) => (
              <li key={f} className="flex items-center gap-2.5 rounded-xl bg-subtle px-3 py-2.5 text-[13px] text-fg-secondary">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-solid" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="cf-dots min-w-0 rounded-2xl p-4 md:p-8">
          <div key={`demo-${active}`} aria-hidden className={styles.enter}>
            <Demo run={inView} />
          </div>
        </div>
      </div>
    </div>
  );
}
