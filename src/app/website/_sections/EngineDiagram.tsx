"use client";

import { useRef, type CSSProperties } from "react";
import { CalendarDays, BarChart3, ClipboardCheck, Monitor, Globe, Smartphone, Check } from "lucide-react";
import { useInView, useSequence } from "../_components/motion";
import { cn } from "@/lib/cn";
import { useBoxWidth } from "./HeroDemo";

/* Eight steps, ~9 s. Three pulses: a sale lands (till), a second source is
   refused (online), a hold explains a refusal (museum shop). */
const STEPS = [900, 800, 900, 1100, 800, 1800, 900, 1800];

const SOURCES = [
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

function Chip({ children, lit, className, style }: { children: React.ReactNode; lit?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] border bg-[var(--cf-bg)] px-3 text-[13px] font-medium text-[var(--cf-fg)] shadow-[var(--cf-shadow)] transition-colors duration-500",
        lit ? "border-[var(--cf-accent)]" : "border-[var(--cf-line)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatusChip({ state, turf }: { state: string; turf: boolean }) {
  const tone = !turf ? "held" : state === "Sold" ? "sold" : state === "Held" ? "held" : "free";
  const label = turf ? state : "Held";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[12px] font-medium transition-colors duration-500",
        tone === "sold" && "border-transparent bg-[var(--cf-green-wash)] text-[var(--cf-green)]",
        tone === "held" && "border-transparent bg-[var(--cf-accent-wash)] text-[var(--cf-accent-text)]",
        tone === "free" && "border-[var(--cf-line)] text-[var(--cf-muted)]",
      )}
    >
      {label}
    </span>
  );
}

