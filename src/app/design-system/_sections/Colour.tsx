"use client";

import { Callout, DocSection, P, SectionHeader, Small, Sub } from "../_components/Doc";
import { ContrastTable } from "../_components/ContrastTable";
import { usePreviewVar } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

/* Ramp classes are written out in full on purpose: Tailwind only emits a theme
   variable (and so a value to read) when a utility that uses it appears in the
   source, and a swatch drawn with the class doubles as a wiring test. */
type Step = readonly [step: string, cls: string];
const BRAND: Step[] = [["50", "bg-brand-50"], ["100", "bg-brand-100"], ["200", "bg-brand-200"], ["300", "bg-brand-300"], ["400", "bg-brand-400"], ["500", "bg-brand-500"], ["600", "bg-brand-600"], ["700", "bg-brand-700"], ["800", "bg-brand-800"], ["900", "bg-brand-900"], ["950", "bg-brand-950"]];
const NEUTRAL: Step[] = [["50", "bg-neutral-50"], ["100", "bg-neutral-100"], ["150", "bg-neutral-150"], ["200", "bg-neutral-200"], ["300", "bg-neutral-300"], ["400", "bg-neutral-400"], ["500", "bg-neutral-500"], ["600", "bg-neutral-600"], ["650", "bg-neutral-650"], ["700", "bg-neutral-700"], ["800", "bg-neutral-800"], ["850", "bg-neutral-850"], ["875", "bg-neutral-875"], ["900", "bg-neutral-900"], ["950", "bg-neutral-950"]];
const GREEN: Step[] = [["50", "bg-green-50"], ["100", "bg-green-100"], ["200", "bg-green-200"], ["300", "bg-green-300"], ["400", "bg-green-400"], ["500", "bg-green-500"], ["600", "bg-green-600"], ["700", "bg-green-700"], ["800", "bg-green-800"], ["900", "bg-green-900"], ["950", "bg-green-950"]];
const AMBER: Step[] = [["50", "bg-amber-50"], ["100", "bg-amber-100"], ["200", "bg-amber-200"], ["300", "bg-amber-300"], ["400", "bg-amber-400"], ["500", "bg-amber-500"], ["600", "bg-amber-600"], ["700", "bg-amber-700"], ["800", "bg-amber-800"], ["900", "bg-amber-900"], ["950", "bg-amber-950"]];
const RED: Step[] = [["50", "bg-red-50"], ["100", "bg-red-100"], ["200", "bg-red-200"], ["300", "bg-red-300"], ["400", "bg-red-400"], ["500", "bg-red-500"], ["600", "bg-red-600"], ["700", "bg-red-700"], ["800", "bg-red-800"], ["900", "bg-red-900"], ["950", "bg-red-950"]];
const BLUE: Step[] = [["50", "bg-blue-50"], ["100", "bg-blue-100"], ["200", "bg-blue-200"], ["300", "bg-blue-300"], ["400", "bg-blue-400"], ["500", "bg-blue-500"], ["600", "bg-blue-600"], ["700", "bg-blue-700"], ["800", "bg-blue-800"], ["900", "bg-blue-900"], ["950", "bg-blue-950"]];
const VIOLET: Step[] = [["400", "bg-violet-400"], ["600", "bg-violet-600"]];

function RampStep({ ramp, step, cls }: { ramp: string; step: string; cls: string }) {
  const value = usePreviewVar(`--color-${ramp}-${step}`);
  return (
    <li className="flex min-w-0 flex-col gap-inline">
      <span aria-hidden className={`${cls} block h-12 rounded-sm border border-line`} />
      <span className="text-xs font-medium text-fg">{step}</span>
      <span className="truncate font-mono text-xs text-muted" title={value || undefined}>
        {value || "—"}
      </span>
    </li>
  );
}

function Ramp({ title, ramp, steps, note }: { title: string; ramp: string; steps: Step[]; note?: string }) {
  return (
    <Sub title={title}>
      {note && <Small>{note}</Small>}
      <ul className="grid grid-cols-4 gap-tight sm:grid-cols-6 lg:grid-cols-8">
        {steps.map(([step, cls]) => (
          <RampStep key={step} ramp={ramp} step={step} cls={cls} />
        ))}
      </ul>
    </Sub>
  );
}

