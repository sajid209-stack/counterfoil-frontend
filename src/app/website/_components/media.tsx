"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion } from "./motion";

/* Recordings of the REAL product — Counterfoil Go at phone size and Counterfoil
   OS on a desktop — filmed from the running app (public/website/<name>.webm,
   poster <name>.jpg). The website shows the product itself, not a drawing of it. */

export const clip = (name: string) => ({ src: `/website/${name}.webm`, poster: `/website/${name}.jpg` });

/**
 * A recording that plays only while on screen: muted, looping, inline, and not
 * downloaded until it is near the viewport. Reduced motion shows the poster.
 * `onTime` reports the playhead (seconds) for captions synced to the footage.
 */
export function Clip({
  name,
  className,
  onTime,
  label,
  playing = true,
}: {
  name: string;
  className?: string;
  onTime?: (t: number) => void;
  /** What the recording shows, for assistive tech. */
  label: string;
  /** Lets a parent pause a clip that is in view but not the active one. */
  playing?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const near = useInView(ref, { once: true, margin: "600px 0px 600px 0px", threshold: 0 });
  const seen = useInView(ref, { once: false, margin: "0px", threshold: 0.25 });
  const reduce = useReducedMotion();
  const { src, poster } = clip(name);
  const cb = useRef(onTime);
  useEffect(() => {
    cb.current = onTime;
  });

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    if (seen && playing) v.play().catch(() => {});
    else v.pause();
  }, [seen, playing, reduce, near]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      cb.current?.(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const off = () => cancelAnimationFrame(raf);
    v.addEventListener("play", on);
    v.addEventListener("pause", off);
    return () => {
      off();
      v.removeEventListener("play", on);
      v.removeEventListener("pause", off);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={cn("block h-full w-full object-cover", className)}
      poster={poster}
      src={near && !reduce ? src : undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      role="img"
    />
  );
}

/** Which caption is live at playhead `t`: the last cue whose `at` has passed. */
export function useCue<T extends { at: number }>(cues: readonly T[]) {
  const [i, setI] = useState(-1);
  const last = useRef(-1);
  const onTime = (t: number) => {
    let k = -1;
    for (let j = 0; j < cues.length; j++) if (t >= cues[j].at) k = j;
    if (k !== last.current) {
      last.current = k;
      setI(k);
    }
  };
  return [i, onTime] as const;
}

/**
 * A modern phone around a Go recording: a dark bezel, the dynamic island, and
 * an iOS status bar drawn above the screen so the app's own header is never
 * covered. Width is set by the caller (the recording is 390 × 844 points).
 */
export function Phone({ children, className, time = "9:41" }: { children: ReactNode; className?: string; time?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[3rem] bg-[#121211] p-[10px] shadow-[0_2px_0_1px_rgb(255_255_255/0.06)_inset,0_50px_100px_-30px_rgb(60_20_0/0.45),0_30px_60px_-40px_rgb(0_0_0/0.5)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2.4rem] bg-[#f5f2eb]">
        <div aria-hidden className="relative z-10 flex h-[30px] items-center justify-between px-6 pt-1 text-[12px] font-semibold text-[#121211]">
          <span>{time}</span>
          <span className="absolute left-1/2 top-[7px] h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#121211]" />
          <span className="flex items-center gap-1">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="1" /><rect x="4.3" y="4" width="3" height="6" rx="1" /><rect x="8.6" y="2" width="3" height="8" rx="1" /><rect x="12.9" y="0" width="3" height="10" rx="1" /></svg>
            <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="18" height="10" rx="3" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="13" height="7" rx="1.6" fill="currentColor" /><rect x="19.6" y="3.5" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45" /></svg>
          </span>
        </div>
        <div className="aspect-[390/844]">{children}</div>
      </div>
    </div>
  );
}

/** A light browser window around an OS recording — no strokes, a soft shadow. */
export function Browser({ children, className, url = "app.counterfoil.app/dashboard" }: { children: ReactNode; className?: string; url?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl bg-white shadow-[0_40px_90px_-30px_rgb(60_20_0/0.35),0_12px_30px_-18px_rgb(0_0_0/0.18)]", className)}>
      <div aria-hidden className="flex h-9 items-center gap-3 bg-[#f4f3f0] px-3.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto hidden max-w-[50%] truncate rounded-md bg-white px-3 py-0.5 text-[12px] text-[#6b6a66] sm:block">{url}</span>
        <span className="hidden w-[46px] sm:block" />
      </div>
      <div className="aspect-[1440/900]">{children}</div>
    </div>
  );
}
