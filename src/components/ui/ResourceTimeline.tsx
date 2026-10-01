"use client";

import { formatClockMin } from "@/lib/format";

export interface TimelineSpan {
  start: number; // minutes from midnight
  end: number;
  label: string; // "Reyes (4)" / "Walk-in (2)"
}

/** The day at a glance for one resource: occupied blocks with party labels,
 *  DM Mono hour ticks, and (optionally) the current selection drawn live in
 *  ember. Shared between the POS flexible sheet and the OS Calendar day view —
 *  manager and counter see the same picture. */
export function ResourceTimeline({
  spans,
  openMin,
  closeMin,
  sel,
  hatched = false, // out-of-service treatment
  onBlockTap,
}: {
  spans: TimelineSpan[];
  openMin: number;
  closeMin: number;
  sel?: { start: number; end: number } | null;
  hatched?: boolean;
  onBlockTap?: (span: TimelineSpan) => void;
}) {
  const total = Math.max(1, closeMin - openMin);
  const pct = (m: number) => `${((m - openMin) / total) * 100}%`;
  /* Hour ticks read 12-hour ("2 PM"), which is wider than the bare "14" they
     replaced — so a long trading day labels every second or third hour rather
     than letting the labels run into each other. */
  const hours = Math.floor((closeMin - Math.ceil(openMin / 60) * 60) / 60) + 1;
  const every = hours > 12 ? 3 : hours > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let m = Math.ceil(openMin / 60) * 60; m <= closeMin; m += 60 * every) ticks.push(m);

  return (
    <div>
      <div className={`relative h-8 overflow-hidden rounded-xs border border-line ${hatched ? "bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_6px)]" : "bg-card"}`}>
        {spans.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={onBlockTap ? () => onBlockTap(s) : undefined}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden bg-line font-mono text-[0.75rem] text-muted"
            style={{ left: pct(s.start), width: pct(s.end - s.start + openMin) }}
            title={s.label}
            tabIndex={onBlockTap ? 0 : -1}
          >
            <span className="truncate px-inline">{s.label}</span>
          </button>
        ))}
        {sel && (
          <span className="pointer-events-none absolute inset-y-0 bg-ember/70" style={{ left: pct(sel.start), width: pct(sel.end - sel.start + openMin) }} aria-hidden />
        )}
      </div>
      <div className="relative mt-inline h-3">
        {/* A label centred on a tick at either end of the strip hangs half off
            it, so the end ones are anchored inward instead. */}
        {ticks.map((m) => {
          const at = (m - openMin) / total;
          const shift = at < 0.04 ? "translate-x-0" : at > 0.96 ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <span key={m} className={`absolute ${shift} whitespace-nowrap font-mono text-[0.75rem] text-muted`} style={{ left: pct(m) }}>{formatClockMin(m, { short: true })}</span>
          );
        })}
      </div>
    </div>
  );
}
