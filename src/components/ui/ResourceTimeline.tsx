"use client";

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
  const ticks: number[] = [];
  for (let m = Math.ceil(openMin / 60) * 60; m <= closeMin; m += 60) ticks.push(m);

  return (
    <div>
      <div className={`relative h-8 overflow-hidden rounded-xs border border-line ${hatched ? "bg-[repeating-linear-gradient(45deg,#D6D4CE,#D6D4CE_2px,transparent_2px,transparent_6px)]" : "bg-card"}`}>
        {spans.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={onBlockTap ? () => onBlockTap(s) : undefined}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden bg-line font-mono text-[12px] text-muted"
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
        {ticks.map((m) => (
          <span key={m} className="absolute -translate-x-1/2 font-mono text-[12px] text-faint" style={{ left: pct(m) }}>{Math.floor(m / 60)}</span>
        ))}
      </div>
    </div>
  );
}
