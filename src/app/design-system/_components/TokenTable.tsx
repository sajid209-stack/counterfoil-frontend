"use client";

import { cn } from "@/lib/cn";
import { CopyButton } from "./CopyButton";
import { Preview, useRootPx, usePreviewVar } from "./Preview";

/**
 * A table of design tokens that reads its own values.
 *
 * Each row names a CSS custom property and draws it; the value beside it is
 * `getComputedStyle(preview).getPropertyValue(name)` taken from INSIDE the
 * active preview wrapper, so it changes with OS/POS and Light/Dark and can never
 * drift from globals.css. A token the stylesheet did not emit (Tailwind drops
 * theme variables nothing uses) reads "—" rather than a made-up value.
 */

export type TokenSample = "colour" | "text" | "radius" | "shadow" | "space" | "none";

export interface TokenDef {
  /** The custom property: `--color-card`. */
  name: string;
  /** The Tailwind utility that reaches it: `bg-card`. */
  utility?: string;
  /** One line under the name — what the token is for. */
  note?: string;
}
export type TokenRow = TokenDef | { group: string };

const isGroup = (r: TokenRow): r is { group: string } => "group" in r;

/** The utility a token reaches when a row does not name one: Tailwind v4 maps a
 *  theme namespace straight onto its utility family. Tokens outside a
 *  namespace (--elevation-*, --chart-*) have none, and say so with a dash. */
function utilityFor(name: string): string | undefined {
  const m = /^--(color|radius|shadow|text|spacing|tracking|font)-(.+)$/.exec(name);
  if (!m || m[2].includes("--")) return undefined;
  const [, ns, key] = m;
  switch (ns) {
    case "color": return `bg-${key} · text-${key} · border-${key}`;
    case "radius": return `rounded-${key}`;
    case "shadow": return `shadow-${key}`;
    case "text": return `text-${key}`;
    case "spacing": return `p-${key} · gap-${key}`;
    case "tracking": return `tracking-${key}`;
    case "font": return `font-${key}`;
  }
}

/** "0.8125rem" → "13px" at the live root size. */
function withPx(value: string, rootPx: number): string {
  const m = /^(-?\d*\.?\d+)rem$/.exec(value);
  if (!m) return value;
  const px = parseFloat(m[1]) * rootPx;
  return `${value} · ${Number.isInteger(px) ? px : px.toFixed(1)}px`;
}

function Sample({ name, kind }: { name: string; kind: TokenSample }) {
  switch (kind) {
    case "colour":
      return <span aria-hidden className="block h-8 w-8 rounded-sm border border-strong" style={{ background: `var(${name})` }} />;
    case "text":
      return (
        <span aria-hidden className="block text-fg" style={{ fontSize: `var(${name})`, lineHeight: `var(${name}--line-height)` }}>
          Aa
        </span>
      );
    case "radius":
      return <span aria-hidden className="block h-8 w-8 border border-strong bg-subtle" style={{ borderRadius: `var(${name})` }} />;
    case "shadow":
      return <span aria-hidden className="block h-8 w-8 rounded-sm bg-card" style={{ boxShadow: `var(${name})` }} />;
    case "space":
      return <span aria-hidden className="block h-3 rounded-xs bg-ember-solid" style={{ width: `var(${name})` }} />;
    default:
      return null;
  }
}

function Row({ def, kind }: { def: TokenDef; kind: TokenSample }) {
  const value = usePreviewVar(def.name);
  const lineHeight = usePreviewVar(kind === "text" ? `${def.name}--line-height` : "--ds-none");
  const rootPx = useRootPx();
  const shown = value ? [withPx(value, rootPx), kind === "text" && lineHeight ? `/ ${withPx(lineHeight, rootPx)}` : ""].filter(Boolean).join(" ") : "";

  return (
    <tr className="border-b border-hairline last:border-0 max-md:grid max-md:grid-cols-[3rem_minmax(0,1fr)] max-md:gap-x-comfortable max-md:py-comfortable">
      <td className="w-16 px-section py-comfortable align-middle max-md:row-span-3 max-md:w-auto max-md:p-0">
        {kind !== "none" && <Sample name={def.name} kind={kind} />}
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        <div className="flex items-center gap-inline">
          <code className="min-w-0 break-all font-mono text-sm text-fg">{def.name}</code>
          <CopyButton text={def.name} label={def.name} />
        </div>
        {def.note && <p className="text-xs text-muted">{def.note}</p>}
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        <span className="mr-inline text-xs text-muted md:hidden">Value</span>
        {shown ? (
          <span className="inline-flex items-center gap-inline">
            <code className="min-w-0 break-words font-mono text-sm text-fg">{shown}</code>
            <CopyButton text={value} label={`value of ${def.name}`} />
          </span>
        ) : (
          <span className="text-sm text-muted" title="The stylesheet did not emit this token (nothing uses it).">
            —
          </span>
        )}
      </td>
      <td className="px-section py-comfortable align-top max-md:p-0">
        {(def.utility ?? utilityFor(def.name)) ? <code className="break-all font-mono text-sm text-muted">{def.utility ?? utilityFor(def.name)}</code> : <span className="text-sm text-muted">—</span>}
      </td>
    </tr>
  );
}

export function TokenTable({
  rows,
  sample = "colour",
  label = "Live values",
  className,
}: {
  rows: TokenRow[];
  sample?: TokenSample;
  /** The caption's extra word — what is being read. */
  label?: string;
  className?: string;
}) {
  return (
    <Preview flush label={label} className={className}>
      <table className="w-full text-left text-sm">
        <thead className="max-md:sr-only">
          <tr className="border-b border-hairline text-muted">
            <th scope="col" className="w-16 px-section py-tight font-medium">
              Sample
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Token
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Computed value
            </th>
            <th scope="col" className="px-section py-tight font-medium">
              Tailwind
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) =>
            isGroup(r) ? (
              <tr key={`g-${r.group}-${i}`} className="bg-subtle">
                <th scope="colgroup" colSpan={4} className={cn("px-section py-tight text-left text-sm font-semibold text-fg max-md:block")}>
                  {r.group}
                </th>
              </tr>
            ) : (
              <Row key={r.name} def={r} kind={sample} />
            ),
          )}
        </tbody>
      </table>
    </Preview>
  );
}
