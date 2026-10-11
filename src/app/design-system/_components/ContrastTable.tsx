"use client";

import { cn } from "@/lib/cn";
import { contrast, ratioLabel } from "./colour";
import { Preview, usePreviewVar } from "./Preview";

/**
 * Contrast, measured from the live tokens.
 *
 * Each row takes a foreground and a background custom property, reads both from
 * INSIDE the active preview (so it changes with OS/POS and Light/Dark), parses
 * them with the browser's own colour parser and computes the WCAG ratio. The
 * thresholds are the product's: 4.5:1 for text, 3:1 for large text and UI.
 */

export interface ContrastDef {
  /** Foreground custom property. */
  fg: string;
  /** Background custom property. */
  bg: string;
  /** Plain-words label for the pairing. */
  label: string;
  /** The ratio it has to clear. */
  need: 3 | 4.5;
  /** What the pair is for — or why it must not be used. */
  note?: string;
  /** A pair that is intentionally below its ratio (and says why in `note`). */
  expectFail?: boolean;
}

function Row({ d }: { d: ContrastDef }) {
  const fg = usePreviewVar(d.fg);
  const bg = usePreviewVar(d.bg);
  const ratio = fg && bg ? contrast(fg, bg) : null;
  const pass = ratio != null && ratio >= d.need;
  const verdict = ratio == null ? "—" : pass ? `Passes ${d.need}:1` : `Below ${d.need}:1`;

  return (
    <tr className="border-b border-hairline last:border-0 max-md:grid max-md:grid-cols-[3.5rem_minmax(0,1fr)] max-md:gap-x-comfortable max-md:py-comfortable">
      <td className="w-20 px-section py-comfortable align-middle max-md:row-span-3 max-md:p-0">
        <span
          aria-hidden
          className="flex h-9 w-14 items-center justify-center rounded-sm border border-strong text-base font-semibold"
          style={{ background: `var(${d.bg})`, color: `var(${d.fg})` }}
        >
          Aa
        </span>
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        <p className="text-sm font-medium text-fg">{d.label}</p>
        <p className="font-mono text-xs text-muted">
          {d.fg} on {d.bg}
        </p>
        {d.note && <p className="text-xs text-muted">{d.note}</p>}
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        <span className="font-mono text-sm tabular-nums text-fg">{ratioLabel(ratio)}</span>
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        <span
          className={cn(
            "inline-flex rounded-full px-tight py-inline text-xs font-medium",
            ratio == null ? "bg-subtle text-muted" : pass ? "bg-success-wash text-success" : d.expectFail ? "bg-warning-wash text-warning" : "bg-danger-wash text-danger",
          )}
        >
          {verdict}
        </span>
      </td>
    </tr>
  );
}

export function ContrastTable({ rows, className }: { rows: ContrastDef[]; className?: string }) {
  return (
    <Preview flush label="Contrast, measured live" className={className}>
      <table className="w-full text-left text-sm">
        <thead className="max-md:sr-only">
          <tr className="border-b border-hairline text-muted">
            <th scope="col" className="w-20 px-section py-tight font-medium">
              Sample
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Pairing
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Ratio
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <Row key={`${d.fg}|${d.bg}`} d={d} />
          ))}
        </tbody>
      </table>
    </Preview>
  );
}
