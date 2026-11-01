"use client";

import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion, useScrollProgress } from "./motion";

/* The website's effects kit — the trend-led motion (kinetic type, scroll-reactive
   text, magnetic and tilting objects, velocity marquees, odometers, a following
   cursor). Every effect:
   - writes to the DOM through refs/CSS variables, never React state per frame;
   - is still and complete under prefers-reduced-motion;
   - leaves real text in the DOM for assistive tech (split pieces are aria-hidden
     behind an sr-only copy). */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/* ── kinetic headline ─────────────────────────────────────────────────── */

/**
 * Splits text into words that rise out of a mask, one after another, the first
 * time it is seen. Pass a string; for mixed styling pass `parts` with a class
 * per run (e.g. the ember accent word).
 */
export function SplitReveal({
  parts,
  as: Tag = "span",
  className,
  stagger = 55,
  delay = 0,
}: {
  parts: { text: string; className?: string }[] | string;
  as?: "span" | "h1" | "h2" | "p";
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { margin: "0px 0px -10% 0px", threshold: 0 });
  const reduce = useReducedMotion();
  const runs = typeof parts === "string" ? [{ text: parts }] : parts;
  const full = runs.map((r) => r.text).join("");
  let n = 0;
  return (
    <Tag ref={ref as never} className={className}>
      <span className="sr-only">{full}</span>
      <span aria-hidden>
        {runs.map((r, ri) =>
          r.text.split(/(\s+)/).map((w, wi) => {
            if (/^\s+$/.test(w)) return <span key={`${ri}-${wi}`}>{w}</span>;
            if (!w) return null;
            const i = n++;
            return (
              <span key={`${ri}-${wi}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span
                  className={cn("inline-block", r.className)}
                  style={{
                    transform: seen || reduce ? "none" : "translateY(105%) rotate(4deg)",
                    opacity: seen || reduce ? 1 : 0,
                    transition: reduce ? "none" : `transform 900ms ${EASE} ${delay + i * stagger}ms, opacity 600ms ${EASE} ${delay + i * stagger}ms`,
                  }}
                >
                  {w}
                </span>
              </span>
            );
          }),
        )}
      </span>
    </Tag>
  );
}

/**
 * A word that rolls through a list like a departure board: each word slides up
 * out of view as the next arrives. The box sizes itself to the current word.
 */
export function WordCycle({ words, className, ms = 2200 }: { words: string[]; className?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const active = useInView(ref, { once: false, threshold: 0 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || reduce) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % words.length), ms);
    return () => window.clearInterval(id);
  }, [active, reduce, ms, words.length]);
  return (
    <span ref={ref} className={cn("relative inline-grid overflow-hidden align-bottom", className)}>
      <span className="sr-only">{words.join(", ")}</span>
      {words.map((w, k) => (
        <span
          key={w}
          aria-hidden
          className="col-start-1 row-start-1 whitespace-nowrap"
          style={{
            transform: k === i ? "translateY(0)" : k === (i - 1 + words.length) % words.length ? "translateY(-110%)" : "translateY(110%)",
            opacity: k === i ? 1 : 0,
            transition: reduce ? "none" : `transform 700ms ${EASE}, opacity 500ms ${EASE}`,
          }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/**
 * A statement whose words light up one by one as it scrolls through the
 * viewport — dim grey to ink — the Apple-keynote reading effect.
 */
export function ScrollWords({ text, className, accent = [] }: { text: string; className?: string; accent?: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const words = text.split(" ");
  useScrollProgress(ref, {
    onChange: (p) => {
      const el = ref.current;
      if (!el || reduce) return;
      // Light the words between 15% and 65% of the paragraph's pass.
      const k = Math.min(1, Math.max(0, (p - 0.15) / 0.5)) * words.length;
      el.querySelectorAll<HTMLElement>("[data-w]").forEach((s, idx) => {
        s.style.opacity = String(Math.min(1, Math.max(0.16, k - idx + 0.16)));
      });
    },
  });
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={i} data-w className={cn("transition-opacity duration-150", accent.includes(w.replace(/[.,]/g, "")) && "text-[var(--cf-accent)]")} style={{ opacity: reduce ? 1 : 0.16 }}>
            {w}{" "}
          </span>
        ))}
      </span>
    </p>
  );
}

/* ── objects that respond to the pointer ──────────────────────────────── */

/** Pulls its child toward the pointer when it comes near — a magnetic button. */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    };
    const leave = () => (el.style.transform = "");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength, reduce]);
  return (
    <span ref={ref} className={cn("inline-block p-3 -m-3", className)} style={{ transition: `transform 450ms ${EASE}` }}>
      {children}
    </span>
  );
}

/**
 * A card that tilts in 3D toward the pointer, with a soft glare that follows it
 * (`--gx`/`--gy` for the glare's position). Flat on touch and reduced motion.
 */
export function Tilt({ children, className, max = 10, glare = true, style }: { children: ReactNode; className?: string; max?: number; glare?: boolean; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
      el.style.setProperty("--gx", `${x * 100}%`);
      el.style.setProperty("--gy", `${y * 100}%`);
      el.style.setProperty("--go", "1");
    };
    const leave = () => {
      el.style.transform = "";
      el.style.setProperty("--go", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max, reduce]);
  return (
    <div ref={ref} className={cn("relative [transform-style:preserve-3d]", className)} style={{ transition: `transform 500ms ${EASE}`, ...style }}>
      {children}
      {glare && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{ opacity: "var(--go, 0)", background: "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.5), transparent 45%)", mixBlendMode: "soft-light" }}
        />
      )}
    </div>
  );
}

/* ── things that run with the scroll ──────────────────────────────────── */

/**
 * A marquee whose speed and lean follow how fast the visitor scrolls, and
 * which turns around when they scroll up. Children are repeated to fill.
 */
export function VelocityMarquee({ children, className, base = 40, direction = 1 }: { children: ReactNode; className?: string; base?: number; direction?: 1 | -1 }) {
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = track.current;
    if (!el || reduce) return;
    let x = 0, v = 0, dir = direction, lastY = window.scrollY, raf = 0, lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy !== 0) dir = dy > 0 ? direction : (-direction as 1 | -1);
      v += (Math.min(60, Math.abs(dy)) * 12 - v) * 0.1;
      x -= dir * (base + v) * dt;
      const w = el.scrollWidth / 2;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      const skew = Math.max(-12, Math.min(12, (dir * v) / 60));
      el.style.transform = `translate3d(${x}px,0,0) skewX(${-skew}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [base, direction, reduce]);
  const items = Children.toArray(children);
  return (
    <div className={cn("overflow-hidden", className)} aria-hidden>
      <div ref={track} className="flex w-max will-change-transform">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {items}
            {items}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A number whose digits roll into place like an odometer when seen. */
export function Odometer({ value, className, prefix = "", suffix = "" }: { value: string; className?: string; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { threshold: 0.3 });
  const reduce = useReducedMotion();
  const chars = (prefix + value + suffix).split("");
  return (
    <span ref={ref} className={cn("inline-flex overflow-hidden leading-none", className)}>
      <span className="sr-only">{prefix + value + suffix}</span>
      {chars.map((c, i) => {
        const d = Number(c);
        if (Number.isNaN(d) || c === " ") return <span key={i} aria-hidden>{c}</span>;
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1em] overflow-hidden">
            <span
              className="flex flex-col"
              style={{
                transform: `translateY(-${(seen || reduce ? d + 10 : 0) * 5}%)`,
                transition: reduce ? "none" : `transform ${1400 + i * 180}ms ${EASE}`,
              }}
            >
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k} className="block h-[1em] leading-none">{k % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ── page-wide chrome ─────────────────────────────────────────────────── */

/** A thin ember bar across the top that fills as the page is read. */
export function ScrollBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        el.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      });
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
    };
  }, []);
  return <div ref={ref} aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[var(--cf-accent)]" style={{ transform: "scaleX(0)" }} />;
}

/**
 * A soft ember ring that trails the pointer and swells over anything
 * clickable. Desktop pointers only; the system cursor stays.
 */
export function CursorRing() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !matchMedia("(pointer: fine)").matches) return;
    let x = -100, y = -100, tx = -100, ty = -100, s = 1, ts = 1, raf = 0;
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      ts = (e.target as Element)?.closest?.("a, button, [role=tab], [role=radio]") ? 2.2 : 1;
      el.style.opacity = "1";
    };
    const out = () => (el.style.opacity = "0");
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      s += (ts - s) * 0.15;
      el.style.transform = `translate3d(${x - 14}px, ${y - 14}px, 0) scale(${s})`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", move);
    document.addEventListener("pointerleave", out);
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", out);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[70] h-7 w-7 rounded-full opacity-0 transition-opacity duration-300"
      style={{ background: "rgb(249 74 0 / 0.14)", boxShadow: "0 0 0 1.5px rgb(249 74 0 / 0.5)", backdropFilter: "saturate(1.4)" }}
    />
  );
}
