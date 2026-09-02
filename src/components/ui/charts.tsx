"use client";

import { useEffect, useId, useRef, useState } from "react";

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
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xs border border-line bg-card px-tight py-inline font-mono text-[11px] tabular-nums shadow-sm" style={{ left: tip.x, top: tip.y - 30 }}>
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
          <p className="text-[12px] text-faint">{active.title ?? active.label}</p>
          <p className="whitespace-nowrap text-[13px] font-medium">{fmt(active.value)}</p>
          {active.compare != null && (
            <p className="whitespace-nowrap text-[12px] text-muted">{fmt(active.compare)}</p>
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
              <text x={padL - 10} y={y(v) + 4} textAnchor="end" className="fill-[var(--color-muted)] text-[12px]">
                {axis(v)}
              </text>
            </g>
          ))}

          {hasCompare && <path d={line((p) => p.compare)} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" />}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line((p) => p.value)} fill="none" stroke="var(--color-ember)" strokeWidth="2" strokeLinejoin="round" />

          {points.map((p, i) => (i % every === 0 || i === points.length - 1 ? (
            <text key={`x${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--color-muted)] text-[12px]">
              {p.label}
            </text>
          ) : null))}

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
          <span className="flex items-center gap-inline text-[12px] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />{valueLabel}
          </span>
          <span className="flex items-center gap-inline text-[12px] text-muted">
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
          <text key={`l${i}`} x={x(i)} y={h - 1} textAnchor="middle" className="fill-[var(--color-faint)] font-mono text-[9px]">{p.label}</text>
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
                <text x={pad + i * bw + bw / 2} y={h - 2} textAnchor="middle" className="fill-[var(--color-faint)] font-mono text-[8px]">{p.label}</text>
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
          <span className="w-40 min-w-0 shrink-0 truncate text-[12px]">{p.label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-xs bg-line"><span className="block h-full rounded-xs bg-ember" style={{ width: `${(p.value / max) * 100}%` }} /></span>
          <span className="w-24 shrink-0 whitespace-nowrap text-right font-mono text-[11px] tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut with a legend carrying amounts and percentages. */
export function DonutChart({ points, fmt }: { points: ChartPoint[]; fmt: (v: number) => string }) {
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  const colors = ["var(--color-ember)", "var(--color-fg)", "var(--color-strong)", "var(--color-faint)", "var(--color-line)", "var(--color-muted)"];
  const r = 42, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-section">
      <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0" role="img">
        {points.map((p, i) => {
          const frac = p.value / total;
          const seg = (
            <circle key={p.label} cx="55" cy="55" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="14"
              strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-acc * c} transform="rotate(-90 55 55)">
              <title>{`${p.label} · ${fmt(p.value)} · ${Math.round(frac * 100)}%`}</title>
            </circle>
          );
          acc += frac;
          return seg;
        })}
      </svg>
      <div className="min-w-0 flex-1">
        {points.map((p, i) => (
          <div key={p.label} className="flex items-center gap-tight text-[12px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="whitespace-nowrap font-mono text-[11px] tabular-nums">{fmt(p.value)} · {Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
