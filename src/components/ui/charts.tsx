"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* Lightweight SVG charts on the token palette — ember for the primary series,
   neutrals for comparison. Every chart: hover tooltip with exact figures in
   DM Mono, and an inherited empty state handled by the caller. */

export interface ChartPoint {
  /** Short axis tick — kept terse because it repeats along the bottom. */
  label: string;
  /** Full name for the tooltip, where there is room to be unambiguous
   *  ("17 Jul" rather than a bare "17"). Falls back to `label`. */
  title?: string;
  value: number;
  compare?: number;
}

const useTip = () => {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const node = tip ? (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xs border border-line bg-card px-tight py-inline font-mono text-[0.75rem] tabular-nums shadow-sm" style={{ left: tip.x, top: tip.y - 30 }}>
      {tip.text}
    </div>
  ) : null;
  return { tip, setTip, node };
};

/** The rendered width in CSS pixels. The other charts here scale a fixed
 *  viewBox, which also scales their text — at 320px a 10px label renders at
 *  5px. A chart carrying an axis has to draw at 1:1 so the labels stay the
 *  size they were set in. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round the axis top up to a readable step so ticks land on 15k, not 14.7k. */
function niceScale(max: number, ticks: number) {
  if (!(max > 0)) return { top: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { top: step * ticks, step };
}

/**
 * The dashboard's revenue chart: a filled area for the current period over a
 * plain line for the one before it, on a labelled axis.
 *
 * Deliberately not a second copy of LineChart — the difference that matters is
 * the axis. A sparkline answers "which way is it going"; this answers "how
 * much, and against what", which needs gridlines and money on the left.
 */
export function AreaChart({
  points,
  fmt,
  fmtAxis,
  height = 260,
  ticks = 4,
  valueLabel,
  compareLabel,
  compareDashed = false,
}: {
  points: ChartPoint[];
  /** Exact value, for the tooltip. */
  fmt: (v: number) => string;
  /** Short value, for the axis. Defaults to `fmt`. */
  fmtAxis?: (v: number) => string;
  height?: number;
  ticks?: number;
  valueLabel: string;
  compareLabel?: string;
  /** Draws the comparison dashed, so it reads as "the period before" even
   *  where the two lines run close. The dashboard keeps it solid. */
  compareDashed?: boolean;
}) {
  const [box, w] = useWidth<HTMLDivElement>();
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const axis = fmtAxis ?? fmt;
  const hasCompare = points.some((p) => p.compare != null);

  // Gutters: left for the money labels, bottom for the period labels.
  // Gutters sized for 12px labels. They were 10px in DM Mono, which is below
  // the type spec's caption floor and rendered ৳ badly — the Bengali taka sign
  // is not in the UI face, so it falls through per-glyph, and at 10px the
  // substituted glyph crowded the digits beside it.
  const padL = 58, padR = 10, padT = 10, padB = 28;
  const plotW = Math.max(0, w - padL - padR);
  const plotH = Math.max(0, height - padT - padB);
  const { top, step } = niceScale(Math.max(...points.map((p) => Math.max(p.value, p.compare ?? 0)), 0), ticks);

  const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + (1 - v / top) * plotH;

  // The reference draws its series as smooth curves, not straight segments —
  // a monotone cubic, so the curve never overshoots into inventing a peak
  // between two points that the data does not contain. (A plain Catmull-Rom
  // would bulge past a local maximum and read as revenue nobody earned.)
  const curve = (get: (p: ChartPoint) => number | undefined) => {
    const pts = points.map((p, i) => [x(i), y(get(p) ?? 0)] as const);
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
    const slope: number[] = [];
    const d: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
    slope[0] = d[0];
    for (let i = 1; i < pts.length - 1; i++) {
      // A sign change is a turning point: flatten it so the curve turns there
      // rather than sailing through.
      slope[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    }
    slope[pts.length - 1] = d[d.length - 1];
    for (let i = 0; i < d.length; i++) {
      // Fritsch–Carlson limiter — keeps each segment monotone.
      if (d[i] === 0) { slope[i] = 0; slope[i + 1] = 0; continue; }
      const a = slope[i] / d[i], b = slope[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); slope[i] = tau * a * d[i]; slope[i + 1] = tau * b * d[i]; }
    }
    let path = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const h = (pts[i + 1][0] - pts[i][0]) / 3;
      path += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + slope[i] * h).toFixed(1)}`
            + ` ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - slope[i + 1] * h).toFixed(1)}`
            + ` ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return path;
  };
  const line = curve;
  const area = `${line((p) => p.value)} L${x(points.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  // Thin the x labels to what actually fits, so they never collide.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 52))));
  const gridline = Array.from({ length: ticks + 1 }, (_, i) => i * step);
  const active = hover != null ? points[hover] : null;

  return (
    <div ref={box} className="relative w-full">
      {/* Tooltip — follows the hovered column, flipping side near the edges so
          it never leaves the card. */}
      {active && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-xs border border-line bg-card px-tight py-inline shadow-sm"
          style={{
            left: Math.min(Math.max(x(hover!), 62), w - 62),
            top: 0,
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-[0.75rem] text-muted">{active.title ?? active.label}</p>
          <p className="whitespace-nowrap text-[0.8125rem] font-medium">{fmt(active.value)}</p>
          {active.compare != null && (
            <p className="whitespace-nowrap text-[0.75rem] text-muted">{fmt(active.compare)}</p>
          )}
        </div>
      )}

      {/* The svg is taken out of flow and sized from the box, never the other
          way round. Measuring a container that the svg itself can widen is a
          feedback loop: any ancestor with the default min-width:auto lets the
          drawing set the column width, which sets the drawing width. Absolute
          positioning means this chart contributes nothing to min-content and
          is safe to drop into a flex or grid child anywhere. */}
      <div className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg className="absolute left-0 top-0" width={w} height={height} role="img" aria-label={valueLabel}>
          <defs>
            {/* The fill is what makes this read as volume rather than a wire. */}
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridline.map((v) => (
            <g key={v}>
              <line
                x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)}
                stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 4"
              />
              <text x={padL - 10} y={y(v) + 4} textAnchor="end" className="fill-[var(--color-muted)] text-[0.75rem]">
                {axis(v)}
              </text>
            </g>
          ))}

          {hasCompare && <path d={line((p) => p.compare)} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeDasharray={compareDashed ? "5 4" : undefined} />}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line((p) => p.value)} fill="none" stroke="var(--color-ember)" strokeWidth="2" strokeLinejoin="round" />

          {/* The last label is always drawn so the axis states where it ends —
              but only if the previous one is not already there. Forcing it
              unconditionally printed "07-28" and "07-29" on top of each other
              at the right edge, which reads as one corrupt string. */}
          {points.map((p, i) => {
            const last = points.length - 1;
            const isTick = i % every === 0;
            const isLast = i === last;
            if (isLast && !isTick && last % every > last - every + 1) return null;
            if (!isTick && !isLast) return null;
            // The forced last label collides when the previous tick is within
            // one step of the end; drop the tick, keep the end.
            if (isTick && !isLast && last - i < every) return null;
            return (
              <text key={`x${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--color-muted)] text-[0.75rem]">
                {p.label}
              </text>
            );
          })}

          {/* Hover guide, drawn over the series so it reads as a cursor. */}
          {active && (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={padT + plotH} stroke="var(--color-strong)" strokeWidth="1" />
              {active.compare != null && <circle cx={x(hover!)} cy={y(active.compare)} r="3" fill="var(--color-muted)" />}
              <circle cx={x(hover!)} cy={y(active.value)} r="4" fill="var(--color-ember)" stroke="var(--color-card)" strokeWidth="1.5" />
            </g>
          )}

          {/* One hit column per point — a whole-height target, so the tooltip
              answers a vertical sweep rather than demanding the exact pixel. */}
          {points.map((p, i) => (
            <rect
              key={`h${i}`}
              x={x(i) - (plotW / Math.max(1, points.length - 1)) / 2}
              y={padT}
              width={Math.max(6, plotW / Math.max(1, points.length - 1))}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      </div>

      {/* A legend distinguishes series. With one series there is nothing to
          distinguish, and the swatch just restates the card's own title under
          the chart — so it appears only when a comparison is actually drawn.
          The series stays named for screen readers either way, via the svg's
          aria-label. */}
      {hasCompare && compareLabel && (
        <div className="mt-tight flex items-center gap-section">
          <span className="flex items-center gap-inline text-[0.75rem] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />{valueLabel}
          </span>
          <span className="flex items-center gap-inline text-[0.75rem] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />{compareLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/** Line chart with an optional dashed comparison series. */
export function LineChart({ points, fmt, height = 160 }: { points: ChartPoint[]; fmt: (v: number) => string; height?: number }) {
  const { setTip, node } = useTip();
  const w = 640, h = height, pad = 8;
  const max = Math.max(...points.map((p) => Math.max(p.value, p.compare ?? 0)), 1);
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2 - 12);
  const path = (get: (p: ChartPoint) => number | undefined) =>
    points.map((p, i) => (get(p) == null ? null : `${x(i)},${y(get(p)!)}`)).filter(Boolean).join(" ");
  return (
    <div className="relative">
      {node}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {points.some((p) => p.compare != null) && (
          <polyline points={path((p) => p.compare)} fill="none" stroke="var(--color-faint)" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
        <polyline points={path((p) => p.value)} fill="none" stroke="var(--color-ember)" strokeWidth="2" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)} cy={y(p.value)} r={8} fill="transparent"
            onMouseEnter={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: ((x(i)) / w) * r.width, y: (y(p.value) / h) * r.height, text: `${p.label} · ${fmt(p.value)}${p.compare != null ? ` (prev ${fmt(p.compare)})` : ""}` }); }}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        {points.map((p, i) => (points.length <= 14 || i % Math.ceil(points.length / 14) === 0 ? (
          <text key={`l${i}`} x={x(i)} y={h - 1} textAnchor="middle" className="fill-[var(--color-faint)] font-mono text-[0.75rem]">{p.label}</text>
        ) : null))}
      </svg>
    </div>
  );
}

/** Vertical bars. */
export function BarChart({ points, fmt, height = 140 }: { points: ChartPoint[]; fmt: (v: number) => string; height?: number }) {
  const { setTip, node } = useTip();
  const w = 320, h = height, pad = 4;
  const max = Math.max(...points.map((p) => p.value), 1);
  const bw = (w - pad * 2) / points.length;
  return (
    <div className="relative">
      {node}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {points.map((p, i) => {
          const bh = (p.value / max) * (h - 24);
          return (
            <g key={i}
              onMouseEnter={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: ((pad + i * bw + bw / 2) / w) * r.width, y: ((h - 12 - bh) / h) * r.height, text: `${p.label} · ${fmt(p.value)}` }); }}
              onMouseLeave={() => setTip(null)}
            >
              <rect x={pad + i * bw + 1} y={h - 12 - bh} width={Math.max(1, bw - 2)} height={bh} rx={2} className="fill-[var(--color-ember)]" opacity={p.value === 0 ? 0.15 : 1} />
              {(points.length <= 12 || i % 2 === 0) && (
                <text x={pad + i * bw + bw / 2} y={h - 2} textAnchor="middle" className="fill-[var(--color-faint)] font-mono text-[0.5rem]">{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Horizontal bars (top products). */
export function HBarChart({ points, fmt }: { points: ChartPoint[]; fmt: (v: number) => string }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex flex-col gap-tight">
      {points.map((p) => (
        <div key={p.label} className="flex items-center gap-tight" title={`${p.label} · ${fmt(p.value)}`}>
          <span className="w-40 min-w-0 shrink-0 truncate text-[0.75rem]">{p.label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-xs bg-line"><span className="block h-full rounded-xs bg-ember" style={{ width: `${(p.value / max) * 100}%` }} /></span>
          <span className="w-24 shrink-0 whitespace-nowrap text-right font-mono text-[0.75rem] tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut with a legend carrying amounts and percentages. */
export function DonutChart({
  points,
  fmt,
  otherLabel = "Other",
}: {
  points: ChartPoint[];
  fmt: (v: number) => string;
  /** What the fifth-and-beyond slice is called. */
  otherLabel?: string;
}) {
  /* Four slots, then "Other". A ninth series is never a generated hue, and a
     fifth here would have to reuse one — which makes two segments claim the
     same identity in the ring and the legend both. */
  const shown = points.length <= 4
    ? points
    : [
        ...points.slice(0, 3),
        {
          label: otherLabel,
          value: points.slice(3).reduce((sum, p) => sum + p.value, 0),
        },
      ];
  const total = shown.reduce((s, p) => s + p.value, 0) || 1;
  /* The four validated categorical slots, in fixed order and never cycled.
     A fifth category folds into "Other" rather than inventing a hue — see the
     token comment in globals.css for what the old neutral ramp measured. */
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  const r = 42, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-section">
      <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0" role="img">
        {shown.map((p, i) => {
          const frac = p.value / total;
          /* A 2px gap in the surface colour between neighbouring fills, so two
             segments never touch — the mark spec's separator, and the secondary
             encoding the 6–8 CVD band obliges. */
          const gap = shown.length > 1 ? 2 : 0;
          const seg = (
            <circle key={p.label} cx="55" cy="55" r={r} fill="none" stroke={colors[i]} strokeWidth="14"
              strokeDasharray={`${Math.max(0, frac * c - gap)} ${c}`} strokeDashoffset={-acc * c} transform="rotate(-90 55 55)">
              <title>{`${p.label} · ${fmt(p.value)} · ${Math.round(frac * 100)}%`}</title>
            </circle>
          );
          acc += frac;
          return seg;
        })}
      </svg>
      <div className="min-w-0 flex-1">
        {shown.map((p, i) => (
          <div key={p.label} className="flex items-center gap-tight text-[0.75rem]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i] }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="whitespace-nowrap font-mono text-[0.75rem] tabular-nums">{fmt(p.value)} · {Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Heatmap ───────────────────────────────────────────────────────────────
 *
 * A weekday-by-hour grid, one hue in six steps. The step of a cell is its
 * share rank among the NON-ZERO cells, not value over max: one very busy hour
 * would otherwise turn every other hour the palest tint and the grid would
 * answer only "where is the peak". Zero is not the first step; it is an
 * outlined empty cell, so "nobody" and "a few people" never read alike.
 *
 * Reading and reaching it:
 *  - Hovering a cell, or moving to it with the arrow keys, draws a tooltip.
 *  - The picture itself is aria-hidden: a focusable wrapper carries the arrow
 *    keys and an aria-live line says which cell is current, and a visually
 *    hidden table below carries every figure, in order, for a screen reader
 *    that browses rather than steps.
 *  - On a narrow screen the grid scrolls inside its own card, with the weekday
 *    column pinned. The pin only gets a solid ground once something has slid
 *    under it: a solid label column against a translucent card is a pale
 *    stripe, so it is earned, like the calendar's header rule.
 */
export interface HeatmapCell {
  /** 0..rows-1, in the order of `rowLabels`. */
  row: number;
  /** Index into `colLabels`. */
  col: number;
  value: number;
}

/* Written out, not built as `--heat-${n}` at render: Tailwind drops a theme
   variable whose full name never appears in the source, and a template literal
   never contains it. */
const HEAT = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)", "var(--heat-6)"];

export function HeatmapChart({
  rowLabels,
  colLabels,
  cells,
  cellText,
  labelEvery = 2,
  ariaLabel,
  caption,
  hint,
  legend,
}: {
  rowLabels: string[];
  colLabels: string[];
  cells: HeatmapCell[];
  /** What a cell says, for the tooltip and the live line: "Sat 2 PM · 14 guests". */
  cellText: (row: number, col: number, value: number) => string;
  /** Show a column label every this many columns. */
  labelEvery?: number;
  ariaLabel: string;
  caption: string;
  /** Said to a keyboard user as they reach the grid. */
  hint: string;
  legend: { fewer: string; more: string };
}) {
  const rows = rowLabels.length;
  const n = colLabels.length;
  const wrap = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<[number, number] | null>(null);
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const values = new Map<number, number>();
  for (const c of cells) values.set(c.row * n + c.col, c.value);
  const nonZero = [...values.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const stepOf = (v: number) => {
    if (!(v > 0)) return 0;
    let less = 0;
    let equal = 0;
    for (const x of nonZero) {
      if (x < v) less++;
      else if (x === v) equal++;
    }
    const rank = (less + equal / 2) / nonZero.length;
    return Math.min(6, Math.floor(rank * 6) + 1);
  };
  const busiest = (() => {
    let best = -1;
    let at: [number, number] = [0, 0];
    for (const [k, v] of values) if (v > best) { best = v; at = [Math.floor(k / n), k % n]; }
    return at;
  })();

  const showAt = (r: number, c: number) => {
    const el = refs.current[r * n + c];
    const box = wrap.current;
    if (!el || !box) return;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const x = Math.min(Math.max(a.left - b.left + a.width / 2, 70), Math.max(70, b.width - 70));
    setTip({ x, y: a.top - b.top, text: cellText(r, c, values.get(r * n + c) ?? 0) });
  };

  const move = (r: number, c: number) => {
    const nr = Math.min(rows - 1, Math.max(0, r));
    const nc = Math.min(n - 1, Math.max(0, c));
    setActive([nr, nc]);
    refs.current[nr * n + nc]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    showAt(nr, nc);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const [r, c] = active ?? busiest;
    const go: Record<string, [number, number]> = {
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      Home: [r, 0],
      End: [r, n - 1],
    };
    const to = go[e.key];
    if (!to) return;
    e.preventDefault();
    move(to[0], to[1]);
  };

  const current = hovered ?? active;
  const minWidth = 44 + n * 26 + n * 2;

  return (
    <div ref={wrap} className="relative">
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xs border border-line bg-card px-tight py-inline text-[0.75rem] font-medium shadow-sm"
          style={{ left: tip.x, top: tip.y - 4 }}
        >
          {tip.text}
        </div>
      )}
      <div className="overflow-x-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}>
        <div
          role="group"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-describedby={hintId}
          onKeyDown={onKey}
          onFocus={(e) => {
            // Only a keyboard arrival picks a cell for the user; a click lands
            // on the cell it hit.
            if (e.target === e.currentTarget && e.currentTarget.matches(":focus-visible")) move(busiest[0], busiest[1]);
          }}
          onBlur={() => { setActive(null); if (!hovered) setTip(null); }}
          onMouseLeave={() => { setHovered(null); setTip(null); }}
          data-focus-host
          className="rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
          style={{ minWidth }}
        >
          <div aria-hidden className="grid gap-[2px]" style={{ gridTemplateColumns: `44px repeat(${n}, minmax(24px, 1fr))` }}>
            <span className={cn("sticky left-0 z-[1]", scrolled && "bg-card")} />
            {colLabels.map((l, c) => (
              <span key={c} className="relative h-5">
                {c % labelEvery === 0 && (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[0.75rem] text-muted">{l}</span>
                )}
              </span>
            ))}
            {rowLabels.map((label, r) => (
              <Fragment key={r}>
                <span
                  className={cn(
                    "sticky left-0 z-[1] flex items-center pr-tight text-[0.75rem] text-muted",
                    scrolled && "bg-card shadow-[2px_0_0_var(--color-hairline)]",
                  )}
                >
                  {label}
                </span>
                {colLabels.map((_, c) => {
                  const v = values.get(r * n + c) ?? 0;
                  const step = stepOf(v);
                  const isCurrent = current != null && current[0] === r && current[1] === c;
                  const ring = isCurrent ? ", 0 0 0 2px var(--color-fg)" : "";
                  return (
                    <div
                      key={c}
                      ref={(el) => { refs.current[r * n + c] = el; }}
                      onMouseEnter={() => { setHovered([r, c]); showAt(r, c); }}
                      className="h-7 rounded-[3px]"
                      style={{
                        background: step ? HEAT[step - 1] : "transparent",
                        boxShadow: step
                          ? `inset 0 0 0 1px var(--heat-edge)${ring}`
                          : `inset 0 0 0 1px var(--color-hairline)${ring}`,
                      }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <span id={hintId} className="sr-only">{hint}</span>
      {/* The same figures, in order, for a screen reader that browses. */}
      {/* In a box of its own: a table ignores the width and overflow of the
          sr-only class, so on its own it stretches the page past the card. */}
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {colLabels.map((l, c) => <th key={c} scope="col">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((label, r) => (
            <tr key={r}>
              <th scope="row">{label}</th>
              {colLabels.map((_, c) => <td key={c}>{values.get(r * n + c) ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table></div>
      <span className="sr-only" aria-live="polite">{active ? cellText(active[0], active[1], values.get(active[0] * n + active[1]) ?? 0) : ""}</span>

      <div className="mt-comfortable flex items-center gap-tight text-[0.75rem] text-muted" aria-hidden>
        <span>{legend.fewer}</span>
        <span className="h-3 w-3 rounded-[3px]" style={{ boxShadow: "inset 0 0 0 1px var(--color-hairline)" }} />
        {HEAT.map((h) => (
          <span key={h} className="h-3 w-3 rounded-[3px]" style={{ background: h, boxShadow: "inset 0 0 0 1px var(--heat-edge)" }} />
        ))}
        <span>{legend.more}</span>
      </div>
    </div>
  );
}
