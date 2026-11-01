"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SplitReveal } from "../_components/fx";
import { Label } from "../_components/ui";
import { Browser, Clip, Phone } from "../_components/media";
import { useReducedMotion } from "../_components/motion";

type Card = { title: string; body: string; chip: string; fill: string; media: ReactNode };

const phone = (name: string, label: string) => (
  <Phone className="w-[210px] md:w-[230px]">
    <Clip name={name} label={label} />
  </Phone>
);

const CARDS: Card[] = [
  {
    title: "Seat maps",
    body: "Draw the room once. Guests pick the exact seat on a plan, and a seat sold at one counter is gone at every other.",
    chip: "Stalls and balcony",
    fill: "#ffffff",
    media: phone("go-seats", "Counterfoil Go: choosing seats on a seat plan"),
  },
  {
    title: "One scan, the whole family",
    body: "A family ticket admits four. The gate scans it once, lets the whole party in, and refuses it if it comes back.",
    chip: "Group admit",
    fill: "var(--color-brand-50)",
    media: phone("go-scan", "Counterfoil Go: scanning one ticket that admits a family"),
  },
  {
    title: "Repeat weekly",
    body: "Book the same field at the same hour every week in one go. Every date is checked against live capacity before it sells.",
    chip: "Recurring bookings",
    fill: "#ffffff",
    media: phone("go-slot", "Counterfoil Go: booking a repeating weekly slot"),
  },
  {
    title: "Speaks Bangla",
    body: "The whole till switches to Bangla, so the person at the counter works in the language they think in.",
    chip: "Bangla and English",
    fill: "var(--color-brand-100)",
    media: phone("go-bangla", "Counterfoil Go running in Bangla"),
  },
  {
    title: "Holds on the calendar",
    body: "Places held for a school group or a private event come off sale and show hatched on the calendar until you release them.",
    chip: "Live holds",
    fill: "#ffffff",
    media: (
      <Browser className="w-full max-w-[460px]" url="app.counterfoil.app/calendar">
        <Clip name="os-calendar" label="Counterfoil OS calendar showing held and booked places" />
      </Browser>
    ),
  },
];

const TOP = 90;
const STEP = 16;
const LG = 1024;

/** Sticky stacking cards: as the next card arrives, the one beneath scales down and dims. */
export function Stack() {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const veils = useRef<(HTMLSpanElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const wide = window.innerWidth >= LG;
      for (let i = 0; i < CARDS.length - 1; i++) {
        const el = refs.current[i];
        const next = refs.current[i + 1];
        if (!el || !next) continue;
        const veil = veils.current[i];
        if (!wide) {
          el.style.transform = "";
          if (veil) veil.style.opacity = "0";
          continue;
        }
        const stick = TOP + (i + 1) * STEP;
        const t = Math.min(1, Math.max(0, (vh - next.getBoundingClientRect().top) / Math.max(1, vh - stick)));
        el.style.transform = `scale(${(1 - 0.08 * t).toFixed(4)})`;
        if (veil) veil.style.opacity = (t * 0.4).toFixed(3);
      }
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);

  return (
    <section id="specials" className="cf-sec scroll-mt-16 overflow-x-clip px-5 py-20 md:px-12 md:py-28">
      <div className="max-w-[720px]">
        <div data-reveal className="mb-5">
          <Label>Beyond the till</Label>
        </div>
        <SplitReveal
          as="h2"
          className="cf-h2"
          parts={[{ text: "What a retail till " }, { text: "can't do.", className: "cf-accent" }]}
        />
      </div>
      <ol className="mt-12 flex flex-col gap-6 md:mt-16 lg:block">
        {CARDS.map((c, i) => (
          <li
            key={c.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={{ top: TOP + i * STEP, background: c.fill }}
            className={cn(
              "relative origin-top overflow-hidden rounded-[28px] shadow-[0_30px_60px_-40px_rgb(60_20_0/0.4)] lg:sticky lg:mb-10",
              "grid items-center gap-8 p-6 md:p-10 lg:min-h-[480px] lg:grid-cols-2 lg:gap-12 lg:p-14",
            )}
          >
            <div className="relative z-10 min-w-0">
              <p aria-hidden className="text-[13px] font-semibold tabular-nums text-brand-foreground">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-fg md:text-[44px]">{c.title}</h3>
              <p className="mt-4 max-w-[440px] text-[16px] leading-relaxed text-fg-secondary">{c.body}</p>
              <span className="mt-6 inline-flex min-h-[32px] items-center rounded-full bg-white/70 px-4 text-[13px] font-semibold text-brand-foreground">
                {c.chip}
              </span>
            </div>
            <div className="relative z-10 flex justify-center lg:justify-end">{c.media}</div>
            <span
              ref={(el) => {
                veils.current[i] = el;
              }}
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 bg-[#efe4da] opacity-0"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