const SEMANTIC: TokenRow[] = [
  { group: "Surfaces" },
  { name: "--color-surface", utility: "bg-surface", note: "The page ground." },
  { name: "--color-card", utility: "bg-card", note: "Cards and panels." },
  { name: "--color-chrome", utility: "bg-chrome", note: "The rail and the top bar." },
  { name: "--color-sheet", utility: "bg-sheet", note: "Menus, popovers and sheets." },
  { name: "--color-subtle", utility: "bg-subtle", note: "A fill inside a card." },
  { name: "--color-muted-wash", utility: "bg-muted-wash", note: "Hover and pressed fill." },
  { name: "--color-offtime", utility: "bg-offtime", note: "Calendar time that cannot be sold." },
  { group: "Text" },
  { name: "--color-fg", utility: "text-fg", note: "Foreground." },
  { name: "--color-muted", utility: "text-muted", note: "Supporting text." },
  // ds-exception: this row documents the faint token; it is a name in a table, not text coloured faint
  { name: "--color-faint", utility: "text-faint", note: "Disabled and placeholder only, never content." },
  { name: "--color-inverse", utility: "bg-inverse", note: "Inverse surface." },
  { name: "--color-inverse-fg", utility: "text-inverse-fg", note: "Text on the inverse surface." },
  { group: "Lines" },
  { name: "--color-line", utility: "border-line", note: "A component's edge; an input." },
  { name: "--color-strong", utility: "border-strong", note: "Hover, or an emphasised edge." },
  { name: "--color-hairline", utility: "border-hairline", note: "Divider between rows." },
  { group: "Brand" },
  { name: "--color-ink", utility: "bg-ink", note: "The deepest neutral." },
  { name: "--color-paper", utility: "bg-paper", note: "The lightest neutral." },
  { name: "--color-ember", utility: "bg-ember", note: "Accent: marks, dots, stripes. Never a fill behind text." },
  { name: "--color-ember-solid", utility: "bg-ember-solid", note: "The primary fill. White text sits on it." },
  { name: "--color-ember-wash", utility: "bg-ember-wash", note: "A tint of the accent." },
  { name: "--color-brand-foreground", utility: "text-brand-foreground", note: "Brand-coloured text and links." },
  { name: "--color-ring", utility: "ring-ring", note: "The focus ring." },
  { name: "--color-on-solid", utility: "text-on-solid", note: "Text on any -solid fill." },
  { group: "Status text" },
  { name: "--color-success", utility: "text-success" },
  { name: "--color-warning", utility: "text-warning" },
  { name: "--color-danger", utility: "text-danger" },
  { name: "--color-info", utility: "text-info" },
  { name: "--color-market", utility: "text-market", note: "The marketplace axis." },
  { group: "Status washes" },
  { name: "--color-success-wash", utility: "bg-success-wash" },
  { name: "--color-warning-wash", utility: "bg-warning-wash" },
  { name: "--color-danger-wash", utility: "bg-danger-wash" },
  { name: "--color-market-wash", utility: "bg-market-wash" },
  { group: "Status solids (white text on them)" },
  { name: "--color-success-solid", utility: "bg-success-solid" },
  { name: "--color-danger-solid", utility: "bg-danger-solid" },
  { name: "--color-market-solid", utility: "bg-market-solid" },
];

const CHARTS: TokenRow[] = [
  { group: "Categorical, in a fixed order" },
  { name: "--chart-1" },
  { name: "--chart-2" },
  { name: "--chart-3" },
  { name: "--chart-4" },
  { group: "Spending breakdown" },
  { name: "--chart-cat-1" },
  { name: "--chart-cat-2" },
  { name: "--chart-cat-3" },
  { name: "--chart-cat-4" },
  { name: "--chart-cat-other", note: "Reads as “the rest”." },
  { group: "Heat, one hue by quantile" },
  { name: "--heat-1" },
  { name: "--heat-2" },
  { name: "--heat-3" },
  { name: "--heat-4" },
  { name: "--heat-5" },
  { name: "--heat-6" },
];

