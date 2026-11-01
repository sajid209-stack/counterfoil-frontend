"use client";

import { useRef, type CSSProperties } from "react";
import { CalendarDays, BarChart3, ClipboardCheck, Monitor, Globe, Smartphone, Check, type LucideIcon } from "lucide-react";
import { useInView, useSequence } from "../_components/motion";
import { cn } from "@/lib/cn";
import { useBoxWidth } from "./HeroDemo";

/* Eight steps, ~9 s. Three pulses: a sale lands (till), a second source is
   refused (online), a hold explains a refusal (museum shop). */
const STEPS = [900, 800, 900, 1100, 800, 1800, 900, 1800];

const SOURCES: Array<{ name: string; Icon: LucideIcon }> = [
  { name: "Till · Fort Main Gate", Icon: Monitor },
  { name: "Till · Museum Shop", Icon: Monitor },
  { name: "Online booking page", Icon: Globe },
  { name: "Phone · Gate scanner", Icon: Smartphone },
];
const OUTCOMES = [
  { name: "Calendar", Icon: CalendarDays, line: "Field 1 · 18:00 booked" },
  { name: "Reports", Icon: BarChart3, line: "Revenue +৳1,500.00" },
  { name: "Check-in roster", Icon: ClipboardCheck, line: "1 arriving at 18:00" },
];

const CARD = "bg-[var(--color-card,#fff)] shadow-[var(--cf-shadow)]";
const SRC_Y = [50, 150, 250, 350];
const OUT_Y = [90, 210, 330];
const srcPath = (i: number) => `M220 ${SRC_Y[i]} C 305 ${SRC_Y[i]}, 305 210, 390 210`;
const outPath = (i: number) => `M610 210 C 695 210, 695 ${OUT_Y[i]}, 780 ${OUT_Y[i]}`;

function useStory() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const step = useSequence(STEPS, inView);
  const w = useBoxWidth(ref);
  const turf = step < 6;
  const state = step >= 3 && turf ? "Sold" : step >= 2 && turf ? "Held" : "Free";
  const active = step >= 1 && step <= 3 ? 0 : step >= 4 && step <= 5 ? 2 : step >= 6 ? 1 : -1;
  const bubble = step === 5 ? { from: "Online booking page", text: "Taken — Field 2 is free at 18:00" } : step === 7 ? { from: "Till · Museum Shop", text: "25 places held for a School group — 15 left" } : null;
  return { ref, step, w, turf, state, active, bubble };
}

function IconTile({ Icon, on }: { Icon: LucideIcon; on?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-500",
        on ? "bg-[var(--color-ember-solid,#f94a00)] text-white" : "bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]",
      )}
    >
      <Icon size={15} strokeWidth={1.8} />
    </span>
  );
}

function Node({ children, className, style }: { children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div style={style} className={cn("flex items-center gap-2.5 rounded-[14px] px-3 text-[13px] font-semibold text-[var(--cf-fg)]", CARD, className)}>
      {children}
    </div>
  );
}

function StatusChip({ state, turf }: { state: string; turf: boolean }) {
  const tone = !turf ? "held" : state === "Sold" ? "sold" : state === "Held" ? "held" : "free";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[12px] font-medium transition-colors duration-500",
        tone === "sold" && "bg-[var(--cf-green-wash)] text-[var(--cf-green)]",
        tone === "held" && "bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]",
        tone === "free" && "bg-[var(--color-subtle,#efece5)] text-[var(--cf-muted)]",
      )}
    >
      {turf ? state : "Held"}
    </span>
  );
}

