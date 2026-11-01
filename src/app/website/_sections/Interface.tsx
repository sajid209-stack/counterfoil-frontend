"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Browser, Clip, useCue } from "../_components/media";
import { useInView, useReducedMotion, useScrollProgress } from "../_components/motion";
import { Heading, Section } from "../_components/ui";
import { GlassChip, StarBg } from "./Glass";
import styles from "./Scenes.module.css";

const TABS = [
  { id: "dashboard", name: "Dashboard", clip: "os-dashboard", caption: "Today's sales, capacity and arrivals, live as the tills sell.", label: "Counterfoil OS dashboard" },
  { id: "calendar", name: "Calendar", clip: "os-calendar", caption: "Every session and resource on one calendar, with holds hatched and never sold.", label: "Counterfoil OS calendar" },
  { id: "customers", name: "Customers", clip: "os-customers", caption: "One record per person: their visits, notes and orders in one place.", label: "Counterfoil OS customers" },
  { id: "catalog", name: "Catalog", clip: "os-catalog", caption: "Everything you sell, set up once and sold at every counter.", label: "Counterfoil OS catalog" },
  { id: "analytics", name: "Analytics", clip: "os-analytics", caption: "Revenue, busiest hours and what sells, ready when you close.", label: "Counterfoil OS analytics" },
] as const;

/* Labels that pop onto the dashboard while it plays; x/y are percentages of the screen. */
const LABELS = [
  { at: 1.2, text: "Sales today", x: 7, y: 20 },
  { at: 2.8, text: "Places sold", x: 31, y: 20 },
  { at: 4.4, text: "Arrived", x: 55, y: 20 },
  { at: 6.2, text: "Activity — live", x: 66, y: 56 },
  { at: 8.0, text: "Sales over time", x: 14, y: 56 },
] as const;

const ADVANCE_S = 10;

/** A faint perspective hairline grid floor, drawn once and again on resize. */
function GridFloor() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const c = cv.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const hy = h * 0.42;
      const g = c.createLinearGradient(0, hy, 0, h);
      g.addColorStop(0, "rgba(255,90,20,0.0)");
      g.addColorStop(0.15, "rgba(255,130,70,0.16)");
      g.addColorStop(1, "rgba(245,242,235,0.05)");
      c.strokeStyle = g;
      c.lineWidth = 1;
      // rows: depth grows toward the viewer
      for (let i = 1; i <= 16; i++) {
        const t = Math.pow(i / 16, 2.2);
        const y = hy + (h - hy) * t;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      // columns: converge on the horizon
      const cx = w / 2;
      for (let i = -14; i <= 14; i++) {
        c.beginPath();
        c.moveTo(cx + i * 6, hy);
        c.lineTo(cx + i * (w / 11), h);
        c.stroke();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(180deg,transparent,#000_30%,#000_80%,transparent)]"
    />
  );
}

/** Counterfoil OS as 3D glass in space: tilted, rising flat on scroll, lit, labelled. */
export function Interface() {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { once: false, margin: "0px", threshold: 0.3 });
  const reduce = useReducedMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();
  const [cue, onTime] = useCue(LABELS);
  useScrollProgress(track);

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
    <Section id="interface" flush className="overflow-hidden bg-black">
      <StarBg />
      <GridFloor />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[70%] -translate-x-1/2 rounded-full bg-[rgb(249_74_0/0.10)] blur-[120px]" />
      <div className="relative px-5 pb-10 pt-20 md:px-12 md:pt-28">
        <Heading align="center" label="Counterfoil OS" title="The whole venue" dim="on one screen." />
      </div>

      <div ref={track} className={cn("relative px-4 pb-20 md:px-12 md:pb-28", styles.track)}>
        <div ref={stage} className="relative mx-auto max-w-[1120px]">
          <div className={styles.tilt}>
            <div
              data-spark
              className="relative rounded-2xl shadow-[0_0_0_1px_rgb(255_90_20/0.35),0_-1px_24px_-2px_rgb(255_90_20/0.35),0_60px_120px_-30px_rgb(249_74_0/0.35)]"
            >
              <Browser url={`app.counterfoil.app/${TABS[active].id}`}>
                <div className="relative h-full w-full">
                  {TABS.map((t, i) => (
                    <div key={t.id} className={cn("absolute inset-0 transition-opacity duration-500", i === active ? "opacity-100" : "opacity-0")}>
                      <Clip name={t.clip} label={t.label} playing={i === active} onTime={i === 0 ? onTime : undefined} />
                    </div>
                  ))}
                </div>
              </Browser>
              <div aria-hidden className={styles.sweep} />
              {/* labels pop onto the dashboard in sequence */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-9">
                {LABELS.map((l, i) => {
                  const shown = active === 0 && (reduce || i <= cue);
                  return (
                    <div
                      key={l.text}
                      className={cn("absolute z-10 flex items-center gap-1.5", styles.label, !shown && styles.labelHidden)}
                      style={{ left: `${l.x}%`, top: `${l.y}%` } as CSSProperties}
                    >
                      <GlassChip title={l.text} />
                      <span className="hidden h-px w-8 bg-gradient-to-r from-[var(--cf-accent)] to-transparent sm:block" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div role="tablist" aria-label="Counterfoil OS screens" onKeyDown={onKey} className="mx-auto mt-12 flex max-w-[1120px] flex-wrap justify-center gap-2">
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
                "relative min-h-11 overflow-hidden rounded-full border px-5 text-[14px] font-medium transition-colors",
                i === active
                  ? "border-[rgb(255_90_20/0.5)] bg-[rgb(249_74_0/0.12)] text-[var(--cf-fg)]"
                  : "border-white/10 bg-white/[0.03] text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
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
        <div id={`${uid}-p`} role="tabpanel" aria-labelledby={`${uid}-t-${TABS[active].id}`}>
          <p className="mx-auto mt-6 max-w-[560px] text-center text-[15px] text-[var(--cf-muted)]" aria-live="polite">
            {TABS[active].caption}
          </p>
        </div>
      </div>
    </Section>
  );
}
