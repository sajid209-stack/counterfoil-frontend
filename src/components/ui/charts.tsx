"use client";

import { useState } from "react";

/* Lightweight SVG charts on the token palette — ember for the primary series,
   neutrals for comparison. Every chart: hover tooltip with exact figures in
   DM Mono, and an inherited empty state handled by the caller. */

export interface ChartPoint {
  label: string;
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