function EngineNode({ turf, state }: { turf: boolean; state: string }) {
  return (
    <div className="cf-window w-full overflow-hidden">
      <div className="flex h-10 items-center gap-2 border-b border-[var(--cf-line)] px-3.5">
        <span className="cf-live h-1.5 w-1.5 rounded-full bg-[var(--cf-accent)]" />
        <span className="text-[13px] font-medium">Capacity engine</span>
      </div>
      <div className="space-y-2.5 p-3.5">
        <p key={turf ? "t" : "s"} className="cf-arrive text-[13px] font-medium">
          {turf ? "Football · Field 1 · 18:00" : "Planetarium Show · 11:00"}
        </p>
        {turf ? (
          <>
            <div className="flex items-center justify-between rounded-md bg-[var(--cf-bg-2)] px-2.5 py-2 text-[12px]">
              <span className="text-[var(--cf-fg-2)]">Field 1</span>
              <StatusChip state={state} turf />
            </div>
            <div className="flex items-center justify-between rounded-md bg-[var(--cf-bg-2)] px-2.5 py-2 text-[12px]">
              <span className="text-[var(--cf-fg-2)]">Field 2</span>
              <StatusChip state="Free" turf />
            </div>
            <p className="text-[12px] text-[var(--cf-muted)]">Football and Cricket share Fields 1–2.</p>
          </>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-[var(--cf-bg-3)]">
              <span className="h-full bg-[var(--cf-accent)] transition-[width] duration-700" style={{ width: "62.5%", backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.45) 0 3px, transparent 3px 6px)" }} />
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--cf-fg-2)]">Held · School group · 25 places</span>
            </div>
            <p className="text-[12px] text-[var(--cf-muted)]">15 of 40 places left to sell.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({ b }: { b: { from: string; text: string } }) {
  return (
    <div className="cf-arrive rounded-[10px] border border-[var(--cf-line)] bg-[var(--cf-red-wash)] px-3 py-2 text-left">
      <p className="cf-label !text-[var(--cf-red)]">{b.from} · refused</p>
      <p className="mt-0.5 text-[13px] font-medium text-[var(--cf-fg)]">{b.text}</p>
    </div>
  );
}

/** A travelling dot along a path. `to` 0 or 1; `on` shows it. */
function Pulse({ d, to, on, tone = "ok" }: { d: string; to: 0 | 1; on: boolean; tone?: "ok" | "no" }) {
  return (
    <span
      className="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 rounded-full"
      style={{
        offsetPath: `path("${d}")`,
        offsetDistance: `${to * 100}%`,
        opacity: on ? 1 : 0,
        background: tone === "ok" ? "var(--cf-accent)" : "var(--cf-red)",
        transition: on ? "offset-distance 750ms var(--cf-ease-in-out), opacity 150ms" : "none",
      }}
    />
  );
}

export function EngineDiagram() {
  const { ref, step, w, turf, state, active, bubble } = useStory();
  const wide = w >= 880;
  const s = Math.min(1, (w || 1000) / 1000);
  const sold = step === 3 || step === 4 || step === 5;
  const outLit = step >= 3 && step <= 5;

  return (
    <div ref={ref} aria-hidden className="cf-dots relative overflow-hidden rounded-2xl border border-[var(--cf-line)]" style={wide || !w ? { height: 420 * s } : undefined}>
      {wide || !w ? (
        <div className="absolute left-0 top-0" style={{ width: 1000, height: 420, transform: `scale(${s})`, transformOrigin: "top left" }}>
          <svg className="absolute inset-0" width="1000" height="420" fill="none">
            {SRC_Y.map((_, i) => (
              <path key={i} d={srcPath(i)} stroke={active === i ? "var(--cf-fg-2)" : "var(--cf-line-2)"} strokeWidth="1.5" style={{ transition: "stroke 400ms" }} />
            ))}
            {OUT_Y.map((_, i) => (
              <path key={i} d={outPath(i)} stroke={outLit ? "var(--cf-fg-2)" : "var(--cf-line-2)"} strokeWidth="1.5" style={{ transition: "stroke 400ms" }} />
            ))}
          </svg>
          {SOURCES.map(({ name, Icon }, i) => (
            <Chip key={name} lit={active === i} className="absolute h-11 w-[220px]" style={{ left: 0, top: SRC_Y[i] - 22 }}>
              <Icon size={15} strokeWidth={1.7} className="text-[var(--cf-muted)]" />
              {name}
            </Chip>
          ))}
          <div className="absolute" style={{ left: 390, top: 92, width: 220 }}>
            <EngineNode turf={turf} state={state} />
          </div>
          {OUTCOMES.map(({ name, Icon, line }, i) => (
            <Chip key={name} lit={outLit} className="absolute h-14 w-[220px]" style={{ left: 780, top: OUT_Y[i] - 28 }}>
              <Icon size={15} strokeWidth={1.7} className="text-[var(--cf-muted)]" />
              <span className="min-w-0">
                <span className="block leading-tight">{name}</span>
                <span className="block truncate text-[12px] font-normal text-[var(--cf-muted)]">{outLit ? line : "Updates live"}</span>
              </span>
              {outLit && <Check size={14} strokeWidth={2.2} className="cf-pop ml-auto shrink-0 text-[var(--cf-green)]" />}
            </Chip>
          ))}
          {/* pulses */}
          <Pulse d={srcPath(0)} to={step >= 1 ? 1 : 0} on={step === 1} />
          <Pulse d={srcPath(2)} to={step === 5 ? 0 : 1} on={step === 4 || step === 5} tone="no" />
          <Pulse d={srcPath(1)} to={step === 7 ? 0 : 1} on={step === 6 || step === 7} tone="no" />
          {OUT_Y.map((_, i) => (
            <Pulse key={i} d={outPath(i)} to={sold && step === 3 ? 1 : 0} on={step === 3} />
          ))}
          {bubble && (
            <div className="absolute w-[300px]" style={{ left: 350, top: 336 }}>
              <Bubble b={bubble} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0 p-4">
          <div className="grid w-full max-w-[460px] grid-cols-2 gap-2">
            {SOURCES.map(({ name, Icon }, i) => (
              <Chip key={name} lit={active === i} className="min-h-11 py-2 text-[12px] leading-tight">
                <Icon size={14} strokeWidth={1.7} className="shrink-0 text-[var(--cf-muted)]" />
                {name}
              </Chip>
            ))}
          </div>
          <Wire on={step === 1 || step === 4 || step === 6} back={step === 5 || step === 7} />
          <div className="w-full max-w-[300px]">
            <EngineNode turf={turf} state={state} />
          </div>
          <div className="mt-3 min-h-[64px] w-full max-w-[340px]">{bubble && <Bubble b={bubble} />}</div>
          <Wire on={step === 3} back={false} />
          <div className="grid w-full max-w-[460px] grid-cols-1 gap-2 sm:grid-cols-3">
            {OUTCOMES.map(({ name, Icon, line }) => (
              <Chip key={name} lit={outLit} className="min-h-12 py-2">
                <Icon size={14} strokeWidth={1.7} className="shrink-0 text-[var(--cf-muted)]" />
                <span className="min-w-0">
                  <span className="block leading-tight">{name}</span>
                  <span className="block text-[12px] font-normal leading-tight text-[var(--cf-muted)]">{outLit ? line : "Updates live"}</span>
                </span>
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Wire({ on, back }: { on: boolean; back: boolean }) {
  return (
    <div className="relative h-8 w-px bg-[var(--cf-line-2)]">
      <span
        className="absolute -left-[4.5px] top-0 h-2.5 w-2.5 rounded-full"
        style={{
          background: back ? "var(--cf-red)" : "var(--cf-accent)",
          opacity: on || back ? 1 : 0,
          transform: `translateY(${on ? 22 : 0}px)`,
          transition: "transform 750ms var(--cf-ease-in-out), opacity 150ms",
        }}
      />
    </div>
  );
}
