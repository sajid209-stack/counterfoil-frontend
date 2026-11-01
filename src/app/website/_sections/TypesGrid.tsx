"use client";

import { useRef, useState, type ReactNode } from "react";
import { useInView, useReducedMotion, useScrollProgress } from "../_components/motion";
import { Tilt } from "../_components/fx";
import { WAYS } from "./TypesData";
import { TypesMicro } from "./TypesMicro";
import s from "./Types.module.css";

/** Real phone posters that peek from the card whose kind they show. */
const POSTERS: Record<string, { name: string; alt: string }> = {
  timed: { name: "go-sell", alt: "Counterfoil Go selling a timed session" },
  courts: { name: "go-slot", alt: "Counterfoil Go choosing a court slot" },
  seats: { name: "go-seats", alt: "Counterfoil Go choosing seats on a plan" },
  open: { name: "go-scan", alt: "Counterfoil Go scanning a ticket at the door" },
  appt: { name: "go-checkin", alt: "Counterfoil Go checking a guest in" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const LG = 1024;

/**
 * The fourteen kinds. From lg up the section is tall and a sticky viewport
 * slides a horizontal track sideways as you scroll; below lg it is a plain
 * swipeable snap row. The scroll handler only writes transforms (no state per
 * frame; the "07 / 14" pill re-renders only when the card index changes).
 */
export function TypesGrid({ header }: { header: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const vp = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();
  const live = useInView(outer, { once: false, threshold: 0, margin: "0px" });
  const [cur, setCur] = useState(1);

  useScrollProgress(outer, {
    from: "top",
    onChange: (p) => {
      const t = track.current;
      const v = vp.current;
      if (!t || !v) return;
      const items = t.children;
      if (window.innerWidth < LG) {
        t.style.transform = "";
        for (let i = 0; i < items.length; i++) (items[i] as HTMLElement).style.transform = "";
        return;
      }
      const max = Math.max(0, t.scrollWidth - v.clientWidth);
      const tx = -p * max;
      t.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
      const mid = v.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < items.length; i++) {
        const el = items[i] as HTMLElement;
        const d = el.offsetLeft + el.offsetWidth / 2 + tx - mid;
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d);
          best = i;
        }
        const z = reduce ? 0 : Math.max(-1, Math.min(1, d / v.clientWidth)) * 3;
        el.style.transform = `rotate(${z.toFixed(2)}deg)`;
      }
      setCur(best + 1);
    },
  });

  return (
    <div ref={outer} data-live={live ? "" : undefined} className="lg:h-[560vh]">
      <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        {/* The heading rides inside the pinned viewport, so the heading and the
            cards it introduces stay one composition while the track slides. */}
        <div ref={vp} className="relative lg:flex lg:h-full lg:flex-col lg:justify-center lg:gap-10 lg:pt-14">
          <div className="px-5 pb-10 pt-20 md:px-12 md:pt-28 lg:pb-0 lg:pt-0">{header}</div>
          <ul
            ref={track}
            className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-10 md:px-12 lg:w-max lg:snap-none lg:gap-6 lg:overflow-visible lg:pb-0 lg:pl-12 lg:pr-[30vw] lg:will-change-transform"
          >
            {WAYS.map((w, i) => {
              const poster = POSTERS[w.id];
              return (
                <li key={w.id} className="w-[290px] shrink-0 snap-start sm:w-[330px] lg:w-[360px]">
                  <Tilt className="h-[420px] lg:h-[min(440px,52vh)]" max={6}>
                    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-b from-brand-50 to-white p-6 shadow-[0_30px_60px_-34px_rgb(60_20_0/0.35)] lg:p-7">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -right-2 -top-3 select-none text-[120px] font-semibold leading-none tracking-[-0.05em] text-[var(--cf-accent)] opacity-[0.13] lg:text-[148px]"
                      >
                        {pad(i + 1)}
                      </span>
                      <span aria-hidden className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-foreground shadow-[0_8px_20px_-10px_rgb(60_20_0/0.35)]">
                        <w.icon size={22} strokeWidth={1.7} />
                      </span>
                      <div className="relative mt-5 min-w-0">
                        <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg">{w.name}</h3>
                        <p className="mt-1.5 text-[14px] leading-snug text-muted">{w.example}</p>
                        <p className="mt-1 text-[13px] leading-snug text-muted">{w.plain}</p>
                      </div>
                      <div className="relative mt-auto flex h-16 items-end">
                        <span className={s.big}>
                          <TypesMicro way={w} />
                        </span>
                      </div>
                      {poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/website/${poster.name}.jpg`}
                          alt={poster.alt}
                          loading="lazy"
                          decoding="async"
                          width={390}
                          height={844}
                          className="absolute -bottom-10 -right-3 w-[104px] rotate-[8deg] rounded-[20px] shadow-[0_24px_40px_-16px_rgb(60_20_0/0.5)]"
                        />
                      )}
                    </div>
                  </Tilt>
                </li>
              );
            })}
          </ul>
          <p
            aria-hidden
            className="absolute bottom-8 right-12 hidden rounded-full bg-white px-4 py-2 text-[13px] font-semibold tabular-nums text-brand-foreground shadow-[0_10px_30px_-12px_rgb(60_20_0/0.35)] lg:block"
          >
            {pad(cur)} / {pad(WAYS.length)}
          </p>
        </div>
      </div>
    </div>
  );
}