export function ColourSection() {
  return (
    <>
      <SectionHeader slug="colour" />

      <DocSection id="architecture" title="Three layers">
        <P>
          A layer only ever points at the one beneath it. <strong className="font-semibold">Primitives</strong> are the raw ramps, named by value and never used in components.{" "}
          <strong className="font-semibold">Semantic roles</strong> are named by purpose, point at a primitive and change with the mode.{" "}
          <strong className="font-semibold">Component tokens</strong> change with the product. This page covers the first two; the third is on Radius and Elevation.
        </P>
      </DocSection>

      <DocSection id="primitives" title="Primitive ramps">
        <P>Fixed values. They do not change with mode or product, so they are shown on the page itself rather than in a preview.</P>
        <Ramp title="Brand" ramp="brand" steps={BRAND} note="Hue 18°, derived from the accent. 500 is the accent; 600 is the primary fill; 700 is brand text." />
        <Ramp title="Neutral" ramp="neutral" steps={NEUTRAL} note="A warm grey. 50 is the paper ground, 950 the ink." />
        <Ramp title="Green" ramp="green" steps={GREEN} note="Success." />
        <Ramp title="Amber" ramp="amber" steps={AMBER} note="Warning." />
        <Ramp title="Red" ramp="red" steps={RED} note="Danger, destructive." />
        <Ramp title="Blue" ramp="blue" steps={BLUE} note="Info." />
        <Ramp title="Violet" ramp="violet" steps={VIOLET} note="The marketplace axis only." />
      </DocSection>

      <DocSection id="roles" title="Semantic roles">
        <P>
          These are the names components use. Switch the mode or product in the top bar and the values below re-read from the browser — in dark, <code className="font-mono text-sm">card</code> and{" "}
          <code className="font-mono text-sm">subtle</code> are different steps, and the accent lifts one region so it stays legible on ink.
        </P>
        <TokenTable rows={SEMANTIC} sample="colour" label="Semantic colour tokens" />
        <Callout title="Two fills for one orange">
          <strong className="font-semibold">ember</strong> is the accent: marks, dots, stripes and the focus ring. It is 3.50:1 under white, so it is never the fill behind text — that is{" "}
          <strong className="font-semibold">ember-solid</strong>, which is pinned and does not lift in dark. Both are measured below.
        </Callout>
      </DocSection>

      <DocSection id="data-viz" title="Chart and heat palettes">
        <P>Charts are the one place hues outside the semantic set are allowed. The slots are assigned in a fixed order and never cycled, and every chart ships direct labels.</P>
        <TokenTable rows={CHARTS} sample="colour" label="Chart and heat tokens" />
      </DocSection>

      <DocSection id="contrast" title="Contrast, measured">
        <P>
          Body text needs 4.5:1; large text and UI marks need 3:1, in both modes. The ratios below are computed from the live tokens in the active preview — change the mode and they change.
        </P>
        <ContrastTable
          rows={[
            { fg: "--color-fg", bg: "--color-card", label: "Body text on a card", need: 4.5 },
            { fg: "--color-muted", bg: "--color-card", label: "Supporting text on a card", need: 4.5 },
            { fg: "--color-muted", bg: "--color-surface", label: "Supporting text on the page", need: 4.5 },
            { fg: "--color-faint", bg: "--color-card", label: "Faint on a card", need: 4.5, expectFail: true, note: "Disabled controls and placeholders only — never content." },
            { fg: "--color-brand-foreground", bg: "--color-card", label: "Brand text and links on a card", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-ember-solid", label: "White on the primary fill", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-danger-solid", label: "White on the destructive fill", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-success-solid", label: "White on the success fill", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-market-solid", label: "White on the marketplace fill", need: 4.5 },
            { fg: "--color-on-solid", bg: "--color-ember", label: "White on the accent", need: 4.5, expectFail: true, note: "Why the accent is never a fill behind text." },
            { fg: "--color-ember", bg: "--color-card", label: "The accent on a card", need: 3, note: "A mark, not text." },
            { fg: "--color-fg", bg: "--color-success-wash", label: "Body text on a success wash", need: 4.5 },
            { fg: "--color-fg", bg: "--color-danger-wash", label: "Body text on a danger wash", need: 4.5 },
          ]}
        />
        <Small>Rows marked “Below” on purpose say so in their note; every other row must pass in both modes.</Small>
      </DocSection>
    </>
  );
}