function EngineNode({ turf, state }: { turf: boolean; state: string }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-[18px]", CARD, "shadow-[var(--cf-shadow-lg)]")}>
      <div className="flex h-11 items-center gap-2 px-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark-plain.png" alt="" className="h-4 w-auto" />
        <span className="text-[13px] font-semibold">Capacity engine</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[var(--color-brand-50,#fff5ee)] px-2 py-0.5 text-[12px] font-medium text-[var(--color-brand-foreground,#aa3000)]">
          <span className="cf-live h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
          Live
        </span>
      </div>
      <div className="space-y-2 px-3.5 pb-3.5">
        <p key={turf ? "t" : "s"} className="cf-arrive text-[13px] font-semibold">
          {turf ? "Football · Field 1 · 18:00" : "Planetarium Show · 11:00"}
        </p>
        {turf ? (
          <>
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-subtle,#efece5)] px-2.5 py-2 text-[12px]">
              <span className="text-[var(--cf-fg-2)]">Field 1</span>
              <StatusChip state={state} turf />
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-subtle,#efece5)] px-2.5 py-2 text-[12px]">
              <span className="text-[var(--cf-fg-2)]">Field 2</span>
              <StatusChip state="Free" turf />
            </div>
            <p className="text-[12px] text-[var(--cf-muted)]">Football and Cricket share Fields 1–2.</p>
          </>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-subtle,#efece5)]">
              <span className="h-full rounded-full bg-[var(--cf-accent)]" style={{ width: "62.5%", backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.5) 0 3px, transparent 3px 6px)" }} />
            </div>
            <p className="text-[12px] font-medium text-[var(--color-brand-foreground,#aa3000)]">Held · School group · 25 places</p>
            <p className="text-[12px] text-[var(--cf-muted)]">15 of 40 places left to sell.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({ b }: { b: { from: string; text: string } }) {
  return (
    <div className="cf-arrive rounded-[14px] bg-[var(--cf-red-wash)] px-3 py-2 text-left shadow-[var(--cf-shadow)]">
      <p className="cf-label !text-[var(--cf-red)]">{b.from} · refused</p>
      <p className="mt-0.5 text-[13px] font-medium text-[var(--cf-fg)]">{b.text}</p>
    </div>
  );
}

/** A travelling ember dot along a path. `to` 0 or 1; `on` shows it. */
function Pulse({ d, to, on }: { d: string; to: 0 | 1; on: boolean }) {
  return (
    <span
      className="pointer-events-none absolute left-0 top-0 h-3 w-3 rounded-full bg-[var(--cf-accent)] shadow-[0_0_0_4px_rgb(249_74_0/0.18)]"
      style={{
        offsetPath: `path("${d}")`,
        offsetDistance: `${to * 100}%`,
        opacity: on ? 1 : 0,
        transition: on ? "offset-distance 750ms var(--cf-ease-in-out), opacity 150ms" : "none",
      }}
    />
  );
}

export function EngineDiagram() {
  const { ref, step, w, turf, state, active, bubble } = useStory();
  const wide = w >= 880;
  const s = Math.min(1, (w || 1000) / 1000);
  const outLit = step >= 3 && step <= 5;
  const line = (on: boolean) => ({ stroke: on ? "#f94a00" : "#d1cdc3", strokeWidth: on ? 2 : 1.5, style: { transition: "stroke 400ms" } as CSSProperties });

  return (
    <div ref={ref} aria-hidden className="cf-dots relative overflow-hidden rounded-3xl" style={wide || !w ? { height: 420 * s } : undefined}>
      {wide || !w ? (
        <div className="absolute left-0 top-0" style={{ width: 1000, height: 420, transform: `scale(${s})`, transformOrigin: "top left" }}>
          <svg className="absolute inset-0" width="1000" height="420" fill="none">
            {SRC_Y.map((_, i) => (
              <path key={i} d={srcPath(i)} {...line(active === i)} />
            ))}
            {OUT_Y.map((_, i) => (
              <path key={i} d={outPath(i)} {...line(outLit)} />
            ))}
          </svg>
          {SOURCES.map(({ name, Icon }, i) => (
            <Node key={name} className="absolute h-11 w-[220px]" style={{ left: 0, top: SRC_Y[i] - 22 }}>
              <IconTile Icon={Icon} on={active === i} />
              {name}
            </Node>
          ))}
          <div className="absolute" style={{ left: 390, top: 92, width: 220 }}>
            <EngineNode turf={turf} state={state} />
          </div>
          {OUTCOMES.map(({ name, Icon, line: l }, i) => (
            <Node key={name} className="absolute h-14 w-[220px]" style={{ left: 780, top: OUT_Y[i] - 28 }}>
              <IconTile Icon={Icon} on={outLit} />
              <span className="min-w-0">
                <span className="block leading-tight">{name}</span>
                <span className="block truncate text-[12px] font-normal text-[var(--cf-muted)]">{outLit ? l : "Updates live"}</span>
              </span>
              {outLit && <Check size={14} strokeWidth={2.4} className="cf-pop ml-auto shrink-0 text-[var(--cf-green)]" />}
            </Node>
          ))}
          <Pulse d={srcPath(0)} to={step >= 1 ? 1 : 0} on={step === 1} />
          <Pulse d={srcPath(2)} to={step === 5 ? 0 : 1} on={step === 4 || step === 5} />
          <Pulse d={srcPath(1)} to={step === 7 ? 0 : 1} on={step === 6 || step === 7} />
          {OUT_Y.map((_, i) => (
            <Pulse key={i} d={outPath(i)} to={step === 3 ? 1 : 0} on={step === 3} />
          ))}
          {bubble && (
            <div className="absolute w-[300px]" style={{ left: 350, top: 336 }}>
              <Bubble b={bubble} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center p-4">
          <div className="grid w-full max-w-[460px] grid-cols-2 gap-2">
            {SOURCES.map(({ name, Icon }, i) => (
              <Node key={name} className="min-h-11 py-2 text-[12px] leading-tight">
                <IconTile Icon={Icon} on={active === i} />
                {name}
              </Node>
            ))}
          </div>
          <Wire on={step === 1 || step === 4 || step === 6} lit={active >= 0} />
          <div className="w-full max-w-[300px]">
            <EngineNode turf={turf} state={state} />
          </div>
          <div className="mt-3 min-h-[64px] w-full max-w-[340px]">{bubble && <Bubble b={bubble} />}</div>
          <Wire on={step === 3} lit={outLit} />
          <div className="grid w-full max-w-[460px] grid-cols-1 gap-2 sm:grid-cols-3">
            {OUTCOMES.map(({ name, Icon, line: l }) => (
              <Node key={name} className="min-h-12 py-2">
                <IconTile Icon={Icon} on={outLit} />
                <span className="min-w-0">
                  <span className="block leading-tight">{name}</span>
                  <span className="block text-[12px] font-normal leading-tight text-[var(--cf-muted)]">{outLit ? l : "Updates live"}</span>
                </span>
              </Node>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Wire({ on, lit }: { on: boolean; lit: boolean }) {
  return (
    <div className={cn("relative h-8 w-0.5 transition-colors duration-500", lit ? "bg-[var(--cf-accent)]" : "bg-[var(--color-strong,#d1cdc3)]")}>
      <span
        className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-[var(--cf-accent)] shadow-[0_0_0_4px_rgb(249_74_0/0.18)]"
        style={{ opacity: on ? 1 : 0, transform: `translateY(${on ? 20 : 0}px)`, transition: "transform 750ms var(--cf-ease-in-out), opacity 150ms" }}
      />
    </div>
  );
}
